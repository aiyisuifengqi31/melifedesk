import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { getTheme } from "@/theme/registry";
import { readStoredColorMode, readStoredThemeId } from "@/auth/userSettings";
import type { UiTokens } from "@/shared/ui/primitives";

import { CameraView } from "./CameraView";
import { drawOverlay, type PortraitTemplate } from "./CameraOverlay";
import { PhotoPreview } from "./PhotoPreview";
import { analyzeFrame } from "./CompositionEngine";
import { chooseSide, guidanceFor, personBoxFromKeypoints, targetBox } from "./PortraitGuide";
import { detectPose, loadPoseDetector } from "./PoseDetector";
import { consumePendingCameraPhoto, setPendingCameraPhoto } from "./pendingCameraPhoto";
import type { CameraFacing, CameraMedia, CameraMode, CameraStatus, LandscapeGuidance, PortraitBody, PortraitGuidance, PortraitSide } from "./types";

const ANALYZE_W = 192;
const ANALYZE_H = 256;

export function SmartCameraScreen({ onExit }: { onExit?: () => void }) {
  const router = useRouter();
  const themeId = readStoredThemeId(typeof window === "undefined" ? undefined : window.localStorage) ?? "default";
  const mode = readStoredColorMode(typeof window === "undefined" ? undefined : window.localStorage) ?? "light";
  const tokens: UiTokens = useMemo(() => getTheme(themeId).tokens[mode], [themeId, mode]);

  const [cameraMode, setCameraMode] = useState<CameraMode>("landscape");
  const [facing, setFacing] = useState<CameraFacing>("environment");
  const [status, setStatus] = useState<CameraStatus>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [camKey, setCamKey] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);

  const [landscape, setLandscape] = useState<LandscapeGuidance | null>(null);
  const [portrait, setPortrait] = useState<PortraitGuidance | null>(null);

  const [portraitBody, setPortraitBody] = useState<PortraitBody>("full");
  const [sideOverride, setSideOverride] = useState<PortraitSide | null>(null);
  const [portraitTemplate, setPortraitTemplate] = useState<PortraitTemplate>("normal");

  const [modelLoading, setModelLoading] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);

  const mediaRef = useRef<CameraMedia>({ video: null, canvas: null });
  const analysisRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<Awaited<ReturnType<typeof loadPoseDetector>> | null>(null);
  const stateRef = useRef({ cameraMode, facing, portraitBody, sideOverride, portraitTemplate });
  stateRef.current = { cameraMode, facing, portraitBody, sideOverride, portraitTemplate };

  useEffect(() => {
    return () => {
      mediaRef.current = { video: null, canvas: null };
    };
  }, []);

  // 人像模式按需加载本地姿态模型
  useEffect(() => {
    let cancelled = false;
    if (cameraMode === "portrait" && status === "ready" && !detectorRef.current && !modelFailed) {
      setModelLoading(true);
      loadPoseDetector()
        .then((detector) => {
          if (cancelled) return;
          detectorRef.current = detector;
          setModelLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setModelFailed(true);
          setModelLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [cameraMode, status, modelFailed]);

  // 实时分析循环（低频）
  useEffect(() => {
    if (status !== "ready" || photo) return;
    const canvas = mediaRef.current.canvas;
    if (!canvas) return;

    let raf = 0;
    let last = 0;
    let interval = 600;

    const tick = () => {
      const now = Date.now();
      if (now - last >= interval) {
        last = now;
        runAnalysis();
      }
      raf = requestAnimationFrame(tick);
    };

    const runAnalysis = () => {
      const video = mediaRef.current.video;
      if (!video || video.videoWidth === 0) return;
      const ac = analysisRef.current ?? document.createElement("canvas");
      ac.width = ANALYZE_W;
      ac.height = ANALYZE_H;
      analysisRef.current = ac;
      const actx = ac.getContext("2d", { willReadFrequently: true });
      if (!actx) return;
      const t0 = Date.now();
      actx.drawImage(video, 0, 0, ANALYZE_W, ANALYZE_H);
      let pixels: Uint8ClampedArray;
      try {
        pixels = actx.getImageData(0, 0, ANALYZE_W, ANALYZE_H).data;
      } catch {
        return;
      }

      const cur = stateRef.current;
      if (cur.cameraMode === "landscape") {
        const g = analyzeFrame(pixels, ANALYZE_W, ANALYZE_H);
        setLandscape(g);
        drawOverlay(canvas, { mode: "landscape", facing: cur.facing, landscape: g });
      } else {
        const autoSide = chooseSide(pixels, ANALYZE_W, ANALYZE_H);
        const effectiveSide = cur.sideOverride ?? autoSide;
        const target = targetBox(effectiveSide, cur.portraitBody);
        const detector = detectorRef.current;
        if (detector) {
          detectPose(detector, video)
            .then((kps) => {
              const actual = kps ? personBoxFromKeypoints(kps, video.videoWidth, video.videoHeight) : null;
              const g = guidanceFor(target, actual, effectiveSide, cur.portraitBody);
              setPortrait(g);
              drawOverlay(canvas, { mode: "portrait", facing: cur.facing, portrait: g, portraitTemplate: cur.portraitTemplate });
            })
            .catch(() => {
              const g = guidanceFor(target, null, effectiveSide, cur.portraitBody);
              setPortrait(g);
              drawOverlay(canvas, { mode: "portrait", facing: cur.facing, portrait: g, portraitTemplate: cur.portraitTemplate });
            });
        } else {
          const g = guidanceFor(target, null, effectiveSide, cur.portraitBody);
          setPortrait(g);
          drawOverlay(canvas, { mode: "portrait", facing: cur.facing, portrait: g, portraitTemplate: cur.portraitTemplate });
        }
      }

      const cost = Date.now() - t0;
      if (cost > 220) interval = 900;
      else if (cost < 120 && interval < 600) interval = 600;
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, photo, cameraMode]);

  // 切换模式时清空旧引导
  useEffect(() => {
    setLandscape(null);
    setPortrait(null);
    const canvas = mediaRef.current.canvas;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [cameraMode]);

  // 拍照后清空叠加层
  useEffect(() => {
    if (!photo) return;
    const canvas = mediaRef.current.canvas;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [photo]);

  const capture = () => {
    const video = mediaRef.current.video;
    if (!video || video.videoWidth === 0) return;
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const cx = c.getContext("2d");
    if (!cx) return;
    if (facing === "user") {
      cx.translate(c.width, 0);
      cx.scale(-1, 1);
    }
    cx.drawImage(video, 0, 0, c.width, c.height);
    try {
      setPhoto(c.toDataURL("image/jpeg", 0.92));
    } catch {
      setErrorMsg("无法生成本地照片");
    }
  };

  const savePhoto = () => {
    if (!photo) return;
    const a = document.createElement("a");
    a.href = photo;
    a.download = `lifedesk-camera-${Date.now()}.jpg`;
    a.click();
  };

  const addToDiary = () => {
    if (!photo) return;
    setPendingCameraPhoto(photo);
    if (onExit) onExit();
    else router.push("/love");
  };

  const hintText =
    cameraMode === "landscape"
      ? landscape?.hint
      : portrait?.hint;

  return (
    <View style={root}>
      <CameraView mediaRef={mediaRef} facing={facing} onStatus={setStatus} onError={setErrorMsg} key={camKey} />

      {/* 顶部栏 */}
      <View style={topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => (onExit ? onExit() : router.back())} style={topBtn}>
          <Text style={topBtnText}>‹ 返回</Text>
        </Pressable>
        <Text style={topTitle}>智能相机</Text>
        <View style={{ width: 56 }} />
      </View>

      {/* 模式切换 */}
      <View style={modeRow}>
        <ModePill active={cameraMode === "landscape"} label="风景" onPress={() => setCameraMode("landscape")} />
        <ModePill active={cameraMode === "portrait"} label="人像" onPress={() => setCameraMode("portrait")} />
      </View>

      {/* 人像额外控制 */}
      {cameraMode === "portrait" ? (
        <View style={subRow}>
          <SegGroup
            options={[
              { label: "左", value: "left" },
              { label: "中", value: "center" },
              { label: "右", value: "right" }
            ]}
            value={sideOverride}
            onAuto={() => setSideOverride(null)}
            onPick={(v) => setSideOverride(v as PortraitSide)}
            autoLabel="自动"
          />
          <SegGroup
            options={[
              { label: "半身", value: "half" },
              { label: "全身", value: "full" }
            ]}
            value={portraitBody}
            onPick={(v) => setPortraitBody(v as PortraitBody)}
          />
          <SegGroup
            options={[
              { label: "正常", value: "normal" },
              { label: "微侧", value: "side" },
              { label: "背影", value: "back" }
            ]}
            value={portraitTemplate}
            onPick={(v) => setPortraitTemplate(v as PortraitTemplate)}
          />
        </View>
      ) : null}

      {/* 提示条 */}
      {hintText ? <View style={hintBar}><Text style={hintTextStyle}>{hintText}</Text></View> : null}

      {/* 状态覆盖层 */}
      {status === "loading" ? <CenterNote text="正在打开摄像头…" /> : null}
      {status === "denied" ? (
        <CenterNote
          text="需要摄像头权限才能使用智能构图。"
          actions={[
            { label: "重新授权", onPress: () => setCamKey((k) => k + 1) },
            { label: "返回", onPress: () => (onExit ? onExit() : router.back()) }
          ]}
        />
      ) : null}
      {status === "unsupported" ? <CenterNote text="当前浏览器不支持摄像头。" actions={[{ label: "返回", onPress: () => (onExit ? onExit() : router.back()) }]} /> : null}
      {status === "error" ? <CenterNote text={errorMsg || "摄像头出错"} actions={[{ label: "返回", onPress: () => (onExit ? onExit() : router.back()) }]} /> : null}
      {cameraMode === "portrait" && modelLoading ? <CenterNote text="正在加载智能构图…" /> : null}
      {cameraMode === "portrait" && modelFailed ? <CenterNote text="智能构图模型加载失败，已降级为手动轮廓参考。" dismissible /> : null}

      {/* 底部栏 */}
      <View style={bottomBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="最近照片" onPress={() => photo && setPhoto(null)} style={thumbWrap}>
          {photo ? <Image source={{ uri: photo }} style={thumbImg} /> : <View style={thumbPlaceholder} />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="拍照" onPress={capture} disabled={status !== "ready"} style={shutter}>
          <View style={shutterInner} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="切换摄像头" onPress={() => setFacing((f) => (f === "environment" ? "user" : "environment"))} style={switchBtn}>
          <Text style={switchText}>⇄</Text>
        </Pressable>
      </View>

      {/* 隐私说明 */}
      <Text style={privacyNote}>构图分析在本机进行，实时相机画面不会上传。</Text>

      {photo ? <PhotoPreview photo={photo} onRetake={() => setPhoto(null)} onSave={savePhoto} onAddToDiary={addToDiary} tokens={tokens} /> : null}
    </View>
  );
}

function ModePill({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`切换${label}模式`} onPress={onPress} style={[pill, active ? pillActive : null]}>
      <Text style={[pillText, active ? pillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function SegGroup({
  options,
  value,
  onPick,
  onAuto,
  autoLabel
}: {
  options: { label: string; value: string }[];
  value: string | null;
  onPick: (v: string) => void;
  onAuto?: () => void;
  autoLabel?: string;
}) {
  return (
    <View style={segGroup}>
      {autoLabel ? (
        <Pressable accessibilityRole="button" accessibilityLabel="自动推荐" onPress={onAuto} style={[seg, value === null ? segActive : null]}>
          <Text style={[segText, value === null ? segTextActive : null]}>{autoLabel}</Text>
        </Pressable>
      ) : null}
      {options.map((opt) => (
        <Pressable key={opt.value} accessibilityRole="button" accessibilityLabel={`选择${opt.label}`} onPress={() => onPick(opt.value)} style={[seg, value === opt.value ? segActive : null]}>
          <Text style={[segText, value === opt.value ? segTextActive : null]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function CenterNote({
  text,
  actions,
  dismissible
}: {
  text: string;
  actions?: { label: string; onPress: () => void }[];
  dismissible?: boolean;
}) {
  return (
    <View style={centerNote}>
      <View style={centerCard}>
        <Text style={centerText}>{text}</Text>
        {actions ? (
          <View style={centerActions}>
            {actions.map((a) => (
              <Pressable key={a.label} accessibilityRole="button" accessibilityLabel={a.label} onPress={a.onPress} style={centerBtn}>
                <Text style={centerBtnText}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {dismissible ? <Text style={centerHint}>仍可继续拍照</Text> : null}
      </View>
    </View>
  );
}

const root: object = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "#000000",
  overflow: "hidden"
};

const topBar: object = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingTop: 14,
  paddingHorizontal: 14,
  paddingBottom: 8,
  zIndex: 10
};

const topBtn: object = {
  backgroundColor: "rgba(0,0,0,0.45)",
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 8
};

const topBtnText: object = { color: "#ffffff", fontSize: 14, fontWeight: "800" };
const topTitle: object = { color: "#ffffff", fontSize: 16, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.6)", textShadowBlur: 4 };

const modeRow: object = {
  position: "absolute",
  top: 56,
  left: 0,
  right: 0,
  flexDirection: "row",
  justifyContent: "center",
  gap: 10,
  zIndex: 10
};

const pill: object = {
  backgroundColor: "rgba(0,0,0,0.45)",
  borderRadius: 999,
  paddingHorizontal: 22,
  paddingVertical: 9
};

const pillActive: object = { backgroundColor: "#1f8f55" };
const pillText: object = { color: "#ffffff", fontSize: 14, fontWeight: "900" };
const pillTextActive: object = { color: "#ffffff" };

const subRow: object = {
  position: "absolute",
  top: 100,
  left: 0,
  right: 0,
  flexDirection: "row",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: 8,
  paddingHorizontal: 12,
  zIndex: 10
};

const segGroup: object = {
  flexDirection: "row",
  backgroundColor: "rgba(0,0,0,0.45)",
  borderRadius: 999,
  padding: 3,
  gap: 2
};

const seg: object = { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 };
const segActive: object = { backgroundColor: "#1f8f55" };
const segText: object = { color: "#ffffff", fontSize: 12, fontWeight: "800" };
const segTextActive: object = { color: "#ffffff" };

const hintBar: object = {
  position: "absolute",
  top: 152,
  left: 0,
  right: 0,
  alignItems: "center",
  zIndex: 10
};

const hintTextStyle: object = {
  color: "#ffffff",
  fontSize: 15,
  fontWeight: "900",
  backgroundColor: "rgba(0,0,0,0.5)",
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 8,
  textAlign: "center",
  textShadowColor: "rgba(0,0,0,0.6)",
  textShadowBlur: 3
};

const bottomBar: object = {
  position: "absolute",
  bottom: 36,
  left: 0,
  right: 0,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 28,
  zIndex: 10
};

const thumbWrap: object = { width: 52, height: 52, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.15)" };
const thumbImg: object = { width: 52, height: 52 };
const thumbPlaceholder: object = { width: 52, height: 52, backgroundColor: "rgba(255,255,255,0.15)" };

const shutter: object = {
  width: 72,
  height: 72,
  borderRadius: 999,
  backgroundColor: "#ffffff",
  alignItems: "center",
  justifyContent: "center",
  shadowColor: "#000000",
  shadowOpacity: 0.3,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 }
};

const shutterInner: object = { width: 60, height: 60, borderRadius: 999, backgroundColor: "#1f8f55", borderWidth: 4, borderColor: "#ffffff" };

const switchBtn: object = {
  width: 52,
  height: 52,
  borderRadius: 999,
  backgroundColor: "rgba(0,0,0,0.45)",
  alignItems: "center",
  justifyContent: "center"
};

const switchText: object = { color: "#ffffff", fontSize: 22, fontWeight: "900" };

const privacyNote: object = {
  position: "absolute",
  bottom: 12,
  left: 0,
  right: 0,
  textAlign: "center",
  color: "rgba(255,255,255,0.7)",
  fontSize: 11,
  zIndex: 9
};

const centerNote: object = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(0,0,0,0.55)",
  zIndex: 20
};

const centerCard: object = {
  backgroundColor: "rgba(255,255,255,0.96)",
  borderRadius: 16,
  padding: 20,
  maxWidth: 300,
  alignItems: "center"
};

const centerText: object = { color: "#111827", fontSize: 15, fontWeight: "800", textAlign: "center" };
const centerHint: object = { color: "#6b7280", fontSize: 12, marginTop: 8 };
const centerActions: object = { flexDirection: "row", gap: 10, marginTop: 14 };
const centerBtn: object = { backgroundColor: "#1f8f55", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 };
const centerBtnText: object = { color: "#ffffff", fontSize: 14, fontWeight: "900" };
