import { useRouter } from "expo-router";

import { AppShell } from "@/components/AppShell";

export default function GiftsRoute() {
  const router = useRouter();
  return <AppShell route="/gifts" onNavigate={(href) => router.push(href)} />;
}
