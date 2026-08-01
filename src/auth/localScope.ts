/**
 * 账号数据隔离。
 *
 * 云端（Supabase user_kv）本身按 user_id + RLS 隔离，但同一台设备上的
 * localStorage 是共享的。如果帆帆退出、关关登录，关关会先看到帆帆残留的
 * 本地缓存。这里记录“当前活跃账号”，一旦检测到换人就清空所有本地业务
 * 缓存，让新账号从云端重新水合。
 */

export const ACTIVE_USER_KEY = "fanfan-guanguan.active_user";
export const LOCAL_PREFIX = "fanfan-guanguan.";

/** 不随账号切换清除的键（纯设备级偏好） */
const KEEP_KEYS = new Set([ACTIVE_USER_KEY]);

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

export function readActiveUser(): string | null {
  return getStorage()?.getItem(ACTIVE_USER_KEY) ?? null;
}

export function purgeLocalScope(): string[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const removable: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && key.startsWith(LOCAL_PREFIX) && !KEEP_KEYS.has(key)) {
      removable.push(key);
    }
  }
  removable.forEach((key) => storage.removeItem(key));
  return removable;
}

/**
 * 在登录状态变化时调用。
 * 只有「已知上一个账号」且「新账号非空且不同」时才清空，
 * 避免会话恢复过程中的 null 抖动误删数据。
 *
 * @returns 是否发生了清空
 */
export function syncActiveUser(userId: string | null): boolean {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  const previous = storage.getItem(ACTIVE_USER_KEY);

  if (!userId) {
    return false;
  }

  if (previous && previous !== userId) {
    purgeLocalScope();
    storage.setItem(ACTIVE_USER_KEY, userId);
    return true;
  }

  if (previous !== userId) {
    storage.setItem(ACTIVE_USER_KEY, userId);
  }

  return false;
}

/** 主动退出登录时调用：清干净，避免下一个人看到上一个人的数据。 */
export function clearActiveUser() {
  purgeLocalScope();
  getStorage()?.removeItem(ACTIVE_USER_KEY);
}
