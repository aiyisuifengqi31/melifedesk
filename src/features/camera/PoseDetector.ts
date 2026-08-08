import type { PersonKeypoint } from "./types";

/**
 * 浏览器本地人体姿态检测（TF.js + MoveNet）。
 *
 * - 全部在用户手机本地完成，不调用任何云端 AI，不上传实时画面；
 * - 仅按需动态 import，且只在用户进入人像模式并首次需要时才加载，
 *   不阻塞 PWA 首屏；
 * - MoveNet 模型权重首次需从 TF Hub 下载（运行时网络），之后由浏览器缓存；
 *   若离线首用或加载失败，调用方应降级为「手动人物轮廓 + 普通拍照」。
 */

type RawKeypoint = { x: number; y: number; score?: number; name?: string };
type RawPose = { keypoints: RawKeypoint[] };
type Detector = {
  estimatePoses: (input: HTMLVideoElement, config?: { maxPoses?: number; flipHorizontal?: boolean }) => Promise<RawPose[]>;
};

let detectorPromise: Promise<Detector> | null = null;

export async function loadPoseDetector(): Promise<Detector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const tf = await import("@tensorflow/tfjs");
      await tf.ready();
      const poseDetection = await import("@tensorflow-models/pose-detection");
      const model = poseDetection.SupportedModels.MoveNet;
      const detector = await poseDetection.createDetector(model, {
        modelType: "Lightning"
      });
      return detector as unknown as Detector;
    })().catch((error) => {
      detectorPromise = null; // 允许重试
      throw error;
    });
  }
  return detectorPromise;
}

export async function detectPose(detector: Detector, video: HTMLVideoElement): Promise<PersonKeypoint[] | null> {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
  const poses = await detector.estimatePoses(video, { maxPoses: 1, flipHorizontal: false });
  if (!poses || poses.length === 0) return null;
  const keypoints: PersonKeypoint[] = poses[0].keypoints.map((k) => ({
    x: k.x,
    y: k.y,
    score: k.score ?? 0,
    name: k.name ?? ""
  }));
  return keypoints;
}
