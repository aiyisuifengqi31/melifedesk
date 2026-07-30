import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AuthPanel } from "@/auth/AuthPanel";
import { getPublicAppConfig } from "@/config/app";

const app = getPublicAppConfig();

export default function LoginRoute() {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = app.webTitle;
    }
  }, []);

  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" role="heading" style={styles.title}>
        {app.displayName}
      </Text>
      <Text style={styles.subtitle}>{app.subtitle}</Text>
      <AuthPanel />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff8ed",
    padding: 24
  },
  title: {
    color: "#34261d",
    fontSize: 32,
    fontWeight: "800"
  },
  subtitle: {
    color: "#7a685c",
    fontSize: 18,
    marginTop: 8
  }
});
