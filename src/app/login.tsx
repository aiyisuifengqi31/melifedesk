import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { signInWithEmail, signUpWithEmail } from "@/auth/authRepository";
import { getSupabaseClient } from "@/auth/supabaseClient";
import { getPublicAppConfig } from "@/config/app";

const app = getPublicAppConfig();

const palette = {
  accent: "#c9748f",
  accentDeep: "#8f5a72",
  accentSoft: "#f7e3ec",
  background: "#fdf3f7",
  blush: "#ffd9e6",
  border: "#eed3de",
  cream: "#fff6ef",
  surface: "#ffffff",
  text: "#3a2833",
  textMuted: "#8a7480"
};

type Mode = "signIn" | "signUp";

export default function LoginRoute() {
  const router = useRouter();
  const client = useMemo(() => getSupabaseClient(), []);
  const [mode, setMode] = useState<Mode>("signIn");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = app.webTitle;
    }
  }, []);

  const report = (message: string, error = false) => {
    setStatus(message);
    setIsError(error);
  };

  const validate = () => {
    if (!email.trim() || !email.includes("@")) {
      report("请输入正确的邮箱地址", true);
      return false;
    }
    if (password.length < 6) {
      report("密码至少 6 位", true);
      return false;
    }
    if (mode === "signUp" && !displayName.trim()) {
      report("请填写昵称，方便 TA 认出你", true);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!client) {
      report("云端账号未配置，可先用本地模式体验", true);
      return;
    }
    if (!validate()) {
      return;
    }

    setBusy(true);
    report("");

    if (mode === "signIn") {
      const { error } = await signInWithEmail(client, { email, password });
      setBusy(false);
      if (error) {
        report(translateAuthError(error.message), true);
        return;
      }
      report("登录成功，正在进入…");
      router.replace("/home" as Href);
      return;
    }

    const { data, error } = await signUpWithEmail(client, { displayName, email, password });
    setBusy(false);
    if (error) {
      report(translateAuthError(error.message), true);
      return;
    }
    if (data.session) {
      report("注册成功，正在进入…");
      router.replace("/home" as Href);
      return;
    }
    report("注册成功，请到邮箱点击确认链接后再登录");
    setMode("signIn");
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.rootInner}>
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      <View style={styles.card}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>帆关</Text>
        </View>
        <Text accessibilityRole="header" role="heading" style={styles.title}>
          {app.displayName}
        </Text>
        <Text style={styles.subtitle}>{app.subtitle}</Text>

        <View style={styles.segment}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="登录"
            onPress={() => {
              setMode("signIn");
              report("");
            }}
            style={[styles.segmentItem, mode === "signIn" ? styles.segmentItemActive : null]}
          >
            <Text style={[styles.segmentText, mode === "signIn" ? styles.segmentTextActive : null]}>登录</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="注册"
            onPress={() => {
              setMode("signUp");
              report("");
            }}
            style={[styles.segmentItem, mode === "signUp" ? styles.segmentItemActive : null]}
          >
            <Text style={[styles.segmentText, mode === "signUp" ? styles.segmentTextActive : null]}>注册</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          {mode === "signUp" ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>昵称</Text>
              <TextInput
                accessibilityLabel="昵称"
                onChangeText={setDisplayName}
                placeholder="怎么称呼你"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                value={displayName}
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>邮箱</Text>
            <TextInput
              accessibilityLabel="邮箱"
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>密码</Text>
            <TextInput
              accessibilityLabel="密码"
              onChangeText={setPassword}
              placeholder="至少 6 位"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === "signIn" ? "立即登录" : "创建账号"}
          disabled={busy}
          onPress={() => void handleSubmit()}
          style={[styles.primaryButton, busy ? styles.primaryButtonBusy : null]}
        >
          {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{mode === "signIn" ? "立即登录" : "创建账号"}</Text>}
        </Pressable>

        {status ? (
          <Text testID="auth-status" style={[styles.status, isError ? styles.statusError : null]}>
            {status}
          </Text>
        ) : null}

        {!client ? (
          <>
            <View style={styles.configHintBox}>
              <Text style={styles.configHintTitle}>🌱 当前是本地模式</Text>
              <Text style={styles.configHintText}>云端账号服务未配置，因此暂时无法注册/登录。</Text>
              <Text style={styles.configHintText}>如需启用登录与双人同步，请在仓库的 GitHub Actions Secrets 中设置：</Text>
              <Text style={styles.configHintCode}>EXPO_PUBLIC_SUPABASE_URL</Text>
              <Text style={styles.configHintCode}>EXPO_PUBLIC_SUPABASE_ANON_KEY</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="以本地模式继续" onPress={() => router.replace("/home" as Href)} style={styles.ghostButton}>
              <Text style={styles.ghostButtonText}>以本地模式继续</Text>
            </Pressable>
          </>
        ) : null}

        <Text style={styles.footerHint}>登录后在「设置 · 我的」里用绑定码和 TA 绑定，数据各自独立、按需共享。</Text>
      </View>
    </ScrollView>
  );
}

function translateAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "邮箱或密码不正确";
  }
  if (text.includes("email not confirmed")) {
    return "邮箱还没确认，请先到邮箱点确认链接";
  }
  if (text.includes("user already registered")) {
    return "该邮箱已注册，直接登录即可";
  }
  if (text.includes("password should be at least")) {
    return "密码太短，请至少 6 位";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "操作太频繁，请稍后再试";
  }
  if (text.includes("fetch") || text.includes("network")) {
    return "网络连接失败，请检查网络后重试";
  }
  return message;
}

const styles = StyleSheet.create({
  blobBottom: {
    backgroundColor: palette.cream,
    borderRadius: 999,
    bottom: -80,
    height: 260,
    left: -70,
    opacity: 0.9,
    position: "absolute",
    width: 260
  },
  blobTop: {
    backgroundColor: palette.blush,
    borderRadius: 999,
    height: 220,
    opacity: 0.55,
    position: "absolute",
    right: -60,
    top: -60,
    width: 220
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 28,
    borderWidth: 1,
    elevation: 3,
    gap: 14,
    maxWidth: 420,
    padding: 26,
    shadowColor: palette.accentDeep,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    width: "100%"
  },
  configHintBox: {
    backgroundColor: palette.accentSoft,
    borderRadius: 14,
    gap: 6,
    padding: 14
  },
  configHintCode: {
    backgroundColor: palette.surface,
    borderRadius: 6,
    color: palette.accentDeep,
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  configHintText: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18
  },
  configHintTitle: {
    color: palette.accentDeep,
    fontSize: 14,
    fontWeight: "900"
  },
  field: {
    gap: 6
  },
  fieldLabel: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  footerHint: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center"
  },
  form: {
    gap: 12
  },
  ghostButton: {
    alignItems: "center",
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12
  },
  ghostButtonText: {
    color: palette.accentDeep,
    fontSize: 14,
    fontWeight: "800"
  },
  input: {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    color: palette.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  logo: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: palette.accentSoft,
    borderRadius: 999,
    height: 68,
    justifyContent: "center",
    width: 68
  },
  logoText: {
    color: palette.accentDeep,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: palette.accent,
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 50,
    paddingVertical: 14
  },
  primaryButtonBusy: {
    opacity: 0.7
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1
  },
  root: {
    backgroundColor: palette.background,
    flex: 1
  },
  rootInner: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    padding: 24
  },
  segment: {
    backgroundColor: palette.background,
    borderRadius: 14,
    flexDirection: "row",
    gap: 4,
    marginTop: 4,
    padding: 4
  },
  segmentItem: {
    alignItems: "center",
    borderRadius: 11,
    flex: 1,
    paddingVertical: 10
  },
  segmentItemActive: {
    backgroundColor: palette.surface,
    shadowColor: palette.accentDeep,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 6
  },
  segmentText: {
    color: palette.textMuted,
    fontSize: 15,
    fontWeight: "800"
  },
  segmentTextActive: {
    color: palette.accentDeep
  },
  status: {
    color: palette.accentDeep,
    fontSize: 13,
    textAlign: "center"
  },
  statusError: {
    color: "#c0392b"
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 14,
    textAlign: "center"
  },
  title: {
    color: palette.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center"
  }
});
