import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { saveUserSettings } from "@/auth/authRepository";
import { getSupabaseClient } from "@/auth/supabaseClient";
import { readStoredThemeId, writeStoredThemeId } from "@/auth/userSettings";
import { getPublicAppConfig } from "@/config/app";
import { FinancePanel } from "@/features/finance/FinancePanel";
import { GiftsPanel } from "@/features/gifts/GiftsPanel";
import { LovePanel } from "@/features/love/LovePanel";
import { DailyPlanPanel } from "@/features/plan/DailyPlanPanel";
import { WorkoutPanel } from "@/features/workout/WorkoutPanel";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeId, setThemeId] = useState<ThemeId>(() => readStoredThemeId(typeof window === "undefined" ? undefined : window.localStorage) ?? "default");
  const [mode, setMode] = useState<ColorMode>("light");

  const activeRoute = route ?? currentRoute;
  const activeKey = routeToKey(activeRoute);
  const title = routeToTitle(activeRoute);
  const theme = getTheme(themeId);
  const tokens = theme.tokens[mode];
  const isMobile = inferredViewport === "mobile";
  const sidebarWidth = isMobile ? 68 : collapsed ? 72 : 224;

  const viewportHeight = Math.max(dimensions.height, 640);
  const styles = useMemo(() => createStyles(tokens, sidebarWidth, isMobile, viewportHeight), [tokens, sidebarWidth, isMobile, viewportHeight]);

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
        <View style={styles.sidebarTop}>
          <View style={styles.sidebarHeader}>
            <View style={styles.avatarMark}>
              <Text style={styles.avatarText}>帆</Text>
            </View>
            {collapsed || isMobile ? null : <Text style={styles.sidebarBrand}>{app.displayName}</Text>}
          </View>

          {!isMobile ? (
            <Pressable accessibilityRole="button" accessibilityLabel="折叠导航" onPress={() => setCollapsed((value) => !value)} style={styles.collapseButton}>
              <Text style={styles.collapseText}>{collapsed ? ">" : "<"}</Text>
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

        <View style={styles.sidebarFooter}>
          {settingsOpen ? (
            <View nativeID="settings-panel" style={styles.settingsPanel}>
              <Text style={styles.settingsTitle}>设置</Text>
              <Text nativeID="sidebar-current-theme" style={styles.settingsMeta}>theme: {themeId}</Text>
              <Text nativeID="sidebar-theme-mode" style={styles.settingsMeta}>mode: {mode}</Text>
              <View style={styles.settingsButtonGrid}>
                {THEME_IDS.map((id) => (
                  <Pressable key={id} accessibilityRole="button" accessibilityLabel={id} onPress={() => void handleThemeChange(id)} style={styles.settingsButton}>
                    <Text style={styles.settingsButtonText}>{id}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="dark mode" onPress={() => setMode((value) => (value === "light" ? "dark" : "light"))} style={styles.settingsWideButton}>
                <Text style={styles.settingsButtonText}>{mode === "light" ? "dark" : "light"}</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="settings"
            nativeID="sidebar-settings-button"
            onPress={() => setSettingsOpen((value) => !value)}
            style={styles.settingsFab}
          >
            <Text style={styles.settingsFabText}>设置</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView testID="page-content" nativeID="page-content" style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.topBar}>
          <View>
            <Text accessibilityRole="header" role="heading" nativeID="page-title" style={styles.appTitle}>
              {title}
            </Text>
            <Text style={styles.subtitle}>{app.displayName} · {app.subtitle}</Text>
          </View>
          <View style={styles.headerPill}>
            <Text style={styles.headerPillText}>{mode}</Text>
          </View>
        </View>

        {activeKey === "plan" ? <DailyPlanPanel /> : null}
        {activeKey === "workout" ? <WorkoutPanel /> : null}
        {activeKey === "finance" ? <FinancePanel /> : null}
        {activeKey === "gifts" ? <GiftsPanel /> : null}
        {activeKey === "love" ? <LovePanel themeTokens={tokens} /> : null}
        {activeKey !== "plan" && activeKey !== "workout" && activeKey !== "finance" && activeKey !== "gifts" && activeKey !== "love" ? <GenericModuleSkeleton themeEmptyState={theme.emptyState} styles={styles} /> : null}
      </ScrollView>
    </View>
  );
}

function GenericModuleSkeleton({ themeEmptyState, styles }: { themeEmptyState: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>通用空状态</Text>
        <Text style={styles.bodyText}>这里还没有真实业务记录。当前只展示布局骨架和主题资源接口。</Text>
        <Text style={styles.assetHint}>空状态资源：{themeEmptyState}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>基础卡片</Text>
        <Text style={styles.bodyText}>页面使用统一卡片、加载、错误和重试状态，后续 Task 再接入真实数据。</Text>
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
    </>
  );
}

function createStyles(tokens: ReturnType<typeof getTheme>["tokens"][ColorMode], sidebarWidth: number, isMobile: boolean, viewportHeight: number) {
  const compactSidebar = isMobile || sidebarWidth < 160;
  const settingsPanelWidth = isMobile || sidebarWidth < 160 ? 210 : sidebarWidth - 20;

  return StyleSheet.create({
    root: {
      height: viewportHeight,
      minHeight: "100%",
      flexDirection: "row",
      backgroundColor: tokens.background
    },
    sidebar: {
      width: sidebarWidth,
      minWidth: sidebarWidth,
      height: viewportHeight,
      backgroundColor: tokens.surfaceMuted,
      borderRightColor: tokens.border,
      borderRightWidth: 1,
      justifyContent: "space-between",
      paddingHorizontal: isMobile ? 6 : 10,
      paddingVertical: 12,
      position: "relative",
      zIndex: 20
    },
    sidebarTop: {
      gap: 10
    },
    sidebarHeader: {
      alignItems: "center",
      gap: 8
    },
    avatarMark: {
      alignItems: "center",
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 999,
      borderWidth: 1,
      height: isMobile ? 42 : 46,
      justifyContent: "center",
      width: isMobile ? 42 : 46
    },
    avatarText: {
      color: tokens.accent,
      fontSize: 18,
      fontWeight: "900"
    },
    sidebarBrand: {
      color: tokens.text,
      fontSize: 15,
      fontWeight: "800",
      textAlign: "center"
    },
    collapseButton: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 28,
      justifyContent: "center",
      width: 36
    },
    collapseText: {
      color: tokens.textMuted,
      fontSize: 14,
      fontWeight: "800"
    },
    navList: {
      flexShrink: 1,
      gap: 8
    },
    navItem: {
      alignItems: "center",
      borderRadius: 999,
      justifyContent: "center",
      minHeight: isMobile ? 62 : 56,
      paddingHorizontal: 4,
      paddingVertical: 6
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
      fontSize: isMobile ? 10 : 13,
      fontWeight: "800",
      marginTop: 4,
      textAlign: "center"
    },
    sidebarFooter: {
      alignItems: "center",
      position: "relative"
    },
    settingsFab: {
      alignItems: "center",
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 999,
      borderWidth: 1,
      minHeight: 38,
      justifyContent: "center",
      paddingHorizontal: compactSidebar ? 8 : 14,
      width: compactSidebar ? 48 : "100%"
    },
    settingsFabText: {
      color: tokens.text,
      fontSize: compactSidebar ? 11 : 13,
      fontWeight: "800"
    },
    settingsPanel: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 8,
      borderWidth: 1,
      bottom: 48,
      left: isMobile || sidebarWidth < 160 ? 0 : undefined,
      padding: 10,
      position: "absolute",
      width: settingsPanelWidth,
      zIndex: 10
    },
    settingsTitle: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "900",
      marginBottom: 6
    },
    settingsMeta: {
      color: tokens.textMuted,
      fontSize: 12,
      marginBottom: 4
    },
    settingsButtonGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 6
    },
    settingsButton: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 7
    },
    settingsWideButton: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 8,
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 8
    },
    settingsButtonText: {
      color: tokens.text,
      fontSize: 12,
      fontWeight: "800"
    },
    content: {
      flex: 1,
      height: viewportHeight,
      marginLeft: 0,
      zIndex: 0
    },
    contentInner: {
      gap: 16,
      padding: isMobile ? 16 : 28,
      paddingBottom: 42
    },
    topBar: {
      alignItems: isMobile ? "flex-start" : "center",
      flexDirection: isMobile ? "column" : "row",
      justifyContent: "space-between",
      gap: 12,
      paddingBottom: 2
    },
    appTitle: {
      color: tokens.text,
      fontSize: isMobile ? 28 : 34,
      fontWeight: "900"
    },
    subtitle: {
      color: tokens.textMuted,
      fontSize: 14,
      marginTop: 6
    },
    headerPill: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    headerPillText: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
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
