import { render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";
import { isPackageDraftAddable, PackagePanel } from "@/features/plan/PackagePanel";

const testTokens = {
  accent: "#7cb87c",
  accentSoft: "#e2f2e2",
  background: "#f0f7f0",
  border: "#d8e8d8",
  surface: "#ffffff",
  surfaceMuted: "#f6faf6",
  text: "#1f2937",
  textMuted: "#6b7c6b"
};

describe("Task 3 and Task 4 pages", () => {
  it("renders the daily plan workspace controls", () => {
    render(<AppShell initialRoute="/plan" />);

    expect(screen.getByText("当前城市天气")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "获取当前城市天气" })).toBeOnTheScreen();
    expect(screen.queryByText("今日待办")).toBeNull();
    expect(screen.queryByText("已完成 0")).toBeNull();
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

  it("removes order number from package entry and keeps the compact two-row form", () => {
    render(<PackagePanel themeTokens={testTokens} />);

    expect(screen.getByPlaceholderText("快递公司")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "选择到达日期" })).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("取件地点")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("取件码")).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText("订单编号（可选）")).toBeNull();
  });

  it("allows package drafts that only contain one uploaded image", () => {
    expect(isPackageDraftAddable({
      arrivalDate: "2026-08-02",
      company: "",
      image: "data:image/png;base64,abc",
      orderNumber: "",
      pickedUp: false,
      pickupCode: "",
      pickupLocation: ""
    })).toBe(true);
  });
});
