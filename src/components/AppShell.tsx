import { useEffect, useMemo, useState } from "react";
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { saveUserSettings } from "@/auth/authRepository";
import { getSupabaseClient } from "@/auth/supabaseClient";
import { readStoredColorMode, readStoredThemeId, writeStoredColorMode, writeStoredThemeId } from "@/auth/userSettings";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { getPublicAppConfig } from "@/config/app";
import { hydrateProfileFromCloud, loadProfile, openImagePicker, saveProfile, type AppProfile } from "@/features/profile/profileStorage";
import { ExamPanel } from "@/features/exam/ExamPanel";
import { EntertainmentPanel } from "@/features/entertainment/EntertainmentPanel";
import { FinancePanel } from "@/features/finance/FinancePanel";
import { HomePanel } from "@/features/home/HomePanel";
import { LovePanel } from "@/features/love/LovePanel";
import { DailyPlanPanel } from "@/features/plan/DailyPlanPanel";
import { WorkoutPanel } from "@/features/workout/WorkoutPanel";
import { NAV_ITEMS, type NavItem, routeToKey } from "@/navigation/items";
import { getTheme } from "@/theme/registry";
import type { ColorMode, ThemeId } from "@/theme/types";
import { loadBackground, saveBackground, type BackgroundSource, getImageSource } from "@/theme/background";
import { ThemedNavIcon } from "./ThemedNavIcon";

type AppShellProps = {
  initialRoute?: string;
  route?: string;
  viewport?: "mobile" | "desktop";
  onNavigate?: (href: NavItem["href"]) => void;
};

const app = getPublicAppConfig();

