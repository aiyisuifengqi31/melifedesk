import type { PersonKeypoint } from "./types";

/**
 * 浏览器本地人体姿态检测（TF.js + MoveNet）。
 *
 * - 全部在用户手机本地完成，不调用任何云端 AI，不上传实时画面；
 * - 仅按需动态 import，且只在用户进入人像模式并首次需要时才加载，不阻塞首屏；
 * - 模型权重从 Google Cloud Storage 的 tfjs-models 副本加载（CORS 友好、稳定），
 *   而非默认的 tfhub.dev 地址——后者在 Android Chrome / 已安装 PWA 中经常因
 *   CORS / 重定向 / opaque response 而加载失败。
 * - 若离线首用或加载失败，调用方应降级为「手动人物轮廓 + 普通拍照」，不阻塞主流程。
 *
 * 诊断：加载失败时会把详细信息写到 window.__smartCameraError（开发模式可直接看），
 * 并通过 getLastModelError() 暴露给 UI 展示真实根因（不再用一句"加载失败"掩盖）。
 */

// tfhub.dev 默认地址在移动端 PWA 极易失败；改为 GCS 上的 tfjs-models 副本。
export const MOVENET_LIGHTNING_URL =
  "https://storage.googleapis.com/tfjs-models/movenet/singlepose/lightning/model.json";

type RawKeypoint = { x: number; y: number; score?: number; name?: string };
type RawPose = { keypoints: RawKeypoint[] };
export type Detector = {
  estimatePoses: (
    input: HTMLVideoElement | HTMLCanvasElement,
    config?: { maxPoses?: number; flipHorizontal?: boolean }
  ) => Promise<RawPose[]>;
};

export type ModelErrorInfo = {
  message: string;
  stack?: string;
  modelUrl: string;
  backend: string | null;
  userAgent: string;
  isSecureContext: boolean;
  serviceWorkerActive: boolean;
  modelHttpStatus: number | null;
  wasmUrl?: string;
  note: string;
};

let detectorPromise: Promise<Detector> | null = null;
let lastError: ModelErrorInfo | null = null;

function captureEnv(): Pick<
  ModelErrorInfo,
  "userAgent" | "isSecureContext" | "serviceWorkerActive"
> {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return {
      userAgent: "unknown",
      isSecureContext: false,
      serviceWorkerActive: false
    };
  }
  let swActive = false;
  try {
    swActive = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  } catch {
    swActive = false;
  }
  return {
    userAgent: navigator.userAgent || "unknown",
    isSecureContext: typeof window.isSecureContext === "boolean" ? window.isSecureContext : false,
    serviceWorkerActive: swActive
  };
}

/**
 * 探测模型 URL 是否可达，并尽量拿到 HTTP 状态码。
 * 仅在加载失败时调用，用于区分 404 / CORS / 网络不通。
 */
async function probeModelHttpStatus(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { method: "GET", mode: "cors", cache: "no-store" });
    return res.status;
  } catch {
    return null;
  }
}

export async function loadPoseDetector(): Promise<Detector> {
  if (!detectorPromise) {
    detectorPromise = (async (): Promise<Detector> => {
      const env = captureEnv();
      let backend: string | null = null;
      try {
        const tf: typeof import("@tensorflow/tfjs") = await import("@tensorflow/tfjs");
        // 显式启用 WebGL 后端（MoveNet 需要），失败再退回默认后端
        try {
          await tf.setBackend("webgl");
        } catch {
          /* 忽略，交给 tf.ready() 选择可用后端 */
        }
        await tf.ready();
        try {
          backend = tf.getBackend();
        } catch {
          backend = null;
        }

        const poseDetection: typeof import("@tensorflow-models/pose-detection") = await import(
          "@tensorflow-models/pose-detection"
        );
        const model = poseDetection.SupportedModels.MoveNet;
        const detector = await poseDetection.createDetector(model, {
          modelType: "Lightning",
          modelUrl: MOVENET_LIGHTNING_URL
        });
        return detector as unknown as Detector;
      } catch (error) {
        const err = error as Error;
        const status = await probeModelHttpStatus(MOVENET_LIGHTNING_URL).catch(() => null);
        lastError = {
          message: err?.message || String(error),
          stack: err?.stack,
          modelUrl: MOVENET_LIGHTNING_URL,
          backend,
          userAgent: env.userAgent,
          isSecureContext: env.isSecureContext,
          serviceWorkerActive: env.serviceWorkerActive,
          modelHttpStatus: status,
          note: "动态 import @tensorflow/* 成功但 createDetector 失败（URL / 后端 / 网络）"
        };
        if (typeof window !== "undefined") {
          (window as unknown as { __smartCameraError?: ModelErrorInfo }).__smartCameraError = lastError;
          // 开发模式可见的真实错误
          // eslint-disable-next-line no-console
          console.error("[SmartCamera]\nmodel init failed:\n", err);
          // eslint-disable-next-line no-console
          console.error("[SmartCamera] diagnostics:", lastError);
        }
        detectorPromise = null; // 允许"重新加载智能构图"再次尝试
        throw error;
      }
    })();
  }
  return detectorPromise;
}

/** 读取最近一次加载失败的诊断信息（用于 UI 展示真实根因）。 */
export function getLastModelError(): ModelErrorInfo | null {
  return lastError;
}

/** 清除已加载（或失败）的探测器，允许下次调用重新初始化（手动重载按钮使用）。 */
export function resetPoseDetector(): void {
  detectorPromise = null;
  lastError = null;
}

export async function detectPose(
  detector: Detector,
  input: HTMLVideoElement | HTMLCanvasElement
): Promise<PersonKeypoint[] | null> {
  const vw = (input as HTMLVideoElement).videoWidth || (input as HTMLCanvasElement).width;
  const vh = (input as HTMLVideoElement).videoHeight || (input as HTMLCanvasElement).height;
  if (!input || vw === 0 || vh === 0) return null;
  const poses = await detector.estimatePoses(input, { maxPoses: 1, flipHorizontal: false });
  if (!poses || poses.length === 0) return null;
  const keypoints: PersonKeypoint[] = poses[0].keypoints.map((k) => ({
    x: k.x,
    y: k.y,
    score: k.score ?? 0,
    name: k.name ?? ""
  }));
  return keypoints;
}
