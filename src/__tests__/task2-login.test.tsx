import { fireEvent, render, screen } from "@testing-library/react-native";

import LoginRoute from "@/app/login";

describe("Task 2 login route", () => {
  it("renders login controls and switches to registration", () => {
    render(<LoginRoute />);

    expect(screen.getByPlaceholderText("you@example.com")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("至少 6 位")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "登录" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "注册" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "立即登录" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "以本地模式继续" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "注册" }));
    expect(screen.getByPlaceholderText("怎么称呼你")).toBeOnTheScreen();
  });
});
