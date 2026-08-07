import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";
import { NAV_ITEMS } from "@/navigation/items";
import { getTheme, THEME_IDS } from "@/theme/registry";

describe("theme system", () => {
  it("registers every theme with required assets", () => {
    expect(THEME_IDS).toContain("default");
    expect(THEME_IDS).toContain("cat");
    expect(THEME_IDS).toContain("dog");
    expect(THEME_IDS.length).toBeGreaterThanOrEqual(8);

    for (const themeId of THEME_IDS) {
      const theme = getTheme(themeId);
      expect(Object.keys(theme.icons)).toHaveLength(NAV_ITEMS.length);
      expect(theme.name).toBeTruthy();
      expect(theme.description).toBeTruthy();
      expect(theme.tokens.light.background).toBeTruthy();
      expect(theme.tokens.dark.background).toBeTruthy();
      expect(theme.emptyState).toBeTruthy();
      expect(theme.chartPalette).toHaveLength(5);
      expect(theme.license).toContain("项目原创占位资源");
    }
  });

  it("switches theme icons from the settings panel", () => {
    render(<AppShell initialRoute="/plan" />);

    expect(screen.getByTestId("nav-icon-plan")).toHaveProp("accessibilityLabel", "default plan selected icon");
    fireEvent.press(screen.getByRole("button", { name: "更多" }));
    expect(screen.getByTestId("nav-icon-workout")).toHaveProp("accessibilityLabel", "default workout unselected icon");

    fireEvent.press(screen.getByRole("button", { name: "设置" }));
    fireEvent.press(screen.getByRole("button", { name: "设置-主题" }));
    expect(screen.getByText("当前主题：清新绿意")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "使用奶油猫咪主题" }));
    expect(screen.getByText("当前主题：奶油猫咪")).toBeOnTheScreen();
    expect(screen.getByTestId("nav-icon-plan")).toHaveProp("accessibilityLabel", "cat plan selected icon");
    expect(screen.getByTestId("nav-icon-workout")).toHaveProp("accessibilityLabel", "cat workout unselected icon");

    fireEvent.press(screen.getByRole("button", { name: "使用柴犬日常主题" }));
    expect(screen.getByTestId("nav-icon-plan")).toHaveProp("accessibilityLabel", "dog plan selected icon");
  });

  it("switches between light and dark mode from the settings panel", () => {
    render(<AppShell initialRoute="/plan" />);

    fireEvent.press(screen.getByRole("button", { name: "设置" }));
    fireEvent.press(screen.getByRole("button", { name: "设置-主题" }));
    expect(screen.getByText("当前外观：浅色")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "深色模式" }));

    expect(screen.getByText("当前外观：深色")).toBeOnTheScreen();
  });
});
