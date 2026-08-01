export type SupabasePublicConfig = {
  anonKey: string;
  configured: boolean;
  url: string;
};

// 注意：这里必须直接引用 `process.env.EXPO_PUBLIC_*`，让 Expo/Metro 的
// 构建期替换插件能把环境变量内联进浏览器 bundle。用 `(n = process.env)`
// 默认参数包一层会导致源码里没有 `process.env.EXPO_PUBLIC_*` 字面量，
// 变量无法被替换，最终结果永远是空 -> 永远显示本地模式、无法登录。
export function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = (typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_SUPABASE_URL : undefined) ?? "";
  const anonKey = (typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY : undefined) ?? "";

  return {
    anonKey,
    configured: Boolean(url && anonKey),
    url
  };
}
