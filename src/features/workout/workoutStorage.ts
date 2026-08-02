export type WorkoutStatus = "trained" | "rest";
export type WorkoutIntensity = "easy" | "moderate" | "hard";

export type WorkoutLog = {
  createTime: string;
  durationMinutes: number;
  feeling?: string;
  id: string;
  intensity: WorkoutIntensity;
  kcal: number;
  kcalSource: "manual" | "estimated";
  notes?: string;
  parts: string[];
  remoteId?: string | null;
  sessionDate: string;
  status: WorkoutStatus;
  title: string;
};

export type WorkoutStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

export const WORKOUT_STORAGE_KEY = "fanfan-guanguan.workouts.v1";

let memoryWorkouts: string | null = null;

const memoryStorage: WorkoutStorage = {
  getItem: (key) => (key === WORKOUT_STORAGE_KEY ? memoryWorkouts : null),
  removeItem: (key) => {
    if (key === WORKOUT_STORAGE_KEY) {
      memoryWorkouts = null;
    }
  },
  setItem: (key, value) => {
    if (key === WORKOUT_STORAGE_KEY) {
      memoryWorkouts = value;
    }
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
  storage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(sortWorkoutLogs(logs)));
}

export function clearLocalWorkoutsForTests(storage: WorkoutStorage = memoryStorage) {
  storage.removeItem(WORKOUT_STORAGE_KEY);
  memoryWorkouts = null;
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

function isWorkoutIntensity(value: unknown): value is WorkoutIntensity {
  return value === "easy" || value === "moderate" || value === "hard";
}
