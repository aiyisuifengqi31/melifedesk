import { render, screen } from "@testing-library/react-native";

import LoginRoute from "@/app/login";

describe("Task 2 login route", () => {
  it("renders registration, login, profile, settings, and couple invite controls", () => {
    render(<LoginRoute />);

    expect(screen.getByPlaceholderText("邮箱")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("密码")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("显示名称")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("邀请码")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "注册" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "登录" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "保存主题" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "生成情侣邀请码" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "接受邀请" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "解除绑定" })).toBeOnTheScreen();
  });
});
