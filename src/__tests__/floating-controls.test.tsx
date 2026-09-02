import { act, fireEvent, render, screen } from "@testing-library/react-native";

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
      width: "33.333333333333336%"
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

  it("switches the unified love story fab action by love tab", async () => {
    render(<AppShell initialRoute="/love" viewport="mobile" />);

    expect(await screen.findByRole("button", { name: "发布恋爱日记" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "礼物" }));
    expect(await screen.findByRole("button", { name: "记录礼物" })).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText("礼物名称（如：手表）")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "记录礼物" }));
    expect(screen.getByTestId("love-gift-composer-modal")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "日记本" }));
    expect(await screen.findByRole("button", { name: "发布恋爱日记" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "纪念日" }));
    expect(await screen.findByRole("button", { name: "添加纪念日" })).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText("纪念日名称（如：在一起的日子）")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "添加纪念日" }));
    expect(screen.getByTestId("love-anniversary-composer-modal")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "照片墙" }));
    expect(await screen.findByRole("button", { name: "照片墙新建文件夹" })).toBeOnTheScreen();
  });

  it("does not show the diary publish portal without an explicit love route guard", () => {
    render(<LovePanel showInlineTabs={false} />);

    expect(screen.queryByRole("button", { name: "发布恋爱日记" })).toBeNull();
  });

  it("hides the love diary publish portal when the browser route changes while the love shell is still mounted", async () => {
    const listeners = new Map<string, Set<EventListener>>();
    const originalAddEventListener = window.addEventListener;
    const originalRemoveEventListener = window.removeEventListener;
    const originalDispatchEvent = window.dispatchEvent;

    window.addEventListener = jest.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const callback = typeof listener === "function" ? listener : listener.handleEvent.bind(listener);
      const bucket = listeners.get(type) ?? new Set<EventListener>();
      bucket.add(callback);
      listeners.set(type, bucket);
    }) as never;
    window.removeEventListener = jest.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const callback = typeof listener === "function" ? listener : listener.handleEvent.bind(listener);
      listeners.get(type)?.delete(callback);
    }) as never;
    window.dispatchEvent = jest.fn((event: Event) => {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    }) as never;

    const { unmount } = render(<AppShell route="/love" viewport="mobile" />);

    try {
      expect(await screen.findByRole("button", { name: "发布恋爱日记" })).toBeOnTheScreen();

      act(() => {
        window.dispatchEvent(new CustomEvent("melifedesk-routechange", { detail: { href: "/home" } }));
      });

      expect(screen.queryByRole("button", { name: "发布恋爱日记" })).toBeNull();
    } finally {
      unmount();
      window.addEventListener = originalAddEventListener;
      window.removeEventListener = originalRemoveEventListener;
      window.dispatchEvent = originalDispatchEvent;
    }
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
