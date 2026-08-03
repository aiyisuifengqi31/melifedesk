import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

type MobileFormLayoutProps = {
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
};

export function MobileFormLayout({ children, style, testID = "mobile-form-layout" }: MobileFormLayoutProps) {
  return <View testID={testID} style={[styles.form, style]}>{children}</View>;
}

export function MobileFormRow({ children, style, testID }: MobileFormLayoutProps) {
  return <View testID={testID} style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  form: {
    gap: 16
  },
  row: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 12
  }
});
