import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";
import { NAV_ITEMS } from "@/navigation/items";

const labelOf = (key: (typeof NAV_ITEMS)[number]["key"]) => NAV_ITEMS.find((item) => item.key === key)?.label ?? "";

describe("primary navigation", () => {
  it("renders only the requested primary navigation and keeps more collapsed by default", () => {
    render(<AppShell initialRoute="/plan" />);

    for (const item of NAV_ITEMS.filter((navItem) => !["exam", "workout", "fun"].includes(navItem.key))) {
      expect(screen.getAllByText(item.label).length).toBeGreaterThan(0);
    }
    expect(screen.getByTestId("sidebar-more-button")).toBeOnTheScreen();
    expect(screen.queryByTestId("sidebar-subitem-exam")).toBeNull();
    expect(screen.queryByTestId("sidebar-subitem-workout")).toBeNull();
    expect(screen.queryByTestId("sidebar-subitem-fun")).toBeNull();
  });

  it("switches routes from the inline more submenu", () => {
    render(<AppShell initialRoute="/plan" />);

    fireEvent.press(screen.getByTestId("sidebar-more-button"));
    expect(screen.getByTestId("sidebar-subitem-exam")).toBeOnTheScreen();
    expect(screen.getByTestId("sidebar-subitem-workout")).toBeOnTheScreen();
    expect(screen.getByTestId("sidebar-subitem-fun")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("sidebar-subitem-workout"));

    expect(screen.getByTestId("nav-icon-workout")).toHaveProp("accessibilityLabel", "default workout selected icon");
  });

  it("moves the middle navigation lower while keeping the footer stable when more expands", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    expect(screen.getByTestId("sidebar-nav-scroll")).toHaveStyle({ marginTop: 136 });
    expect(screen.queryByTestId("sidebar-more-panel")).toBeNull();
    expect(screen.getByTestId("sidebar-footer")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("sidebar-more-button"));

    expect(screen.getByTestId("sidebar-more-panel")).toBeOnTheScreen();
    expect(screen.getByTestId("sidebar-subitem-exam")).toHaveStyle({ minHeight: 44 });
    expect(screen.getByTestId("sidebar-subitem-workout")).toHaveStyle({ minHeight: 44 });
    expect(screen.getByTestId("sidebar-subitem-fun")).toHaveStyle({ minHeight: 44 });
    expect(screen.getByTestId("sidebar-footer")).toBeOnTheScreen();
  });

  it("keeps love story as a primary route and auto-expands more only for exam, workout, and fun", () => {
    render(<AppShell initialRoute="/love" viewport="mobile" />);

    expect(screen.queryByTestId("sidebar-more-panel")).toBeNull();
    expect(screen.getByTestId("nav-icon-love")).toHaveProp("accessibilityLabel", "default love selected icon");
    expect(screen.getAllByText("恋爱\n故事").length).toBeGreaterThan(0);

    fireEvent.press(screen.getByTestId("sidebar-more-button"));
    expect(screen.getByTestId("sidebar-subitem-exam")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("sidebar-subitem-fun"));
    expect(screen.getByTestId("sidebar-more-panel")).toBeOnTheScreen();
    expect(screen.getByTestId("sidebar-subitem-fun")).toHaveStyle({ backgroundColor: "#e9f7ee" });

    fireEvent.press(screen.getByRole("button", { name: labelOf("finance") }));

    expect(screen.queryByTestId("sidebar-more-panel")).toBeNull();
    expect(screen.getByTestId("nav-icon-finance")).toHaveProp("accessibilityLabel", "default finance selected icon");
  });

  it("keeps mobile sidebar width within the required range", () => {
    render(<AppShell initialRoute="/plan" viewport="mobile" />);

    expect(screen.getByTestId("primary-sidebar")).toHaveStyle({
      width: 68
    });
    expect(screen.getByTestId("page-content")).toHaveStyle({
      marginLeft: 0
    });
  });

  it("collapses and expands the web sidebar", () => {
    render(<AppShell initialRoute="/plan" viewport="desktop" />);

    expect(screen.getByTestId("primary-sidebar")).toHaveStyle({
      width: 224
    });

    fireEvent.press(screen.getByRole("button", { name: "折叠导航" }));

    expect(screen.getByTestId("primary-sidebar")).toHaveStyle({
      width: 72
    });
  });
});
