import type { CandidateSide, CompositionStatus, NormBox, PersonKeypoint, PortraitBody, PortraitGuidance, PortraitRecommendation, PortraitSide } from "./types";

/**
 * 人像模式指引（纯函数，无 AI）。
 *
 * 与旧版单纯「哪边空就放哪边」不同，本版：
 * 1. 生成多个候选站位（左 / 中 / 右，全身再加左下 / 右下）；
 * 2. 对每个候选框用 10 项背景指标打分（复杂度 / 边缘密度 / 显著主体 /
 *    三分 / 对称 / 遮挡 / 头部杂乱线 / 留白 / 贴边）；
 * 3. 取最高分作为推荐，并给出可解释理由；
 * 4. 低置信度时明确说「没有明显最佳站位」，不假装知道。
 *
 * 稳定性（防抖动）由调用方用 EMA 滑动平均处理「best 选择」，本文件保持纯函数。
 */

const CANDIDATE_CX: Record<CandidateSide, number> = {
  left: 0.27,
  center: 0.5,
  right: 0.72,
  lowerLeft: 0.27,
  lowerRight: 0.72
};

export function targetBox(side: PortraitSide, body: PortraitBody): NormBox {
  return candidateBox(side, body);
}

/** 候选框几何：半身放大、全身留顶/底；lower 变体给人物更多头顶留白。 */
export function candidateBox(side: CandidateSide, body: PortraitBody): NormBox {
  const cx = CANDIDATE_CX[side];
  const isLower = side === "lowerLeft" || side === "lowerRight";
  if (body === "half") {
    const w = 0.46;
    const h = 0.5;
    const y = isLower ? 0.3 : 0.14;
    return { x: clamp01(cx - w / 2), y, w, h };
  }
  const w = 0.32;
  const h = 0.76;
  const y = isLower ? 0.2 : 0.12;
  return { x: clamp01(cx - w / 2), y, w, h };
}

function clamp01(v: number): number {
  return Math.min(0.96, Math.max(0.02, v));
}

// ---------- 帧统计 ----------

type Maps = { lum: Float32Array; w: number; h: number };

function buildMaps(pixels: Uint8ClampedArray, w: number, h: number): Maps {
  const lum = new Float32Array(w * h);
  const step = Math.max(1, Math.floor((w * h) / (160 * 120)));
  for (let i = 0; i < pixels.length; i += 4 * step) {
    const idx = (i / 4) | 0;
    const x = idx % w;
    const y = (idx / w) | 0;
    const L = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]) / 255;
    lum[y * w + x] = L;
  }
  return { lum, w, h };
}

function regionAvg(maps: Maps, box: NormBox): number {
  const { lum, w, h } = maps;
  const x0 = Math.max(0, Math.floor(box.x * w));
  const x1 = Math.min(w - 1, Math.floor((box.x + box.w) * w));
  const y0 = Math.max(0, Math.floor(box.y * h));
  const y1 = Math.min(h - 1, Math.floor((box.y + box.h) * h));
  let s = 0;
  let c = 0;
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      s += lum[y * w + x];
      c += 1;
    }
  }
  return c ? s / c : 0.5;
}

/** 区域亮度方差（背景视觉复杂度）：越高越"乱"。归一到 0..1。 */
function regionComplexity(maps: Maps, box: NormBox): number {
  const { lum, w, h } = maps;
  const x0 = Math.max(0, Math.floor(box.x * w));
  const x1 = Math.min(w - 1, Math.floor((box.x + box.w) * w));
  const y0 = Math.max(0, Math.floor(box.y * h));
  const y1 = Math.min(h - 1, Math.floor((box.y + box.h) * h));
  const vals: number[] = [];
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      vals.push(lum[y * w + x]);
    }
  }
  if (vals.length < 2) return 0.5;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  let v = 0;
  for (const vv of vals) v += (vv - mean) * (vv - mean);
  const sd = Math.sqrt(v / vals.length);
  return Math.min(1, sd * 2.2);
}

/** 区域边缘密度（梯度幅值均值）：越高线条越密。归一到 0..1。 */
function regionEdge(maps: Maps, box: NormBox): number {
  const { lum, w, h } = maps;
  const x0 = Math.max(1, Math.floor(box.x * w));
  const x1 = Math.min(w - 2, Math.floor((box.x + box.w) * w));
  const y0 = Math.max(1, Math.floor(box.y * h));
  const y1 = Math.min(h - 2, Math.floor((box.y + box.h) * h));
  let s = 0;
  let c = 0;
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      const gx = Math.abs(lum[y * w + (x + 1)] - lum[y * w + (x - 1)]);
      const gy = Math.abs(lum[(y + 1) * w + x] - lum[(y - 1) * w + x]);
      s += Math.min(1, (gx + gy) * 1.6);
      c += 1;
    }
  }
  return c ? s / c : 0.5;
}

/** 局部对比度：某点邻域梯度幅值（0..1）。 */
function localContrast(lum: Float32Array, w: number, h: number, x: number, y: number): number {
  const x1 = Math.max(0, x - 1);
  const x2 = Math.min(w - 1, x + 1);
  const y1 = Math.max(0, y - 1);
  const y2 = Math.min(h - 1, y + 1);
  const gx = Math.abs(lum[y * w + x2] - lum[y * w + x1]);
  const gy = Math.abs(lum[y1 * w + x] - lum[y2 * w + x]);
  return Math.min(1, gx + gy);
}

/**
 * 显著主体中心：寻找"紧凑高对比团块"的质心。
 * 仅当高对比像素占比在 2%~40% 之间才视为一个主体——
 * 低于 2% 视为无主体；高于 40% 视为整幅纹理/一条贯穿全图的线（如地平线），
 * 不作为遮挡主体处理，避免把地平线误判成要躲开的人。
 */
