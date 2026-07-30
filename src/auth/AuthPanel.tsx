import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { THEME_IDS } from "@/theme/registry";
import type { ThemeId } from "@/theme/types";
import { acceptCoupleInvite, createCoupleInvite, leaveActiveCouple, saveUserSettings, signInWithEmail, signOut, signUpWithEmail } from "./authRepository";
import { getSupabaseClient } from "./supabaseClient";

export function AuthPanel() {
  const client = useMemo(() => getSupabaseClient(), []);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(client ? "Supabase Auth 已配置" : "Supabase 未配置，请先填写 .env");
  const [themeId, setThemeId] = useState<ThemeId>("default");

  async function requireClient() {
    if (!client) {
      setStatus("Supabase 未配置，无法执行账号操作");
      return null;
    }
    return client;
  }

  async function handleSignUp() {
    const supabase = await requireClient();
    if (!supabase) return;
    const { error } = await signUpWithEmail(supabase, { displayName, email, password });
    setStatus(error ? error.message : "注册请求已提交，请按 Supabase 邮件策略完成确认");
  }

  async function handleSignIn() {
    const supabase = await requireClient();
    if (!supabase) return;
    const { error } = await signInWithEmail(supabase, { email, password });
    setStatus(error ? error.message : "已登录");
  }

  async function handleSignOut() {
    const supabase = await requireClient();
    if (!supabase) return;
    const { error } = await signOut(supabase);
    setStatus(error ? error.message : "已退出登录");
  }

  async function handleSaveTheme() {
    const supabase = await requireClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setStatus("请先登录后再保存主题");
      return;
    }
    const { error } = await saveUserSettings(supabase, data.user.id, { themeId });
    setStatus(error ? error.message : "主题已保存到 user_settings");
  }

  async function handleCreateInvite() {
    const supabase = await requireClient();
    if (!supabase) return;
    const { data, error } = await createCoupleInvite(supabase);
    setStatus(error ? error.message : `邀请码：${JSON.stringify(data)}`);
  }

  async function handleAcceptInvite() {
    const supabase = await requireClient();
    if (!supabase) return;
    const { error } = await acceptCoupleInvite(supabase, inviteCode);
    setStatus(error ? error.message : "已接受邀请");
  }

  async function handleLeaveCouple() {
    const supabase = await requireClient();
    if (!supabase) return;
    const { error } = await leaveActiveCouple(supabase);
    setStatus(error ? error.message : "已解除绑定");
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>账号</Text>
      <TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="邮箱" style={styles.input} value={email} />
      <TextInput onChangeText={setPassword} placeholder="密码" secureTextEntry style={styles.input} value={password} />
      <TextInput onChangeText={setDisplayName} placeholder="显示名称" style={styles.input} value={displayName} />
      <View style={styles.actions}>
        <ActionButton label="注册" onPress={handleSignUp} />
        <ActionButton label="登录" onPress={handleSignIn} />
        <ActionButton label="退出" onPress={handleSignOut} />
      </View>

      <Text style={styles.sectionTitle}>用户设置</Text>
      <View style={styles.themeRow}>
        {THEME_IDS.map((id) => (
          <Pressable key={id} accessibilityRole="button" accessibilityLabel={`选择${id}主题`} onPress={() => setThemeId(id)} style={[styles.themeChoice, themeId === id ? styles.themeChoiceActive : null]}>
            <Text style={styles.themeText}>{id}</Text>
          </Pressable>
        ))}
      </View>
      <ActionButton label="保存主题" onPress={handleSaveTheme} />

      <Text style={styles.sectionTitle}>情侣关系</Text>
      <TextInput autoCapitalize="characters" onChangeText={setInviteCode} placeholder="邀请码" style={styles.input} value={inviteCode} />
      <View style={styles.actions}>
        <ActionButton label="生成情侣邀请码" onPress={handleCreateInvite} />
        <ActionButton label="接受邀请" onPress={handleAcceptInvite} />
        <ActionButton label="解除绑定" onPress={handleLeaveCouple} />
      </View>

      <Text testID="auth-status" style={styles.status}>
        {status}
      </Text>
    </View>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  button: {
    backgroundColor: "#34261d",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "800"
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#ebd8c6",
    borderRadius: 8,
    borderWidth: 1,
    color: "#34261d",
    minWidth: 240,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  panel: {
    backgroundColor: "#fffdfa",
    borderColor: "#ebd8c6",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginTop: 22,
    maxWidth: 620,
    padding: 16,
    width: "100%"
  },
  sectionTitle: {
    color: "#34261d",
    fontSize: 16,
    fontWeight: "800"
  },
  status: {
    color: "#7a685c",
    fontSize: 13
  },
  themeChoice: {
    borderColor: "#ebd8c6",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  themeChoiceActive: {
    backgroundColor: "#ffe6d9",
    borderColor: "#e88f7a"
  },
  themeRow: {
    flexDirection: "row",
    gap: 8
  },
  themeText: {
    color: "#34261d",
    fontWeight: "700"
  }
});
