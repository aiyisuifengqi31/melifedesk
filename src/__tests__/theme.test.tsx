import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";
import { getTheme, THEME_IDS } from "@/theme/registry";

describe("theme system", () => {
  it("registers default, cat, and dog themes with required assets", () => {
    expect(THEME_IDS).toEqual(["default", "cat", "dog"]);

    for (const themeId of THEME_IDS) {
      const theme = getTheme(themeId);
      expect(Object.keys(theme.icons)).toHaveLength(6);
      expect(theme.tokens.light.background).toBeTruthy();
      expect(theme.tokens.dark.background).toBeTruthy();
      expect(theme.emptyState).toBeTruthy();
      expect(theme.chartPalette).toHaveLength(5);
      expect(theme.license).toContain("项目原创占位资源");
    }
  });

  it("switches theme icons and tokens together", () => {
    render(<AppShell initialRoute="/plan" />);

    expect(screen.getByTestId("active-theme")).toHaveTextContent("当前主题：default");
    expect(screen.getByTestId("theme-token").props.children).toContain("#ffffff");
    expect(screen.queryByText("default-plan")).toBeNull();
    expect(screen.getByTestId("nav-icon-plan")).toHaveProp("accessibilityLabel", "default plan selected icon");
    expect(screen.getByTestId("nav-icon-workout")).toHaveProp("accessibilityLabel", "default workout unselected icon");

    fireEvent.press(screen.getByRole("button", { name: "cat" }));

    expect(screen.getByTestId("active-theme")).toHaveTextContent("当前主题：cat");
    expect(screen.getByTestId("theme-token").props.children).toContain("#fff8ed");
    expect(screen.queryByText("cat-plan")).toBeNull();
    expect(screen.getByTestId("nav-icon-plan")).toHaveProp("accessibilityLabel", "cat plan selected icon");
    expect(screen.getByTestId("nav-icon-workout")).toHaveProp("accessibilityLabel", "cat workout unselected icon");

    fireEvent.press(screen.getByRole("button", { name: "dog" }));

    expect(screen.getByTestId("active-theme")).toHaveTextContent("当前主题：dog");
    expect(screen.queryByText("dog-plan")).toBeNull();
    expect(screen.getByTestId("nav-icon-plan")).toHaveProp("accessibilityLabel", "dog plan selected icon");
  });

  it("switches between light and dark mode tokens", () => {
    render(<AppShell initialRoute="/plan" />);

    expect(screen.getByTestId("theme-token").props.children).toContain("#ffffff");

    fireEvent.press(screen.getByRole("button", { name: "切换深色模式" }));

    expect(screen.getByTestId("theme-token").props.children).toContain("#17151f");
  });
});