export function AppShell({ initialRoute = "/home", route, viewport, onNavigate }: AppShellProps) {
  const dimensions = useWindowDimensions();
  const inferredViewport = viewport ?? (dimensions.width < 720 ? "mobile" : "desktop");
  const [currentRoute, setCurrentRoute] = useState(route ?? initialRoute);
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeId, setThemeId] = useState<ThemeId>(() => readStoredThemeId(typeof window === "undefined" ? undefined : window.localStorage) ?? "default");
  const [mode, setMode] = useState<ColorMode>(() => readStoredColorMode(typeof window === "undefined" ? undefined : window.localStorage) ?? "light");
  const [profile, setProfile] = useState<AppProfile>(() => loadProfile());
  const [background, setBackground] = useState<BackgroundSource | null>(() => loadBackground());

  useEffect(() => {
    let cancelled = false;
    hydrateProfileFromCloud()
      .then((next) => {
        if (!cancelled) {
          setProfile(next);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const activeRoute = route ?? currentRoute;
  const activeKey = routeToKey(activeRoute);
  const theme = getTheme(themeId);
  const tokens = theme.tokens[mode];
  const isMobile = inferredViewport === "mobile";
  const sidebarWidth = isMobile ? 68 : collapsed ? 72 : 224;

  const viewportHeight = Math.max(dimensions.height, 640);
  const imageSource = useMemo(() => getImageSource(background), [background]);
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

  const handleColorModeChange = async (nextMode: ColorMode) => {
    setMode(nextMode);
    writeStoredColorMode(typeof window === "undefined" ? undefined : window.localStorage, nextMode);

    const client = getSupabaseClient();
    if (!client) {
      return;
    }

    const { data } = await client.auth.getUser();
    if (data.user) {
      await saveUserSettings(client, data.user.id, { colorMode: nextMode });
    }
  };

  const handleBackgroundChange = (nextBackground: BackgroundSource | null) => {
    setBackground(nextBackground);
    saveBackground(nextBackground);
  };

  return (
    <View style={styles.root}>
      <View testID="primary-sidebar" nativeID="sidebar" style={styles.sidebar}>
        <View style={styles.sidebarTop}>
          <View style={styles.sidebarHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="更换头像" onPress={() => openImagePicker((dataUrl) => {
              const next = { ...profile, avatarUri: dataUrl };
              setProfile(next);
              saveProfile(next);
            })} style={styles.avatarMark}>
              {profile.avatarUri ? (
                <Image accessibilityIgnoresInvertColors source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{Array.from(profile.displayName)[0] ?? "友"}</Text>
              )}
            </Pressable>
            {collapsed || isMobile ? null : <Text style={styles.sidebarBrand} numberOfLines={1}>{profile.displayName}</Text>}
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
                  {collapsed && !isMobile ? null : <Text style={[styles.navLabel, selected ? styles.navLabelSelected : null]}>{item.label}</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sidebarFooter}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="设置"
            nativeID="sidebar-settings-button"
            onPress={() => setSettingsOpen((value) => !value)}
            style={styles.settingsFab}
          >
            <Text style={styles.settingsFabText}>设置</Text>
          </Pressable>
        </View>
      </View>

      {imageSource ? (
        <ImageBackground
          imageStyle={styles.backgroundImage}
          resizeMode="cover"
          source={imageSource}
          style={styles.content}
        >
          <ScrollView testID="page-content" nativeID="page-content" style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
            <PageContent activeKey={activeKey} handleNavigate={handleNavigate} styles={styles} themeEmptyState={theme.emptyState} tokens={tokens} />
          </ScrollView>
        </ImageBackground>
      ) : (
        <ScrollView testID="page-content" nativeID="page-content" style={styles.content} contentContainerStyle={styles.contentInner}>
          <PageContent activeKey={activeKey} handleNavigate={handleNavigate} styles={styles} themeEmptyState={theme.emptyState} tokens={tokens} />
        </ScrollView>
      )}

      {settingsOpen ? (
        <SettingsPanel
          background={background}
          colorMode={mode}
          onBackgroundChange={handleBackgroundChange}
          onClose={() => setSettingsOpen(false)}
          onColorModeChange={(next) => void handleColorModeChange(next)}
          onProfileChange={setProfile}
          onThemeChange={(next) => void handleThemeChange(next)}
          profile={profile}
          themeId={themeId}
          tokens={tokens}
        />
      ) : null}
    </View>
  );
}

function PageContent({
  activeKey,
  handleNavigate,
  styles,
  themeEmptyState,
  tokens
}: {
  activeKey: string;
  handleNavigate: (href: NavItem["href"]) => void;
  styles: ReturnType<typeof createStyles>;
  themeEmptyState: string;
  tokens: ReturnType<typeof getTheme>["tokens"][ColorMode];
}) {
  return (
    <>
      {activeKey === "home" ? <HomePanel themeTokens={tokens} /> : null}
      {activeKey === "plan" ? <DailyPlanPanel themeTokens={tokens} /> : null}
      {activeKey === "workout" ? <WorkoutPanel /> : null}
      {activeKey === "finance" ? <FinancePanel /> : null}
      {activeKey === "love" ? <LovePanel themeTokens={tokens} /> : null}
      {activeKey === "exam" ? <ExamPanel themeTokens={tokens} /> : null}
      {activeKey === "fun" ? <EntertainmentPanel themeTokens={tokens} /> : null}
      {activeKey !== "home" && activeKey !== "plan" && activeKey !== "workout" && activeKey !== "finance" && activeKey !== "love" && activeKey !== "exam" && activeKey !== "fun" ? <GenericModuleSkeleton themeEmptyState={themeEmptyState} styles={styles} /> : null}
    </>
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
      backgroundColor: tokens.surface,
      borderRightColor: tokens.border,
      borderRightWidth: 1,
      justifyContent: "space-between",
      paddingHorizontal: isMobile ? 8 : 12,
      paddingVertical: 16,
      position: "relative",
      shadowColor: "#000000",
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 3,
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
      backgroundColor: tokens.accentSoft,
      borderRadius: 16,
      height: isMobile ? 44 : 50,
      justifyContent: "center",
      overflow: "hidden",
      width: isMobile ? 44 : 50
    },
    avatarImage: {
      borderRadius: 16,
      height: "100%",
      width: "100%"
    },
    avatarText: {
      color: tokens.accent,
      fontSize: 20,
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
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 999,
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
      gap: 6
    },
    navItem: {
      alignItems: "center",
      borderRadius: 14,
      justifyContent: "center",
      minHeight: isMobile ? 52 : 46,
      paddingHorizontal: 4,
      paddingVertical: 4
    },
    navItemSelected: {
      backgroundColor: tokens.accent,
      shadowColor: tokens.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 2
    },
    navItemIdle: {
      backgroundColor: "transparent"
    },
    navLabel: {
      color: tokens.text,
      fontSize: isMobile ? 9 : 11,
      fontWeight: "800",
      lineHeight: isMobile ? 12 : 14,
      marginTop: 2,
      textAlign: "center"
    },
    navLabelSelected: {
      color: "#ffffff"
    },
    sidebarFooter: {
      alignItems: "center",
      position: "relative"
    },
    settingsFab: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      minHeight: 38,
      justifyContent: "center",
      paddingHorizontal: compactSidebar ? 8 : 14,
      width: compactSidebar ? 48 : "100%"
    },
    settingsFabText: {
      color: tokens.accent,
      fontSize: compactSidebar ? 11 : 13,
      fontWeight: "800"
    },
    backgroundImage: {
      opacity: 0.22
    },
    content: {
      flex: 1,
      height: viewportHeight,
      marginLeft: 0,
      zIndex: 0
    },
    contentScroll: {
      flex: 1,
      height: viewportHeight
    },
    contentInner: {
      gap: 16,
      padding: isMobile ? 16 : 28,
      paddingBottom: 42
    },
    card: {
      backgroundColor: tokens.surface,
      borderRadius: 20,
      padding: 18,
      shadowColor: "#7cb87c",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 2
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
      borderRadius: 20,
      padding: 18,
      shadowColor: "#7cb87c",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 2
    },
    retryButton: {
      alignSelf: "flex-start",
      marginTop: 10,
      borderRadius: 12,
      backgroundColor: tokens.accent,
      paddingHorizontal: 14,
      paddingVertical: 10
    },
    retryText: {
      color: "#ffffff",
      fontWeight: "800"
    }
  });
}
