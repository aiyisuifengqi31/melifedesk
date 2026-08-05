import { RefObject, useEffect } from "react";

// RN Web 在 minify 后不会透传非标准的 WebkitTouchCallout 样式，
// 因此在 web 上用 ref 直接给 DOM 节点设置，禁止 iOS / 微信长按呼出复制、分享气泡。
// 原生环境 ref.current 是 View 实例（无 style），会自动跳过，不影响原生构建。
export function useDisableTouchCallout(ref: RefObject<unknown>) {
  useEffect(() => {
    const node = ref.current as unknown as { style?: { webkitTouchCallout?: string } } | null;
    if (node && node.style) {
      node.style.webkitTouchCallout = "none";
    }
  }, [ref]);
}
