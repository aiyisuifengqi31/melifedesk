import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";
import { EntertainmentPanel } from "@/features/entertainment/EntertainmentPanel";
import { LovePanel } from "@/features/love/LovePanel";
import { getTheme } from "@/theme/registry";

const tokens = getTheme("default").tokens.light;

describe("floating page controls", () => {
  it("keeps love diary tabs in the bottom floating control", () => {
    render(<LovePanel themeTokens={tokens} />);

    expect(screen.getByTestId("love-floating-tabs")).toBeOnTheScreen();
  });

  it("keeps entertainment tabs in the bottom floating control", () => {
    render(<EntertainmentPanel themeTokens={tokens} />);

    expect(screen.getByTestId("entertainment-floating-tabs")).toBeOnTheScreen();
  });

  it("opens the sidebar quick shortcut arc above settings", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByRole("button", { name: "打开快捷入口" }));

    expect(screen.getByTestId("quick-shortcut-menu")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "备忘录快捷入口" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "待办快捷入口" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "快递快捷入口" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "支出快捷入口" })).toBeOnTheScreen();
  });
});
