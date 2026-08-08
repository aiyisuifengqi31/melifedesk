import { useEffect, useRef } from "react";
import { View } from "react-native";
import type { CameraFacing, CameraMedia, CameraStatus } from "./types";

type Props = {
  mediaRef: React.MutableRefObject<CameraMedia>;
  facing: CameraFacing;
  onStatus?: (status: CameraStatus) => void;
  onError?: (message: string) => void;
};

/**
 * Web 原生相机视图：在容器内挂载一个 <video>（实时预览）与一个 <canvas>
 * （叠加层由 CameraOverlay 绘制）。仅在浏览器运行；离开页面时停止轨道并移除节点。
 */
export function CameraView({ mediaRef, facing, onStatus, onError }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onStatus?.("unsupported");
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");

    Object.assign(video.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: facing === "user" ? "scaleX(-1)" : "none"
    } as CSSStyleDeclaration);
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none"
    } as CSSStyleDeclaration);

    container.appendChild(video);
    container.appendChild(canvas);
    mediaRef.current = { video, canvas };

    const start = async () => {
      try {
        onStatus?.("loading");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing === "user" ? "user" : "environment" },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        onStatus?.("ready");
      } catch (error) {
        const name = (error as DOMException)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          onStatus?.("denied");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          onError?.("未检测到摄像头");
          onStatus?.("error");
        } else {
          onError?.("无法打开摄像头");
          onStatus?.("error");
        }
      }
    };
    void start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
      mediaRef.current = { video: null, canvas: null };
      video.remove();
      canvas.remove();
    };
  }, [facing]);

  return <View ref={containerRef as never} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />;
}
