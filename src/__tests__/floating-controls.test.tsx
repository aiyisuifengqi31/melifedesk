import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";

describe("floating page controls", () => {
  it("renders finance secondary tabs as a fixed app-shell layer aligned to mobile content", () => {
    render(<AppShell initialRoute="/finance" viewport="mobile" />);

    expect(screen.queryByTestId("finance-floating-tabs")).toBeNull();
    expect(screen.getByTestId("secondary-floating-tabs")).toHaveStyle({
      left: 84,
      position: "absolute",
      right: 16
    });
    expect(screen.getByTestId("secondary-tab-stats")).toHaveStyle({ flex: 1 });
  });

  it("aligns secondary tabs to the desktop content area instead of covering the sidebar", () => {
    render(<AppShell initialRoute="/finance" viewport="desktop" />);

    expect(screen.getByTestId("secondary-floating-tabs")).toHaveStyle({
      left: 252,
      right: 28
    });
  });

  it("shares the same fixed secondary tab bar across love diary, exam, and entertainment", () => {
    const { rerender } = render(<AppShell route="/love" viewport="mobile" />);

    expect(screen.queryByTestId("love-floating-tabs")).toBeNull();
    expect(screen.getByTestId("secondary-floating-tabs")).toBeOnTheScreen();

    rerender(<AppShell route="/exam" viewport="mobile" />);

    expect(screen.queryByTestId("exam-inline-tabs")).toBeNull();
    expect(screen.getByTestId("secondary-floating-tabs")).toBeOnTheScreen();
    expect(screen.getByTestId("secondary-tab-essay")).toHaveStyle({ flex: 1 });
    expect(screen.getByTestId("secondary-tab-record")).toHaveStyle({ flex: 1 });

    rerender(<AppShell route="/fun" viewport="mobile" />);

    expect(screen.queryByTestId("entertainment-floating-tabs")).toBeNull();
    expect(screen.getByTestId("secondary-floating-tabs")).toBeOnTheScreen();
    expect(screen.getByTestId("secondary-tab-hot")).toHaveStyle({ flex: 1 });
    expect(screen.getByTestId("secondary-tab-useful")).toHaveStyle({ flex: 1 });
  });

  it("removes the love diary publish button when leaving the love route", async () => {
    const { rerender } = render(<AppShell route="/love" viewport="mobile" />);

    expect(await screen.findByRole("button", { name: "发布恋爱日记" })).toBeOnTheScreen();

    rerender(<AppShell route="/home" viewport="mobile" />);

    expect(screen.queryByRole("button", { name: "发布恋爱日记" })).toBeNull();
  });

  it("opens the sidebar quick shortcut panel above settings", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByRole("button", { name: "打开快捷入口" }));

    expect(screen.getByTestId("quick-fab")).toHaveProp("accessibilityState", { expanded: true });
    expect(screen.getByTestId("quick-shortcut-menu-motion")).toBeOnTheScreen();
    expect(screen.getByTestId("quick-shortcut-menu")).toBeOnTheScreen();
    expect(screen.getByTestId("quick-shortcut-voice")).toBeOnTheScreen();
    expect(screen.getByTestId("quick-shortcut-finance")).toBeOnTheScreen();
    expect(screen.getByTestId("quick-shortcut-package-scan")).toBeOnTheScreen();
    expect(screen.getByTestId("quick-shortcut-workout")).toBeOnTheScreen();
  });

  it("dismisses the shortcut arc when tapping outside it", async () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByRole("button", { name: "打开快捷入口" }));
    expect(screen.getByTestId("quick-shortcut-menu")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "关闭快捷入口背景" }));
    expect(screen.getByTestId("quick-fab")).toHaveProp("accessibilityState", { expanded: false });
    expect(screen.getByTestId("quick-shortcut-menu-motion")).toHaveProp("pointerEvents", "none");
    expect(screen.getByTestId("quick-shortcut-menu-motion")).toHaveStyle({ opacity: 0 });
  });

  it("marks the expanded more navigation panel as an animated layer", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("sidebar-more-button"));

    expect(screen.getByTestId("sidebar-more-panel-motion")).toBeOnTheScreen();
    expect(screen.getByTestId("sidebar-more-panel")).toBeOnTheScreen();
  });
  it("opens the notes shortcut directly in note creation state", async () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("quick-fab"));
    fireEvent.press(screen.getByTestId("quick-shortcut-notes"));

    expect(screen.getByTestId("quick-shortcut-menu-motion")).toHaveProp("pointerEvents", "none");
    expect(screen.getByTestId("notes-content-input").props.autoFocus).toBe(true);
  });

  it("opens the todo shortcut directly in todo creation state", async () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("quick-fab"));
    fireEvent.press(screen.getByTestId("quick-shortcut-todos"));

    expect(screen.getByTestId("quick-shortcut-menu-motion")).toHaveProp("pointerEvents", "none");
    expect(screen.getByTestId("todo-title-input").props.autoFocus).toBe(true);
  });

  it("opens the package screenshot shortcut in the express capture area", async () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("quick-fab"));
    fireEvent.press(screen.getByTestId("quick-shortcut-package-scan"));

    expect(screen.getByTestId("quick-shortcut-menu-motion")).toHaveProp("pointerEvents", "none");
    expect(screen.getAllByRole("button", { name: "上传快递截图" }).length).toBeGreaterThan(0);
  });

  it("opens the finance shortcut on expense quick entry", async () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("quick-fab"));
    fireEvent.press(screen.getByTestId("quick-shortcut-finance"));

    expect(screen.getByTestId("quick-shortcut-menu-motion")).toHaveProp("pointerEvents", "none");
    expect(screen.getByTestId("quick-accounting-sheet")).toBeOnTheScreen();
    expect(screen.queryByTestId("finance-amount-input")).toBeNull();
  });

  it("opens global voice capture from the first quick action", async () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("quick-fab"));
    fireEvent.press(screen.getByTestId("quick-shortcut-voice"));

    expect(screen.getByTestId("quick-shortcut-menu-motion")).toHaveProp("pointerEvents", "none");
    expect(screen.getByTestId("global-quick-capture")).toBeOnTheScreen();
    expect(screen.getByTestId("quick-capture-text-input").props.autoFocus).toBe(true);
  });
});
