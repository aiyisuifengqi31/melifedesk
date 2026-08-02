import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Platform } from "react-native";

import { getPublicAppConfig } from "@/config/app";
import { AuthGate } from "@/auth/AuthGate";
import { WelcomeScreen } from "@/components/WelcomeScreen";

const app = getPublicAppConfig();
const WELCOME_SEEN_KEY = "fanfan-guanguan.welcome.seen.v1";

function hasSeenWelcomeThisSession(): boolean {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return false;
  }
  return window.sessionStorage.getItem(WELCOME_SEEN_KEY) === "1";
}

function markWelcomeSeen() {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }
  window.sessionStorage.setItem(WELCOME_SEEN_KEY, "1");
}

export function shouldShowStartupWelcome({
  pathname,
  platformOS,
  seenThisSession,
  isServerRender = false
}: {
  pathname: string;
  platformOS: typeof Platform.OS;
  seenThisSession: boolean;
  isServerRender?: boolean;
}): boolean {
  if (isServerRender) {
    return false;
  }
  if (platformOS === "web") {
    return false;
  }
  if (pathname === "/login") {
    return false;
  }
  return !seenThisSession;
}

export default function RootLayout() {
  const pathname = usePathname();
  const [showWelcome, setShowWelcome] = useState(() =>
    shouldShowStartupWelcome({
      pathname,
      platformOS: Platform.OS,
      seenThisSession: hasSeenWelcomeThisSession(),
      isServerRender: typeof window === "undefined"
    })
  );

  const handleWelcomeStart = () => {
    markWelcomeSeen();
    setShowWelcome(false);
  };

  if (showWelcome && shouldShowStartupWelcome({ pathname, platformOS: Platform.OS, seenThisSession: false, isServerRender: typeof window === "undefined" })) {
    return (
      <>
        <WelcomeScreen onStart={handleWelcomeStart} />
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
