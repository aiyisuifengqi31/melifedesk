import { usePathname, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { getPublicAppConfig } from "@/config/app";
import { readActiveUser, syncActiveUser } from "./localScope";
import { isPeekUsable, peekPersistedSession } from "./persistedSession";
import { getSupabaseClient } from "./supabaseClient";
import { StartupPerf } from "@/lib/startupPerf";

type GateState = "loading" | "signedIn" | "signedOut";

const app = getPublicAppConfig();
/** 本地无法直接判定时的兜底等待（越短越好，超时后按上次活跃账号放行）。 */
const STARTUP_SESSION_GRACE_MS = 600;

let activeUserBootstrapped = false;

/** 只做一次：把本地会话里的 userId 同步为“当前活跃账号”（换人时会清空上一个人的本地缓存）。 */
function bootstrapActiveUserOnce(userId: string) {
  if (activeUserBootstrapped) return;
  activeUserBootstrapped = true;
  syncActiveUser(userId);
}

/** OAuth / 邮件登录回调：URL 里带 token 或 code，必须交给 supabase 自己解析，不能走快速通道。 */
function hasAuthCallbackInUrl(): boolean {
  if (typeof window === "undefined" || !window.location) return false;
  const href = window.location.href ?? "";
  return /[#&?](access_token|refresh_token|error_description)=/.test(href) || /[?&]code=/.test(href);
}

/**
 * 首帧就地判定登录态：
 * - 本地已有未过期会话 → 直接进入工作台（后台继续校验，失效会跳登录页）
 * - 其它情况 → 保持原有异步等待 + 兜底逻辑
 */
export function resolveInitialGateState(hasClient: boolean): GateState {
  if (!hasClient) return "signedIn";
  if (typeof window === "undefined") return "loading";
  if (hasAuthCallbackInUrl()) return "loading";
  const peek = peekPersistedSession();
  if (isPeekUsable(peek) && peek.userId) {
    bootstrapActiveUserOnce(peek.userId);
    return "signedIn";
  }
  return "loading";
}

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
  const [state, setState] = useState<GateState>(() => resolveInitialGateState(Boolean(client)));

  useEffect(() => {
    if (!client) {
      return;
    }

    let alive = true;
    let settled = false;
    StartupPerf.mark("Auth start");

    const startupFallback = setTimeout(() => {
      if (!alive || settled) {
        return;
      }
      StartupPerf.mark(`Auth grace fallback (${STARTUP_SESSION_GRACE_MS}ms)`);
      setState(readActiveUser() ? "signedIn" : "signedOut");
    }, STARTUP_SESSION_GRACE_MS);

    void client.auth.getSession().then(({ data }) => {
      if (!alive) {
        return;
      }
      settled = true;
      clearTimeout(startupFallback);
      StartupPerf.mark("Auth ready");
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
      clearTimeout(startupFallback);
      listener.subscription.unsubscribe();
    };
  }, [client]);

  const dismissedRef = useRef(false);
  useEffect(() => {
    if (!dismissedRef.current && state !== "loading") {
      dismissedRef.current = true;
      StartupPerf.mark("Loading dismissed");
    }
  }, [state]);

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
