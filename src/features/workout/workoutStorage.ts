import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";

export type WorkoutStatus = "trained" | "rest";
export type WorkoutIntensity = "easy" | "moderate" | "hard";

export type WorkoutLog = {
  createTime: string;
  distanceKm?: number;
  durationMinutes: number;
  feeling?: string;
  id: string;
  intensity: WorkoutIntensity;
  kcal: number;
  kcalSource: "manual" | "estimated";
  notes?: string;
  parts: string[];
  remoteId?: string | null;
  restType?: "full" | "stretch" | "light";
  sessionDate: string;
  status: WorkoutStatus;
  sets?: number;
  title: string;
  weightKg?: number;
};

export type WorkoutStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

export type BodyMetricLog = {
  bodyFatPercent?: number | null;
  createTime: string;
  id: string;
  recordDate: string;
  updateTime: string;
  weightKg: number;
};

export const WORKOUT_STORAGE_KEY = "fanfan-guanguan.workouts.v1";
export const BODY_METRIC_STORAGE_KEY = "fanfan-guanguan.body-metrics.v1";

const memoryValues = new Map<string, string>();

const memoryStorage: WorkoutStorage = {
  getItem: (key) => memoryValues.get(key) ?? null,
  removeItem: (key) => {
    memoryValues.delete(key);
  },
  setItem: (key, value) => {
    memoryValues.set(key, value);
  }
};

export function getDefaultWorkoutStorage(): WorkoutStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

export function loadLocalWorkouts(storage: WorkoutStorage = getDefaultWorkoutStorage()): WorkoutLog[] {
  const raw = storage.getItem(WORKOUT_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as WorkoutLog[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((log) => typeof log.id === "string" && typeof log.title === "string" && typeof log.sessionDate === "string")
      .map((log) => ({
        ...log,
        durationMinutes: Number.isFinite(log.durationMinutes) ? log.durationMinutes : 0,
        intensity: isWorkoutIntensity(log.intensity) ? log.intensity : "moderate",
        kcal: Number.isFinite(log.kcal) ? log.kcal : 0,
        kcalSource: log.kcalSource === "estimated" ? "estimated" : "manual",
        parts: Array.isArray(log.parts) ? log.parts.filter((part) => typeof part === "string") : [],
        status: log.status === "rest" ? "rest" : "trained"
      }));
  } catch {
    return [];
  }
}

export function saveLocalWorkouts(logs: WorkoutLog[], storage: WorkoutStorage = getDefaultWorkoutStorage()) {
  const sorted = sortWorkoutLogs(logs);
  storage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(sorted));
  void saveCloudValue(WORKOUT_STORAGE_KEY, sorted);
}

export async function hydrateWorkoutsFromCloud(storage: WorkoutStorage = getDefaultWorkoutStorage()): Promise<WorkoutLog[]> {
  const local = loadLocalWorkouts(storage);
  return hydrateFromCloud<WorkoutLog[]>(WORKOUT_STORAGE_KEY, local, (value) => saveLocalWorkouts(value, storage));
}

export function clearLocalWorkoutsForTests(storage: WorkoutStorage = memoryStorage) {
  storage.removeItem(WORKOUT_STORAGE_KEY);
  memoryValues.delete(WORKOUT_STORAGE_KEY);
}

export function createWorkoutId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `workout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sortWorkoutLogs(logs: WorkoutLog[]) {
  return [...logs].sort((left, right) => {
    const dateCompare = right.sessionDate.localeCompare(left.sessionDate);
    return dateCompare === 0 ? right.createTime.localeCompare(left.createTime) : dateCompare;
  });
}

export function loadLocalBodyMetrics(storage: WorkoutStorage = getDefaultWorkoutStorage()): BodyMetricLog[] {
  const raw = storage.getItem(BODY_METRIC_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as BodyMetricLog[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortBodyMetrics(
      parsed
        .filter((log) => typeof log.id === "string" && typeof log.recordDate === "string" && Number(log.weightKg) > 0)
        .map((log) => ({
          bodyFatPercent: Number(log.bodyFatPercent) > 0 && Number(log.bodyFatPercent) < 100 ? Number(log.bodyFatPercent) : null,
          createTime: typeof log.createTime === "string" ? log.createTime : new Date().toISOString(),
          id: log.id,
          recordDate: log.recordDate,
          updateTime: typeof log.updateTime === "string" ? log.updateTime : typeof log.createTime === "string" ? log.createTime : new Date().toISOString(),
          weightKg: Number(log.weightKg)
        }))
    );
  } catch {
    return [];
  }
}

export function saveLocalBodyMetrics(metrics: BodyMetricLog[], storage: WorkoutStorage = getDefaultWorkoutStorage()) {
  const byDate = new Map<string, BodyMetricLog>();
  for (const metric of metrics) {
    byDate.set(metric.recordDate, metric);
  }
  const sorted = sortBodyMetrics([...byDate.values()]);
  storage.setItem(BODY_METRIC_STORAGE_KEY, JSON.stringify(sorted));
  void saveCloudValue(BODY_METRIC_STORAGE_KEY, sorted);
}

export async function hydrateBodyMetricsFromCloud(storage: WorkoutStorage = getDefaultWorkoutStorage()): Promise<BodyMetricLog[]> {
  const local = loadLocalBodyMetrics(storage);
  return hydrateFromCloud<BodyMetricLog[]>(BODY_METRIC_STORAGE_KEY, local, (value) => saveLocalBodyMetrics(value, storage));
}

export function createBodyMetricId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `body-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sortBodyMetrics(metrics: BodyMetricLog[]) {
  return [...metrics].sort((left, right) => {
    const dateCompare = right.recordDate.localeCompare(left.recordDate);
    return dateCompare === 0 ? right.updateTime.localeCompare(left.updateTime) : dateCompare;
  });
}

function isWorkoutIntensity(value: unknown): value is WorkoutIntensity {
  return value === "easy" || value === "moderate" || value === "hard";
}
