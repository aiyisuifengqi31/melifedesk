/**
 * 把非关键任务推迟到「首帧绘制之后」再执行。
 *
 * 启动阶段的云端水合都属于“可以晚一点”的任务：先让首页画出来、能点，
 * 再去发网络请求。同时所有调用方都用同一个调度器，这样它们会落在同一个
 * 宏任务里，cloudSync 的批量窗口能把多个 key 合并成一次请求。
 */

export function runAfterFirstPaint(task: () => void): () => void {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    const timer = setTimeout(task, 0);
    return () => clearTimeout(timer);
  }

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const frame = window.requestAnimationFrame(() => {
    if (cancelled) return;
    timer = setTimeout(() => {
      if (!cancelled) task();
    }, 0);
  });

  return () => {
    cancelled = true;
    window.cancelAnimationFrame?.(frame);
    if (timer) clearTimeout(timer);
  };
}
