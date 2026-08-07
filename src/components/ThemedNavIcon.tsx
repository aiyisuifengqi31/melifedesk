import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";

import type { RouteKey } from "@/navigation/items";
import type { ThemeDefinition } from "@/theme/types";

type ThemedNavIconProps = {
  routeKey: RouteKey;
  selected: boolean;
  size?: number;
  theme: ThemeDefinition;
};

export function ThemedNavIcon({ routeKey, selected, size = 30, theme }: ThemedNavIconProps) {
  const resource = selected ? theme.icons[routeKey].selected : theme.icons[routeKey].unselected;
  const state = selected ? "selected" : "unselected";

  return (
    <View
      accessibilityLabel={`${theme.id} ${routeKey} ${state} icon`}
      nativeID={`nav-icon-${routeKey}`}
      style={styles.iconFrame}
      testID={`nav-icon-${routeKey}`}
    >
      <SvgXml height={size} testID={`nav-icon-svg-${routeKey}`} width={size} xml={resource.xml} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    alignItems: "center",
    justifyContent: "center"
  }
});
