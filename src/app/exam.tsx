import { useRouter } from "expo-router";

import { AppShell } from "@/components/AppShell";

export default function ExamRoute() {
  const router = useRouter();
  return <AppShell route="/exam" onNavigate={(href) => router.push(href)} />;
}
