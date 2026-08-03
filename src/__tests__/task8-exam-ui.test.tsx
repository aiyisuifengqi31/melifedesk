import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";

describe("Task 8 exam page", () => {
  it("uses bottom tabs and opens real essay article details", () => {
    render(<AppShell initialRoute="/exam" viewport="mobile" />);

    expect(screen.queryByTestId("exam-inline-tabs")).toBeNull();
    expect(screen.getByTestId("secondary-floating-tabs")).toBeOnTheScreen();
    expect(screen.getByTestId("secondary-tab-essay")).toBeOnTheScreen();
    expect(screen.getByText("每日精选文章")).toBeOnTheScreen();
    expect(screen.queryByText(/待接入/)).toBeNull();

    fireEvent.press(screen.getByTestId("essay-article-people-livelihood-20260725"));

    expect(screen.getByTestId("essay-detail")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "查看官方原文" })).toBeOnTheScreen();
    expect(screen.getByText("核心观点")).toBeOnTheScreen();
  });

  it("keeps knowledge, idiom, and record tabs available from the fixed bottom bar", () => {
    render(<AppShell initialRoute="/exam" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("secondary-tab-knowledge"));
    expect(screen.getByText("今日常识积累")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("secondary-tab-idiom"));
    expect(screen.getByText("今日成语积累")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("secondary-tab-record"));
    expect(screen.getByText("今日阅读时长")).toBeOnTheScreen();
  });
});
