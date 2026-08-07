import { useEffect, useMemo, useRef, useState } from "react";
import { Image, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ImageStyle } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { saveUserSettings } from "@/auth/authRepository";
import { getSupabaseClient } from "@/auth/supabaseClient";
import { readStoredColorMode, readStoredThemeId, writeStoredColorMode, writeStoredThemeId } from "@/auth/userSettings";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { getPublicAppConfig } from "@/config/app";
import { hydrateProfileFromCloud, loadProfile, openImagePicker, saveProfile, type AppProfile } from "@/features/profile/profileStorage";
import { ExamPanel, examTabs, type ExamTab } from "@/features/exam/ExamPanel";
import { EntertainmentPanel, entertainmentTabs, type EntTab } from "@/features/entertainment/EntertainmentPanel";
import { FinancePanel, financeTabs, type FinanceTab } from "@/features/finance/FinancePanel";
import { HomePanel } from "@/features/home/HomePanel";
import { LovePanel, loveTabs, type LoveTab } from "@/features/love/LovePanel";
import { DailyPlanPanel } from "@/features/plan/DailyPlanPanel";
import { GlobalQuickCapture } from "@/features/quick-capture/GlobalQuickCapture";
import { WorkoutPanel } from "@/features/workout/WorkoutPanel";
import { QuickAccountingSheet } from "@/features/finance/QuickAccountingSheet";
import {
  getDefaultFinanceStorage,
  loadFinanceTransactions,
  loadGiftRecords,
  loadSavingEntries,
  saveFinanceTransactions,
  saveGiftRecords,
  saveSavingEntries,
  sortTransactions,
  type FinanceTransaction
} from "@/features/finance/financeStorage";
import { QUICK_CAPTURE_DATA_EVENT } from "@/features/quick-capture/quickCapture";
import { NAV_ITEMS, type NavItem, type RouteKey, routeToKey } from "@/navigation/items";
import { getTheme } from "@/theme/registry";
import type { ColorMode, ThemeId } from "@/theme/types";
import { hydrateBackgroundFromCloud, loadBackground, saveBackground, type BackgroundSource, getImageSource } from "@/theme/background";
import { FixedBottomTabs } from "@/shared/ui/FixedBottomTabs";
import { useDisableTouchCallout } from "@/shared/ui/useDisableTouchCallout";
import { ThemedNavIcon } from "./ThemedNavIcon";

type AppShellProps = {
  initialRoute?: string;
  route?: string;
  viewport?: "mobile" | "desktop";
  onNavigate?: (href: NavItem["href"]) => void;
};

type ShortcutRequest = {
  kind: "notes" | "todos" | "packages" | "packageScan" | "finance" | "workout";
  nonce: number;
};

const app = getPublicAppConfig();
const PRIMARY_ROUTE_KEYS: RouteKey[] = ["home", "plan", "finance", "exam"];
const MORE_ROUTE_KEYS: RouteKey[] = ["love", "workout", "fun"];
const navItemByKey = (key: RouteKey) => NAV_ITEMS.find((item) => item.key === key);
const PRIMARY_NAV_ITEMS = PRIMARY_ROUTE_KEYS.map(navItemByKey).filter((item): item is NavItem => Boolean(item));
const MORE_NAV_ITEMS = MORE_ROUTE_KEYS.map(navItemByKey).filter((item): item is NavItem => Boolean(item));

