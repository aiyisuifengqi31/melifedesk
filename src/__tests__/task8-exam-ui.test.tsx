import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";

describe("Task 8 exam page", () => {
  it("renders the exam workspace and switches between daily, essay, and source tabs", () => {
    render(<AppShell initialRoute="/exam" />);

    expect(screen.getAllByText("考公练习").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("每日题、错题和申论工作台")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "生成每日题" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "申论" }));
    expect(screen.getByText("申论草稿")).toBeOnTheScreen();
    expect(screen.getByText(/不宣称自动评分准确/)).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "题源" }));
    expect(screen.getByText("题源与审核")).toBeOnTheScreen();
    expect(screen.getByText("公开来源名称")).toBeOnTheScreen();
  });
});
