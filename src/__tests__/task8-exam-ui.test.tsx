import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";

describe("Task 8 exam page", () => {
  it("uses bottom tabs for the redesigned exam workspace and removes Fenbi deep links", () => {
    render(<AppShell initialRoute="/exam" viewport="mobile" />);

    expect(screen.queryByTestId("exam-inline-tabs")).toBeNull();
    expect(screen.getByTestId("secondary-floating-tabs")).toBeOnTheScreen();
    expect(screen.getByTestId("secondary-tab-essay")).toBeOnTheScreen();
    expect(screen.getByTestId("secondary-tab-knowledge")).toBeOnTheScreen();
    expect(screen.getByTestId("secondary-tab-idiom")).toBeOnTheScreen();
    expect(screen.getByTestId("secondary-tab-record")).toBeOnTheScreen();

    expect(screen.queryByText("去粉笔做题")).toBeNull();
    expect(screen.queryByText("做题")).toBeNull();

    expect(screen.getByText("每日精选文章")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("secondary-tab-knowledge"));
    expect(screen.getByText("今日常识积累")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("secondary-tab-idiom"));
    expect(screen.getByText("今日成语积累")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("secondary-tab-record"));
    expect(screen.getByText("今日阅读时长")).toBeOnTheScreen();
  });
});
