import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { ACTIVE_USER_KEY } from "@/auth/localScope";
import { AuthGate } from "@/auth/AuthGate";

const mockReplace = jest.fn();
let mockPathname = "/home";
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn(() => ({
  data: {
    subscription: {
      unsubscribe: jest.fn()
    }
  }
}));

jest.mock("expo-router", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    replace: mockReplace
  })
}));

jest.mock("@/auth/supabaseClient", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange
    }
  })
}));

describe("AuthGate startup", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    const storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value)
      }
    });
    mockPathname = "/home";
    mockReplace.mockClear();
    mockGetSession.mockReset();
    mockOnAuthStateChange.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the app immediately for a returning local user even when Supabase session lookup stalls", async () => {
    window.localStorage.setItem(ACTIVE_USER_KEY, "returning-user");
    mockGetSession.mockReturnValue(new Promise(() => {}));

    render(
      <AuthGate>
        <Text testID="app-ready">ready</Text>
      </AuthGate>
    );

    expect(screen.getByTestId("app-ready")).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalledWith("/login");
  });
});
