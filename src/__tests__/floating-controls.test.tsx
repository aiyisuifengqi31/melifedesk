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
    expect(screen.getByTestId("secondary-tab-record")).toHaveStyle({ flex: 1 });
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

  it("opens the sidebar quick shortcut panel above settings", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByRole("button", { name: "打开快捷入口" }));

    expect(screen.getByTestId("quick-shortcut-menu")).toBeOnTheScreen();
    expect(screen.getByTestId("quick-shortcut-voice")).toBeOnTheScreen();
    expect(screen.getByTestId("quick-shortcut-finance")).toBeOnTheScreen();
    expect(screen.getByTestId("quick-shortcut-package-scan")).toBeOnTheScreen();
    expect(screen.getByTestId("quick-shortcut-workout")).toBeOnTheScreen();
  });

  it("dismisses the shortcut arc when tapping outside it", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByRole("button", { name: "打开快捷入口" }));
    expect(screen.getByTestId("quick-shortcut-menu")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "关闭快捷入口背景" }));
    expect(screen.queryByTestId("quick-shortcut-menu")).toBeNull();
  });
  it("opens the notes shortcut directly in note creation state", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("quick-fab"));
    fireEvent.press(screen.getByTestId("quick-shortcut-notes"));

    expect(screen.queryByTestId("quick-shortcut-menu")).toBeNull();
    expect(screen.getByTestId("notes-content-input").props.autoFocus).toBe(true);
  });

  it("opens the todo shortcut directly in todo creation state", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("quick-fab"));
    fireEvent.press(screen.getByTestId("quick-shortcut-todos"));

    expect(screen.queryByTestId("quick-shortcut-menu")).toBeNull();
    expect(screen.getByTestId("todo-title-input").props.autoFocus).toBe(true);
  });

  it("opens the package screenshot shortcut in the express capture area", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("quick-fab"));
    fireEvent.press(screen.getByTestId("quick-shortcut-package-scan"));

    expect(screen.queryByTestId("quick-shortcut-menu")).toBeNull();
    expect(screen.getByRole("button", { name: "上传快递截图" })).toBeOnTheScreen();
  });

  it("opens the finance shortcut on expense quick entry", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("quick-fab"));
    fireEvent.press(screen.getByTestId("quick-shortcut-finance"));

    expect(screen.queryByTestId("quick-shortcut-menu")).toBeNull();
    expect(screen.getByTestId("finance-amount-input").props.autoFocus).toBe(true);
    expect(screen.getByTestId("secondary-tab-record")).toHaveStyle({ flex: 1 });
  });

  it("opens global voice capture from the first quick action", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("quick-fab"));
    fireEvent.press(screen.getByTestId("quick-shortcut-voice"));

    expect(screen.queryByTestId("quick-shortcut-menu")).toBeNull();
    expect(screen.getByTestId("global-quick-capture")).toBeOnTheScreen();
    expect(screen.getByTestId("quick-capture-text-input").props.autoFocus).toBe(true);
  });
});
