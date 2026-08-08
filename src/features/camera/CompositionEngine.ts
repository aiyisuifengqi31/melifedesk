import type { CompositionStatus, LandscapeGuidance, NormBox } from "./types";

/**
 * 本地构图指导引擎（纯函数，无 AI / 无网络）。
 *
 * 输入：一帧降采样后的 RGBA 像素数据 + 宽高。
 * 输出：推荐构图区域、主体大致位置、地平线估计、状态与提示。
 *
 * 仅做启发式图像统计（亮度质量分布、水平梯度、三分位置偏差），
 * 不识别景物名称，符合 V1「告诉普通用户手机往哪移」的目标。
 */

type Stats = {
  colLum: number[]; // 每列平均亮度（已归一化 0..1）
  rowLum: number[]; // 每行平均亮度
  totalLum: number;
};

function buildStats(pixels: Uint8ClampedArray, w: number, h: number): Stats {
  const colLum = new Array(w).fill(0);
  const colCount = new Array(w).fill(0);
  const rowLum = new Array(h).fill(0);
  const rowCount = new Array(h).fill(0);
  const step = Math.max(1, Math.floor((w * h) / (160 * 120)));
  let total = 0;
  for (let i = 0; i < pixels.length; i += 4 * step) {
    const x = ((i / 4) % w);
    const y = Math.floor(i / 4 / w);
    const lum = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]) / 255;
    colLum[x] += lum;
    colCount[x] += 1;
    rowLum[y] += lum;
    rowCount[y] += 1;
    total += lum;
  }
  for (let x = 0; x < w; x++) colLum[x] = colCount[x] ? colLum[x] / colCount[x] : 0;
  for (let y = 0; y < h; y++) rowLum[y] = rowCount[y] ? rowLum[y] / rowCount[y] : 0;
  return { colLum, rowLum, totalLum: total };
}

function massCenter(stats: Stats, w: number, h: number): { cx: number; cy: number } {
  let sx = 0;
  let sy = 0;
  let sum = 0;
  for (let x = 0; x < w; x++) {
    sx += x * stats.colLum[x];
    sum += stats.colLum[x];
  }
  for (let y = 0; y < h; y++) {
    sy += y * stats.rowLum[y];
  }
  const cx = sum > 0 ? sx / sum / (w - 1) : 0.5;
  const cy = sum > 0 ? sy / sum / (h - 1) : 0.5;
  return { cx, cy };
}

function regionWeight(colLum: number[], w: number, a: number, b: number): number {
  const lo = Math.floor(a * w);
  const hi = Math.floor(b * w);
  let s = 0;
  for (let x = lo; x < hi; x++) s += colLum[x];
  return s / Math.max(1, hi - lo);
}

function detectHorizon(rowLum: number[], h: number): { y: number | null; tiltDeg: number } {
  // 行亮度梯度（平滑后）
  const smooth: number[] = [];
  for (let y = 0; y < h; y++) {
    const a = rowLum[Math.max(0, y - 1)];
    const b = rowLum[Math.min(h - 1, y + 1)];
    smooth.push((a + 2 * rowLum[y] + b) / 4);
  }
  let bestY: number | null = null;
  let bestGrad = 0;
  for (let y = 1; y < h - 1; y++) {
    const g = Math.abs(smooth[y + 1] - smooth[y - 1]);
    if (g > bestGrad) {
      bestGrad = g;
      bestY = y;
    }
  }
  if (bestY === null || bestGrad < 0.04) return { y: null, tiltDeg: 0 };
  // 倾斜：对比左半与右半各自的地平线行
  const half = Math.floor(h / 2);
  const leftPeak = peakRow(smooth, 0, half);
  const rightPeak = peakRow(smooth, half, h);
  const tiltDeg = (rightPeak - leftPeak) / (h / 2) * 45;
  return { y: bestY / (h - 1), tiltDeg };
}

