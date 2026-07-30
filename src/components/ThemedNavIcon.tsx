import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";

import type { RouteKey } from "@/navigation/items";
import type { ThemeDefinition } from "@/theme/types";

type ThemedNavIconProps = {
  routeKey: RouteKey;
  selected: boolean;
  theme: ThemeDefinition;
};

export function ThemedNavIcon({ routeKey, selected, theme }: ThemedNavIconProps) {
  const resource = selected ? theme.icons[routeKey].selected : theme.icons[routeKey].unselected;
  const state = selected ? "selected" : "unselected";
  const webDataAttributes = { dataSet: { iconSource: resource.source } } as Record<string, unknown>;

  return (
    <View
      {...webDataAttributes}
      accessibilityLabel={`${theme.id} ${routeKey} ${state} icon`}
      nativeID={`nav-icon-${routeKey}`}
      style={[styles.iconFrame, selected ? styles.iconFrameSelected : styles.iconFrameIdle]}
      testID={`nav-icon-${routeKey}`}
    >
      <SvgXml height={24} testID={`nav-icon-svg-${routeKey}`} width={24} xml={resource.xml} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    alignItems: "center",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  iconFrameIdle: {
    backgroundColor: "rgba(255, 255, 255, 0.54)"
  },
  iconFrameSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.92)"
  }
});
