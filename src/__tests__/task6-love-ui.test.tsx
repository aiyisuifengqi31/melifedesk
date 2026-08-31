import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";

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

jest.mock("@/features/love/loveDiaryComments", () => ({
  deleteDiaryCommentFromCloud: jest.fn(async () => undefined),
  loadDiaryCommentsFromCloud: jest.fn(async () => []),
  saveDiaryCommentToCloud: jest.fn(async () => undefined)
}));

jest.mock("@/features/love/loveDiaryLikes", () => ({
  loadDiaryLikesFromCloud: jest.fn(async () => ({})),
  toggleDiaryLikeInCloud: jest.fn(async (_diaryId: string, liked: boolean) => !liked)
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
    expect(screen.getAllByText("日记本").length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getAllByText("日记本").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("🔍 搜索日记")).toBeOnTheScreen();
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
    expect(screen.getByTestId("love-dropdown-motion")).toBeOnTheScreen();
    expect(screen.getByTestId("love-dropdown-popover")).toHaveStyle({ zIndex: 10070 });
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

  it("uses a centered diary modal and closes it when switching love tabs", async () => {
    render(<AppShell initialRoute="/love" />);

    fireEvent.press(await screen.findByRole("button", { name: "发布恋爱日记" }));

    expect(screen.getByTestId("love-diary-composer-modal")).toBeOnTheScreen();
    expect(screen.getByTestId("love-diary-composer-motion")).toBeOnTheScreen();
    expect(screen.queryByTestId("love-diary-composer-sheet")).toBeNull();
    expect(screen.queryByTestId("love-composer-handle")).toBeNull();

    fireEvent.changeText(screen.getByTestId("love-diary-title-input"), "没写完的标题");
    fireEvent.press(screen.getByTestId("secondary-tab-gifts"));

    await waitFor(() => expect(screen.queryByTestId("love-diary-composer-modal")).toBeNull());
    expect(screen.queryByRole("button", { name: "发布恋爱日记" })).toBeNull();

    fireEvent.press(screen.getByTestId("secondary-tab-diary"));
    expect(await screen.findByRole("button", { name: "发布恋爱日记" })).toBeOnTheScreen();
  });

  it("keeps the diary modal open while editing fields and uses the compact content-image layout", async () => {
    render(<AppShell initialRoute="/love" />);

    fireEvent.press(await screen.findByRole("button", { name: "发布恋爱日记" }));

    fireEvent.press(screen.getByTestId("love-diary-composer-modal"));
    fireEvent.press(screen.getByTestId("love-diary-title-input"));
    fireEvent.changeText(screen.getByTestId("love-diary-title-input"), "不会误关闭");
    fireEvent.press(screen.getByTestId("love-diary-content-input"));
    fireEvent.changeText(screen.getByTestId("love-diary-content-input"), "正文可以输入");

    expect(screen.getByTestId("love-diary-composer-modal")).toBeOnTheScreen();
    expect(screen.getByTestId("love-diary-title-input").props.value).toBe("不会误关闭");
    expect(screen.getByTestId("love-diary-content-input").props.value).toBe("正文可以输入");
    expect(screen.getByTestId("love-diary-content-image-row")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "上传图片" })).toHaveStyle({ alignSelf: "flex-start", height: 52 });
    expect(screen.getByTestId("love-diary-save-row")).toBeOnTheScreen();
  });

  it("closes the diary composer only after a successful save", async () => {
    render(<AppShell initialRoute="/love" />);

    fireEvent.press(await screen.findByRole("button", { name: "发布恋爱日记" }));
    fireEvent.changeText(screen.getByTestId("love-diary-title-input"), "保存后关闭");
    fireEvent.changeText(screen.getByTestId("love-diary-content-input"), "真正保存成功以后再关闭弹窗");
    fireEvent.press(screen.getByRole("button", { name: "保存日记" }));

    expect(await screen.findByText(/✓ 已保存/)).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByTestId("love-diary-composer-modal")).toBeNull());
    expect(screen.getByText("保存后关闭")).toBeOnTheScreen();
  });

  it("keeps the diary publish fab fixed to the viewport", async () => {
    render(<AppShell initialRoute="/love" />);

    expect(await screen.findByRole("button", { name: "发布恋爱日记" })).toHaveStyle({
      bottom: "calc(94px + env(safe-area-inset-bottom, 0px))",
      position: "fixed"
    } as never);
  });

  it("opens a compact diary action dropdown without closing immediately", async () => {
    render(<AppShell initialRoute="/love" />);

    fireEvent.press(await screen.findByRole("button", { name: "发布恋爱日记" }));
    fireEvent.changeText(screen.getByTestId("love-diary-title-input"), "菜单不会闪退");
    fireEvent.changeText(screen.getByTestId("love-diary-content-input"), "右上角菜单可以稳定点击");
    fireEvent.press(screen.getByRole("button", { name: "保存日记" }));

    expect(await screen.findByText(/✓ 已保存/)).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByTestId("love-diary-composer-modal")).toBeNull());
    fireEvent.press(screen.getByRole("button", { name: "打开日记菜单：菜单不会闪退" }));

    expect(screen.getByTestId("love-diary-action-menu")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "编辑日记：菜单不会闪退" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "移动日记：菜单不会闪退" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "删除日记：菜单不会闪退" })).toBeOnTheScreen();
  });

  it("keeps archive filters and diary history inside one compact archive area", async () => {
    render(<AppShell initialRoute="/love" />);

    fireEvent.press(await screen.findByRole("button", { name: "发布恋爱日记" }));
    fireEvent.changeText(screen.getByPlaceholderText("标题，例如：一起吃饭"), "一起散步");
    fireEvent.changeText(screen.getByPlaceholderText("今天发生了什么..."), "今天一起散步，很开心");
    fireEvent.press(screen.getByRole("button", { name: "保存日记" }));

    expect(await screen.findByText(/✓ 已保存/)).toBeOnTheScreen();
    const archive = screen.getByTestId("love-diary-archive-card");
    expect(within(archive).getByText("日记本")).toBeOnTheScreen();
    expect(within(archive).getAllByText("我").length).toBeGreaterThan(0);
    expect(within(archive).getAllByRole("button", { name: /评论 0/ }).length).toBeGreaterThan(0);
    for (const label of ["时间", "类型", "文件夹", "作者"]) {
      expect(within(archive).getByText(label)).toBeOnTheScreen();
    }
    expect(within(archive).queryByText("日期")).toBeNull();
    expect(within(archive).queryByText("排序")).toBeNull();
    expect(within(archive).getAllByText("一起散步").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("love-diary-history-wrapper")).toBeNull();
  });

  it("toggles diary likes directly from the story card", async () => {
    render(<AppShell initialRoute="/love" />);

    fireEvent.press(await screen.findByRole("button", { name: "发布恋爱日记" }));
    fireEvent.changeText(screen.getByPlaceholderText("标题，例如：一起吃饭"), "一起看电影");
    fireEvent.changeText(screen.getByPlaceholderText("今天发生了什么..."), "电影很好看");
    fireEvent.press(screen.getByRole("button", { name: "保存日记" }));

    const likeButton = (await screen.findAllByRole("button", { name: /喜欢 0/ }))[0];
    fireEvent.press(likeButton);

    expect(await screen.findByRole("button", { name: /已喜欢 1/ })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: /已喜欢 1/ }));
    expect((await screen.findAllByRole("button", { name: /喜欢 0/ })).length).toBeGreaterThan(0);
  });

  it("opens an inline bottom comment composer instead of the old diary comment modal", async () => {
    render(<AppShell initialRoute="/love" />);

    fireEvent.press(await screen.findByRole("button", { name: "发布恋爱日记" }));
    fireEvent.changeText(screen.getByPlaceholderText("标题，例如：一起吃饭"), "一起吃火锅");
    fireEvent.changeText(screen.getByPlaceholderText("今天发生了什么..."), "辣锅很好吃");
    fireEvent.press(screen.getByRole("button", { name: "保存日记" }));

    fireEvent.press((await screen.findAllByRole("button", { name: /评论 0/ }))[0]);

    expect(screen.getByTestId("love-inline-comment-composer")).toBeOnTheScreen();
    expect(screen.getByTestId("love-inline-comment-motion")).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByTestId("secondary-floating-tabs")).toBeNull());
    expect(screen.queryByRole("button", { name: "发布恋爱日记" })).toBeNull();
    expect(screen.getByPlaceholderText("说点什么吧…")).toBeOnTheScreen();
    expect(screen.queryByText("还没有评论，写下第一句回应。")).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText("说点什么吧…"), "下次还去");
    fireEvent.press(screen.getByRole("button", { name: "发送评论" }));

    expect(await screen.findByText("下次还去")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /评论 1/ })).toBeOnTheScreen();
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
