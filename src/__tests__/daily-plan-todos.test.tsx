import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { UiTokens } from "@/shared/ui/primitives";

import { AppShell } from "@/components/AppShell";
import { HomePanel } from "@/features/home/HomePanel";
import { DailyPlanPanel } from "@/features/plan/DailyPlanPanel";
import { TodoPanel } from "@/features/plan/TodoPanel";
import { loadLocalTodos, saveLocalTodos, type TodoTask } from "@/features/plan/todoStorage";

const storageKey = "fanfan-guanguan.todos.v1";

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

function makeStorage() {
  const data = new Map<string, string>();

  return {
    clear: () => data.clear(),
    getItem: jest.fn((key: string) => data.get(key) ?? null),
    removeItem: jest.fn((key: string) => data.delete(key)),
    setItem: jest.fn((key: string, value: string) => {
      data.set(key, value);
    })
  };
}

function installWindowStorage() {
  const storage = makeStorage();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage
  });
  return storage;
}

describe("Daily plan todo storage", () => {
  it("saves and loads tasks from localStorage-compatible storage", () => {
    const storage = makeStorage();
    const task: TodoTask = {
      completed: false,
      createTime: "2026-07-31T08:00:00.000Z",
      deadline: "2026-08-01T10:30:00.000Z",
      id: "task-1",
      priority: "normal",
      remindAt: "2026-08-01T09:30:00.000Z",
      title: "写项目计划"
    };

    saveLocalTodos([task], storage);

    expect(storage.setItem).toHaveBeenCalledWith(storageKey, JSON.stringify([task]));
    expect(loadLocalTodos(storage)).toEqual([task]);
  });
});

describe("DailyPlanPanel todo split", () => {
  it("does not render the duplicated todo workspace inside daily plan", () => {
    const storage = makeStorage();

    render(<DailyPlanPanel storage={storage} themeTokens={testTokens} />);

    expect(screen.queryByText("今日待办")).toBeNull();
    expect(screen.queryByText("已完成 0")).toBeNull();
  });
});

describe("Todo route interactions", () => {
  beforeEach(() => {
    installWindowStorage();
  });

  it("keeps daily todos out of the primary navigation and opens them from the home card", async () => {
    const seeded: TodoTask = {
      completed: false,
      createTime: "2026-07-31T08:00:00.000Z",
      deadline: "2026-08-01T10:30:00.000Z",
      id: "task-1",
      priority: "urgent",
      remindAt: "2026-08-01T09:30:00.000Z",
      title: "复盘页面交互"
    };
    saveLocalTodos([seeded], window.localStorage);

    render(<HomePanel storage={window.localStorage} themeTokens={testTokens} />);

    expect(screen.getByText("今日待办")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "打开每日待办" }));

    expect(screen.getByText("每日待办")).toBeOnTheScreen();
    expect(await screen.findByText("复盘页面交互")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "返回首页" }));
    expect(screen.getByText("生活控制中心")).toBeOnTheScreen();
  });

  it("does not expose a standalone daily todo navigation tab", () => {
    render(<AppShell initialRoute="/home" />);

    expect(screen.queryByRole("button", { name: "每日\n待办" })).toBeNull();
  });

  it("adds, edits, completes, restores, persists, and deletes tasks on the home-opened todo page", async () => {
    const seeded: TodoTask = {
      completed: false,
      createTime: "2026-07-31T08:00:00.000Z",
      deadline: "2026-08-01T10:30:00.000Z",
      id: "task-1",
      priority: "urgent",
      remindAt: "2026-08-01T09:30:00.000Z",
      title: "复盘页面交互"
    };
    saveLocalTodos([seeded], window.localStorage);

    const { rerender } = render(<TodoPanel storage={window.localStorage} themeTokens={testTokens} />);

    expect(screen.getByText("每日待办")).toBeOnTheScreen();
    expect(await screen.findByText("复盘页面交互")).toBeOnTheScreen();
    expect(screen.getByText(/紧急/)).toBeOnTheScreen();
    expect(screen.getByText("未完成待办")).toBeOnTheScreen();
    expect(screen.getByText("已完成待办 0")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("checkbox", { name: "完成任务：复盘页面交互" }));
    await waitFor(() => expect(screen.getByText("已完成待办 1")).toBeOnTheScreen());
    expect(screen.getByRole("checkbox", { name: "恢复任务：复盘页面交互" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("checkbox", { name: "恢复任务：复盘页面交互" }));
    await waitFor(() => expect(screen.getByText("已完成待办 0")).toBeOnTheScreen());

    fireEvent.press(screen.getByRole("button", { name: "编辑任务：复盘页面交互" }));
    fireEvent.changeText(screen.getByDisplayValue("复盘页面交互"), "复盘首页待办");
    fireEvent.press(screen.getByRole("button", { name: "保存编辑" }));
    await waitFor(() => expect(screen.getByText("复盘首页待办")).toBeOnTheScreen());

    rerender(<TodoPanel storage={window.localStorage} themeTokens={testTokens} />);
    expect(await screen.findAllByText("复盘首页待办")).toHaveLength(1);
    expect(loadLocalTodos(window.localStorage)[0]?.title).toBe("复盘首页待办");

    fireEvent.press(screen.getByRole("button", { name: "删除任务：复盘首页待办" }));
    await waitFor(() => expect(screen.queryByText("复盘首页待办")).toBeNull());
    expect(loadLocalTodos(window.localStorage)).toEqual([]);
  });
});
