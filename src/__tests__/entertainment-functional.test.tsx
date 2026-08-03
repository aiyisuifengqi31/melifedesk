import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";

describe("Entertainment functional pages", () => {
  it("opens film shortcuts into real list panels instead of inert cards", () => {
    render(<AppShell initialRoute="/fun" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("secondary-tab-film"));
    expect(screen.getByText("影视发现与记录")).toBeOnTheScreen();
    expect(screen.getByTestId("media-form")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "周末观影清单" }));
    expect(screen.getByText("周末观影清单")).toBeOnTheScreen();
    expect(screen.getByTestId("media-list")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "返回影视列表" }));
    fireEvent.press(screen.getByRole("button", { name: "追剧进度" }));
    expect(screen.getByText("我的追剧")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "返回影视列表" }));
    fireEvent.press(screen.getByRole("button", { name: "下饭综艺" }));
    expect(screen.getByText("下饭综艺")).toBeOnTheScreen();
  });

  it("opens every useful shortcut into a concrete tool", () => {
    render(<AppShell initialRoute="/fun" viewport="mobile" />);

    fireEvent.press(screen.getByTestId("secondary-tab-useful"));
    fireEvent.press(screen.getByRole("button", { name: "节假日日历" }));
    expect(screen.getByTestId("holiday-tool")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "返回实用首页" }));
    fireEvent.press(screen.getByRole("button", { name: "电影上映日历" }));
    expect(screen.getByTestId("release-tool")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "返回实用首页" }));
    fireEvent.press(screen.getByRole("button", { name: "生活日期提醒" }));
    expect(screen.getByTestId("reminder-tool")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "返回实用首页" }));
    fireEvent.press(screen.getByRole("button", { name: "常用查询入口" }));
    expect(screen.getByTestId("links-tool")).toBeOnTheScreen();
  });
});
