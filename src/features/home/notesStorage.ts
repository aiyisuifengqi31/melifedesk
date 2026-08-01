import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";

export type NoteCategory = "全部" | "工作" | "生活" | "美食" | "旅游" | "未分类";

export type NoteItem = {
  category: NoteCategory;
  content: string;
  createTime: string;
  id: string;
  title: string;
};

export type NotesStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

export const NOTES_STORAGE_KEY = "fanfan-guanguan.home.notes.v1";

let memoryNotes: string | null = null;

const memoryStorage: NotesStorage = {
  getItem: (key) => (key === NOTES_STORAGE_KEY ? memoryNotes : null),
  removeItem: (key) => {
    if (key === NOTES_STORAGE_KEY) {
      memoryNotes = null;
    }
  },
  setItem: (key, value) => {
    if (key === NOTES_STORAGE_KEY) {
      memoryNotes = value;
    }
  }
};

export function getDefaultNotesStorage(): NotesStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

export function loadNotes(storage: NotesStorage = getDefaultNotesStorage()): NoteItem[] {
  const raw = storage.getItem(NOTES_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as NoteItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((note) => typeof note.id === "string" && typeof note.title === "string")
      .map((note) => ({
        ...note,
        category: isNoteCategory(note.category) ? note.category : "未分类"
      }));
  } catch {
    return [];
  }
}

export function saveNotes(notes: NoteItem[], storage: NotesStorage = getDefaultNotesStorage()) {
  storage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  void saveCloudValue(NOTES_STORAGE_KEY, notes);
}

export async function hydrateNotesFromCloud(storage: NotesStorage = getDefaultNotesStorage()): Promise<NoteItem[]> {
  const local = loadNotes(storage);
  return hydrateFromCloud<NoteItem[]>(NOTES_STORAGE_KEY, local, (value) => saveNotes(value, storage));
}

export function createNoteId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isNoteCategory(value: unknown): value is NoteCategory {
  return (
    value === "全部" ||
    value === "工作" ||
    value === "生活" ||
    value === "美食" ||
    value === "旅游" ||
    value === "未分类"
  );
}

export const NOTE_CATEGORIES: NoteCategory[] = ["全部", "工作", "生活", "美食", "旅游", "未分类"];
