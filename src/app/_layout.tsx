import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { getPublicAppConfig } from "@/config/app";

const app = getPublicAppConfig();

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false, title: app.webTitle }} />
      <StatusBar style="auto" />
    </>
  );
}
