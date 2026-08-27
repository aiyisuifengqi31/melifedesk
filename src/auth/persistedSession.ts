/**
 * 同步「窥视」localStorage 里 supabase-js 持久化的会话。
 *
 * 目的：启动时不必等 supabase-js 的异步存储/互斥锁流程，就能立刻判断
 * “这个人上次是登录状态且会话还没过期”，从而首帧直接进入工作台，
 * 真正的校验仍然在后台继续（getSession + onAuthStateChange），
 * 校验不通过会照常跳登录页。
 *
 * 解析失败一律返回 found=false，调用方回落到原本的异步等待逻辑。
 */

import { getSupabasePublicConfig } from "./supabaseConfig";

export type PersistedSessionPeek = {
  /** 本地是否存在 supabase 会话记录 */
  found: boolean;
  userId: string | null;
  /** 秒级时间戳 */
  expiresAt: number | null;
  hasRefreshToken: boolean;
};

const EMPTY: PersistedSessionPeek = { found: false, userId: null, expiresAt: null, hasRefreshToken: false };

export function buildAuthStorageKey(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0];
    return ref ? `sb-${ref}-auth-token` : null;
  } catch {
    return null;
  }
}

function decodeStoredValue(raw: string): unknown {
  const text = raw.startsWith("base64-") ? globalThis.atob(raw.slice("base64-".length)) : raw;
  return JSON.parse(text);
}

export function parsePersistedSession(raw: string | null | undefined): PersistedSessionPeek {
  if (!raw) return EMPTY;
  try {
    const parsed = decodeStoredValue(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return EMPTY;
    // 兼容旧格式 { currentSession: {...} }
    const session = (parsed.currentSession ?? parsed) as Record<string, unknown>;
    const user = session.user as { id?: unknown } | undefined;
    const userId = typeof user?.id === "string" ? user.id : null;
    const expiresAtRaw = session.expires_at;
    const expiresAt = typeof expiresAtRaw === "number" ? expiresAtRaw : null;
    const hasRefreshToken = typeof session.refresh_token === "string" && session.refresh_token.length > 0;
    if (!userId) return EMPTY;
    return { found: true, userId, expiresAt, hasRefreshToken };
  } catch {
    return EMPTY;
  }
}

export function peekPersistedSession(): PersistedSessionPeek {
  if (typeof window === "undefined" || !window.localStorage) return EMPTY;
  const config = getSupabasePublicConfig();
  if (!config.configured) return EMPTY;
  const key = buildAuthStorageKey(config.url);
  if (!key) return EMPTY;
  try {
    return parsePersistedSession(window.localStorage.getItem(key));
  } catch {
    return EMPTY;
  }
}

/**
 * 本地会话是否可以先放行进入工作台。
 *
 * - access_token 未过期（留 5s 安全边界）→ 直接放行；
 * - access_token 过期但有 refresh_token → 也放行：token 刷新在后台进行，
 *   刷新成功用户无感，刷新失败会被 AuthGate 收到并跳登录页。
 *   （否则每个隔一段时间回来的老用户，都要先等一次 token 刷新的网络往返。）
 */
export function isPeekUsable(peek: PersistedSessionPeek, nowMs: number = Date.now()): boolean {
  if (!peek.found || !peek.userId) return false;
  if (peek.expiresAt && peek.expiresAt * 1000 > nowMs + 5000) return true;
  return peek.hasRefreshToken;
}
