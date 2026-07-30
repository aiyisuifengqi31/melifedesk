import { render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";

describe("Task 3 and Task 4 pages", () => {
  it("renders the daily plan workspace controls", () => {
    render(<AppShell initialRoute="/plan" />);

    expect(screen.getByText("今日")).toBeOnTheScreen();
    expect(screen.getByText("天气")).toBeOnTheScreen();
    expect(screen.getByText("月历")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("新增待办")).toBeOnTheScreen();
    expect(screen.getByText("in_progress")).toBeOnTheScreen();
    expect(screen.getByText("重复规则")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "快速记录" })).toBeOnTheScreen();
  });

  it("renders the workout workspace controls", () => {
    render(<AppShell initialRoute="/workout" />);

    expect(screen.getByText("今日是否训练")).toBeOnTheScreen();
    expect(screen.getByText("训练部位")).toBeOnTheScreen();
    expect(screen.getByText("训练强度")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("训练项目")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("消耗热量")).toBeOnTheScreen();
    expect(screen.getByText("本周训练次数")).toBeOnTheScreen();
    expect(screen.getByText("最近 30 天")).toBeOnTheScreen();
    expect(screen.getByText("连续训练天数")).toBeOnTheScreen();
  });
});
