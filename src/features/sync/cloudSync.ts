import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/auth/supabaseClient";

const KV_TABLE = "user_kv";

/**
 * 非关键云端请求的超时时间。超时后一律回落本地数据（fail-soft），
 * 保证任何一个次要接口异常都不会让界面一直等下去。
 */
const CLOUD_TIMEOUT_MS = 4000;
/** 会话复用有效期：启动阶段所有模块共用同一次会话解析结果。 */
const SESSION_CACHE_MS = 30_000;
/** user_kv 读取合并窗口：首批（启动阶段）窗口更大，确保各模块的 key 合并成一次请求。 */
const FIRST_BATCH_WINDOW_MS = 160;
const BATCH_WINDOW_MS = 20;

type Session = {
  client: SupabaseClient;
  userId: string;
};

type BatchEntry = {
  key: string;
  resolve: (value: unknown) => void;
};

type Batch = {
  entries: BatchEntry[];
  timer: ReturnType<typeof setTimeout>;
};

let sessionCache: { at: number; promise: Promise<Session | null> } | null = null;
let authListenerBound = false;
let pendingBatch: Batch | null = null;
let firstBatchDone = false;

/**
 * 超时 + 失败降级包装：永不 reject，超时或异常都返回 fallback。
 */
function withTimeout<T>(task: Promise<T>, fallback: T, label: string, timeoutMs = CLOUD_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const finish = (value: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      // eslint-disable-next-line no-console
      console.warn(`[cloudSync] ${label} 超过 ${timeoutMs}ms 未返回，改用本地数据`);
      resolve(fallback);
    }, timeoutMs);
    task.then(finish).catch((error) => {
      // eslint-disable-next-line no-console
      console.warn(`[cloudSync] ${label} 失败，改用本地数据`, error);
      finish(fallback);
    });
  });
}

function bindAuthListener(client: SupabaseClient) {
  if (authListenerBound) return;
  authListenerBound = true;
  try {
    client.auth.onAuthStateChange(() => {
      // 登录 / 退出 / 换账号 / token 刷新后立即失效，避免复用上一个用户的身份。
      sessionCache = null;
    });
  } catch {
    /* 测试环境下的 mock 客户端可能没有该方法，忽略即可 */
  }
}

async function resolveSession(client: SupabaseClient): Promise<Session | null> {
  // 用 getSession() 而不是 getUser()：
  // - getSession() 读本地持久化会话（必要时才自动刷新 token），不会每次都打一次网络；
  // - supabase-js 对 auth 操作加了互斥锁，多个模块各自 getUser() 会被串行化，
  //   启动阶段会叠加成好几秒的等待；
  // - 数据安全仍由服务端 RLS（auth.uid()）强校验，userId 只用于拼查询条件。
  const { data, error } = await client.auth.getSession();
  const userId = data?.session?.user?.id ?? null;
  if (error || !userId) return null;
  return { client, userId };
}

async function getSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  bindAuthListener(client);

  const now = Date.now();
  if (sessionCache && now - sessionCache.at < SESSION_CACHE_MS) {
    return sessionCache.promise;
  }
  const promise = withTimeout(resolveSession(client), null, "会话解析");
  sessionCache = { at: now, promise };
  return promise;
}

async function flushBatch(entries: BatchEntry[]) {
  const keys = Array.from(new Set(entries.map((entry) => entry.key)));
  const session = await getSession();
  if (!session) {
    entries.forEach((entry) => entry.resolve(undefined));
    return;
  }

  const rows = await withTimeout(
    (async () => {
      const { data, error } = await session.client
        .from(KV_TABLE)
        .select("key,value")
        .eq("user_id", session.userId)
        .in("key", keys);
      if (error) throw error;
      return (data ?? []) as Array<{ key: string; value: unknown }>;
    })(),
    null as Array<{ key: string; value: unknown }> | null,
    `user_kv 批量读取（${keys.length} 个 key）`
  );

  const byKey = new Map<string, unknown>();
  (rows ?? []).forEach((row) => {
    if (row && typeof row.key === "string") byKey.set(row.key, row.value);
  });
  entries.forEach((entry) => entry.resolve(byKey.get(entry.key)));
}

/**
 * 把同一时间窗口内的多个 key 读取合并成一次 user_kv 查询。
 * 启动时首页 + 外壳共 8 个 key，从 8 次请求降到 1 次。
 */
function readKeyBatched(key: string): Promise<unknown> {
  return new Promise((resolve) => {
    if (!pendingBatch) {
      const window = firstBatchDone ? BATCH_WINDOW_MS : FIRST_BATCH_WINDOW_MS;
      firstBatchDone = true;
      const timer = setTimeout(() => {
        const batch = pendingBatch;
        pendingBatch = null;
        if (batch) void flushBatch(batch.entries);
      }, window);
      pendingBatch = { entries: [], timer };
    }
    pendingBatch.entries.push({ key, resolve });
  });
}

/**
 * Read a synced value from the cloud. Always resolves; falls back to `fallback`
 * when Supabase is not configured, the user is signed out, or the request
 * times out / fails.
 */
export async function loadCloudValue<T>(key: string, fallback: T): Promise<T> {
  if (!getSupabaseClient()) return fallback;
  const value = await readKeyBatched(key);
  if (value == null) return fallback;
  return value as T;
}

/**
 * Persist a value to the cloud. Fire-and-forget: any failure is swallowed so the
 * local-first app never blocks on the network. No-op when signed out.
 */
export async function saveCloudValue(key: string, value: unknown): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await withTimeout(
    (async () => {
      await session.client
        .from(KV_TABLE)
        .upsert(
          { user_id: session.userId, key, value, updated_at: new Date().toISOString() },
          { onConflict: "user_id,key" }
        );
    })(),
    undefined,
    `user_kv 写入（${key}）`
  );
}

export async function clearCloudValue(key: string): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await withTimeout(
    (async () => {
      await session.client.from(KV_TABLE).delete().eq("user_id", session.userId).eq("key", key);
    })(),
    undefined,
    `user_kv 删除（${key}）`
  );
}

/**
 * Pull the cloud copy and, if it differs from the local value, write it to
 * localStorage. Returns the winning value so the caller can refresh UI state.
 * Used on panel mount for cross-device hydration.
 */
export async function hydrateFromCloud<T>(key: string, localValue: T, writeLocal: (value: T) => void): Promise<T> {
  const cloud = await loadCloudValue<T | null>(key, null);
  if (cloud == null) return localValue;
  const same = JSON.stringify(cloud) === JSON.stringify(localValue);
  if (!same) {
    writeLocal(cloud);
    return cloud;
  }
  return localValue;
}

/** 测试用：清空会话缓存与批处理状态。 */
export function resetCloudSyncStateForTests() {
  sessionCache = null;
  authListenerBound = false;
  if (pendingBatch) clearTimeout(pendingBatch.timer);
  pendingBatch = null;
  firstBatchDone = false;
}
