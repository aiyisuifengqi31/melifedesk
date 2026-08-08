import type {
  CameraFacing,
  CameraMode,
  LandscapeGuidance,
  NormBox,
  PortraitGuidance,
  PortraitRecommendation,
  PortraitTemplate
} from "./types";

type DrawParams = {
  mode: CameraMode;
  facing: CameraFacing;
  landscape?: LandscapeGuidance | null;
  portrait?: PortraitGuidance | null;
  portraitTemplate?: PortraitTemplate;
  recommend?: PortraitRecommendation | null;
  manualMode?: boolean;
};

// PortraitTemplate 已在 types.ts 定义并由此处重新导出，供其他模块引用
export type { PortraitTemplate };

const STATUS_COLOR = {
  far: "#9aa3ad",
  near: "#f5c518",
  good: "#36c46b"
} as const;

const SMART_COLOR = "#36c46b"; // 智能推荐目标框
const MANUAL_COLOR = "#9aa3ad"; // 手动构图参考

/** 在相机 canvas 上绘制三分线、水平辅助、推荐区域 / 人物目标轮廓。 */
export function drawOverlay(canvas: HTMLCanvasElement, params: DrawParams): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  if (cssW === 0 || cssH === 0) return;
  if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  drawThirds(ctx, cssW, cssH);

  if (params.mode === "landscape" && params.landscape) {
    drawLandscape(ctx, cssW, cssH, params.landscape);
  } else if (params.mode === "portrait") {
    drawPortrait(ctx, cssW, cssH, params.portrait ?? null, params.recommend ?? null, params.manualMode ?? false, params.portraitTemplate ?? "normal");
  }
}

function drawThirds(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1;
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 2;
  for (let i = 1; i < 3; i++) {
    const x = (w * i) / 3;
    const y = (h * i) / 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLandscape(ctx: CanvasRenderingContext2D, w: number, h: number, g: LandscapeGuidance) {
  if (g.horizonY !== null) {
    const y = g.horizonY * h;
    ctx.save();
    ctx.strokeStyle = "rgba(120,200,255,0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.restore();
  }

  const color = STATUS_COLOR[g.status];
  const box = g.recommend;
  const x = box.x * w;
  const y = box.y * h;
  const bw = box.w * w;
  const bh = box.h * h;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4;
  roundRect(ctx, x, y, bw, bh, 10);
  ctx.stroke();

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.font = "600 13px sans-serif";
  const label = "推荐区域";
  const tw = ctx.measureText(label).width;
  ctx.fillRect(x, y - 22, tw + 12, 18);
  ctx.fillStyle = color;
  ctx.fillText(label, x + 6, y - 9);
  ctx.restore();
}

function drawPortrait(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  g: PortraitGuidance | null,
  recommend: PortraitRecommendation | null,
  manualMode: boolean,
  template: PortraitTemplate
) {
  // 其他候选位置：淡白点，提示"还有这些可选站位"
  if (recommend && recommend.candidates.length > 1) {
    for (const c of recommend.candidates) {
      if (c.side === recommend.best) continue;
      const cx = (c.box.x + c.box.w / 2) * w;
      const cy = (c.box.y + c.box.h / 2) * h;
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const targetBox: NormBox | null = recommend ? recommend.bestBox : g ? g.target : null;
  if (targetBox) {
    const color = manualMode ? MANUAL_COLOR : SMART_COLOR;
    drawPerson(ctx, targetBox, w, h, color, template);
    const label = manualMode ? "手动构图参考" : g && g.detected ? "推荐站位" : "请站这里";
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "600 13px sans-serif";
    const tw = ctx.measureText(label).width;
    const lx = targetBox.x * w;
    const ly = targetBox.y * h - 22;
    ctx.fillRect(lx, ly, tw + 12, 18);
    ctx.fillStyle = color;
    ctx.fillText(label, lx + 6, ly + 13);
    ctx.restore();
  }

  if (g && g.detected && g.actual) {
    const a = g.actual;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(a.x * w, a.y * h, a.w * w, a.h * h);
    ctx.restore();
  }
}

function drawPerson(ctx: CanvasRenderingContext2D, box: NormBox, w: number, h: number, color: string, template: PortraitTemplate) {
  const x = box.x * w;
  const y = box.y * h;
  const bw = box.w * w;
  const bh = box.h * h;
  const cx = x + bw / 2;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4;

  const headR = bw * 0.16;
  const headCx = template === "side" ? cx + bw * 0.06 : cx;
  const headCy = y + headR + bh * 0.04;
  ctx.beginPath();
  ctx.arc(headCx, headCy, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 身体（梯形）
  const shoulderY = headCy + headR + bh * 0.04;
  const hipY = y + bh * 0.62;
  const shoulderW = bw * 0.34;
  const hipW = bw * 0.26;
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW, shoulderY);
  ctx.lineTo(cx + shoulderW, shoulderY);
  ctx.lineTo(cx + hipW, hipY);
  ctx.lineTo(cx - hipW, hipY);
  ctx.closePath();
  ctx.stroke();

  // 腿
  const footY = y + bh * 0.98;
  ctx.beginPath();
  ctx.moveTo(cx - hipW * 0.7, hipY);
  ctx.lineTo(cx - hipW * 0.4, footY);
  ctx.moveTo(cx + hipW * 0.7, hipY);
  ctx.lineTo(cx + hipW * 0.4, footY);
  ctx.stroke();

  // 手臂
  const handY = y + bh * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW, shoulderY + bh * 0.02);
  ctx.lineTo(cx - bw * 0.32, handY);
  ctx.moveTo(cx + shoulderW, shoulderY + bh * 0.02);
  ctx.lineTo(cx + bw * 0.32, handY);
  ctx.stroke();

  if (template === "normal" || template === "side") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(headCx + (template === "side" ? headR * 0.4 : 0), headCy, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
