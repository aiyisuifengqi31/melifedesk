import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { DailyPlanPanel } from "@/features/plan/DailyPlanPanel";
import { clearLocalTodosForTests, loadLocalTodos, saveLocalTodos, type TodoTask } from "@/features/plan/todoStorage";

const storageKey = "fanfan-guanguan.todos.v1";

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
      remindAt: "2026-08-01T09:30:00.000Z",
      title: "写项目计划"
    };

    saveLocalTodos([task], storage);

    expect(storage.setItem).toHaveBeenCalledWith(storageKey, JSON.stringify([task]));
    expect(loadLocalTodos(storage)).toEqual([task]);
  });
});

describe("DailyPlanPanel todos", () => {
  beforeEach(() => {
    clearLocalTodosForTests();
  });

  it("adds a task, completes it, restores it, persists after rerender, and deletes it", async () => {
    const storage = makeStorage();
    const { rerender } = render(<DailyPlanPanel storage={storage} />);

    fireEvent.press(screen.getByRole("button", { name: "新增任务" }));
    fireEvent.changeText(screen.getByPlaceholderText("任务名称"), "复盘页面交互");
    fireEvent.changeText(screen.getByPlaceholderText("截止日期"), "2026-08-02");
    fireEvent.changeText(screen.getByPlaceholderText("提醒时间，可选"), "09:30");
    fireEvent.press(screen.getByRole("button", { name: "保存任务" }));

    expect(await screen.findByText("复盘页面交互")).toBeOnTheScreen();
    expect(screen.getByText("待办")).toBeOnTheScreen();
    expect(screen.getByText("已完成 0")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("checkbox", { name: "完成任务：复盘页面交互" }));

    await waitFor(() => expect(screen.getByText("已完成 1")).toBeOnTheScreen());
    expect(screen.getByRole("checkbox", { name: "恢复任务：复盘页面交互" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("checkbox", { name: "恢复任务：复盘页面交互" }));
    await waitFor(() => expect(screen.getByText("已完成 0")).toBeOnTheScreen());

    rerender(<DailyPlanPanel storage={storage} />);
    expect(await screen.findAllByText("复盘页面交互")).toHaveLength(1);

    fireEvent.press(screen.getByRole("button", { name: "删除任务：复盘页面交互" }));
    await waitFor(() => expect(screen.queryByText("复盘页面交互")).toBeNull());
  });
});
