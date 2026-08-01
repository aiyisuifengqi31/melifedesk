import { useRouter } from "expo-router";

import { AppShell } from "@/components/AppShell";

export default function HomeRoute() {
  const router = useRouter();
  return <AppShell route="/home" onNavigate={(href) => router.push(href as never)} />;
}
