import { fireEvent, render, screen, within } from "@testing-library/react-native";

import type { UiTokens } from "@/shared/ui/primitives";

import { HomePanel } from "@/features/home/HomePanel";
import { saveLocalTodos, type TodoTask } from "@/features/plan/todoStorage";

function seedTodos(count: number) {
  const today = new Date().toISOString().slice(0, 10);
  const todos: TodoTask[] = Array.from({ length: count }, (_, index) => ({
    completed: false,
    createTime: `${today}T07:${String(index).padStart(2, "0")}:00.000Z`,
    deadline: `${today}T1${index}:00:00.000Z`,
    id: `seed-todo-${index}`,
    priority: "normal",
    remindAt: "",
    title: `待办 ${index}`
  }));
  saveLocalTodos(todos, window.localStorage);
}

const testTokens: UiTokens = {
  accent: "#7cb87c",
  accentSoft: "#e2f2e2",
  background: "#f0f7f0",
  border: "#d8e8d8",
  surface: "#ffffff",
  surfaceMuted: "#f6faf6",
  text: "#1f2937",
  textMuted: "#6b7c6b"
};

const ORDER_KEY = "fanfan-guanguan.home.order";
const COLLAPSED_KEY = "fanfan-guanguan.home.collapsed";

function makeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: jest.fn((key: string) => data.get(key) ?? null),
    removeItem: jest.fn((key: string) => data.delete(key)),
    setItem: jest.fn((key: string, value: string) => {
      data.set(key, value);
    })
  };
}

describe("HomePanel layout (Phase 2)", () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    storage = makeStorage();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage
    });
  });

  it("collapses a card and persists the collapsed state", () => {
    seedTodos(4);

    render(<HomePanel themeTokens={testTokens} />);

    const todosCard = screen.getByTestId("home-todo-widget");
    expect(within(todosCard).getByTestId("home-todo-show-more")).toBeOnTheScreen();

    fireEvent.press(within(todosCard).getByRole("button", { name: "收起卡片" }));

    expect(within(todosCard).queryByTestId("home-todo-show-more")).toBeNull();
    expect(storage.data.get(COLLAPSED_KEY)).toContain("todos");
  });

  it("enters edit mode, shows lock for core cards and hides a non-core card", () => {
    render(<HomePanel themeTokens={testTokens} />);

    fireEvent.press(screen.getByRole("button", { name: "编辑首页" }));

    const todosCard = screen.getByTestId("home-todo-widget");
    expect(within(todosCard).getByText("锁定")).toBeOnTheScreen();
    expect(within(todosCard).queryByRole("button", { name: "隐藏卡片" })).toBeNull();

    const notesCard = screen.getByTestId("home-notes-card");
    fireEvent.press(within(notesCard).getByRole("button", { name: "隐藏卡片" }));

    expect(within(notesCard).getByRole("button", { name: "显示卡片" })).toBeOnTheScreen();
    const savedOrder = JSON.parse(storage.data.get(ORDER_KEY) ?? "[]");
    expect(savedOrder).not.toContain("notes");
  });

  it("reorders cards via move up and persists the new order", () => {
    render(<HomePanel themeTokens={testTokens} />);

    fireEvent.press(screen.getByRole("button", { name: "编辑首页" }));

    const notesCard = screen.getByTestId("home-notes-card");
    fireEvent.press(within(notesCard).getByRole("button", { name: "上移卡片" }));

    const savedOrder = JSON.parse(storage.data.get(ORDER_KEY) ?? "[]");
    expect(savedOrder.indexOf("notes")).toBeLessThan(savedOrder.indexOf("meal"));
  });

  it("restores a hidden non-core card via the show toggle", () => {
    storage.data.set(ORDER_KEY, JSON.stringify(["summary", "quickAccounting", "todos", "meal"]));

    render(<HomePanel themeTokens={testTokens} />);
    fireEvent.press(screen.getByRole("button", { name: "编辑首页" }));

    const notesCard = screen.getByTestId("home-notes-card");
    fireEvent.press(within(notesCard).getByRole("button", { name: "显示卡片" }));

    const savedOrder = JSON.parse(storage.data.get(ORDER_KEY) ?? "[]");
    expect(savedOrder).toContain("notes");
  });

  it("keeps the compact quick accounting action as a single plus", () => {
    render(<HomePanel themeTokens={testTokens} />);

    const quickAccountingCard = screen.getByTestId("home-quick-accounting-card");
    expect(within(quickAccountingCard).getByText("＋")).toBeOnTheScreen();
    expect(within(quickAccountingCard).queryByText("＋ 记一笔")).toBeNull();
  });
});
