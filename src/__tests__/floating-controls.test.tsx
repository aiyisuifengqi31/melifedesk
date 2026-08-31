import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";
import { LovePanel } from "@/features/love/LovePanel";

describe("floating page controls", () => {
  it("renders finance secondary tabs as a fixed app-shell layer aligned to mobile content", () => {
    render(<AppShell initialRoute="/finance" viewport="mobile" />);

    expect(screen.queryByTestId("finance-floating-tabs")).toBeNull();
    expect(screen.getByTestId("secondary-floating-tabs")).toHaveStyle({
      left: 84,
      position: "absolute",
      right: 16
    });
    expect(screen.getByTestId("secondary-tab-slot-stats")).toHaveStyle({ flex: 1, minWidth: 0 });
    expect(screen.getByTestId("secondary-tab-stats")).toHaveStyle({ flex: 1 });
    expect(screen.getByTestId("secondary-tab-indicator")).toHaveStyle({
      bottom: 0,
      top: 0,
      width: "25%"
    });
    expect(screen.getByTestId("secondary-tab-indicator-pill")).toHaveStyle({
      backgroundColor: "rgba(93, 178, 235, 0.14)",
      borderRadius: 9999,
      left: 6,
      right: 6
    });
    expect(screen.getByTestId("secondary-tab-stats")).not.toHaveStyle({ backgroundColor: expect.any(String) });
  });

  it("aligns secondary tabs to the desktop content area instead of covering the sidebar", () => {
    render(<AppShell initialRoute="/finance" viewport="desktop" />);

    expect(screen.getByTestId("secondary-floating-tabs")).toHaveStyle({
      left: 252,
      right: 28
    });
  });

  it("uses one compact app-shell bottom inset instead of stacking page spacers", () => {
    render(<AppShell initialRoute="/finance" viewport="mobile" />);

    expect(screen.getByTestId("page-content").props.contentContainerStyle).toEqual(
      expect.objectContaining({
        paddingBottom: 96
      })
    );
  });

  it("shares the same fixed secondary tab bar across love diary, exam, and entertainment", () => {
    const { rerender } = render(<AppShell route="/love" viewport="mobile" />);

    expect(screen.queryByTestId("love-floating-tabs")).toBeNull();
    expect(screen.getByTestId("secondary-floating-tabs")).toBeOnTheScreen();
    expect(screen.getByTestId("love-diary-publish-fab-shell")).toHaveStyle({
      position: "fixed" as "absolute",
      right: 18
    });

    rerender(<AppShell route="/exam" viewport="mobile" />);

    expect(screen.queryByTestId("exam-inline-tabs")).toBeNull();
    expect(screen.getByTestId("secondary-floating-tabs")).toBeOnTheScreen();
    expect(screen.getByTestId("secondary-tab-slot-essay")).toHaveStyle({ flex: 1, minWidth: 0 });
    expect(screen.getByTestId("secondary-tab-essay")).toHaveStyle({ flex: 1 });
    expect(screen.getByTestId("secondary-tab-record")).toHaveStyle({ flex: 1 });

    rerender(<AppShell route="/fun" viewport="mobile" />);

    expect(screen.queryByTestId("entertainment-floating-tabs")).toBeNull();
    expect(screen.getByTestId("secondary-floating-tabs")).toBeOnTheScreen();
    expect(screen.getByTestId("secondary-tab-slot-hot")).toHaveStyle({ flex: 1, minWidth: 0 });
    expect(screen.getByTestId("secondary-tab-hot")).toHaveStyle({ flex: 1 });
    expect(screen.getByTestId("secondary-tab-useful")).toHaveStyle({ flex: 1 });
  });

  it("removes the love diary publish button when leaving the love route", async () => {
    const { rerender } = render(<AppShell route="/love" viewport="mobile" />);

    expect(await screen.findByRole("button", { name: "发布恋爱日记" })).toBeOnTheScreen();

    rerender(<AppShell route="/home" viewport="mobile" />);

    expect(screen.queryByRole("button", { name: "发布恋爱日记" })).toBeNull();
  });

  it("unmounts the love diary publish button when navigating with the sidebar", async () => {
    render(<AppShell initialRoute="/love" viewport="mobile" />);

    expect(await screen.findByRole("button", { name: "发布恋爱日记" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "首页" }));
    expect(screen.queryByRole("button", { name: "发布恋爱日记" })).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: /恋爱\s*故事/ }));
    expect(await screen.findByRole("button", { name: "发布恋爱日记" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: /收支\s*记账/ }));
    expect(screen.queryByRole("button", { name: "发布恋爱日记" })).toBeNull();
  });

  it("only shows the love diary publish button on the diary tab", async () => {
    render(<AppShell initialRoute="/love" viewport="mobile" />);

    expect(await screen.findByRole("button", { name: "发布恋爱日记" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "礼物" }));
    expect(screen.queryByRole("button", { name: "发布恋爱日记" })).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "日记本" }));
    expect(await screen.findByRole("button", { name: "发布恋爱日记" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "纪念日" }));
    expect(screen.queryByRole("button", { name: "发布恋爱日记" })).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "照片墙" }));
    expect(screen.queryByRole("button", { name: "发布恋爱日记" })).toBeNull();
  });

  it("does not show the diary publish portal without an explicit love route guard", () => {
    render(<LovePanel showInlineTabs={false} />);

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