function peakRow(smooth: number[], lo: number, hi: number): number {
  let best = lo;
  let bestG = -1;
  for (let y = lo + 1; y < hi - 1; y++) {
    const g = Math.abs(smooth[y + 1] - smooth[y - 1]);
    if (g > bestG) {
      bestG = g;
      best = y;
    }
  }
  return best;
}

function pickRecommend(stats: Stats, w: number, mass: { cx: number; cy: number }): { box: NormBox; rule: LandscapeGuidance["rule"] } {
  const left = regionWeight(stats.colLum, w, 0, 1 / 3);
  const center = regionWeight(stats.colLum, w, 1 / 3, 2 / 3);
  const right = regionWeight(stats.colLum, w, 2 / 3, 1);

  let cx = 0.62;
  let rule: LandscapeGuidance["rule"] = "thirds";
  if (right < left * 0.75) {
    cx = 0.67; // 右侧更空，放右侧三分位
  } else if (left < right * 0.75) {
    cx = 0.33; // 左侧更空
    rule = "thirds";
  } else if (Math.abs(left - right) < 0.05 * Math.max(1, center)) {
    cx = 0.5; // 近似对称
    rule = "symmetry";
  }

  let cy = 0.6;
  const top = regionWeight(stats.rowLum, stats.rowLum.length, 0, 1 / 3);
  const bottom = regionWeight(stats.rowLum, stats.rowLum.length, 2 / 3, 1);
  if (top > bottom * 1.15) {
    cy = 0.66; // 上方偏亮（天空），主体放下三分
    rule = "horizon";
  } else if (center > left && center > right) {
    cy = 0.5;
  }

  const size = 0.26;
  return { box: { x: Math.min(0.92 - size, Math.max(0.04, cx - size / 2)), y: Math.min(0.92 - size, Math.max(0.04, cy - size / 2)), w: size, h: size }, rule };
}

function statusFromScore(score: number): CompositionStatus {
  if (score >= 0.72) return "good";
  if (score >= 0.45) return "near";
  return "far";
}

export function analyzeFrame(pixels: Uint8ClampedArray, w: number, h: number): LandscapeGuidance {
  const stats = buildStats(pixels, w, h);
  const mass = massCenter(stats, w, h);
  const horizon = detectHorizon(stats.rowLum, h);
  const { box, rule } = pickRecommend(stats, w, mass);

  const dx = mass.cx - (box.x + box.w / 2);
  const dy = mass.cy - (box.y + box.h / 2);
  const dist = Math.min(1, Math.hypot(dx, dy) / 0.5);

  const tiltPenalty = Math.min(0.5, Math.abs(horizon.tiltDeg) / 60);
  const score = Math.max(0, Math.min(1, 1 - dist * 0.7 - tiltPenalty));

  const status = statusFromScore(score);
  const hint = buildHint(dx, dy, horizon, status);

  return {
    rule,
    status,
    score,
    recommend: box,
    mainMass: mass,
    horizonY: horizon.y,
    horizonTiltDeg: horizon.tiltDeg,
    hint
  };
}

function buildHint(dx: number, dy: number, horizon: { y: number | null; tiltDeg: number }, status: CompositionStatus): string {
  if (status === "good") return "✓ 构图合适，可以拍了";
  const parts: string[] = [];
  // 只有出现明显方向偏差时才提示移动，避免无意义反复要求用户挪动
  if (dx > 0.1) parts.push("→ 向右侧构图");
  else if (dx < -0.1) parts.push("← 向左侧构图");
  if (dy > 0.1) parts.push("↓ 下移一点");
  else if (dy < -0.1) parts.push("↑ 上移一点");
  if (horizon.y !== null && Math.abs(horizon.tiltDeg) > 6) {
    parts.push(horizon.tiltDeg > 0 ? "手机稍微向左旋转" : "手机稍微向右旋转");
  }
  if (parts.length === 0) return "当前画面构图较均衡";
  return parts.join("　");
}
