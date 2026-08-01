import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";

export const STUDY_STORAGE_KEY = "fanfan-guanguan.exam.study.v1";

export type StudyRecord = {
  date: string;
  minutes: number;
  source: "manual" | "timer";
};

export type StudyState = {
  records: StudyRecord[];
  runningSince: string | null;
};

export function toLocalIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDate(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

function emptyState(): StudyState {
  return { records: [], runningSince: null };
}

export function loadStudyState(): StudyState {
  const raw = getStorage()?.getItem(STUDY_STORAGE_KEY);
  if (!raw) {
    return emptyState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StudyState>;
    const records = Array.isArray(parsed.records)
      ? parsed.records
          .filter((item): item is StudyRecord => Boolean(item) && typeof item.date === "string" && typeof item.minutes === "number")
          .map<StudyRecord>((item) => ({
            date: item.date,
            minutes: Math.max(0, Math.round(item.minutes)),
            source: item.source === "manual" ? "manual" : "timer"
          }))
      : [];
    return {
      records,
      runningSince: typeof parsed.runningSince === "string" ? parsed.runningSince : null
    };
  } catch {
    return emptyState();
  }
}

export function saveStudyState(state: StudyState) {
  getStorage()?.setItem(STUDY_STORAGE_KEY, JSON.stringify(state));
  void saveCloudValue(STUDY_STORAGE_KEY, state);
}

export async function hydrateStudyFromCloud(): Promise<StudyState> {
  const local = loadStudyState();
  return hydrateFromCloud<StudyState>(STUDY_STORAGE_KEY, local, (value) => saveStudyState(value));
}

export function addStudyMinutes(state: StudyState, minutes: number, source: StudyRecord["source"] = "timer", date = toLocalIso(new Date())): StudyState {
  const safeMinutes = Math.max(0, Math.round(minutes));
  if (safeMinutes <= 0) {
    return state;
  }
  return { ...state, records: [{ date, minutes: safeMinutes, source }, ...state.records].slice(0, 800) };
}

export function minutesOn(state: StudyState, date: string): number {
  return state.records.filter((item) => item.date === date).reduce((sum, item) => sum + item.minutes, 0);
}

export function minutesInRange(state: StudyState, fromDate: string, toDate: string): number {
  return state.records
    .filter((item) => item.date >= fromDate && item.date <= toDate)
    .reduce((sum, item) => sum + item.minutes, 0);
}

export function totalMinutes(state: StudyState): number {
  return state.records.reduce((sum, item) => sum + item.minutes, 0);
}

export function studyStreakDays(state: StudyState): number {
  const dates = new Set(state.records.filter((item) => item.minutes > 0).map((item) => item.date));
  let streak = 0;
  let cursor = new Date();

  while (dates.has(toLocalIso(cursor))) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }

  return streak;
}

export function buildStudyBars(state: StudyState, days = 7) {
  const today = new Date();
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = toLocalIso(shiftDate(today, index - (days - 1)));
    return { date, label: date.slice(5).replace("-", "/"), minutes: minutesOn(state, date) };
  });

  const max = Math.max(10, ...buckets.map((item) => item.minutes));
  return buckets.map((item) => ({ ...item, height: Math.max(item.minutes ? 8 : 0, Math.round((item.minutes / max) * 100)) }));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分`;
}

export function elapsedMinutes(runningSince: string | null): number {
  if (!runningSince) {
    return 0;
  }
  const started = new Date(runningSince).getTime();
  if (!Number.isFinite(started)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - started) / 60000));
}

export function elapsedSeconds(runningSince: string | null): number {
  if (!runningSince) {
    return 0;
  }
  const started = new Date(runningSince).getTime();
  if (!Number.isFinite(started)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - started) / 1000));
}

export function formatStopwatch(seconds: number): string {
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
