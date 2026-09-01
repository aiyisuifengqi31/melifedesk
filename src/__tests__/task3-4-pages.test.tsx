import { fireEvent, render, screen } from "@testing-library/react-native";
import { TextInput } from "react-native";

import { AppShell } from "@/components/AppShell";
import { isPackageDraftAddable, PackagePanel } from "@/features/plan/PackagePanel";

function mockBrowserRoute(pathname: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { hash: "", pathname }
  });
}

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
  beforeEach(() => {
    mockBrowserRoute("/");
  });

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

  it("shows the workout add button immediately when entering workout before the browser route catches up", () => {
    mockBrowserRoute("/home");

    render(<AppShell initialRoute="/workout" />);

    expect(screen.getByRole("button", { name: "添加运动记录" })).toBeOnTheScreen();
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

  it("keeps package actions tucked behind a menu and opens pickup code in a large overlay", () => {
    const storage = {
      getItem: jest.fn((key: string) => key.includes("packages") ? JSON.stringify([
        {
          arrivalDate: "2026-08-02",
          company: "SF",
          createTime: "2026-08-02T08:00:00.000Z",
          id: "pkg-compact-1",
          image: null,
          orderNumber: "",
          pickedUp: false,
          pickupCode: "A12-3",
          pickupLocation: "Gate"
        }
      ]) : null),
      removeItem: jest.fn(),
      setItem: jest.fn()
    };

    render(<PackagePanel storage={storage} themeTokens={testTokens} />);

    expect(screen.getByTestId("package-code-pkg-compact-1")).toBeOnTheScreen();
    expect(screen.queryByTestId("package-delete-pkg-compact-1")).toBeNull();

    fireEvent.press(screen.getByTestId("package-more-pkg-compact-1"));
    expect(screen.getByTestId("package-delete-pkg-compact-1")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("package-code-pkg-compact-1"));
    expect(screen.getByTestId("package-code-modal")).toBeOnTheScreen();
  });
});
