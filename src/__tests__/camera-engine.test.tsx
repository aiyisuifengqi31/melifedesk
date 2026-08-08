import { analyzeFrame } from "@/features/camera/CompositionEngine";
import { evaluateCandidates, guidanceFor, personBoxFromKeypoints, targetBox } from "@/features/camera/PortraitGuide";
import type { PersonKeypoint } from "@/features/camera/types";

function makePixels(w: number, h: number, fill: (x: number, y: number) => [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

describe("CompositionEngine", () => {
  it("左侧高亮时主体偏左并给出构图提示", () => {
    const w = 60;
    const h = 60;
    const pixels = makePixels(w, h, (x) => (x < w / 3 ? [240, 240, 240] : [40, 40, 40]));
    const g = analyzeFrame(pixels, w, h);
    expect(g.mainMass.cx).toBeLessThan(0.5);
    expect(typeof g.hint).toBe("string");
    expect(g.hint.length).toBeGreaterThan(0);
  });

  it("均匀画面不崩溃且返回合法状态", () => {
    const w = 60;
    const h = 60;
    const pixels = makePixels(w, h, () => [120, 120, 120]);
    const g = analyzeFrame(pixels, w, h);
    expect(["far", "near", "good"]).toContain(g.status);
    expect(g.score).toBeGreaterThanOrEqual(0);
    expect(g.score).toBeLessThanOrEqual(1);
  });

  it("无明显方向偏差时返回均衡提示而非反复移动", () => {
    const w = 60;
    const h = 60;
    const pixels = makePixels(w, h, () => [120, 120, 120]);
    const g = analyzeFrame(pixels, w, h);
    if (g.status !== "good") {
      expect(g.hint).toBe("当前画面构图较均衡");
    }
  });
});

describe("PortraitGuide 候选评分", () => {
  it("targetBox 右侧三分位中心约 0.72", () => {
    const box = targetBox("right", "full");
    const cx = box.x + box.w / 2;
    expect(cx).toBeGreaterThan(0.6);
    expect(cx).toBeLessThan(0.85);
  });

  it("背景右侧更空（左侧杂乱）时推荐右侧候选", () => {
    const w = 60;
    const h = 60;
    // 左 2/3 周期纹理（杂乱），右 1/3 均匀（干净）；周期 4 避免被分析采样混叠成纯色
    const pixels = makePixels(w, h, (x, y) =>
      x < (2 * w) / 3 ? ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? [240, 240, 240] : [20, 20, 20]) : [40, 40, 40]
    );
    const rec = evaluateCandidates(pixels, w, h, "full");
    expect(["right", "lowerRight"]).toContain(rec.best);
    expect(rec.auto).toBe(true);
  });

  it("左侧更空（右侧杂乱）时推荐左侧候选", () => {
    const w = 60;
    const h = 60;
    const pixels = makePixels(w, h, (x, y) =>
      x > w / 3 ? ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? [240, 240, 240] : [20, 20, 20]) : [40, 40, 40]
    );
    const rec = evaluateCandidates(pixels, w, h, "full");
    expect(["left", "lowerLeft"]).toContain(rec.best);
  });

  it("完全均匀场景置信度低，不假装知道最佳站位", () => {
    const w = 60;
    const h = 60;
    const pixels = makePixels(w, h, () => [120, 120, 120]);
    const rec = evaluateCandidates(pixels, w, h, "full");
    expect(rec.lowConfidence).toBe(true);
    expect(rec.reasons.length).toBe(0);
  });

  it("关键点不足时返回 null", () => {
    const kps: PersonKeypoint[] = [{ x: 10, y: 10, score: 0.9, name: "nose" }];
    expect(personBoxFromKeypoints(kps, 100, 100)).toBeNull();
  });

  it("实际位置接近目标时状态为 good", () => {
    const target = targetBox("center", "full");
    const actual = { x: target.x + 0.01, y: target.y + 0.01, w: target.w, h: target.h };
    const g = guidanceFor(target, actual, "center", "full");
    expect(g.status).toBe("good");
    expect(g.hint).toContain("位置很好");
  });

  it("实际明显偏左时提示向右一步", () => {
    const target = targetBox("center", "full");
    const actual = { x: target.x - target.w * 0.4, y: target.y, w: target.w, h: target.h };
    const g = guidanceFor(target, actual, "center", "full");
    expect(g.hint).toContain("向右");
  });
});
