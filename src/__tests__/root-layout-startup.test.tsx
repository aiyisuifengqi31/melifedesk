import { render } from "@testing-library/react-native";

import RootLayout, { shouldShowStartupWelcome } from "@/app/_layout";

let mockPathname = "/login";

jest.mock("expo-router", () => ({
  Stack: () => {
    const { Text } = require("react-native");
    return <Text testID="app-stack">stack</Text>;
  },
  usePathname: () => mockPathname
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null
}));

jest.mock("@/auth/AuthGate", () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

jest.mock("@/components/WelcomeScreen", () => ({
  WelcomeScreen: () => {
    const { Text } = require("react-native");
    return <Text testID="welcome-screen">welcome</Text>;
  }
}));

describe("root layout startup", () => {
  beforeEach(() => {
    mockPathname = "/login";
  });

  it("does not block the login page behind the welcome screen", () => {
    const screen = render(<RootLayout />);

    expect(screen.queryByTestId("welcome-screen")).toBeNull();
    expect(screen.getByTestId("app-stack")).toBeTruthy();
  });

  it("does not show the startup welcome layer on web pages", () => {
    expect(shouldShowStartupWelcome({ pathname: "/home", platformOS: "web", seenThisSession: false })).toBe(false);
    expect(shouldShowStartupWelcome({ pathname: "/login", platformOS: "android", seenThisSession: false })).toBe(false);
    expect(shouldShowStartupWelcome({ pathname: "/home", platformOS: "android", seenThisSession: false })).toBe(true);
    expect(shouldShowStartupWelcome({ pathname: "/home", platformOS: "android", seenThisSession: true })).toBe(false);
    expect(shouldShowStartupWelcome({ pathname: "/home", platformOS: "android", seenThisSession: false, isServerRender: true })).toBe(false);
  });
});
