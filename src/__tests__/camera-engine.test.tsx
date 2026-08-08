import { analyzeFrame } from "@/features/camera/CompositionEngine";
import { chooseSide, guidanceFor, personBoxFromKeypoints, targetBox } from "@/features/camera/PortraitGuide";
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
  it("左侧高亮时主体偏左并给出向左构图提示", () => {
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
});

describe("PortraitGuide", () => {
  it("targetBox 右侧三分位中心约 0.72", () => {
    const box = targetBox("right", "full");
    const cx = box.x + box.w / 2;
    expect(cx).toBeGreaterThan(0.6);
    expect(cx).toBeLessThan(0.85);
  });

  it("背景右侧更空时自动推荐右侧", () => {
    const w = 60;
    const h = 60;
    const pixels = makePixels(w, h, (x) => (x < (2 * w) / 3 ? [220, 220, 220] : [40, 40, 40]));
    expect(chooseSide(pixels, w, h)).toBe("right");
  });

  it("关键点不足时返回 null", () => {
    const kps: PersonKeypoint[] = [
      { x: 10, y: 10, score: 0.9, name: "nose" }
    ];
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