function salientCenter(maps: Maps): { x: number; y: number } | null {
  const { lum, w, h } = maps;
  const step = Math.max(2, Math.floor(w / 80));
  let sx = 0;
  let sy = 0;
  let sw = 0;
  let count = 0;
  let total = 0;
  for (let y = step; y < h - step; y += step) {
    for (let x = step; x < w - step; x += step) {
      const c = localContrast(lum, w, h, x, y);
      total += 1;
      if (c > 0.25) {
        sx += x * c;
        sy += y * c;
        sw += c;
        count += 1;
      }
    }
  }
  if (sw < 1e-6) return null;
  const frac = count / total;
  if (frac < 0.02 || frac > 0.4) return null;
  return { x: sx / sw / w, y: sy / sw / h };
}

function pointInBox(p: { x: number; y: number }, box: NormBox): boolean {
  return p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
}

function nearThirds(cx: number, cy: number): boolean {
  const xs = [1 / 6, 1 / 3, 2 / 3, 5 / 6];
  const ys = [1 / 3, 2 / 3];
  const near = (v: number, arr: number[]) => arr.some((a) => Math.abs(v - a) < 0.12);
  return near(cx, xs) && near(cy, ys);
}

function symmetryScore(maps: Maps): number {
  const { lum, w, h } = maps;
  let diff = 0;
  let c = 0;
  const step = Math.max(2, Math.floor(w / 60));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < Math.floor(w / 2); x += step) {
      const l = lum[y * w + x];
      const r = lum[y * w + (w - 1 - x)];
      diff += Math.abs(l - r);
      c += 1;
    }
  }
  const meanDiff = c ? diff / c : 1;
  return Math.max(0, 1 - meanDiff * 2.5);
}

// ---------- 评分 ----------

export type CandidateScore = {
  side: CandidateSide;
  box: NormBox;
  norm: number;
  reasons: string[];
};

/** 候选站位评分：根据真实背景挑选最适合放人的位置。 */
export function evaluateCandidates(pixels: Uint8ClampedArray, w: number, h: number, body: PortraitBody): PortraitRecommendation {
  const maps = buildMaps(pixels, w, h);
  const sides: CandidateSide[] = body === "half" ? ["left", "center", "right"] : ["left", "center", "right", "lowerLeft", "lowerRight"];
  const salient = salientCenter(maps);
  const cleanL = 1 - regionComplexity(maps, { x: 0, y: 0, w: 1 / 3, h: 1 });
  const cleanC = 1 - regionComplexity(maps, { x: 1 / 3, y: 0, w: 1 / 3, h: 1 });
  const cleanR = 1 - regionComplexity(maps, { x: 2 / 3, y: 0, w: 1 / 3, h: 1 });

  const scored: CandidateScore[] = sides.map((side) => {
    const box = candidateBox(side, body);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;

    const comp = regionComplexity(maps, box);
    const edge = regionEdge(maps, box);
    const clean = 1 - (0.6 * comp + 0.4 * edge);

    let occ = 0;
    if (salient && pointInBox(salient, box)) occ = 1;
    const headBox: NormBox = { x: box.x + box.w * 0.34, y: box.y, w: box.w * 0.32, h: box.h * 0.18 };
    const headEdge = regionEdge(maps, headBox);

    const thirdsBonus = nearThirds(cx, cy) ? 0.12 : 0;
    const symBonus = side === "center" ? symmetryScore(maps) * 0.18 : 0;

    const touchesEdge = box.x < 0.04 || box.y < 0.04 || box.x + box.w > 0.96 || box.y + box.h > 0.96;
    const margin = touchesEdge ? -0.18 : 0;

    const raw = clean * 1.0 + thirdsBonus + symBonus - occ * 0.55 - headEdge * 0.18 + margin;
    const norm = Math.min(1, Math.max(0, (raw + 1) / 2));
    void raw;

    const reasons: string[] = [];
    if (side === "right" && cleanR > cleanL + 0.08) reasons.push("右侧背景较干净");
    if (side === "left" && cleanL > cleanR + 0.08) reasons.push("左侧背景较干净");
    if (cleanL < Math.min(cleanC, cleanR) - 0.08) reasons.push("左侧存在明显视觉主体");
    if (cleanR < Math.min(cleanC, cleanL) - 0.08) reasons.push("右侧存在明显视觉主体");
    if (occ > 0) reasons.push("避免遮挡主要背景主体");
    if (thirdsBonus > 0) reasons.push("三分位构图更协调");
    if (side === "center" && symBonus > 0.06) reasons.push("画面左右对称，适合居中");
    if (reasons.length === 0) reasons.push("综合背景较为均衡");

    return { side, box, norm, reasons };
  });

  scored.sort((a, b) => b.norm - a.norm);
  const top = scored[0];
  const second = scored[1] ?? { norm: 0 };
  const confidence = Math.max(0, Math.min(1, top.norm - second.norm));
  const lowConfidence = confidence < 0.06;

  return {
    best: top.side,
    bestBox: top.box,
    confidence,
    lowConfidence,
    reasons: lowConfidence ? [] : top.reasons,
    candidates: scored,
    auto: true
  };
}

/** 手动模式：用户明确选择左 / 中 / 右，不再跑背景分析。 */
export function manualRecommend(side: PortraitSide, body: PortraitBody): PortraitRecommendation {
  const box = candidateBox(side, body);
  return {
    best: side,
    bestBox: box,
    confidence: 0,
    lowConfidence: false,
    reasons: ["已切换到手动构图参考"],
    candidates: [{ side, box, norm: 1, reasons: ["手动构图参考"] }],
    auto: false
  };
}

// ---------- 真实人物检测 + 引导 ----------

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
