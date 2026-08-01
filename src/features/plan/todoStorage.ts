import { hydrateFromCloud, saveCloudValue } from "@/features/sync/cloudSync";

export type TodoPriority = "low" | "normal" | "high" | "urgent";

export type TodoTask = {
  completed: boolean;
  createTime: string;
  deadline: string | null;
  id: string;
  priority: TodoPriority;
  remindAt?: string | null;
  remoteId?: string | null;
  title: string;
};

export type TodoStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

export const TODO_STORAGE_KEY = "fanfan-guanguan.todos.v1";

let memoryTodos: string | null = null;

const memoryStorage: TodoStorage = {
  getItem: (key) => (key === TODO_STORAGE_KEY ? memoryTodos : null),
  removeItem: (key) => {
    if (key === TODO_STORAGE_KEY) {
      memoryTodos = null;
    }
  },
  setItem: (key, value) => {
    if (key === TODO_STORAGE_KEY) {
      memoryTodos = value;
    }
  }
};

export function getDefaultTodoStorage(): TodoStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

export function loadLocalTodos(storage: TodoStorage = getDefaultTodoStorage()): TodoTask[] {
  const raw = storage.getItem(TODO_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as TodoTask[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((task) => typeof task.id === "string" && typeof task.title === "string" && typeof task.completed === "boolean")
      .map((task) => ({
        ...task,
        priority: isTodoPriority(task.priority) ? task.priority : "normal"
      }));
  } catch {
    return [];
  }
}

export function saveLocalTodos(tasks: TodoTask[], storage: TodoStorage = getDefaultTodoStorage()) {
  storage.setItem(TODO_STORAGE_KEY, JSON.stringify(tasks));
  void saveCloudValue(TODO_STORAGE_KEY, tasks);
}

export async function hydrateTodosFromCloud(storage: TodoStorage = getDefaultTodoStorage()): Promise<TodoTask[]> {
  const local = loadLocalTodos(storage);
  return hydrateFromCloud<TodoTask[]>(TODO_STORAGE_KEY, local, (value) => saveLocalTodos(value, storage));
}

export function clearLocalTodosForTests(storage: TodoStorage = memoryStorage) {
  storage.removeItem(TODO_STORAGE_KEY);
  memoryTodos = null;
}

export function createTodoId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sortTodos(tasks: TodoTask[]) {
  return [...tasks].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }
    const leftTime = left.deadline ?? left.createTime;
    const rightTime = right.deadline ?? right.createTime;
    return leftTime.localeCompare(rightTime);
  });
}

function isTodoPriority(value: unknown): value is TodoPriority {
  return value === "low" || value === "normal" || value === "high" || value === "urgent";
}
