import { useEffect, useRef, useState } from "react";
import { Animated, Text, type TextStyle } from "react-native";

import { MOTION, prefersReducedMotion } from "./tokens";

type Props = {
  value: number;
  format: (value: number) => string;
  style?: TextStyle;
  duration?: number;
};

/**
 * 轻量数字过渡：数值变化时在 duration 内从旧值平滑递增到新值，
 * 不做复杂滚轮动画，仅 200~350ms 淡入式切换。
 * 开启「减少动态效果」时直接落定终值，不做滚动。
 */
export function AnimatedNumber({ value, format, style, duration = MOTION.number }: Props) {
  const animated = useRef(new Animated.Value(value));
  const prev = useRef(value);
  const [display, setDisplay] = useState(() => format(value));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(format(value));
      prev.current = value;
      animated.current.setValue(value);
      return;
    }
    const node = animated.current;
    node.setValue(prev.current);
    const listener = node.addListener(({ value: v }) => setDisplay(format(v)));
    const animation = Animated.timing(node, { toValue: value, duration, useNativeDriver: false });
    animation.start(({ finished }) => {
      if (finished) {
        node.removeListener(listener);
        setDisplay(format(value));
      }
    });
    prev.current = value;
    return () => {
      node.removeListener(listener);
      animation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <Text style={style}>{display}</Text>;
}
