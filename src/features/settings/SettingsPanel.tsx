import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { IconPackage, IconPalette, IconSettings, IconUser } from "@/shared/ui/lineIcons";
import { acceptCoupleInvite, createCoupleInvite, leaveActiveCouple, signOut } from "@/auth/authRepository";
import { clearActiveUser } from "@/auth/localScope";
import { getSupabaseClient } from "@/auth/supabaseClient";
import { openImagePicker, saveProfile, type AppProfile } from "@/features/profile/profileStorage";
import {
  applyBackupPayload,
  buildBackupPayload,
  clearLocalData,
  collectBackupData,
  describeBackupSize,
  downloadBackupFile,
  labelForBackupKey,
  openBackupFilePicker,
  parseBackupPayload
} from "./backup";
import {
  generateBindingCode,
  hydrateCoupleFromCloud,
  loadCoupleState,
  normalizeBindingCode,
  saveCoupleState,
  SHARE_SCOPE_LABELS,
  toggleShareScope,
  type CoupleShareScope,
  type CoupleState
} from "./coupleStorage";
import { getTheme, THEME_IDS } from "@/theme/registry";
import type { ColorMode, ThemeId, ThemeTokens } from "@/theme/types";
import { PRESET_BACKGROUNDS, findBackgroundOption, type BackgroundSource } from "@/theme/background";

type SettingsTab = "backup" | "profile" | "theme";

type SettingsPanelProps = {
  background: BackgroundSource | null;
  colorMode: ColorMode;
  onBackgroundChange: (background: BackgroundSource | null) => void;
  onClose: () => void;
  onColorModeChange: (mode: ColorMode) => void;
  onProfileChange: (profile: AppProfile) => void;
  onThemeChange: (themeId: ThemeId) => void;
  profile: AppProfile;
  themeId: ThemeId;
  tokens: ThemeTokens;
};

const TABS: Array<{ icon: (color: string) => ReactNode; key: SettingsTab; label: string }> = [
  { icon: (color) => <IconUser color={color} size={16} />, key: "profile", label: "我的" },
  { icon: (color) => <IconPalette color={color} size={16} />, key: "theme", label: "主题" },
  { icon: (color) => <IconPackage color={color} size={16} />, key: "backup", label: "导出" }
];

