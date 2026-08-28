import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";
import { ActionChip, ContentCard, EmptyState, FloatingQuickAction, InlineError, PageHeader, PrimaryButton, SecondaryButton, SegmentedTabs, StatCard } from "@/shared/ui/primitives";

jest.mock("@/auth/partnership", () => ({
  getCurrentCoupleId: jest.fn(async () => "couple-1"),
  getCurrentPartnerId: jest.fn(async () => "partner-b")
}));

jest.mock("@/features/love/loveSharedCloud", () => ({
  getCurrentLoveUserId: jest.fn(async () => "user-a"),
  hydrateLoveSharedValue: jest.fn(async (_key: string, localValue: unknown) => localValue),
  saveLoveSharedValue: jest.fn(async () => undefined)
}));

const tokens = {
  accent: "#65465a",
  accentSoft: "#f0e2ea",
  background: "#fff8fb",
  border: "#ead4df",
  surface: "#ffffff",
  surfaceMuted: "#f7edf2",
  text: "#2f2430",
  textMuted: "#776878"
};

describe("Task 6 love page and UI polish", () => {
  it("renders the compact love diary workspace without long-lived explanatory copy", async () => {
    render(<AppShell initialRoute="/love" />);

    expect(screen.queryByText("记录每一个甜蜜瞬间")).toBeNull();
    expect(await screen.findByText("❤️ 已绑定")).toBeOnTheScreen();
    expect(screen.getAllByText("日记本").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("礼物").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("纪念日").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("照片墙").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("生理周期")).toBeNull();
    expect(screen.getByText("日记档案")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "发布恋爱日记" })).toBeOnTheScreen();
    expect(screen.queryByText("写日记")).toBeNull();
    expect(screen.queryByPlaceholderText("标题，例如：一起吃饭")).toBeNull();
    expect(screen.queryByPlaceholderText("今天发生了什么...")).toBeNull();
    expect(screen.queryByRole("button", { name: "仅自己可见" })).toBeNull();
    expect(screen.queryByText("恋爱空间内容会保存到双方共享空间，双方都可以查看和编辑。")).toBeNull();
  });

  it("saves a diary directly into shared couple space", async () => {
    render(<AppShell initialRoute="/love" />);

    fireEvent.press(await screen.findByRole("button", { name: "发布恋爱日记" }));
    fireEvent.changeText(screen.getByPlaceholderText("标题，例如：一起吃饭"), "一起散步");
    fireEvent.changeText(screen.getByPlaceholderText("今天发生了什么..."), "今天一起散步，很开心");
    fireEvent.press(screen.getByRole("button", { name: "保存日记" }));

    expect(await screen.findByText(/✓ 已保存/)).toBeOnTheScreen();
    expect(screen.getByText("一起散步")).toBeOnTheScreen();
    expect(screen.getByText("今天一起散步，很开心")).toBeOnTheScreen();
    expect(screen.getByText("日记档案")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("搜索日记")).toBeOnTheScreen();
    expect(screen.queryByText("共享")).toBeNull();
    expect(screen.queryByText(/最后由/)).toBeNull();
    expect(screen.queryByText("还没有日记")).toBeNull();
  });

  it("opens love selectors as anchored dropdowns instead of a bottom sheet", async () => {
    render(<AppShell initialRoute="/love" />);

    expect(await screen.findByText("❤️ 已绑定")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "发布恋爱日记" }));
    fireEvent.press(screen.getByRole("button", { name: "选择日记心情" }));

    expect(screen.getByTestId("love-dropdown-popover")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "选择选择心情：🥰 甜蜜" })).toBeOnTheScreen();
    expect(screen.queryByTestId("love-choice-bottom-sheet")).toBeNull();
  });

  it("opens the diary composer from a floating publish button", async () => {
    render(<AppShell initialRoute="/love" />);

    expect(await screen.findByRole("button", { name: "发布恋爱日记" })).toBeOnTheScreen();
    expect(screen.queryByText("写日记")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "发布恋爱日记" }));

    expect(screen.getByText("写日记")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("标题，例如：一起吃饭")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("今天发生了什么...")).toBeOnTheScreen();
  });

  it("keeps archive filters and diary history inside one compact archive area", async () => {
    render(<AppShell initialRoute="/love" />);

    fireEvent.press(await screen.findByRole("button", { name: "发布恋爱日记" }));
    fireEvent.changeText(screen.getByPlaceholderText("标题，例如：一起吃饭"), "一起散步");
    fireEvent.changeText(screen.getByPlaceholderText("今天发生了什么..."), "今天一起散步，很开心");
    fireEvent.press(screen.getByRole("button", { name: "保存日记" }));

    expect(await screen.findByText(/✓ 已保存/)).toBeOnTheScreen();
    const archive = screen.getByTestId("love-diary-archive-card");
    expect(within(archive).getByText("日记档案")).toBeOnTheScreen();
    expect(within(archive).getAllByText("我").length).toBeGreaterThan(0);
    expect(within(archive).getAllByText("评论 0").length).toBeGreaterThan(0);
    for (const label of ["日期", "类型", "文件夹", "排序"]) {
      expect(within(archive).getByText(label)).toBeOnTheScreen();
    }
    expect(within(archive).getAllByText("一起散步").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("love-diary-history-wrapper")).toBeNull();
  });

  it("exports reusable polished UI primitives", () => {
    render(
      <ContentCard tokens={tokens}>
        <PageHeader subtitle="副标题" title="标题" tokens={tokens} />
        <StatCard label="统计" value="12" tokens={tokens} />
        <ActionChip label="chip" selected tokens={tokens} />
        <SegmentedTabs options={["A", "B"]} selected="A" tokens={tokens} />
        <EmptyState description="empty" title="空状态" tokens={tokens} />
        <InlineError message="错误" tokens={tokens} />
        <PrimaryButton label="主按钮" tokens={tokens} />
        <SecondaryButton label="次按钮" tokens={tokens} />
        <FloatingQuickAction label="浮动按钮" tokens={tokens} />
      </ContentCard>
    );

    for (const text of ["标题", "统计", "chip", "空状态", "错误"]) {
      expect(screen.getByText(text)).toBeOnTheScreen();
    }
    for (const name of ["主按钮", "次按钮", "浮动按钮"]) {
      expect(screen.getByRole("button", { name })).toBeOnTheScreen();
    }
  });
});
