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
      style={styles.iconFrame}
      testID={`nav-icon-${routeKey}`}
    >
      <SvgXml height={30} testID={`nav-icon-svg-${routeKey}`} width={30} xml={resource.xml} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32
  }
});