export function SettingsPanel({
  background,
  colorMode,
  onBackgroundChange,
  onClose,
  onColorModeChange,
  onProfileChange,
  onThemeChange,
  profile,
  themeId,
  tokens
}: SettingsPanelProps) {
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [nameDraft, setNameDraft] = useState(profile.displayName);
  const [mottoDraft, setMottoDraft] = useState(profile.motto ?? "");
  const [birthdayDraft, setBirthdayDraft] = useState(profile.birthday ?? "");
  const [profileMessage, setProfileMessage] = useState("");

  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

  const [couple, setCouple] = useState<CoupleState>(() => loadCoupleState());
  const [partnerCodeDraft, setPartnerCodeDraft] = useState("");
  const [coupleMessage, setCoupleMessage] = useState("");

  const [backupItems, setBackupItems] = useState<Record<string, string>>(() => collectBackupData());
  const [backupMessage, setBackupMessage] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const client = getSupabaseClient();
    if (client) {
      void client.auth.getUser().then(({ data }) => {
        if (!cancelled) {
          setEmail(data.user?.email ?? null);
        }
      });
    }
    hydrateCoupleFromCloud()
      .then((next) => {
        if (!cancelled) {
          setCouple(next);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshBackupItems = () => setBackupItems(collectBackupData());

  const commitProfile = () => {
    const next: AppProfile = {
      ...profile,
      birthday: birthdayDraft.trim() || undefined,
      displayName: nameDraft.trim() || "帆帆和关关",
      motto: mottoDraft.trim() || undefined
    };
    saveProfile(next);
    onProfileChange(next);
    setNameDraft(next.displayName);
    setProfileMessage("资料已保存");
  };

  const pickAvatar = () => {
    openImagePicker((dataUrl) => {
      const next = { ...profile, avatarUri: dataUrl };
      saveProfile(next);
      onProfileChange(next);
      setProfileMessage("头像已更新");
    });
  };

  const changePassword = async () => {
    const client = getSupabaseClient();
    if (!client) {
      setAccountMessage("当前是本地模式，暂未连接账号服务。");
      return;
    }
    if (newPassword.length < 6) {
      setAccountMessage("新密码至少 6 位。");
      return;
    }
    const { error } = await client.auth.updateUser({ password: newPassword });
    setAccountMessage(error ? `修改失败：${error.message}` : "密码已更新。");
    if (!error) {
      setNewPassword("");
    }
  };

  const doSignOut = async () => {
    const client = getSupabaseClient();
    if (!client) {
      setAccountMessage("当前是本地模式，无需退出。");
      return;
    }
    await signOut(client);
    clearActiveUser();
    setAccountMessage("已退出登录，本地缓存已清空。");
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const persistCouple = (next: CoupleState) => {
    setCouple(next);
    saveCoupleState(next);
  };

  const pickCustomBackground = () => {
    openImagePicker((dataUrl) => {
      onBackgroundChange({ kind: "custom", uri: dataUrl });
    });
  };

  const regenerateCode = async () => {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await createCoupleInvite(client);
      if (!error && typeof data === "string" && data) {
        persistCouple({ ...couple, myCode: normalizeBindingCode(data) || couple.myCode });
        setCoupleMessage("绑定码已生成，发给对方即可。");
        return;
      }
    }
    persistCouple({ ...couple, myCode: generateBindingCode() });
    setCoupleMessage("绑定码已生成，发给对方即可。");
  };

  const copyCode = async () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(couple.myCode);
      setCoupleMessage("绑定码已复制到剪贴板。");
      return;
    }
    setCoupleMessage(`绑定码：${couple.myCode}`);
  };

  const bindPartner = async () => {
    const code = normalizeBindingCode(partnerCodeDraft);
    if (code.length < 4) {
      setCoupleMessage("请输入对方完整的绑定码。");
      return;
    }
    if (code === couple.myCode) {
      setCoupleMessage("不能绑定自己的绑定码哦。");
      return;
    }

    const client = getSupabaseClient();
    if (client) {
      const { error } = await acceptCoupleInvite(client, code);
      if (error) {
        setCoupleMessage(`绑定失败：${error.message}`);
        return;
      }
    }

    persistCouple({ ...couple, boundAt: new Date().toISOString(), partnerCode: code });
    setPartnerCodeDraft("");
    setCoupleMessage("绑定成功，你们现在可以共享内容了。");
  };

  const unbindPartner = async () => {
    const client = getSupabaseClient();
    if (client) {
      await leaveActiveCouple(client);
    }
    persistCouple({ ...couple, boundAt: null, partnerCode: null, partnerName: null });
    setCoupleMessage("已解除绑定。");
  };

  const exportBackup = () => {
    const payload = buildBackupPayload();
    downloadBackupFile(payload);
    setBackupMessage(`已导出 ${Object.keys(payload.data).length} 项数据。`);
  };

  const importBackup = () => {
    openBackupFilePicker((raw) => {
      const payload = parseBackupPayload(raw);
      if (!payload) {
        setBackupMessage("文件格式不对，请选择本应用导出的备份文件。");
        return;
      }
      const count = applyBackupPayload(payload);
      refreshBackupItems();
      setBackupMessage(`已恢复 ${count} 项数据，刷新页面后生效。`);
    });
  };

  const doClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setBackupMessage("再点一次确认清空，建议先导出备份。");
      return;
    }
    const count = clearLocalData();
    refreshBackupItems();
    setConfirmClear(false);
    setBackupMessage(`已清空 ${count} 项本地数据。`);
  };

  const backupKeys = Object.keys(backupItems).sort();

  return (
    <View nativeID="settings-panel" style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View pointerEvents="none" style={styles.pageWatermark}>
            <IconSettings color={tokens.text} size={74} />
          </View>
          <Text style={styles.title}>设置</Text>
          <Pressable accessibilityLabel="关闭设置" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>关闭</Text>
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          {TABS.map((item) => {
            const selected = tab === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityLabel={`设置-${item.label}`}
                accessibilityRole="button"
                onPress={() => setTab(item.key)}
                style={[styles.tabButton, selected ? styles.tabButtonActive : null]}
              >
                {item.icon(selected ? tokens.surface : tokens.textMuted)}
                <Text style={[styles.tabText, selected ? styles.tabTextActive : null]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.body} style={styles.bodyScroll}>
          {tab === "profile" ? (
            <>
              <View style={styles.block}>
                <Text style={styles.blockTitle}>个人资料</Text>
                <View style={styles.avatarRow}>
                  <Pressable accessibilityLabel="更换头像" accessibilityRole="button" onPress={pickAvatar} style={styles.avatar}>
                    {profile.avatarUri ? (
                      <Image accessibilityIgnoresInvertColors source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{Array.from(profile.displayName)[0] ?? "友"}</Text>
                    )}
                  </Pressable>
                  <View style={styles.avatarHint}>
                    <Text style={styles.blockLabel}>头像</Text>
                    <Text style={styles.muted}>点击左侧圆形头像即可从相册选择图片</Text>
                  </View>
                </View>

                <Text style={styles.blockLabel}>昵称</Text>
                <TextInput
                  accessibilityLabel="编辑昵称"
                  onChangeText={setNameDraft}
                  placeholder="给自己起个名字"
                  placeholderTextColor={tokens.textMuted}
                  style={styles.input}
                  value={nameDraft}
                />

                <Text style={styles.blockLabel}>个性签名</Text>
                <TextInput
                  accessibilityLabel="编辑个性签名"
                  onChangeText={setMottoDraft}
                  placeholder="想对自己说的一句话"
                  placeholderTextColor={tokens.textMuted}
                  style={styles.input}
                  value={mottoDraft}
                />

                <Text style={styles.blockLabel}>生日</Text>
                <TextInput
                  accessibilityLabel="编辑生日"
                  onChangeText={setBirthdayDraft}
                  placeholder="例如 1998-05-20"
                  placeholderTextColor={tokens.textMuted}
                  style={styles.input}
                  value={birthdayDraft}
                />

                <Pressable accessibilityLabel="保存资料" accessibilityRole="button" onPress={commitProfile} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>保存资料</Text>
                </Pressable>
                {profileMessage ? <Text style={styles.feedback}>{profileMessage}</Text> : null}
              </View>

              <View style={styles.block}>
                <Text style={styles.blockTitle}>账号与密码</Text>
                <Text style={styles.muted}>当前账号：{email ?? "本地模式（未登录）"}</Text>
                <Text style={styles.blockLabel}>设置新密码</Text>
                <TextInput
                  accessibilityLabel="新密码"
                  onChangeText={setNewPassword}
                  placeholder="至少 6 位"
                  placeholderTextColor={tokens.textMuted}
                  secureTextEntry
                  style={styles.input}
                  value={newPassword}
                />
                <View style={styles.buttonRow}>
                  <Pressable accessibilityLabel="修改密码" accessibilityRole="button" onPress={() => void changePassword()} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>修改密码</Text>
                  </Pressable>
                  <Pressable accessibilityLabel="退出登录" accessibilityRole="button" onPress={() => void doSignOut()} style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>退出登录</Text>
                  </Pressable>
                </View>
                {accountMessage ? <Text style={styles.feedback}>{accountMessage}</Text> : null}
              </View>

              <View style={styles.block}>
                <Text style={styles.blockTitle}>伴侣绑定</Text>
                <Text style={styles.muted}>把绑定码发给对方，对方输入后你们就成为一对，可选择互相可见的内容。</Text>

                <View style={styles.codeCard}>
                  <Text style={styles.codeLabel}>我的绑定码</Text>
                  <Text style={styles.codeValue}>{couple.myCode}</Text>
                </View>
                <View style={styles.buttonRow}>
                  <Pressable accessibilityLabel="复制绑定码" accessibilityRole="button" onPress={() => void copyCode()} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>复制</Text>
                  </Pressable>
                  <Pressable accessibilityLabel="重新生成绑定码" accessibilityRole="button" onPress={() => void regenerateCode()} style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>重新生成</Text>
                  </Pressable>
                </View>

                {couple.partnerCode ? (
                  <View style={styles.boundCard}>
                    <Text style={styles.boundText}>已绑定：{couple.partnerName ?? couple.partnerCode}</Text>
                    <Pressable accessibilityLabel="解除绑定" accessibilityRole="button" onPress={() => void unbindPartner()} style={styles.dangerButton}>
                      <Text style={styles.dangerButtonText}>解除</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={styles.blockLabel}>输入对方的绑定码</Text>
                    <View style={styles.buttonRow}>
                      <TextInput
                        accessibilityLabel="对方绑定码"
                        autoCapitalize="characters"
                        onChangeText={(value) => setPartnerCodeDraft(normalizeBindingCode(value))}
                        placeholder="例如 A7K2M9"
                        placeholderTextColor={tokens.textMuted}
                        style={[styles.input, styles.inputFlex]}
                        value={partnerCodeDraft}
                      />
                      <Pressable accessibilityLabel="绑定伴侣" accessibilityRole="button" onPress={() => void bindPartner()} style={styles.primaryButton}>
                        <Text style={styles.primaryButtonText}>绑定</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                <Text style={styles.blockLabel}>对方可以看到</Text>
                <View style={styles.chipRow}>
                  {(Object.keys(SHARE_SCOPE_LABELS) as CoupleShareScope[]).map((scope) => {
                    const selected = couple.shareScopes.includes(scope);
                    return (
                      <Pressable
                        key={scope}
                        accessibilityLabel={`共享${SHARE_SCOPE_LABELS[scope]}`}
                        accessibilityRole="button"
                        onPress={() => persistCouple(toggleShareScope(couple, scope))}
                        style={[styles.chip, selected ? styles.chipActive : null]}
                      >
                        <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>{SHARE_SCOPE_LABELS[scope]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {coupleMessage ? <Text style={styles.feedback}>{coupleMessage}</Text> : null}
              </View>
            </>
          ) : null}

          {tab === "theme" ? (
            <>
              <View style={styles.block}>
                <Text style={styles.blockTitle}>外观</Text>
                <View style={styles.chipRow}>
                  <Pressable
                    accessibilityLabel="浅色模式"
                    accessibilityRole="button"
                    onPress={() => onColorModeChange("light")}
                    style={[styles.chip, colorMode === "light" ? styles.chipActive : null]}
                  >
                    <Text style={[styles.chipText, colorMode === "light" ? styles.chipTextActive : null]}>浅色</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="深色模式"
                    accessibilityRole="button"
                    onPress={() => onColorModeChange("dark")}
                    style={[styles.chip, colorMode === "dark" ? styles.chipActive : null]}
                  >
                    <Text style={[styles.chipText, colorMode === "dark" ? styles.chipTextActive : null]}>深色</Text>
                  </Pressable>
                </View>
                <Text nativeID="sidebar-theme-mode" style={styles.muted}>
                  当前外观：{colorMode === "light" ? "浅色" : "深色"}
                </Text>
              </View>

              <View style={styles.block}>
                <Text style={styles.blockTitle}>配色主题</Text>
                <Text nativeID="sidebar-current-theme" style={styles.muted}>
                  当前主题：{getTheme(themeId).name}
                </Text>
                <View style={styles.themeGrid}>
                  {THEME_IDS.map((id) => {
                    const definition = getTheme(id);
                    const preview = definition.tokens[colorMode];
                    const selected = id === themeId;
                    return (
                      <Pressable
                        key={id}
                        accessibilityLabel={`使用${definition.name}主题`}
                        accessibilityRole="button"
                        onPress={() => onThemeChange(id)}
                        style={[styles.themeCard, selected ? styles.themeCardActive : null]}
                      >
                        <View style={styles.swatchRow}>
                          <View style={[styles.swatch, { backgroundColor: preview.accent }]} />
                          <View style={[styles.swatch, { backgroundColor: preview.accentSoft }]} />
                          <View style={[styles.swatch, { backgroundColor: preview.background, borderColor: preview.border, borderWidth: 1 }]} />
                        </View>
                        <Text style={styles.themeName}>{definition.name}</Text>
                        <Text style={styles.themeDesc} numberOfLines={2}>{definition.description}</Text>
                        {selected ? <Text style={styles.themeSelected}>使用中</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.block}>
                <Text style={styles.blockTitle}>页面背景</Text>
                <Text style={styles.muted}>
                  当前背景：{background?.kind === "custom" ? "自定义图片" : findBackgroundOption(background)?.name ?? "无背景"}
                </Text>
                <View style={styles.backgroundGrid}>
                  {PRESET_BACKGROUNDS.map((option) => {
                    const selected =
                      (background === null && option.id === "none") ||
                      (background?.kind === "preset" && background.uri === option.source.uri);
                    return (
                      <Pressable
                        key={option.id}
                        accessibilityLabel={`使用${option.name}背景`}
                        accessibilityRole="button"
                        onPress={() => onBackgroundChange(option.id === "none" ? null : option.source)}
                        style={[styles.backgroundCard, selected ? styles.backgroundCardActive : null]}
                      >
                        {option.source.uri ? (
                          <Image source={option.source.uri as unknown as { uri: string }} style={styles.backgroundThumb} />
                        ) : (
                          <View style={styles.backgroundNone}>
                            <Text style={styles.backgroundNoneText}>无</Text>
                          </View>
                        )}
                        <Text style={styles.backgroundName}>{option.name}</Text>
                        {selected ? <Text style={styles.backgroundSelected}>使用中</Text> : null}
                      </Pressable>
                    );
                  })}
                  <Pressable
                    accessibilityLabel="上传自定义背景"
                    accessibilityRole="button"
                    onPress={pickCustomBackground}
                    style={[styles.backgroundCard, background?.kind === "custom" ? styles.backgroundCardActive : null]}
                  >
                    <View style={styles.backgroundUpload}>
                      <Text style={styles.backgroundUploadText}>+</Text>
                    </View>
                    <Text style={styles.backgroundName}>自定义</Text>
                    {background?.kind === "custom" ? <Text style={styles.backgroundSelected}>使用中</Text> : null}
                  </Pressable>
                </View>
              </View>
            </>
          ) : null}

          {tab === "backup" ? (
            <>
              <View style={styles.block}>
                <Text style={styles.blockTitle}>数据概览</Text>
                <Text style={styles.muted}>
                  共 {backupKeys.length} 项，约 {describeBackupSize(backupItems)}
                </Text>
                {backupKeys.length === 0 ? (
                  <Text style={styles.muted}>还没有本地数据。</Text>
                ) : (
                  backupKeys.map((key) => (
                    <View key={key} style={styles.dataRow}>
                      <Text style={styles.dataName}>{labelForBackupKey(key)}</Text>
                      <Text style={styles.dataSize}>{describeBackupSize({ [key]: backupItems[key] })}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.block}>
                <Text style={styles.blockTitle}>备份与恢复</Text>
                <Text style={styles.muted}>导出后会生成一个 JSON 文件，换手机时导入即可恢复。</Text>
                <View style={styles.buttonRow}>
                  <Pressable accessibilityLabel="导出备份" accessibilityRole="button" onPress={exportBackup} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>导出备份</Text>
                  </Pressable>
                  <Pressable accessibilityLabel="导入备份" accessibilityRole="button" onPress={importBackup} style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>导入备份</Text>
                  </Pressable>
                </View>
                <Pressable accessibilityLabel="清空本地数据" accessibilityRole="button" onPress={doClear} style={styles.dangerWideButton}>
                  <Text style={styles.dangerButtonText}>{confirmClear ? "再点一次确认清空" : "清空本地数据"}</Text>
                </Pressable>
                {backupMessage ? <Text style={styles.feedback}>{backupMessage}</Text> : null}
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function createStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    avatar: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 999,
      height: 62,
      justifyContent: "center",
      overflow: "hidden",
      width: 62
    },
    avatarHint: {
      flex: 1,
      gap: 2
    },
    avatarImage: {
      height: "100%",
      width: "100%"
    },
    avatarRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 14
    },
    avatarText: {
      color: tokens.accent,
      fontSize: 24,
      fontWeight: "900"
    },
    block: {
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: 8,
      padding: 14
    },
    blockLabel: {
      color: tokens.text,
      fontSize: 13,
      fontWeight: "800",
      marginTop: 4
    },
    blockTitle: {
      color: tokens.text,
      fontSize: 16,
      fontWeight: "900"
    },
    body: {
      gap: 12,
      paddingBottom: 24,
      paddingHorizontal: 14
    },
    bodyScroll: {
      flex: 1
    },
    boundCard: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 12,
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    boundText: {
      color: tokens.text,
      flex: 1,
      fontSize: 14,
      fontWeight: "800"
    },
    buttonRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    chip: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 7
    },
    chipActive: {
      backgroundColor: tokens.accent,
      borderColor: tokens.accent
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    chipText: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "800"
    },
    chipTextActive: {
      color: "#ffffff"
    },
    closeButton: {
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7
    },
    closeText: {
      color: tokens.text,
      fontSize: 13,
      fontWeight: "800"
    },
    codeCard: {
      alignItems: "center",
      backgroundColor: tokens.accentSoft,
      borderRadius: 14,
      gap: 4,
      paddingVertical: 14
    },
    codeLabel: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "800"
    },
    codeValue: {
      color: tokens.accent,
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: 6
    },
    dangerButton: {
      backgroundColor: tokens.danger,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8
    },
    dangerButtonText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "900"
    },
    dangerWideButton: {
      alignItems: "center",
      backgroundColor: tokens.danger,
      borderRadius: 12,
      marginTop: 4,
      paddingVertical: 11
    },
    dataName: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "700"
    },
    dataRow: {
      alignItems: "center",
      borderTopColor: tokens.border,
      borderTopWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8
    },
    dataSize: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: "700"
    },
    feedback: {
      color: tokens.accent,
      fontSize: 13,
      fontWeight: "800"
    },
    ghostButton: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 11
    },
    ghostButtonText: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "800"
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      overflow: "hidden",
      paddingHorizontal: 14,
      paddingTop: 14,
      position: "relative"
    },
    pageWatermark: {
      bottom: -18,
      opacity: 0.05,
      position: "absolute",
      right: 78,
      top: -12
    },
    input: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 12,
      borderWidth: 1,
      color: tokens.text,
      fontSize: 14,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    inputFlex: {
      flex: 1,
      minWidth: 120
    },
    muted: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 19
    },
    overlay: {
      alignItems: "center",
      backgroundColor: "rgba(15, 23, 42, 0.45)",
      bottom: 0,
      justifyContent: "center",
      left: 0,
      padding: 12,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 60
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: tokens.accent,
      borderRadius: 12,
      paddingHorizontal: 18,
      paddingVertical: 11
    },
    primaryButtonText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "900"
    },
    sheet: {
      backgroundColor: tokens.background,
      borderColor: tokens.border,
      borderRadius: 28,
      borderWidth: 1,
      elevation: 10,
      gap: 10,
      maxHeight: "92%",
      maxWidth: 520,
      overflow: "hidden",
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 22,
      width: "100%"
    },
    swatch: {
      borderRadius: 999,
      height: 16,
      width: 16
    },
    swatchRow: {
      flexDirection: "row",
      gap: 5
    },
    tabButton: {
      alignItems: "center",
      backgroundColor: tokens.surfaceMuted,
      borderRadius: 12,
      flex: 1,
      gap: 2,
      paddingVertical: 8
    },
    tabButtonActive: {
      backgroundColor: tokens.accent
    },
    tabIcon: {
      fontSize: 16
    },
    tabRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 14
    },
    tabText: {
      color: tokens.textMuted,
      fontSize: 13,
      fontWeight: "800"
    },
    tabTextActive: {
      color: "#ffffff"
    },
    themeCard: {
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 14,
      borderWidth: 1,
      flexBasis: "48%",
      flexGrow: 1,
      gap: 4,
      padding: 10
    },
    themeCardActive: {
      backgroundColor: tokens.accentSoft,
      borderColor: tokens.accent,
      borderWidth: 2
    },
    themeDesc: {
      color: tokens.textMuted,
      fontSize: 11,
      lineHeight: 15
    },
    themeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 4
    },
    themeName: {
      color: tokens.text,
      fontSize: 14,
      fontWeight: "900"
    },
    themeSelected: {
      color: tokens.accent,
      fontSize: 11,
      fontWeight: "900"
    },
    backgroundCard: {
      alignItems: "center",
      backgroundColor: tokens.surfaceMuted,
      borderColor: tokens.border,
      borderRadius: 14,
      borderWidth: 1,
      flexBasis: "30%",
      flexGrow: 1,
      gap: 6,
      overflow: "hidden",
      padding: 8
    },
    backgroundCardActive: {
      backgroundColor: tokens.accentSoft,
      borderColor: tokens.accent,
      borderWidth: 2
    },
    backgroundGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 4
    },
    backgroundName: {
      color: tokens.text,
      fontSize: 12,
      fontWeight: "800"
    },
    backgroundNone: {
      alignItems: "center",
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 10,
      borderStyle: "dashed",
      borderWidth: 1,
      height: 70,
      justifyContent: "center",
      width: "100%"
    },
    backgroundNoneText: {
      color: tokens.textMuted,
      fontSize: 14,
      fontWeight: "900"
    },
    backgroundSelected: {
      color: tokens.accent,
      fontSize: 11,
      fontWeight: "900"
    },
    backgroundThumb: {
      borderRadius: 10,
      height: 70,
      width: "100%"
    },
    backgroundUpload: {
      alignItems: "center",
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderRadius: 10,
      borderStyle: "dashed",
      borderWidth: 1,
      height: 70,
      justifyContent: "center",
      width: "100%"
    },
    backgroundUploadText: {
      color: tokens.accent,
      fontSize: 28,
      fontWeight: "500"
    },
    title: {
      color: tokens.text,
      fontSize: 18,
      fontWeight: "900"
    }
  });
}
