import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { saveUserSettings } from "@/auth/authRepository";
import { getSupabaseClient } from "@/auth/supabaseClient";
import { readStoredThemeId, writeStoredThemeId } from "@/auth/userSettings";
import { getPublicAppConfig } from "@/config/app";
import { NAV_ITEMS, type NavItem, routeToKey, routeToTitle } from "@/navigation/items";
import { getTheme, THEME_IDS } from "@/theme/registry";
import type { ColorMode, ThemeId } from "@/theme/types";
import { ThemedNavIcon } from "./ThemedNavIcon";

type AppShellProps = {
  initialRoute?: string;
  route?: string;
  viewport?: "mobile" | "desktop";
  onNavigate?: (href: NavItem["href"]) => void;
};

const app = getPublicAppConfig();

export function AppShell({ initialRoute = "/plan", route, viewport, onNavigate }: AppShellProps) {
  const dimensions = useWindowDimensions();
  const inferredViewport = viewport ?? (dimensions.width < 720 ? "mobile" : "desktop");
  const [currentRoute, setCurrentRoute] = useState(route ?? initialRoute);
  const [collapsed, setCollapsed] = useState(false);
  const [themeId, setThemeId] = useState<ThemeId>(() => readStoredThemeId(typeof window === "undefined" ? undefined : window.localStorage) ?? "default");
  const [mode, setMode] = useState<ColorMode>("light");

  const activeRoute = route ?? currentRoute;
  const activeKey = routeToKey(activeRoute);
  const title = routeToTitle(activeRoute);
  const theme = getTheme(themeId);
  const tokens = theme.tokens[mode];
  const isMobile = inferredViewport === "mobile";
  const sidebarWidth = isMobile ? 68 : collapsed ? 72 : 224;

  const styles = useMemo(() => createStyles(tokens, sidebarWidth, isMobile), [tokens, sidebarWidth, isMobile]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = app.webTitle;
    }
  }, []);

  const handleNavigate = (href: NavItem["href"]) => {
    if (onNavigate) {
      onNavigate(href);
      return;
    }
    setCurrentRoute(href);
  };

  const handleThemeChange = async (nextThemeId: ThemeId) => {
    setThemeId(nextThemeId);
    writeStoredThemeId(typeof window === "undefined" ? undefined : window.localStorage, nextThemeId);

    const client = getSupabaseClient();
    if (!client) {
      return;
    }

    const { data } = await client.auth.getUser();
    if (data.user) {
      await saveUserSettings(client, data.user.id, { themeId: nextThemeId });
    }
  };

  return (
    <View style={styles.root}>
      <View testID="primary-sidebar" nativeID="sidebar" style={styles.sidebar}>
        <Text style={styles.sidebarBrand}>{collapsed && !isMobile ? "帆关" : app.displayName}</Text>
        {!isMobile ? (
          <Pressable accessibilityRole="button" accessibilityLabel="折叠导航" onPress={() => setCollapsed((value) => !value)} style={styles.collapseButton}>
            <Text style={styles.collapseText}>{collapsed ? "展" : "收"}</Text>
          </Pressable>
        ) : null}
        <View style={styles.navList}>
          {NAV_ITEMS.map((item) => {
            const selected = item.key === activeKey;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => handleNavigate(item.href)}
                style={[styles.navItem, selected ? styles.navItemSelected : styles.navItemIdle]}
              >
                <ThemedNavIcon routeKey={item.key} selected={selected} theme={theme} />
                {collapsed && !isMobile ? null : <Text style={styles.navLabel}>{item.label}</Text>}
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView testID="page-content" nativeID="page-content" style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.topBar}>
          <View>
            <Text accessibilityRole="header" role="heading" style={styles.appTitle}>
              {app.displayName}
            </Text>
            <Text style={styles.subtitle}>{app.subtitle}</Text>
          </View>
          <View style={styles.themeControls}>
            {THEME_IDS.map((id) => (
              <Pressable key={id} accessibilityRole="button" accessibilityLabel={id} onPress={() => void handleThemeChange(id)} style={styles.themeButton}>
                <Text style={styles.themeButtonText}>{id}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel="切换深色模式" onPress={() => setMode((value) => (value === "light" ? "dark" : "light"))} style={styles.themeButton}>
              <Text style={styles.themeButtonText}>明暗</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.pageHeader}>
          <Text accessibilityRole="header" role="heading" style={styles.pageTitle}>
            {title}
          </Text>
          <Text style={styles.pageMeta}>当前页面：{title}</Text>
          <Text testID="active-theme" nativeID="active-theme" style={styles.pageMeta}>当前主题：{themeId}</Text>
          <Text testID="theme-mode" nativeID="theme-mode" style={styles.pageMeta}>当前模式：{mode}</Text>
          <Text testID="theme-token" nativeID="theme-token" style={styles.pageMeta}>背景 token：{tokens.background}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>通用空状态</Text>
          <Text style={styles.bodyText}>这里还没有真实业务记录。Task 1 只展示布局骨架和主题资源接口。</Text>
          <Text style={styles.assetHint}>空状态资源：{theme.emptyState}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>基础卡片</Text>
          <Text style={styles.bodyText}>页面将使用统一卡片、加载、错误和重试状态，后续 Task 才接入真实数据。</Text>
        </View>

        <View style={styles.stateRow}>
          <View style={styles.stateBox}>
            <Text style={styles.cardTitle}>加载状态</Text>
            <Text style={styles.bodyText}>正在加载...</Text>
          </View>
          <View style={styles.stateBox}>
            <Text style={styles.cardTitle}>错误状态</Text>
            <Text style={styles.bodyText}>暂时无法读取内容。</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="重试" style={styles.retryButton}>
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof getTheme>["tokens"][ColorMode], sidebarWidth: number, isMobile: boolean) {
  return StyleSheet.create({
    root: {
      minHeight: "100%",
      flexDirection: "row",
      backgroundColor: tokens.background
    },
    sidebar: {
      width: sidebarWidth,
      minWidth: sidebarWidth,
      backgroundColor: tokens.surfaceMuted,
      borderRightColor: tokens.border,
      borderRightWidth: 1,
      paddingHorizontal: isMobile ? 6 : 10,
      paddingVertical: 12
    },
    sidebarBrand: {
      color: tokens.text,
      fontSize: isMobile ? 11 : 18,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 8
    },
    collapseButton: {
      minHeight: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      backgroundColor: tokens.surface,
      marginBottom: 10
    },
    collapseText: {
      color: tokens.text,
      fontSize: 13,
      fontWeight: "700"
    },
    navList: {
      gap: 8
    },
    navItem: {
      minHeight: isMobile ? 64 : 54,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
      paddingHorizontal: 4
    },
    navItemSelected: {
      backgroundColor: tokens.accentSoft,
      borderColor: tokens.accent,
      borderWidth: 1
    },
    navItemIdle: {
      backgroundColor: "transparent"
    },
    navLabel: {
      color: tokens.text,
      fontSize: isMobile ? 11 : 14,
      fontWeight: "700",
      marginTop: 4,
      textAlign: "center"
    },
    content: {
      flex: 1,
      marginLeft: 0
    },
    contentInner: {
      padding: isMobile ? 14 : 24,
      gap: 16
    },
    topBar: {
      flexDirection: isMobile ? "column" : "row",
      justifyContent: "space-between",
      gap: 12
    },
    appTitle: {
      color: tokens.text,
      fontSize: 26,
      fontWeight: "800"
    },
    subtitle: {
      color: tokens.textMuted,
      fontSize: 14,
      marginTop: 2
    },
    themeControls: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap"
    },
    themeButton: {
      borderRadius: 8,
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    themeButtonText: {
      color: tokens.text,
      fontWeight: "700"
    },
    pageHeader: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 16
    },
    pageTitle: {
      color: tokens.text,
      fontSize: 24,
      fontWeight: "800"
    },
    pageMeta: {
      color: tokens.textMuted,
      fontSize: 13,
      marginTop: 6
    },
    card: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 16
    },
    cardTitle: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 6
    },
    bodyText: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20
    },
    assetHint: {
      color: tokens.accent,
      fontSize: 12,
      marginTop: 10
    },
    stateRow: {
      flexDirection: isMobile ? "column" : "row",
      gap: 12
    },
    stateBox: {
      flex: 1,
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 16
    },
    retryButton: {
      alignSelf: "flex-start",
      marginTop: 10,
      borderRadius: 8,
      backgroundColor: tokens.accent,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    retryText: {
      color: "#ffffff",
      fontWeight: "800"
    }
  });
}
