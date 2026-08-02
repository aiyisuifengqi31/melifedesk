import type { ExpoConfig } from "expo/config";

const app = {
  displayName: "帆帆和关关",
  slug: "fanfan-guanguan",
  scheme: "fanfan-guanguan",
  androidPackage: "com.fanfan.guanguan",
  iosBundleIdentifier: "com.fanfan.guanguan",
  easProjectId: "23bcfc0e-34cc-413c-9ba2-da897f4510cb"
};

export default (): ExpoConfig => {
  return {
    name: app.displayName,
    slug: app.slug,
    scheme: app.scheme,
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    assetBundlePatterns: ["**/*"],
    ios: {
      bundleIdentifier: app.iosBundleIdentifier,
      supportsTablet: true
    },
    android: {
      package: app.androidPackage,
      versionCode: 1,
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
    },
    extra: {
      eas: {
        projectId: app.easProjectId
      }
    }
  };
};
