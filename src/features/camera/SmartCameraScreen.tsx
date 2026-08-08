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
import {
  candidateBox,
  evaluateCandidates,
  guidanceFor,
  manualRecommend,
  personBoxFromKeypoints
} from "./PortraitGuide";
import {
  detectPose,
  getLastModelError,
  loadPoseDetector,
  resetPoseDetector
} from "./PoseDetector";
import type {
  CameraFacing,
  CameraMedia,
  CameraMode,
  CameraStatus,
  CandidateSide,
  LandscapeGuidance,
  NormBox,
  PortraitBody,
  PortraitGuidance,
  PortraitRecommendation,
  PortraitSide
} from "./types";

const ANALYZE_W = 320; // 分析用离屏 canvas 宽；高按视频宽高比动态计算（典型 320x180 / 320x240）

type ModelStatus = "idle" | "loading" | "ready" | "failed";

export function SmartCameraScreen({ onExit }: { onExit?: () => void }) {
  const router = useRouter();
  const themeId = readStoredThemeId(typeof window === "undefined" ? undefined : window.localStorage) ?? "default";
  const colorMode = readStoredColorMode(typeof window === "undefined" ? undefined : window.localStorage) ?? "light";
  const tokens: UiTokens = useMemo(() => getTheme(themeId).tokens[colorMode], [themeId, colorMode]);

  const debug =
    typeof window !== "undefined" &&
    typeof window.location !== "undefined" &&
    new URLSearchParams(window.location.search).has("debug");

  const [cameraMode, setCameraMode] = useState<CameraMode>("landscape");
  const [facing, setFacing] = useState<CameraFacing>("environment");
  const [status, setStatus] = useState<CameraStatus>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [camKey, setCamKey] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);

  const [landscape, setLandscape] = useState<LandscapeGuidance | null>(null);
  const [portrait, setPortrait] = useState<PortraitGuidance | null>(null);
  const [recommend, setRecommend] = useState<PortraitRecommendation | null>(null);

  const [portraitBody, setPortraitBody] = useState<PortraitBody>("full");
  const [sideOverride, setSideOverride] = useState<PortraitSide | null>(null);
  const [portraitTemplate, setPortraitTemplate] = useState<PortraitTemplate>("normal");
  const [smartMode, setSmartMode] = useState(true); // true=智能构图(背景候选评分)；false=基础模式(手动框)

  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [modelFailed, setModelFailed] = useState(false);

  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // refs
  const mediaRef = useRef<CameraMedia>({ video: null, canvas: null });
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<Awaited<ReturnType<typeof loadPoseDetector>> | null>(null);
  const latestRef = useRef<Parameters<typeof drawOverlay>[1]>({
    mode: "landscape",
    facing: "environment"
  });
  const emaRef = useRef<Record<string, number>>({});
  const actualBoxRef = useRef<NormBox | null>(null);
  const portraitGuidanceRef = useRef<PortraitGuidance | null>(null);
  const recommendRef = useRef<PortraitRecommendation | null>(null);

  // 性能测量
  const perfRef = useRef({ frames: 0, lastFpsT: Date.now(), fps: 0, poseMs: 0, bgMs: 0, analyzeW: ANALYZE_W, analyzeH: 180 });
  const bgTimeoutRef = useRef<number | null>(null);
  const poseTimeoutRef = useRef<number | null>(null);
  const bgIntervalRef = useRef(400);
  const poseIntervalRef = useRef(150);

  // 当前可变状态快照，供定时器读取（避免闭包陈旧）
  const stateRef = useRef({ cameraMode, facing, smartMode, portraitBody, sideOverride, portraitTemplate, modelStatus, modelFailed });
  stateRef.current = { cameraMode, facing, smartMode, portraitBody, sideOverride, portraitTemplate, modelStatus, modelFailed };

  const showToast = (msg: string, ms = 3000) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), ms);
  };

  // 卸载时清理定时器与摄像头
  useEffect(() => {
    return () => {
      if (bgTimeoutRef.current) window.clearTimeout(bgTimeoutRef.current);
      if (poseTimeoutRef.current) window.clearTimeout(poseTimeoutRef.current);
      mediaRef.current = { video: null, canvas: null };
    };
  }, []);

  // 模型单次加载：进入人像且摄像头就绪时触发；失败不再自动重试
  useEffect(() => {
    let cancelled = false;
    if (cameraMode === "portrait" && status === "ready" && !detectorRef.current && modelStatus !== "loading") {
      setModelStatus("loading");
      loadPoseDetector()
        .then((det) => {
          if (cancelled) return;
          detectorRef.current = det;
          setModelStatus("ready");
          setModelFailed(false);
        })
        .catch(() => {
          if (cancelled) return;
          setModelStatus("failed");
          setModelFailed(true);
          const info = getLastModelError();
          showToast("人像识别未加载（背景智能推荐仍可用）", 3500);
          // eslint-disable-next-line no-console
          console.error("[SmartCamera] 模型加载失败，真实根因：", info);
        });
    }
    return () => {
      cancelled = true;
    };
    // 仅在关键依赖变化重跑；不再每帧/每秒重试
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMode, status, modelStatus]);

  // 重新加载智能构图（手动按钮）
  const reloadModel = () => {
    if (cameraMode !== "portrait") {
      setCameraMode("portrait");
      return;
    }
    detectorRef.current = null;
    resetPoseDetector();
    setModelFailed(false);
    setModelStatus("idle");
  };

  // 切换到预览时停止所有分析；回到相机时恢复
  useEffect(() => {
    if (photo) return; // preview：不跑分析
  }, [photo]);

  // ---------- 背景构图分析（~400ms / 2.5fps） ----------
  const runBackground = () => {
    const video = mediaRef.current.video;
    if (!video || video.videoWidth === 0 || photo) return;
    const cur = stateRef.current;
    const aspect = video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 4 / 3;
    const aw = ANALYZE_W;
    const ah = Math.max(120, Math.round(ANALYZE_W / aspect));
    let canvas = bgCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      bgCanvasRef.current = canvas;
    }
    if (canvas.width !== aw || canvas.height !== ah) {
      canvas.width = aw;
      canvas.height = ah;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, aw, ah);
    let pixels: Uint8ClampedArray;
    try {
      pixels = ctx.getImageData(0, 0, aw, ah).data;
    } catch {
      return;
    }
    perfRef.current.analyzeW = aw;
    perfRef.current.analyzeH = ah;

    const t0 = Date.now();
    let rec: PortraitRecommendation;
    if (cur.cameraMode === "landscape") {
      const g = analyzeFrame(pixels, aw, ah);
      setLandscape(g);
      latestRef.current = { ...latestRef.current, mode: "landscape", landscape: g };
    } else {
      if (cur.smartMode && cur.sideOverride === null) {
        const evalRes = evaluateCandidates(pixels, aw, ah, cur.portraitBody);
        // EMA 滑动平均，保证推荐位置稳定 ~1-2s 不抖动
        for (const c of evalRes.candidates) {
          const prev = emaRef.current[c.side];
          emaRef.current[c.side] = prev === undefined ? c.norm : prev * 0.8 + c.norm * 0.2;
        }
        const sorted = [...evalRes.candidates].sort(
          (a, b) => (emaRef.current[b.side] ?? 0) - (emaRef.current[a.side] ?? 0)
        );
        const bestSide = sorted[0].side;
        const best = evalRes.candidates.find((c) => c.side === bestSide)!;
        const top = emaRef.current[bestSide] ?? best.norm;
        const second = emaRef.current[sorted[1].side] ?? 0;
        const confidence = Math.max(0, Math.min(1, top - second));
        rec = {
          best: bestSide,
          bestBox: candidateBox(bestSide, cur.portraitBody),
          confidence,
          lowConfidence: confidence < 0.06,
          reasons: confidence < 0.06 ? [] : best.reasons,
          candidates: evalRes.candidates,
          auto: true
        };
      } else {
        const side = cur.sideOverride ?? "right";
        rec = manualRecommend(side, cur.portraitBody);
      }
      recommendRef.current = rec;
      setRecommend(rec);
      latestRef.current = {
        ...latestRef.current,
        mode: "portrait",
        recommend: rec,
        manualMode: !cur.smartMode || cur.sideOverride !== null,
        portraitTemplate: cur.portraitTemplate
      };
      recomputePortrait();
    }
    const cost = Date.now() - t0;
    perfRef.current.bgMs = cost;
    if (cost > 120 && bgIntervalRef.current < 600) {
      bgIntervalRef.current = 600;
    }
  };

  // ---------- 人像真实检测（~150ms / ~6-7fps，仅在 AI 就绪时） ----------
  const runPose = async () => {
    const video = mediaRef.current.video;
    const cur = stateRef.current;
    if (!video || video.videoWidth === 0 || photo) return;
    if (cur.cameraMode !== "portrait") return;
    const det = detectorRef.current;
    if (!det) return; // 模型未就绪：不跑人像检测
    const aspect = video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 4 / 3;
    const aw = ANALYZE_W;
    const ah = Math.max(120, Math.round(ANALYZE_W / aspect));
    let canvas = poseCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      poseCanvasRef.current = canvas;
    }
    if (canvas.width !== aw || canvas.height !== ah) {
      canvas.width = aw;
      canvas.height = ah;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, aw, ah);

    const t0 = Date.now();
    try {
      const kps = await detectPose(det, canvas);
      const actual = kps ? personBoxFromKeypoints(kps, aw, ah) : null;
      actualBoxRef.current = actual;
      recomputePortrait();
    } catch {
      actualBoxRef.current = null;
    }
    const cost = Date.now() - t0;
    perfRef.current.poseMs = cost;
    // 自适应降级：检测过慢就拉低频率
    if (cost > 300 && poseIntervalRef.current < 400) poseIntervalRef.current = 400;
    else if (cost > 150 && poseIntervalRef.current < 250) poseIntervalRef.current = 250;
  };

  const recomputePortrait = () => {
    const rec = recommendRef.current;
    if (!rec) return;
    const cur = stateRef.current;
    const sideLabel: PortraitSide = rec.best === "lowerLeft" ? "left" : rec.best === "lowerRight" ? "right" : rec.best;
    const g = guidanceFor(rec.bestBox, actualBoxRef.current, sideLabel, cur.portraitBody);
    portraitGuidanceRef.current = g;
    setPortrait(g);
    latestRef.current = { ...latestRef.current, mode: "portrait", portrait: g, recommend: rec };
  };

  // 定时器：递归 setTimeout 以支持动态间隔（性能降级）
  useEffect(() => {
    if (status !== "ready" || photo) {
      if (bgTimeoutRef.current) window.clearTimeout(bgTimeoutRef.current);
      if (poseTimeoutRef.current) window.clearTimeout(poseTimeoutRef.current);
      bgTimeoutRef.current = null;
      poseTimeoutRef.current = null;
      return;
    }
    const loopBg = () => {
      runBackground();
      if (bgTimeoutRef.current) window.clearTimeout(bgTimeoutRef.current);
      bgTimeoutRef.current = window.setTimeout(loopBg, bgIntervalRef.current);
    };
    const loopPose = () => {
      void runPose();
      if (poseTimeoutRef.current) window.clearTimeout(poseTimeoutRef.current);
      poseTimeoutRef.current = window.setTimeout(loopPose, poseIntervalRef.current);
    };
    bgTimeoutRef.current = window.setTimeout(loopBg, 200);
    poseTimeoutRef.current = window.setTimeout(loopPose, 300);
    return () => {
      if (bgTimeoutRef.current) window.clearTimeout(bgTimeoutRef.current);
      if (poseTimeoutRef.current) window.clearTimeout(poseTimeoutRef.current);
      bgTimeoutRef.current = null;
      poseTimeoutRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, photo]);

  // 绘制循环：仅消费 latestRef 缓存，绝不在每帧重跑模型（保持预览 60fps）
  useEffect(() => {
    if (status !== "ready") return;
    let raf = 0;
    const perf = perfRef.current;
    const draw = () => {
      const canvas = mediaRef.current.canvas;
      if (canvas && !photo) {
        drawOverlay(canvas, latestRef.current);
      }
      // FPS 统计
      perf.frames += 1;
      const now = Date.now();
      if (now - perf.lastFpsT >= 1000) {
        perf.fps = Math.round((perf.frames * 1000) / (now - perf.lastFpsT));
        perf.frames = 0;
        perf.lastFpsT = now;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [status, photo]);

  // 切换模式时清空旧引导
  useEffect(() => {
    setLandscape(null);
    setPortrait(null);
    setRecommend(null);
    recommendRef.current = null;
    actualBoxRef.current = null;
    emaRef.current = {};
    portraitGuidanceRef.current = null;
    const canvas = mediaRef.current.canvas;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, [cameraMode]);

  // ---------- 拍照：使用相机原始分辨率，而非分析帧 ----------
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

  // ---------- 保存：优先 Web Share，兜底本机下载 ----------
  const savePhoto = async () => {
    if (!photo) return;
    try {
      const blob: Blob = await (await fetch(photo)).blob();
      const file = new File([blob], `lifedesk-${Date.now()}.jpg`, { type: "image/jpeg" });
      const navAny = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: unknown) => Promise<void> };
      if (navAny.canShare && navAny.canShare({ files: [file] }) && navAny.share) {
        try {
          await navAny.share({ files: [file], title: "LifeDesk 照片" });
          return; // 用户在系统分享面板保存/分享，不自动上传
        } catch (e) {
          if ((e as DOMException)?.name === "AbortError") return; // 用户取消，不强制下载
        }
      }
    } catch {
      /* 继续走下载兜底 */
    }
    const a = document.createElement("a");
    a.href = photo;
    a.download = `lifedesk-${Date.now()}.jpg`;
    a.click();
    showToast("已尝试保存到本机；若未出现下载，请长按图片保存。", 3500);
  };

  // 单行提示（顶部安全区）
  let hintText: string | null = null;
  if (cameraMode === "landscape") {
    hintText = landscape?.hint ?? null;
  } else if (recommend) {
    if (portrait?.detected) hintText = portrait.hint;
    else if (recommend.lowConfidence) hintText = "当前场景没有明显最佳站位，可选择 左 / 中 / 右";
    else if (recommend.reasons.length) hintText = `建议${sideLabelZh(recommend.best)}（${recommend.reasons[0]}）`;
    else hintText = `智能推荐：${sideLabelZh(recommend.best)}`;
  }

  const isPreview = !!photo;

  return (
    <View style={root}>
      <CameraView mediaRef={mediaRef} facing={facing} onStatus={setStatus} onError={setErrorMsg} key={camKey} />

      {/* 顶部栏（相机态与预览态都保留"返回"，其余控件仅相机态显示） */}
      <View style={topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => (onExit ? onExit() : router.back())} style={topBtn}>
          <Text style={topBtnText}>‹ 返回</Text>
        </Pressable>
        <Text style={topTitle}>智能相机</Text>
        <View style={{ width: 56 }} />
      </View>

      {/* 模式切换（仅相机态） */}
      {!isPreview ? (
        <View style={modeRow}>
          <ModePill active={cameraMode === "landscape"} label="风景" onPress={() => setCameraMode("landscape")} />
          <ModePill active={cameraMode === "portrait"} label="人像" onPress={() => setCameraMode("portrait")} />
        </View>
      ) : null}

      {/* 人像：更多按钮 + 折叠面板（仅相机态） */}
      {!isPreview && cameraMode === "portrait" ? (
        <View style={moreWrap}>
          <Pressable accessibilityRole="button" accessibilityLabel="更多设置" onPress={() => setMoreOpen((v) => !v)} style={moreBtn}>
            <Text style={moreBtnText}>{moreOpen ? "收起 ▲" : "更多 ⌄"}</Text>
          </Pressable>
          {moreOpen ? (
            <View style={morePanel}>
              <SegGroup
                title="位置"
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
                title="取景"
                options={[
                  { label: "半身", value: "half" },
                  { label: "全身", value: "full" }
                ]}
                value={portraitBody}
                onPick={(v) => setPortraitBody(v as PortraitBody)}
              />
              <SegGroup
                title="姿势"
                options={[
                  { label: "正常", value: "normal" },
                  { label: "微侧", value: "side" },
                  { label: "背影", value: "back" }
                ]}
                value={portraitTemplate}
                onPick={(v) => setPortraitTemplate(v as PortraitTemplate)}
              />
              <SegGroup
                title="模式"
                options={[
                  { label: "智能构图", value: "smart" },
                  { label: "基础模式", value: "basic" }
                ]}
                value={smartMode ? "smart" : "basic"}
                onPick={(v) => setSmartMode(v === "smart")}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 单行提示（顶部安全区，仅相机态） */}
      {!isPreview && hintText ? (
        <View style={hintBar}>
          <Text style={hintTextStyle}>{hintText}</Text>
        </View>
      ) : null}

      {/* 非阻塞 Toast（顶部，3s 自动消失） */}
      {toast ? (
        <View style={toastBar}>
          <Text style={toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* 模型失败时的持久小状态（不挡中央） */}
      {!isPreview && cameraMode === "portrait" && modelFailed ? (
        <View style={badge}>
          <Text style={badgeText}>无人物识别 · 背景推荐可用</Text>
        </View>
      ) : null}

      {/* 重新加载智能构图（仅模型失败时） */}
      {!isPreview && cameraMode === "portrait" && modelFailed ? (
        <Pressable accessibilityRole="button" accessibilityLabel="重新加载智能构图" onPress={reloadModel} style={reloadBtn}>
          <Text style={reloadBtnText}>重新加载智能构图</Text>
        </Pressable>
      ) : null}

      {/* 状态覆盖层（仅相机态的加载/错误） */}
      {!isPreview ? (
        <>
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
        </>
      ) : null}

      {/* 底部栏（仅相机态） */}
      {!isPreview ? (
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
      ) : null}

      {/* 隐私说明（仅相机态） */}
      {!isPreview ? <Text style={privacyNote}>构图分析在本机进行，实时相机画面不会上传。</Text> : null}

      {/* 预览态：整屏照片 + 两个按钮（相机控件已完全隐藏） */}
      {isPreview && photo ? <PhotoPreview photo={photo} onRetake={() => setPhoto(null)} onSave={savePhoto} /> : null}

      {/* Debug 覆盖层（?debug=1） */}
      {debug && !isPreview ? <DebugOverlay perf={perfRef.current} modelStatus={modelStatus} tokens={tokens} /> : null}
    </View>
  );
}

function sideLabelZh(side: CandidateSide): string {
  return side === "left" ? "左侧" : side === "center" ? "中间" : side === "right" ? "右侧" : side === "lowerLeft" ? "左下" : "右下";
}

function ModePill({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`切换${label}模式`} onPress={onPress} style={[pill, active ? pillActive : null]}>
      <Text style={[pillText, active ? pillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function SegGroup({
  title,
  options,
  value,
  onPick,
  onAuto,
  autoLabel
}: {
  title: string;
  options: { label: string; value: string }[];
  value: string | null;
  onPick: (v: string) => void;
  onAuto?: () => void;
  autoLabel?: string;
}) {
  return (
    <View style={segRow}>
      <Text style={segTitle}>{title}</Text>
      <View style={segGroup}>
        {autoLabel ? (
          <Pressable accessibilityRole="button" accessibilityLabel="自动" onPress={onAuto} style={[seg, value === null ? segActive : null]}>
            <Text style={[segText, value === null ? segTextActive : null]}>{autoLabel}</Text>
          </Pressable>
        ) : null}
        {options.map((opt) => (
          <Pressable key={opt.value} accessibilityRole="button" accessibilityLabel={`选择${opt.label}`} onPress={() => onPick(opt.value)} style={[seg, value === opt.value ? segActive : null]}>
            <Text style={[segText, value === opt.value ? segTextActive : null]}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function CenterNote({ text, actions }: { text: string; actions?: { label: string; onPress: () => void }[] }) {
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
      </View>
    </View>
  );
}

function DebugOverlay({ perf, modelStatus, tokens }: { perf: { fps: number; poseMs: number; bgMs: number; analyzeW: number; analyzeH: number }; modelStatus: string; tokens: UiTokens }) {
  const lines = [
    `FPS ${perf.fps}`,
    `pose ${perf.poseMs}ms`,
    `bg ${perf.bgMs}ms`,
    `analyze ${perf.analyzeW}x${perf.analyzeH}`,
    `model ${modelStatus}`
  ];
  return (
    <View style={debugBox}>
      {lines.map((l) => (
        <Text key={l} style={[debugText, { color: tokens.text }]}>
          {l}
        </Text>
      ))}
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

const moreWrap: object = {
  position: "absolute",
  top: 100,
  right: 12,
  alignItems: "flex-end",
  zIndex: 12
};

const moreBtn: object = {
  backgroundColor: "rgba(0,0,0,0.5)",
  borderRadius: 999,
  paddingHorizontal: 14,
  paddingVertical: 7
};

const moreBtnText: object = { color: "#ffffff", fontSize: 12, fontWeight: "800" };

const morePanel: object = {
  marginTop: 8,
  backgroundColor: "rgba(20,20,20,0.82)",
  borderRadius: 14,
  padding: 12,
  gap: 10,
  width: 250
};

const segRow: object = { flexDirection: "row", alignItems: "center", justifyContent: "space-between" };
const segTitle: object = { color: "#ffffff", fontSize: 12, fontWeight: "800", width: 42 };
const segGroup: object = { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 999, padding: 3, gap: 2 };
const seg: object = { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 };
const segActive: object = { backgroundColor: "#1f8f55" };
const segText: object = { color: "#ffffff", fontSize: 12, fontWeight: "800" };
const segTextActive: object = { color: "#ffffff" };

const hintBar: object = {
  position: "absolute",
  top: "18%",
  left: 12,
  right: 12,
  alignItems: "center",
  zIndex: 11
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

const toastBar: object = {
  position: "absolute",
  top: 100,
  left: 16,
  right: 16,
  alignItems: "center",
  zIndex: 30
};

const toastText: object = {
  color: "#ffffff",
  fontSize: 13,
  fontWeight: "700",
  backgroundColor: "rgba(0,0,0,0.78)",
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 10,
  textAlign: "center"
};

const badge: object = {
  position: "absolute",
  top: 100,
  left: 12,
  zIndex: 11
};

const badgeText: object = { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "700", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 };

const reloadBtn: object = {
  position: "absolute",
  top: 140,
  left: 12,
  zIndex: 11,
  backgroundColor: "rgba(31,143,85,0.9)",
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 8
};

const reloadBtnText: object = { color: "#ffffff", fontSize: 12, fontWeight: "800" };

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
const centerActions: object = { flexDirection: "row", gap: 10, marginTop: 14 };
const centerBtn: object = { backgroundColor: "#1f8f55", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 };
const centerBtnText: object = { color: "#ffffff", fontSize: 14, fontWeight: "900" };

const debugBox: object = {
  position: "absolute",
  bottom: 100,
  left: 12,
  backgroundColor: "rgba(0,0,0,0.6)",
  borderRadius: 8,
  padding: 8,
  gap: 2,
  zIndex: 25
};

const debugText: object = { fontSize: 11, fontWeight: "700", fontFamily: "monospace" };
