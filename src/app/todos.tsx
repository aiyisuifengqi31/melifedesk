import { useRouter } from "expo-router";

import { AppShell } from "@/components/AppShell";

export default function TodosRoute() {
  const router = useRouter();
  return <AppShell route="/todos" onNavigate={(href) => router.push(href as never)} />;
}
