import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";

export const COUPLE_STORAGE_KEY = "fanfan-guanguan.couple.v1";

export type CoupleShareScope = "finance" | "love" | "plan" | "workout";

export type CoupleState = {
  myCode: string;
  partnerCode: string | null;
  partnerName: string | null;
  boundAt: string | null;
  shareScopes: CoupleShareScope[];
};

export const SHARE_SCOPE_LABELS: Record<CoupleShareScope, string> = {
  finance: "收支记账",
  love: "恋爱日记",
  plan: "每日计划",
  workout: "运动健身"
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBindingCode(length = 6): string {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeBindingCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function defaultState(): CoupleState {
  return {
    boundAt: null,
    myCode: generateBindingCode(),
    partnerCode: null,
    partnerName: null,
    shareScopes: ["love"]
  };
}

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

export function loadCoupleState(): CoupleState {
  const storage = getStorage();
  const raw = storage?.getItem(COUPLE_STORAGE_KEY);
  if (!raw) {
    const created = defaultState();
    storage?.setItem(COUPLE_STORAGE_KEY, JSON.stringify(created));
    return created;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CoupleState>;
    const scopes = Array.isArray(parsed.shareScopes)
      ? parsed.shareScopes.filter((scope): scope is CoupleShareScope => scope in SHARE_SCOPE_LABELS)
      : ["love" as CoupleShareScope];

    return {
      boundAt: typeof parsed.boundAt === "string" ? parsed.boundAt : null,
      myCode: typeof parsed.myCode === "string" && parsed.myCode ? parsed.myCode : generateBindingCode(),
      partnerCode: typeof parsed.partnerCode === "string" && parsed.partnerCode ? parsed.partnerCode : null,
      partnerName: typeof parsed.partnerName === "string" && parsed.partnerName ? parsed.partnerName : null,
      shareScopes: scopes
    };
  } catch {
    return defaultState();
  }
}

export function saveCoupleState(state: CoupleState) {
  getStorage()?.setItem(COUPLE_STORAGE_KEY, JSON.stringify(state));
  void saveCloudValue(COUPLE_STORAGE_KEY, state);
}

export async function hydrateCoupleFromCloud(): Promise<CoupleState> {
  const local = loadCoupleState();
  return hydrateFromCloud<CoupleState>(COUPLE_STORAGE_KEY, local, (value) => saveCoupleState(value));
}

export function toggleShareScope(state: CoupleState, scope: CoupleShareScope): CoupleState {
  const has = state.shareScopes.includes(scope);
  return {
    ...state,
    shareScopes: has ? state.shareScopes.filter((item) => item !== scope) : [...state.shareScopes, scope]
  };
}
