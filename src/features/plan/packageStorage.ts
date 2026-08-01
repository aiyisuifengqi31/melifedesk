import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";

export type PackageItem = {
  arrivalDate: string;
  company: string;
  createTime: string;
  id: string;
  image: string | null;
  orderNumber: string;
  pickedUp: boolean;
  pickupCode: string;
  pickupLocation: string;
};

export type PackageStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

export const PACKAGE_STORAGE_KEY = "fanfan-guanguan.packages.v1";

let memoryPackages: string | null = null;

const memoryStorage: PackageStorage = {
  getItem: (key) => (key === PACKAGE_STORAGE_KEY ? memoryPackages : null),
  removeItem: (key) => {
    if (key === PACKAGE_STORAGE_KEY) {
      memoryPackages = null;
    }
  },
  setItem: (key, value) => {
    if (key === PACKAGE_STORAGE_KEY) {
      memoryPackages = value;
    }
  }
};

export function getDefaultPackageStorage(): PackageStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

export function loadPackages(storage: PackageStorage = getDefaultPackageStorage()): PackageItem[] {
  const raw = storage.getItem(PACKAGE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as PackageItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => typeof item.id === "string" && typeof item.company === "string");
  } catch {
    return [];
  }
}

export function savePackages(items: PackageItem[], storage: PackageStorage = getDefaultPackageStorage()) {
  storage.setItem(PACKAGE_STORAGE_KEY, JSON.stringify(items));
  void saveCloudValue(PACKAGE_STORAGE_KEY, items);
}

export async function hydratePackagesFromCloud(storage: PackageStorage = getDefaultPackageStorage()): Promise<PackageItem[]> {
  const local = loadPackages(storage);
  return hydrateFromCloud<PackageItem[]>(PACKAGE_STORAGE_KEY, local, (value) => savePackages(value, storage));
}

export function clearPackagesForTests(storage: PackageStorage = memoryStorage) {
  storage.removeItem(PACKAGE_STORAGE_KEY);
  memoryPackages = null;
}

export function createPackageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pkg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
