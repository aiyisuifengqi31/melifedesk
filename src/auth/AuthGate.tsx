import { usePathname, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { getPublicAppConfig } from "@/config/app";
import { syncActiveUser } from "./localScope";
import { getSupabaseClient } from "./supabaseClient";

type GateState = "loading" | "signedIn" | "signedOut";

const app = getPublicAppConfig();

/**
 * 登录守卫：
 * - Supabase 未配置时直接放行（本地单机模式，方便离线预览与测试）
 * - 已登录则拦截 /login，跳回首页
 * - 未登录则任何页面都跳到 /login
 * 会话由 supabase-js 持久化在 localStorage，刷新页面不需要重新登录。
 */
export function AuthGate({ children }: PropsWithChildren) {
  const client = useMemo(() => getSupabaseClient(), []);
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<GateState>(client ? "loading" : "signedIn");

  useEffect(() => {
    if (!client) {
      return;
    }

    let alive = true;

    void client.auth.getSession().then(({ data }) => {
      if (!alive) {
        return;
      }
      const userId = data.session?.user?.id ?? null;
      syncActiveUser(userId);
      setState(userId ? "signedIn" : "signedOut");
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      syncActiveUser(userId);
      setState(userId ? "signedIn" : "signedOut");
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [client]);

  const onLoginPage = pathname === "/login";

  useEffect(() => {
    if (state === "signedOut" && !onLoginPage) {
      router.replace("/login");
    }
    if (state === "signedIn" && onLoginPage) {
      router.replace("/home" as Href);
    }
  }, [onLoginPage, router, state]);

  if (state === "loading" || (state === "signedOut" && !onLoginPage) || (state === "signedIn" && onLoginPage)) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>{app.displayName}</Text>
        <ActivityIndicator color="#8f5a72" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  splash: {
    alignItems: "center",
    backgroundColor: "#fff8fb",
    flex: 1,
    gap: 14,
    justifyContent: "center"
  },
  splashTitle: {
    color: "#8f5a72",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 2
  }
});
