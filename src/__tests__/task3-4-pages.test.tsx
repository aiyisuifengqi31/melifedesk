import { fireEvent, render, screen } from "@testing-library/react-native";
import { TextInput } from "react-native";

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
  it("renders the daily plan workspace controls without the duplicate home todo module", () => {
    render(<AppShell initialRoute="/plan" />);

    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByText("今日待办")).toBeNull();
  });

  it("renders the workout workspace controls with a single duration input", () => {
    render(<AppShell initialRoute="/workout" />);

    expect(screen.UNSAFE_getAllByType(TextInput).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("训练时间")).toBeOnTheScreen();
    expect(screen.getByText("训练部位")).toBeOnTheScreen();
    expect(screen.getByText("本周训练统计")).toBeOnTheScreen();
  });

  it("keeps manual package entry compact and collapsed behind the screenshot-first flow", () => {
    render(<PackagePanel themeTokens={testTokens} />);

    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    fireEvent.press(screen.getAllByRole("button")[1]);

    expect(screen.UNSAFE_getAllByType(TextInput)).toHaveLength(3);
    expect(screen.queryByPlaceholderText("order number")).toBeNull();
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