export function AppShell({ initialRoute = "/home", route, viewport, onNavigate }: AppShellProps) {
  const dimensions = useWindowDimensions();
  const inferredViewport = viewport ?? (dimensions.width < 720 ? "mobile" : "desktop");
  const [currentRoute, setCurrentRoute] = useState(route ?? initialRoute);
  const [collapsed, setCollapsed] = useState(false);
  const [manualMoreOpen, setManualMoreOpen] = useState<boolean | null>(null);
  const [entertainmentTab, setEntertainmentTab] = useState<EntTab>("hot");
  const [examTab, setExamTab] = useState<ExamTab>("essay");
  const [financeTab, setFinanceTab] = useState<FinanceTab>("stats");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [loveTab, setLoveTab] = useState<LoveTab>("diary");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [quickAccountingOpen, setQuickAccountingOpen] = useState(false);
  const [quickAccountingToast, setQuickAccountingToast] = useState<FinanceTransaction | null>(null);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [shortcutRequest, setShortcutRequest] = useState<ShortcutRequest | null>(null);
  const [themeId, setThemeId] = useState<ThemeId>(() => readStoredThemeId(typeof window === "undefined" ? undefined : window.localStorage) ?? "default");
  const [mode, setMode] = useState<ColorMode>(() => readStoredColorMode(typeof window === "undefined" ? undefined : window.localStorage) ?? "light");
  const [profile, setProfile] = useState<AppProfile>(() => loadProfile());
  const [background, setBackground] = useState<BackgroundSource | null>(() => loadBackground());
  const backgroundDirtyRef = useRef(false);

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

  useEffect(() => {
    let cancelled = false;
    hydrateBackgroundFromCloud()
      .then((next) => {
        if (!cancelled && !backgroundDirtyRef.current) {
          setBackground(next);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const activeRoute = route ?? currentRoute;
  const activeKey = routeToKey(activeRoute);
  const moreRouteActive = MORE_ROUTE_KEYS.includes(activeKey);
  const moreNavOpen = manualMoreOpen ?? moreRouteActive;
  const theme = getTheme(themeId);
  const tokens = theme.tokens[mode];
  const isMobile = inferredViewport === "mobile";
  const sidebarWidth = isMobile ? 68 : collapsed ? 72 : 224;
  const navOffset = Math.min(72, Math.max(64, Math.round(dimensions.height * 0.08)));

  const viewportHeight = isMobile && Platform.OS === "web" ? ("100dvh" as const) : Math.max(dimensions.height, 640);
  const hasSecondaryTabs = activeKey === "finance" || activeKey === "love" || activeKey === "exam" || activeKey === "fun";
  const imageSource = useMemo(() => getImageSource(background), [background]);
  const styles = useMemo(() => createStyles(tokens, sidebarWidth, isMobile, viewportHeight, hasSecondaryTabs, navOffset), [tokens, sidebarWidth, isMobile, viewportHeight, hasSecondaryTabs, navOffset]);

  useEffect(() => {
    if (route && !moreRouteActive) {
      setManualMoreOpen(null);
    }
  }, [moreRouteActive, route]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = app.webTitle;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const visualViewport = window.visualViewport;
    const initialHeight = window.innerHeight;
    const updateKeyboardState = () => {
      const currentHeight = visualViewport?.height ?? window.innerHeight;
      setKeyboardOpen(currentHeight < initialHeight - 120);
    };
    const handleFocusIn = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target || !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }
      window.setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }, 80);
    };

    visualViewport?.addEventListener("resize", updateKeyboardState);
    window.addEventListener("resize", updateKeyboardState);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", updateKeyboardState);

    return () => {
      visualViewport?.removeEventListener("resize", updateKeyboardState);
      window.removeEventListener("resize", updateKeyboardState);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", updateKeyboardState);
    };
  }, []);

  const handleNavigate = (href: NavItem["href"]) => {
    setQuickMenuOpen(false);
    setShortcutRequest(null);
    const nextKey = routeToKey(href);
    setManualMoreOpen(null);
    if (onNavigate) {
      onNavigate(href);
      return;
    }
    setCurrentRoute(href);
  };

  const openShortcut = (kind: ShortcutRequest["kind"]) => {
    const href: NavItem["href"] = kind === "packages" || kind === "packageScan" ? "/plan" : kind === "finance" ? "/finance" : kind === "workout" ? "/workout" : "/home";
    setQuickMenuOpen(false);
    setQuickCaptureOpen(false);
    setSettingsOpen(false);
    if (kind === "finance") {
      setQuickAccountingOpen(true);
      return;
    }
    setShortcutRequest((previous) => ({ kind, nonce: (previous?.nonce ?? 0) + 1 }));
    if (onNavigate) {
      onNavigate(href);
      return;
    }
    setCurrentRoute(href);
  };

  const undoQuickAccounting = () => {
    if (!quickAccountingToast) return;
    const storage = getDefaultFinanceStorage();
    if (quickAccountingToast.savingEntryId || quickAccountingToast.categoryName === "储蓄") {
      saveSavingEntries(
        loadSavingEntries(storage).filter((entry) => entry.id !== quickAccountingToast.savingEntryId && entry.financeTransactionId !== quickAccountingToast.id),
        storage
      );
    }
    if (quickAccountingToast.giftRecordId || quickAccountingToast.categoryName === "随份子") {
      saveGiftRecords(
        loadGiftRecords(storage).filter((record) => record.id !== quickAccountingToast.giftRecordId && record.financeTransactionId !== quickAccountingToast.id),
        storage
      );
    }
    const next = sortTransactions(loadFinanceTransactions(storage).filter((transaction) => transaction.id !== quickAccountingToast.id));
    saveFinanceTransactions(next, storage);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new Event(QUICK_CAPTURE_DATA_EVENT));
    }
    setQuickAccountingToast(null);
  };

  const openQuickCapture = () => {
    setQuickMenuOpen(false);
    setSettingsOpen(false);
    setQuickCaptureOpen(true);
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
    backgroundDirtyRef.current = true;
    setBackground(nextBackground);
    saveBackground(nextBackground);
  };

  return (
    <View style={styles.root}>
      {quickMenuOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭快捷入口背景"
          onPress={() => setQuickMenuOpen(false)}
          style={styles.quickDismissLayer}
        />
      ) : null}
      <View testID="primary-sidebar" nativeID="sidebar" style={styles.sidebar}>
        <View style={styles.sidebarTop}>
          <View style={styles.sidebarHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="更换头像" onPress={() => openImagePicker((dataUrl) => {
              const next = { ...profile, avatarUri: dataUrl };
              setProfile(next);
              saveProfile(next);
            })} style={styles.avatarMark}>
              {profile.avatarUri ? (
                <Image accessibilityIgnoresInvertColors source={{ uri: profile.avatarUri }} style={styles.avatarImage as ImageStyle} />
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

        </View>

        <ScrollView testID="sidebar-nav-scroll" style={styles.navScroll} contentContainerStyle={styles.navList} showsVerticalScrollIndicator={false}>
          {PRIMARY_NAV_ITEMS.map((item) => {
            const selected = item.key === activeKey;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => handleNavigate(item.href)}
                style={[styles.navItem, selected ? styles.navItemSelected : styles.navItemIdle]}
              >
                <ThemedNavIcon routeKey={item.key} selected={selected} size={24} theme={theme} />
                {collapsed && !isMobile ? null : <Text style={[styles.navLabel, selected ? styles.navLabelSelected : null]}>{item.label}</Text>}
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="更多"
            onPress={() => setManualMoreOpen((value) => !(value ?? moreRouteActive))}
            style={[styles.navItem, styles.navItemIdle, moreRouteActive ? styles.navItemMoreHint : null]}
            testID="sidebar-more-button"
          >
            <MoreNavIcon color={moreRouteActive ? tokens.accent : tokens.textMuted} />
            {collapsed && !isMobile ? null : (
              <View style={styles.moreLabelRow}>
                <Text style={[styles.navLabel, moreRouteActive ? styles.navLabelHint : null]}>更多</Text>
                <Text style={[styles.moreChevron, moreNavOpen ? styles.moreChevronOpen : null]}>{moreNavOpen ? "⌃" : "⌄"}</Text>
              </View>
            )}
          </Pressable>

          {moreNavOpen ? (
            <View testID="sidebar-more-panel" style={styles.morePanel}>
              {MORE_NAV_ITEMS.map((item) => {
                const selected = item.key === activeKey;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    onPress={() => handleNavigate(item.href)}
                    style={[styles.navSubItem, selected ? styles.navSubItemSelected : null]}
                    testID={`sidebar-subitem-${item.key}`}
                  >
                    <ThemedNavIcon routeKey={item.key} selected={selected} size={20} theme={theme} />
                    {collapsed && !isMobile ? null : <Text style={[styles.navSubLabel, selected ? styles.navSubLabelSelected : null]}>{item.label}</Text>}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </ScrollView>

        <View testID="sidebar-footer" style={styles.sidebarFooter}>
          <View style={styles.quickDock}>
            {quickMenuOpen ? (
              <View testID="quick-shortcut-menu" style={styles.quickMenu}>
                <ShortcutButton icon="🎙" label="语音记录" testID="quick-shortcut-voice" onPress={openQuickCapture} />
                <ShortcutButton icon="¥" label="记一笔支出" testID="quick-shortcut-finance" onPress={() => openShortcut("finance")} />
                <ShortcutButton icon="▣" label="上传快递截图" testID="quick-shortcut-package-scan" onPress={() => openShortcut("packageScan")} />
                <ShortcutButton icon="□" label="添加待办" testID="quick-shortcut-todos" onPress={() => openShortcut("todos")} />
                <ShortcutButton icon="✎" label="写备忘录" testID="quick-shortcut-notes" onPress={() => openShortcut("notes")} />
                <ShortcutButton icon="↗" label="记录运动" testID="quick-shortcut-workout" onPress={() => openShortcut("workout")} />
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={quickMenuOpen ? "关闭快捷入口" : "打开快捷入口"}
              onPress={() => setQuickMenuOpen((value) => !value)}
              style={styles.quickFab}
              testID="quick-fab"
            >
              <PlusIcon color="#ffffff" />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="设置"
            nativeID="sidebar-settings-button"
            onPress={() => setSettingsOpen((value) => !value)}
            style={styles.settingsFab}
          >
            <SettingsIcon color={tokens.accent} />
            <Text style={styles.settingsFabText}>设置</Text>
          </Pressable>
        </View>
      </View>

      {imageSource ? (
        <ImageBackground
          imageStyle={styles.backgroundImage as ImageStyle}
          resizeMode="cover"
          source={imageSource}
          style={styles.content}
        >
          <ScrollView testID="page-content" nativeID="page-content" style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
            <PageContent
              activeKey={activeKey}
              entertainmentTab={entertainmentTab}
              examTab={examTab}
              financeTab={financeTab}
              handleNavigate={handleNavigate}
              loveTab={loveTab}
              onEntertainmentTabChange={setEntertainmentTab}
              onExamTabChange={setExamTab}
              onFinanceTabChange={setFinanceTab}
              onLoveTabChange={setLoveTab}
              onOpenQuickAccounting={() => setQuickAccountingOpen(true)}
              onOpenPackages={() => openShortcut("packages")}
              shortcutRequest={shortcutRequest}
              styles={styles}
              themeEmptyState={theme.emptyState}
              tokens={tokens}
            />
          </ScrollView>
        </ImageBackground>
      ) : (
        <ScrollView testID="page-content" nativeID="page-content" style={styles.content} contentContainerStyle={styles.contentInner}>
          <PageContent
            activeKey={activeKey}
            entertainmentTab={entertainmentTab}
            examTab={examTab}
            financeTab={financeTab}
            handleNavigate={handleNavigate}
            loveTab={loveTab}
            onEntertainmentTabChange={setEntertainmentTab}
            onExamTabChange={setExamTab}
            onFinanceTabChange={setFinanceTab}
            onLoveTabChange={setLoveTab}
            onOpenQuickAccounting={() => setQuickAccountingOpen(true)}
            onOpenPackages={() => openShortcut("packages")}
            shortcutRequest={shortcutRequest}
            styles={styles}
            themeEmptyState={theme.emptyState}
            tokens={tokens}
          />
        </ScrollView>
      )}

      {activeKey === "finance" ? <FixedBottomTabs activeValue={financeTab} hidden={keyboardOpen || quickCaptureOpen} items={financeTabs} onChange={setFinanceTab} style={styles.secondaryTabs} tokens={tokens} /> : null}
      {activeKey === "love" ? <FixedBottomTabs activeValue={loveTab} hidden={keyboardOpen || quickCaptureOpen} items={loveTabs} onChange={setLoveTab} style={styles.secondaryTabs} tokens={tokens} /> : null}
      {activeKey === "exam" ? <FixedBottomTabs activeValue={examTab} hidden={keyboardOpen || quickCaptureOpen} items={examTabs} onChange={setExamTab} style={styles.secondaryTabs} tokens={tokens} /> : null}
      {activeKey === "fun" ? <FixedBottomTabs activeValue={entertainmentTab} hidden={keyboardOpen || quickCaptureOpen} items={entertainmentTabs} onChange={setEntertainmentTab} style={styles.secondaryTabs} tokens={tokens} /> : null}

      {quickCaptureOpen ? <GlobalQuickCapture onClose={() => setQuickCaptureOpen(false)} tokens={tokens} /> : null}

      <QuickAccountingSheet
        onClose={() => setQuickAccountingOpen(false)}
        onSaved={(transaction) => setQuickAccountingToast(transaction)}
        tokens={tokens}
        visible={quickAccountingOpen}
      />

      {quickAccountingToast ? (
        <View style={styles.quickAccountingToast}>
          <Text style={styles.quickAccountingToastText}>
            已记录 {quickAccountingToast.categoryName} {quickAccountingToast.transactionType === "expense" ? "-" : "+"}¥{quickAccountingToast.amount}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="撤销刚刚的记账" onPress={undoQuickAccounting} style={styles.quickAccountingUndo}>
            <Text style={styles.quickAccountingUndoText}>撤销</Text>
          </Pressable>
        </View>
      ) : null}

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

function MoreNavIcon({ color }: { color: string }) {
  return (
    <Svg accessibilityLabel="more navigation icon" height={24} testID="nav-icon-more" viewBox="0 0 24 24" width={24}>
      <Rect fill="none" height={6} rx={1.8} stroke={color} strokeWidth={1.9} width={6} x={4} y={4} />
      <Rect fill="none" height={6} rx={1.8} stroke={color} strokeWidth={1.9} width={6} x={14} y={4} />
      <Rect fill="none" height={6} rx={1.8} stroke={color} strokeWidth={1.9} width={6} x={4} y={14} />
      <Rect fill="none" height={6} rx={1.8} stroke={color} strokeWidth={1.9} width={6} x={14} y={14} />
    </Svg>
  );
}

function PlusIcon({ color }: { color: string }) {
  return (
    <Svg accessibilityLabel="quick add icon" height={24} testID="quick-fab-icon" viewBox="0 0 24 24" width={24}>
      <Path d="M12 5v14M5 12h14" fill="none" stroke={color} strokeLinecap="round" strokeWidth={2.4} />
    </Svg>
  );
}

function SettingsIcon({ color }: { color: string }) {
  return (
    <Svg accessibilityLabel="settings icon" height={18} testID="settings-fab-icon" viewBox="0 0 24 24" width={18}>
      <Circle cx={12} cy={12} fill="none" r={3.2} stroke={color} strokeWidth={2} />
      <Path
        d="M19.4 13.5a7.9 7.9 0 0 0 0-3l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A8 8 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5a7.9 7.9 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a8 8 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5Z"
        fill="none"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function PageContent({
  activeKey,
  entertainmentTab,
  examTab,
  financeTab,
  handleNavigate,
  loveTab,
  onEntertainmentTabChange,
  onExamTabChange,
  onFinanceTabChange,
  onLoveTabChange,
  onOpenQuickAccounting,
  onOpenPackages,
  shortcutRequest,
  styles,
  themeEmptyState,
  tokens
}: {
  activeKey: string;
  entertainmentTab: EntTab;
  examTab: ExamTab;
  financeTab: FinanceTab;
  handleNavigate: (href: NavItem["href"]) => void;
  loveTab: LoveTab;
  onEntertainmentTabChange: (tab: EntTab) => void;
  onExamTabChange: (tab: ExamTab) => void;
  onFinanceTabChange: (tab: FinanceTab) => void;
  onLoveTabChange: (tab: LoveTab) => void;
  onOpenQuickAccounting: () => void;
  onOpenPackages: () => void;
  shortcutRequest: ShortcutRequest | null;
  styles: ReturnType<typeof createStyles>;
  themeEmptyState: string;
  tokens: ReturnType<typeof getTheme>["tokens"][ColorMode];
}) {
  return (
    <>
      {activeKey === "home" ? (
        <HomePanel
          onOpenFinance={() => handleNavigate("/finance")}
          onOpenQuickAccounting={onOpenQuickAccounting}
          onOpenPackages={onOpenPackages}
          shortcutNonce={shortcutRequest?.nonce}
          shortcutView={shortcutRequest?.kind === "notes" || shortcutRequest?.kind === "todos" ? shortcutRequest.kind : undefined}
          themeTokens={tokens}
        />
      ) : null}
      {activeKey === "plan" ? <DailyPlanPanel shortcutNonce={shortcutRequest?.nonce} shortcutTarget={shortcutRequest?.kind === "packages" ? "packages" : shortcutRequest?.kind === "packageScan" ? "packageScan" : undefined} themeTokens={tokens} /> : null}
      {activeKey === "workout" ? <WorkoutPanel /> : null}
      {activeKey === "finance" ? (
        <FinancePanel
          activeTab={financeTab}
          onTabChange={onFinanceTabChange}
          shortcutCreate={shortcutRequest?.kind === "finance"}
          shortcutNonce={shortcutRequest?.kind === "finance" ? shortcutRequest.nonce : undefined}
          showInlineTabs={false}
          themeTokens={tokens}
        />
      ) : null}
      {activeKey === "love" ? <LovePanel activeTab={loveTab} onTabChange={onLoveTabChange} showInlineTabs={false} themeTokens={tokens} /> : null}
      {activeKey === "exam" ? <ExamPanel activeTab={examTab} onTabChange={onExamTabChange} showInlineTabs={false} themeTokens={tokens} /> : null}
      {activeKey === "fun" ? <EntertainmentPanel activeTab={entertainmentTab} onTabChange={onEntertainmentTabChange} showInlineTabs={false} themeTokens={tokens} /> : null}
      {activeKey !== "home" && activeKey !== "plan" && activeKey !== "workout" && activeKey !== "finance" && activeKey !== "love" && activeKey !== "exam" && activeKey !== "fun" ? <GenericModuleSkeleton themeEmptyState={themeEmptyState} styles={styles} /> : null}
    </>
  );
}

function ShortcutButton({ icon, label, onPress, testID }: { icon: string; label: string; onPress: () => void; testID?: string }) {
  const shortcutRef = useRef<unknown>(null);
  useDisableTouchCallout(shortcutRef);
  return (
    <Pressable ref={shortcutRef as never} accessibilityRole="button" accessibilityLabel={`${label}快捷入口`} onPress={onPress} style={shortcutButtonBase} testID={testID}>
      <Text style={shortcutButtonIcon}>{icon}</Text>
      <Text style={shortcutButtonText}>{label}</Text>
    </Pressable>
  );
}

const shortcutButtonBase = {
  alignItems: "center" as const,
  backgroundColor: "rgba(255, 255, 255, 0.96)",
  borderColor: "#dce8dc",
  borderRadius: 14,
  borderWidth: 1,
  flexDirection: "row" as const,
  gap: 8,
  minHeight: 42,
  justifyContent: "flex-start" as const,
  paddingHorizontal: 10,
  paddingVertical: 8,
  userSelect: "none",
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8
} as never;

const shortcutButtonIcon = {
  color: "#1f8f55",
  fontSize: 15,
  fontWeight: "900" as const,
  textAlign: "center" as const,
  width: 20
};

const shortcutButtonText = {
  color: "#1f2937",
  fontSize: 13,
  fontWeight: "900" as const
};

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

function createStyles(
  tokens: ReturnType<typeof getTheme>["tokens"][ColorMode],
  sidebarWidth: number,
  isMobile: boolean,
  viewportHeight: number | "100dvh",
  hasSecondaryTabs: boolean,
  navOffset: number
) {
  const compactSidebar = isMobile || sidebarWidth < 160;
  const contentPadding = isMobile ? 16 : 28;
  const shellHeight = viewportHeight as unknown as number;

  return StyleSheet.create({
    root: {
      height: shellHeight,
      maxHeight: shellHeight,
      minHeight: shellHeight,
      flexDirection: "row",
      backgroundColor: tokens.background,
      overflow: "hidden"
    },
    sidebar: {
      width: sidebarWidth,
      minWidth: sidebarWidth,
      height: shellHeight,
      backgroundColor: tokens.surface,
      borderRightColor: tokens.border,
      borderRightWidth: 1,
      justifyContent: "flex-start",
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
      flexShrink: 0,
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
    navScroll: {
      flex: 1,
      marginTop: navOffset,
      minHeight: 0,
      width: "100%"
    },
    navList: {
      alignItems: "center",
      gap: 8,
      paddingBottom: 10
    },
    navItem: {
      alignItems: "center",
      borderRadius: 18,
      justifyContent: "center",
      minHeight: isMobile ? 56 : 52,
      paddingHorizontal: 4,
      paddingVertical: 6,
      width: compactSidebar ? 54 : "80%"
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
    navItemMoreHint: {
      backgroundColor: "#f2fbf4",
      borderColor: tokens.border,
      borderWidth: 1
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
    navLabelHint: {
      color: tokens.accent
    },
    moreLabelRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 3,
      justifyContent: "center"
    },
    moreChevron: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 14,
      marginTop: 2
    },
    moreChevronOpen: {
      color: tokens.accent
    },
    morePanel: {
      alignItems: "center",
      gap: 5,
      paddingTop: 3,
      width: "100%"
    },
    navSubItem: {
      alignItems: "center",
      borderColor: "transparent",
      borderRadius: 14,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 4,
      paddingVertical: 5,
      width: compactSidebar ? 48 : "74%"
    },
    navSubItemSelected: {
      backgroundColor: "#e9f7ee",
      borderColor: "#bfe8ca"
    },
    navSubLabel: {
      color: tokens.textMuted,
      fontSize: isMobile ? 8 : 10,
      fontWeight: "800",
      lineHeight: isMobile ? 11 : 13,
      marginTop: 1,
      textAlign: "center"
    },
    navSubLabelSelected: {
      color: tokens.accent
    },
    sidebarFooter: {
      alignItems: "center",
      flexShrink: 0,
      gap: 8,
      marginTop: 10,
      position: "relative"
    },
    quickDismissLayer: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 12
    },
    quickDock: {
      alignItems: "center",
      height: 46,
      justifyContent: "center",
      position: "relative",
      width: "100%",
      zIndex: 70
    },
    quickFab: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 999,
      height: 44,
      justifyContent: "center",
      shadowColor: tokens.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      width: 44
    },
    quickFabText: {
      color: "#ffffff",
      fontSize: 28,
      fontWeight: "700",
      lineHeight: 32
    },
    quickMenu: {
      backgroundColor: "rgba(255, 255, 255, 0.92)",
      borderColor: tokens.border,
      borderRadius: 18,
      borderWidth: 1,
      bottom: 52,
      gap: 8,
      left: compactSidebar ? 4 : 0,
      padding: 8,
      position: "absolute",
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
      width: compactSidebar ? 178 : 196,
      zIndex: 90
    },
    quickAccountingToast: {
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.96)",
      borderColor: tokens.border,
      borderRadius: 999,
      borderWidth: 1,
      bottom: hasSecondaryTabs ? 84 : 22,
      flexDirection: "row",
      gap: 10,
      left: sidebarWidth + contentPadding,
      paddingHorizontal: 12,
      paddingVertical: 9,
      position: "absolute",
      right: contentPadding,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      zIndex: 150
    },
    quickAccountingToastText: {
      color: tokens.text,
      flex: 1,
      fontSize: 13,
      fontWeight: "900"
    },
    quickAccountingUndo: {
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5
    },
    quickAccountingUndoText: {
      color: tokens.accent,
      fontSize: 12,
      fontWeight: "900"
    },
    settingsFab: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      gap: 2,
      minHeight: 38,
      justifyContent: "center",
      paddingHorizontal: compactSidebar ? 8 : 14,
      paddingVertical: 5,
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
      height: shellHeight,
      marginLeft: 0,
      overflow: "hidden",
      zIndex: 0
    },
    contentScroll: {
      flex: 1,
      height: shellHeight
    },
    contentInner: {
      gap: 16,
      padding: contentPadding,
      paddingBottom: hasSecondaryTabs ? 132 : 42
    },
    secondaryTabs: {
      bottom: Platform.OS === "web" ? ("calc(12px + env(safe-area-inset-bottom))" as unknown as number) : 12,
      left: sidebarWidth + contentPadding,
      position: "absolute",
      right: contentPadding,
      zIndex: 80
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
