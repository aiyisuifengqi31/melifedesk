import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";

export type AppProfile = {
  avatarUri?: string;
  displayName: string;
};

export const PROFILE_STORAGE_KEY = "fanfan-guanguan.profile.v1";
const DEFAULT_DISPLAY_NAME = "帆帆和关关";

type ProfileStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

let memoryProfile: string | null = null;

const memoryStorage: ProfileStorage = {
  getItem: (key) => (key === PROFILE_STORAGE_KEY ? memoryProfile : null),
  removeItem: (key) => {
    if (key === PROFILE_STORAGE_KEY) {
      memoryProfile = null;
    }
  },
  setItem: (key, value) => {
    if (key === PROFILE_STORAGE_KEY) {
      memoryProfile = value;
    }
  }
};

export function getDefaultProfileStorage(): ProfileStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

export function loadProfile(storage: ProfileStorage = getDefaultProfileStorage()): AppProfile {
  const raw = storage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    return { displayName: DEFAULT_DISPLAY_NAME };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AppProfile>;
    return {
      avatarUri: typeof parsed.avatarUri === "string" ? parsed.avatarUri : undefined,
      displayName: typeof parsed.displayName === "string" && parsed.displayName.trim() ? parsed.displayName : DEFAULT_DISPLAY_NAME
    };
  } catch {
    return { displayName: DEFAULT_DISPLAY_NAME };
  }
}

export function saveProfile(profile: AppProfile, storage: ProfileStorage = getDefaultProfileStorage()) {
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  void saveCloudValue(PROFILE_STORAGE_KEY, profile);
}

export async function hydrateProfileFromCloud(storage: ProfileStorage = getDefaultProfileStorage()): Promise<AppProfile> {
  const local = loadProfile(storage);
  const merged = await hydrateFromCloud<AppProfile>(PROFILE_STORAGE_KEY, local, (value) => saveProfile(value, storage));
  return merged;
}

export function getInitial(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return "友";
  }
  return Array.from(trimmed)[0] ?? "友";
}

export function openImagePicker(onPicked: (dataUrl: string) => void) {
  if (typeof document === "undefined") {
    return;
  }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onPicked(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}
