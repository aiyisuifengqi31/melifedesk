import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AuthPanel } from "@/auth/AuthPanel";
import { getPublicAppConfig } from "@/config/app";
import { ContentCard } from "@/shared/ui/primitives";

const app = getPublicAppConfig();
const tokens = {
  accent: "#8f5a72",
  accentSoft: "#f4e4ec",
  background: "#fff8fb",
  border: "#ead4df",
  surface: "#ffffff",
  surfaceMuted: "#fbedf3",
  text: "#332431",
  textMuted: "#786574"
};

export default function LoginRoute() {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = app.webTitle;
    }
  }, []);

  return (
    <View style={styles.root}>
      <ContentCard tokens={tokens}>
        <Text accessibilityRole="header" role="heading" style={styles.title}>
          {app.displayName}
        </Text>
        <Text style={styles.subtitle}>{app.subtitle}</Text>
        <AuthPanel />
      </ContentCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.background,
    padding: 24
  },
  title: {
    color: tokens.text,
    fontSize: 32,
    fontWeight: "800"
  },
  subtitle: {
    color: tokens.textMuted,
    fontSize: 18,
    marginTop: 8
  }
});
