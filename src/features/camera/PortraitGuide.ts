import type { CompositionStatus, NormBox, PersonKeypoint, PortraitBody, PortraitGuidance, PortraitSide } from "./types";

/**
 * 人像模式指引（纯函数，无 AI）。
 *
 * - 根据背景左右复杂度推荐人物站位（左 / 中 / 右三分位）；
 * - 由真实人体关键点算出 actualPersonBox，与目标 targetPersonBox 比较，
 *   给出普通人能看懂的左右 / 远近 / 上下指导。
 */

export function targetBox(side: PortraitSide, body: PortraitBody): NormBox {
  const cx = side === "left" ? 0.27 : side === "center" ? 0.5 : 0.72;
  if (body === "half") {
    const w = 0.46;
    const h = 0.5;
    return { x: clamp01(cx - w / 2), y: 0.14, w, h };
  }
  const w = 0.32;
  const h = 0.76;
  return { x: clamp01(cx - w / 2), y: 0.12, w, h };
}

function clamp01(v: number): number {
  return Math.min(0.96, Math.max(0.02, v));
}

function columnWeight(pixels: Uint8ClampedArray, w: number, h: number, a: number, b: number): number {
  const lo = Math.floor(a * w);
  const hi = Math.floor(b * w);
  let sum = 0;
  let count = 0;
  const step = Math.max(1, Math.floor((w * h) / (160 * 120)));
  for (let i = 0; i < pixels.length; i += 4 * step) {
    const x = (i / 4) % w;
    if (x < lo || x >= hi) continue;
    const lum = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]) / 255;
    sum += lum;
    count += 1;
  }
  return count ? sum / count : 0;
}

/** 背景左右哪一侧更空，就把人物放哪一侧。 */
export function chooseSide(pixels: Uint8ClampedArray, w: number, h: number): PortraitSide {
  const left = columnWeight(pixels, w, h, 0, 1 / 3);
  const right = columnWeight(pixels, w, h, 2 / 3, 1);
  if (right < left * 0.7) return "right";
  if (left < right * 0.7) return "left";
  if (Math.abs(left - right) < 0.04) return "center";
  return "right"; // 无法可靠判断时默认右侧三分位
}

export function personBoxFromKeypoints(keypoints: PersonKeypoint[], vw: number, vh: number): NormBox | null {
  const valid = keypoints.filter((k) => k.score > 0.2 && vw > 0 && vh > 0);
  if (valid.length < 4) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const k of valid) {
    if (k.x < minX) minX = k.x;
    if (k.y < minY) minY = k.y;
    if (k.x > maxX) maxX = k.x;
    if (k.y > maxY) maxY = k.y;
  }
  const x = minX / vw;
  const y = minY / vh;
  const w = (maxX - minX) / vw;
  const hh = (maxY - minY) / vh;
  if (w <= 0 || hh <= 0) return null;
  return { x, y, w, h: hh };
}

function statusFrom(dxAbs: number, sizeRatio: number, dyAbs: number): CompositionStatus {
  const sizeOk = sizeRatio >= 0.82 && sizeRatio <= 1.18;
  if (dxAbs < 0.06 && sizeOk && dyAbs < 0.07) return "good";
  if (dxAbs < 0.14 && sizeOk) return "near";
  return "far";
}

export function guidanceFor(target: NormBox, actual: NormBox | null, side: PortraitSide, body: PortraitBody): PortraitGuidance {
  const tCx = target.x + target.w / 2;
  const tCy = target.y + target.h / 2;
  const detected = actual !== null;

  if (!actual) {
    return { side, body, target, actual: null, status: "far", detected: false, hint: "未检测到人物，请站到画面中" };
  }

  const aCx = actual.x + actual.w / 2;
  const aCy = actual.y + actual.h / 2;
  const dx = tCx - aCx; // >0 表示实际在目标左侧
  const dy = tCy - aCy;
  const sizeRatio = actual.h / Math.max(0.001, target.h);

  const dxAbs = Math.abs(dx);
  const dyAbs = Math.abs(dy);
  const status = statusFrom(dxAbs, sizeRatio, dyAbs);

  const parts: string[] = [];
  if (dx > 0.06) parts.push("人物向右一步 →");
  else if (dx < -0.06) parts.push("← 人物向左一步");
  if (sizeRatio < 0.82) parts.push("靠近一点");
  else if (sizeRatio > 1.18) parts.push("后退一点");
  if (dy > 0.07) parts.push("蹲低一点");
  else if (dy < -0.07) parts.push("站高一点");

  let hint: string;
  if (status === "good") hint = "✓ 位置很好";
  else hint = parts.length ? parts.join("　") : "微调一下位置";

  return { side, body, target, actual, status, detected: true, hint };
}
