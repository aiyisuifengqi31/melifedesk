import { useRouter } from "expo-router";

import { AppShell } from "@/components/AppShell";

export default function WorkoutRoute() {
  const router = useRouter();
  return <AppShell route="/workout" onNavigate={(href) => router.push(href as never)} />;
}
