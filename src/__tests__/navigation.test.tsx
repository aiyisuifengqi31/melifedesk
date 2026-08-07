import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";
import { NAV_ITEMS } from "@/navigation/items";

const labelOf = (key: (typeof NAV_ITEMS)[number]["key"]) => NAV_ITEMS.find((item) => item.key === key)?.label ?? "";

describe("primary navigation", () => {
  it("renders only the requested primary navigation and keeps more collapsed by default", () => {
    render(<AppShell initialRoute="/plan" />);

    for (const item of NAV_ITEMS.filter((navItem) => !["love", "workout", "fun"].includes(navItem.key))) {
      expect(screen.getAllByText(item.label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(labelOf("love"))).toBeNull();
    expect(screen.getByTestId("sidebar-more-button")).toBeOnTheScreen();
    expect(screen.queryByTestId("sidebar-subitem-love")).toBeNull();
    expect(screen.queryByTestId("sidebar-subitem-workout")).toBeNull();
    expect(screen.queryByTestId("sidebar-subitem-fun")).toBeNull();
  });

  it("switches routes from the inline more submenu", () => {
    render(<AppShell initialRoute="/plan" />);

    fireEvent.press(screen.getByTestId("sidebar-more-button"));
    expect(screen.getByTestId("sidebar-subitem-love")).toBeOnTheScreen();
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
    expect(screen.getByTestId("sidebar-subitem-love")).toHaveStyle({ minHeight: 44 });
    expect(screen.getByTestId("sidebar-subitem-workout")).toHaveStyle({ minHeight: 44 });
    expect(screen.getByTestId("sidebar-subitem-fun")).toHaveStyle({ minHeight: 44 });
    expect(screen.getByTestId("sidebar-footer")).toBeOnTheScreen();
  });

  it("auto-expands more for love, workout, and fun routes and collapses after a primary navigation press", () => {
    render(<AppShell initialRoute="/love" viewport="mobile" />);

    expect(screen.getByTestId("sidebar-more-panel")).toBeOnTheScreen();
    expect(screen.getByTestId("sidebar-subitem-love")).toHaveStyle({ backgroundColor: "#e9f7ee" });
    expect(screen.getByTestId("sidebar-more-button")).toHaveStyle({ backgroundColor: "#f2fbf4" });

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
