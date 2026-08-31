import { forwardRef, useRef } from "react";
import { Animated, Pressable, View, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { MOTION, prefersReducedMotion } from "./tokens";

type Props = Omit<PressableProps, "style"> & {
  style?: PressableProps["style"];
  wrapperStyle?: StyleProp<ViewStyle>;
  wrapperTestID?: string;
  children?: React.ReactNode;
  /** 按压时轻微振动毫秒数（仅 Android 支持，不支持时自动忽略）。0 表示不振动。 */
  vibrate?: number;
};

/**
 * 统一的轻量按压反馈：按下时 scale 0.97，松开恢复。
 * 不改变布局语义，仅作为视觉微交互复用，避免每个按钮各写一套动画。
 */
export const PressableScale = forwardRef<View, Props>(function PressableScale(
  { style, wrapperStyle, wrapperTestID, children, vibrate = 0, onPressIn, onPressOut, onPress, ...rest },
  ref
) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (to: number) => {
    if (prefersReducedMotion()) {
      scale.setValue(to);
      return;
    }
    Animated.timing(scale, { toValue: to, duration: MOTION.press, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, wrapperStyle]} testID={wrapperTestID}>
      <Pressable
        {...rest}
        ref={ref as never}
        style={style}
        onPressIn={(e: GestureResponderEvent) => {
          animateTo(0.97);
          onPressIn?.(e);
        }}
        onPressOut={(e: GestureResponderEvent) => {
          animateTo(1);
          onPressOut?.(e);
        }}
        onPress={(e: GestureResponderEvent) => {
          if (vibrate && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            try {
              navigator.vibrate(vibrate);
            } catch {
              /* 不支持时忽略 */
            }
          }
          onPress?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
});
