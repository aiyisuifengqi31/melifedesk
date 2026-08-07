import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";
import { NAV_ITEMS } from "@/navigation/items";

const labelOf = (key: (typeof NAV_ITEMS)[number]["key"]) => NAV_ITEMS.find((item) => item.key === key)?.label ?? "";

describe("primary navigation", () => {
  it("renders the primary navigation names and keeps more collapsed by default", () => {
    render(<AppShell initialRoute="/plan" />);

    for (const item of NAV_ITEMS.filter((navItem) => navItem.key !== "workout" && navItem.key !== "fun")) {
      expect(screen.getAllByText(item.label).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole("button", { name: "更多" })).toBeOnTheScreen();
    expect(screen.queryByTestId("sidebar-subitem-workout")).toBeNull();
    expect(screen.queryByTestId("sidebar-subitem-fun")).toBeNull();
  });

  it("switches routes from the inline more submenu", async () => {
    render(<AppShell initialRoute="/plan" />);

    fireEvent.press(screen.getByRole("button", { name: "更多" }));
    fireEvent.press(screen.getByTestId("sidebar-subitem-workout"));

    expect(await screen.findByRole("button", { name: "今天训练了" })).toBeOnTheScreen();
  });

  it("keeps the middle navigation offset and the footer stable when more expands", () => {
    render(<AppShell initialRoute="/home" viewport="mobile" />);

    expect(screen.getByTestId("sidebar-nav-scroll")).toHaveStyle({ marginTop: 42 });
    expect(screen.queryByTestId("sidebar-more-panel")).toBeNull();
    expect(screen.getByTestId("sidebar-footer")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "更多" }));

    expect(screen.getByTestId("sidebar-more-panel")).toBeOnTheScreen();
    expect(screen.getByTestId("sidebar-subitem-workout")).toHaveStyle({ minHeight: 40 });
    expect(screen.getByTestId("sidebar-subitem-fun")).toHaveStyle({ minHeight: 40 });
    expect(screen.getByTestId("sidebar-footer")).toBeOnTheScreen();
  });

  it("auto-expands more for workout and fun routes and collapses after a primary navigation press", () => {
    render(<AppShell initialRoute="/fun" viewport="mobile" />);

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
