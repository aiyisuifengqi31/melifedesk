import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { UiTokens } from "@/shared/ui/primitives";

import { DailyPlanPanel } from "@/features/plan/DailyPlanPanel";
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

describe("DailyPlanPanel todos", () => {
  it("renders, completes, restores, persists, and deletes a task", async () => {
    const storage = makeStorage();
    const seeded: TodoTask = {
      completed: false,
      createTime: "2026-07-31T08:00:00.000Z",
      deadline: "2026-08-01T10:30:00.000Z",
      id: "task-1",
      priority: "urgent",
      remindAt: "2026-08-01T09:30:00.000Z",
      title: "复盘页面交互"
    };
    saveLocalTodos([seeded], storage);

    const { rerender } = render(<DailyPlanPanel storage={storage} themeTokens={testTokens} />);

    expect(await screen.findByText("复盘页面交互")).toBeOnTheScreen();
    expect(screen.getByText("紧急")).toBeOnTheScreen();
    expect(screen.getByText("待办")).toBeOnTheScreen();
    expect(screen.getByText("已完成 0")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("checkbox", { name: "完成任务：复盘页面交互" }));
    await waitFor(() => expect(screen.getByText("已完成 1")).toBeOnTheScreen());
    expect(screen.getByRole("checkbox", { name: "恢复任务：复盘页面交互" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("checkbox", { name: "恢复任务：复盘页面交互" }));
    await waitFor(() => expect(screen.getByText("已完成 0")).toBeOnTheScreen());

    rerender(<DailyPlanPanel storage={storage} themeTokens={testTokens} />);
    expect(await screen.findAllByText("复盘页面交互")).toHaveLength(1);

    fireEvent.press(screen.getByRole("button", { name: "删除任务：复盘页面交互" }));
    await waitFor(() => expect(screen.queryByText("复盘页面交互")).toBeNull());
  });
});
