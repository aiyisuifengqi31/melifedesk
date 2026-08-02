import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";
import { EntertainmentPanel } from "@/features/entertainment/EntertainmentPanel";
import { FinancePanel } from "@/features/finance/FinancePanel";
import { LovePanel } from "@/features/love/LovePanel";
import { getTheme } from "@/theme/registry";

const tokens = getTheme("default").tokens.light;

describe("floating page controls", () => {
  it("keeps love diary tabs in the bottom floating control", () => {
    render(<LovePanel themeTokens={tokens} />);

    expect(screen.getByTestId("love-floating-tabs")).toHaveStyle({ left: 76, right: 10 });
  });

  it("keeps entertainment tabs in the bottom floating control", () => {
    render(<EntertainmentPanel themeTokens={tokens} />);

    expect(screen.getByTestId("entertainment-floating-tabs")).toHaveStyle({ left: 76, right: 10 });
  });

  it("keeps finance tabs spread across the bottom row", () => {
    render(<FinancePanel />);

    expect(screen.getByTestId("finance-floating-tabs")).toHaveStyle({ left: 76, right: 10 });
  });

  it("opens the sidebar quick shortcut arc above settings", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByRole("button", { name: "打开快捷入口" }));

    expect(screen.getByTestId("quick-shortcut-menu")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "备忘录快捷入口" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "待办快捷入口" })).toHaveStyle({ bottom: 138, left: 82 });
    expect(screen.getByRole("button", { name: "快递快捷入口" })).toHaveStyle({ bottom: 76, left: 104 });
    expect(screen.getByRole("button", { name: "支出快捷入口" })).toHaveStyle({ bottom: 14, left: 82 });
  });

  it("dismisses the shortcut arc when tapping outside it", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByRole("button", { name: "打开快捷入口" }));
    expect(screen.getByTestId("quick-shortcut-menu")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "关闭快捷入口背景" }));
    expect(screen.queryByTestId("quick-shortcut-menu")).toBeNull();
  });
});
