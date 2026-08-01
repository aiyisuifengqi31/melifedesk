import { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";

type AnimatedToggleProps = {
  onToggle: () => void;
  themeTokens: UiTokens;
  value: boolean;
};

export function AnimatedToggle({ onToggle, themeTokens, value }: AnimatedToggleProps) {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const thumbOffset = 30;

  useEffect(() => {
    Animated.timing(animatedValue, {
      duration: 220,
      toValue: value ? 1 : 0,
      useNativeDriver: false
    }).start();
  }, [value, animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, thumbOffset]
  });
  const trackColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#d8e8d8", themeTokens.accent]
  });

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={value ? "关闭" : "开启"} accessibilityState={{ checked: value }} onPress={onToggle}>
      <Animated.View
        style={{
          backgroundColor: trackColor,
          borderRadius: 999,
          height: 36,
          justifyContent: "center",
          padding: 3,
          width: 64
        }}
      >
        <Animated.View
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 999,
            height: 30,
            transform: [{ translateX }],
            width: 30
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
