import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";

import { getPublicAppConfig } from "@/config/app";
import { AuthGate } from "@/auth/AuthGate";
import { WelcomeScreen } from "@/components/WelcomeScreen";

const app = getPublicAppConfig();

export default function RootLayout() {
  const [showWelcome, setShowWelcome] = useState(true);

  if (showWelcome) {
    return (
      <>
        <WelcomeScreen onStart={() => setShowWelcome(false)} />
        <StatusBar style="auto" />
      </>
    );
  }

  return (
    <>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, title: app.webTitle }} />
      </AuthGate>
      <StatusBar style="auto" />
    </>
  );
}
