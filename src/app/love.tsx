import { useRouter } from "expo-router";

import { AppShell } from "@/components/AppShell";

export default function LoveRoute() {
  const router = useRouter();
  return <AppShell route="/love" onNavigate={(href) => router.push(href)} />;
}
