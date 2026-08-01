import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { getPublicAppConfig } from "@/config/app";
import { AuthGate } from "@/auth/AuthGate";

const app = getPublicAppConfig();

export default function RootLayout() {
  return (
    <>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, title: app.webTitle }} />
      </AuthGate>
      <StatusBar style="auto" />
    </>
  );
}
