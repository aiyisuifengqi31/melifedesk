import { useRouter } from "expo-router";

import { AppShell } from "@/components/AppShell";

export default function FinanceRoute() {
  const router = useRouter();
  return <AppShell route="/finance" onNavigate={(href) => router.push(href)} />;
}
