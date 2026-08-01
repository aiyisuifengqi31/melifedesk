import { router } from "expo-router";

import { AppShell } from "@/components/AppShell";

export default function FunRoute() {
  return <AppShell route="/fun" onNavigate={(href) => router.push(href as never)} />;
}
