import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { UiTokens } from "@/shared/ui/primitives";

import { AppShell } from "@/components/AppShell";
import { HomePanel } from "@/features/home/HomePanel";
import { saveFinanceTransactions } from "@/features/finance/financeStorage";
import { savePackages, type PackageItem } from "@/features/plan/packageStorage";
import { DailyPlanPanel } from "@/features/plan/DailyPlanPanel";
import { saveReminders, type ReminderItem } from "@/features/plan/reminderStorage";
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

describe("Daily plan calendar workspace", () => {
  it("starts with life calendar, updates the selected day schedule, and persists schedule actions", async () => {
    const storage = makeStorage();
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todo: TodoTask = {
      completed: false,
      createTime: `${today}T07:00:00.000Z`,
      deadline: `${today}T10:00:00.000Z`,
      id: "todo-plan-1",
      priority: "normal",
      remindAt: `${today}T09:00:00.000Z`,
      title: "today schedule task"
    };
    const packageItem: PackageItem = {
      arrivalDate: tomorrow,
      company: "SF",
      createTime: `${today}T08:00:00.000Z`,
      id: "pkg-plan-1",
      image: null,
      orderNumber: "",
      pickedUp: false,
      pickupCode: "A12-3",
      pickupLocation: "Gate"
    };
    const reminder: ReminderItem = {
      createTime: `${today}T08:10:00.000Z`,
      date: today,
      id: "reminder-plan-1",
      time: "20:00",
      title: "call partner"
    };
    saveLocalTodos([todo], storage);
    savePackages([packageItem], storage);
    saveReminders([reminder], storage);

    render(<DailyPlanPanel storage={storage} themeTokens={testTokens} />);

    expect(screen.queryByText("当前城市天气")).toBeNull();
    expect(screen.getByTestId("life-calendar")).toBeOnTheScreen();
    expect(screen.getByTestId(`calendar-marker-todo-${today}`)).toBeOnTheScreen();
    expect(screen.getByTestId(`calendar-marker-reminder-${today}`)).toBeOnTheScreen();
    expect(screen.getByText("today schedule task")).toBeOnTheScreen();
    expect(screen.getByText("call partner")).toBeOnTheScreen();
    expect(screen.getByTestId("upcoming-three-days")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId(`schedule-todo-toggle-${todo.id}`));
    await waitFor(() => expect(loadLocalTodos(storage)[0]?.completed).toBe(true));

    fireEvent.press(screen.getByTestId(`calendar-day-${tomorrow}`));
    expect(screen.getAllByText("A12-3").length).toBeGreaterThan(0);
  });
});

describe("Todo route interactions", () => {
  beforeEach(() => {
    installWindowStorage();
  });

  it("keeps daily todos out of navigation, toggles in the home card, and only opens from all", async () => {
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

    expect(screen.getAllByText("今日待办").length).toBeGreaterThan(0);
    expect(screen.getByText("复盘页面交互")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("checkbox", { name: "完成首页待办：复盘页面交互" }));
    expect(loadLocalTodos(window.localStorage)[0]?.completed).toBe(true);
    expect(screen.queryByText("每日待办")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "查看全部每日待办" }));

    expect(screen.getByText("每日待办")).toBeOnTheScreen();
    expect(await screen.findByText("复盘页面交互")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "返回首页" }));
    expect(screen.getByText("今日概览")).toBeOnTheScreen();
  });

  it("does not expose a standalone daily todo navigation tab", () => {
    render(<AppShell initialRoute="/home" />);

    expect(screen.queryByRole("button", { name: "每日\n待办" })).toBeNull();
  });

  it("keeps the life control center compact without the removed pet widget", () => {
    render(<HomePanel storage={window.localStorage} themeTokens={testTokens} />);

    expect(screen.getByTestId("home-summary-card")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "切换为小猫" })).toBeNull();
    expect(screen.queryByRole("button", { name: "切换为小狗" })).toBeNull();
    expect(screen.queryByRole("button", { name: "摸摸小宠物" })).toBeNull();
  });

  it("renders a compact real-data today overview and trims home widgets", () => {
    const today = new Date().toISOString().slice(0, 10);
    const todoStorage = window.localStorage;
    const packageItem: PackageItem = {
      arrivalDate: today,
      company: "顺丰",
      createTime: `${today}T08:00:00.000Z`,
      id: "pkg-1",
      image: null,
      orderNumber: "",
      pickedUp: false,
      pickupCode: "3-2-1",
      pickupLocation: "驿站"
    };
    saveLocalTodos(
      [
        { completed: true, createTime: `${today}T07:00:00.000Z`, deadline: `${today}T10:00:00.000Z`, id: "todo-1", priority: "normal", remindAt: "", title: "读书" },
        { completed: false, createTime: `${today}T07:20:00.000Z`, deadline: `${today}T11:00:00.000Z`, id: "todo-2", priority: "normal", remindAt: "", title: "写日记" }
      ],
      todoStorage
    );
    savePackages([packageItem], window.localStorage);
    saveFinanceTransactions(
      [
        { amount: "52.00", categoryName: "餐饮", createTime: `${today}T12:00:00.000Z`, id: "finance-1", localDate: today, note: "午饭", transactionType: "expense" }
      ],
      window.localStorage
    );

    render(<HomePanel storage={todoStorage} themeTokens={testTokens} />);

    expect(screen.getByText("今日概览")).toBeOnTheScreen();
    expect(screen.queryByText("生活控制中心")).toBeNull();
    expect(screen.getAllByText("1/2").length).toBeGreaterThan(0);
    expect(screen.getByText("待取快递")).toBeOnTheScreen();
    expect(screen.getAllByText("¥52.00").length).toBeGreaterThan(0);
    expect(screen.queryByText("金币")).toBeNull();
    expect(screen.getByTestId("home-todo-widget")).not.toHaveStyle({ height: 210 });
    expect(screen.getByTestId("home-notes-quick-entry")).toBeOnTheScreen();
    expect(screen.getByTestId("meal-spinner-compact-entry")).toBeOnTheScreen();
    expect(screen.queryByTestId("meal-spinner-wheel")).toBeNull();
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
