import { render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";

describe("Task 3 and Task 4 pages", () => {
  it("renders the daily plan workspace controls", () => {
    render(<AppShell initialRoute="/plan" />);

    expect(screen.getByText("上午好，把今天安排得轻一点")).toBeOnTheScreen();
    expect(screen.getByText("当前城市天气")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "获取当前城市天气" })).toBeOnTheScreen();
    expect(screen.getByText("今日待办")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("添加待办任务...")).toBeOnTheScreen();
    expect(screen.getByText("待办")).toBeOnTheScreen();
    expect(screen.getByText("已完成 0")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "新增任务" })).toBeOnTheScreen();
  });

  it("renders the workout workspace controls", () => {
    render(<AppShell initialRoute="/workout" />);

    expect(screen.getByRole("button", { name: "今天训练了" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "今天休息" })).toBeOnTheScreen();
    expect(screen.getByText("训练部位")).toBeOnTheScreen();
    expect(screen.getByText("训练强度")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("训练项目")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("消耗热量")).toBeOnTheScreen();
    expect(screen.getByText("本周训练")).toBeOnTheScreen();
    expect(screen.getByText("本周消耗")).toBeOnTheScreen();
    expect(screen.getByText("近7天训练时长")).toBeOnTheScreen();
    expect(screen.getByText("训练日志")).toBeOnTheScreen();
  });
});
