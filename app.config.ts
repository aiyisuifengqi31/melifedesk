import type { ExpoConfig } from "expo/config";

export default (): ExpoConfig => ({
  name: "帆帆和关关",
  slug: "fanfan-guanguan",
  scheme: "fanfan-guanguan",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  assetBundlePatterns: ["**/*"],
  ios: {
    bundleIdentifier: "com.fanfan.guanguan",
    supportsTablet: true
  },
  android: {
    package: "com.fanfan.guanguan",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#fff8ed"
    }
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/favicon.png"
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#fff8ed"
      }
    ]
  ],
  experiments: {
    baseUrl: process.env.PAGES_BASE_URL || "",
    typedRoutes: true
  }
});
