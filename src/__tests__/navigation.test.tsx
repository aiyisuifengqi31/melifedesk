import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";
import { NAV_ITEMS } from "@/navigation/items";

describe("primary navigation", () => {
  it("renders the six fixed navigation names", () => {
    render(<AppShell initialRoute="/plan" />);

    for (const item of NAV_ITEMS) {
      expect(screen.getAllByText(item.label).length).toBeGreaterThan(0);
    }
  });

  it("switches routes when a navigation item is pressed", async () => {
    render(<AppShell initialRoute="/plan" />);

    fireEvent.press(screen.getByRole("button", { name: "运动\n健身" }));

    expect(await screen.findByRole("button", { name: "今天训练了" })).toBeOnTheScreen();
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
