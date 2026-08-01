import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";

describe("Task 8 exam page", () => {
  it("renders the exam workspace and switches between practice, reading, and study tabs", () => {
    render(<AppShell initialRoute="/exam" />);

    expect(screen.getByText("每日一句")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "去粉笔做题" })).toBeOnTheScreen();
    expect(screen.getByText("河北高频成语")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "申论阅读" }));
    expect(screen.getByText("权威阅读源")).toBeOnTheScreen();
    expect(screen.getByText("申论金句库")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "学习时长" }));
    expect(screen.getByText("开始计时")).toBeOnTheScreen();
    expect(screen.getByText("近 7 天学习时长")).toBeOnTheScreen();
  });
});
