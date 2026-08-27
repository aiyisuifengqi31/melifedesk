/**
 * 启动耗时埋点（轻量、无 UI、可保留）。
 * - 在控制台逐条打印 [startup] 标记
 * - 在 window.__startupTimings 暴露时间线 [{name, delta, total}]
 * - 在 window.__startupTimelineText 暴露可读文本
 *
 * 用法：在关键阶段调用 StartupPerf.mark("xxx")。
 * 时间基准 T0 = 本模块首次被 import 时（应用最早可触达的代码之一）。
 */

type Mark = { name: string; t: number; total: number; delta: number };

const hasPerf = typeof performance !== "undefined";
const T0 = hasPerf ? performance.now() : Date.now();

const marks: Mark[] = [];
let started = false;
let reported = false;

function nowMs(): number {
  return hasPerf ? performance.now() : Date.now();
}

function push(name: string) {
  const t = nowMs();
  const total = t - T0;
  const delta = marks.length ? t - marks[marks.length - 1].t : total;
  marks.push({ name, t, total, delta });
  // eslint-disable-next-line no-console
  console.log(`[startup] ${name.padEnd(28)} +${Math.round(delta)}ms   (累计 ${Math.round(total)}ms)`);
  if (typeof window !== "undefined") {
    const w = window as unknown as { __startupTimings?: Array<{ name: string; delta: number; total: number }> };
    w.__startupTimings = marks.map((m) => ({ name: m.name, delta: Math.round(m.delta), total: Math.round(m.total) }));
  }
}

export const StartupPerf = {
  start() {
    if (started) return;
    started = true;
    push("App start");
  },
  mark(name: string) {
    push(name);
  },
  report() {
    if (reported) return;
    reported = true;
    const lines = marks.map((m) => `${m.name.padEnd(28)} +${Math.round(m.delta)}ms   累计 ${Math.round(m.total)}ms`).join("\n");
    const totalOf = (name: string) => marks.find((m) => m.name === name)?.total ?? null;
    const interactive = totalOf("Homepage interactive") ?? totalOf("Homepage rendered");
    const summary =
      `T_interactive（打开网站 → 首页可操作）= ${interactive == null ? "n/a" : Math.round(interactive)}ms\n` +
      `Loading 全屏遮罩时长 = ${(() => {
        const dismissed = totalOf("Loading dismissed");
        return dismissed == null ? "n/a" : Math.round(dismissed);
      })()}ms`;
    // eslint-disable-next-line no-console
    console.log(`%c[startup] === 启动时间线 ===\n${lines}\n${summary}`, "color:#8f5a72;font-weight:bold");
    if (typeof window !== "undefined") {
      (window as unknown as { __startupTimelineText?: string }).__startupTimelineText = `${lines}\n${summary}`;
    }
  },
  timeline(): Mark[] {
    return marks.slice();
  }
};
