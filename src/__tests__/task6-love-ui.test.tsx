import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppShell } from "@/components/AppShell";
import { ActionChip, ContentCard, EmptyState, FloatingQuickAction, InlineError, PageHeader, PrimaryButton, SecondaryButton, SegmentedTabs, StatCard } from "@/shared/ui/primitives";

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
  it("renders the love diary workspace areas and disclaimer", () => {
    render(<AppShell initialRoute="/love" />);

    expect(screen.getAllByText("恋爱日记").length).toBeGreaterThan(0);
    expect(screen.getByText("记录每一个甜蜜瞬间")).toBeOnTheScreen();
    expect(screen.getAllByText("日记").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("纪念日").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("生理周期")).toBeNull();
    expect(screen.getByText("写日记")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("今天发生了什么...")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "仅自己可见" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "双方可见" })).toBeOnTheScreen();
  });

  it("saves a diary with private or shared visibility", () => {
    render(<AppShell initialRoute="/love" />);

    fireEvent.changeText(screen.getByPlaceholderText("今天发生了什么..."), "今天一起散步，很开心");
    fireEvent.press(screen.getByRole("button", { name: "选择心情：甜蜜" }));
    fireEvent.press(screen.getByRole("button", { name: "双方可见" }));
    fireEvent.press(screen.getByRole("button", { name: "保存日记" }));

    expect(screen.getByText("日记已保存。")).toBeOnTheScreen();
    expect(screen.getByText("今天一起散步，很开心")).toBeOnTheScreen();
    expect(screen.getAllByText("双方可见").length).toBeGreaterThan(1);
    expect(screen.queryByText("还没有日记")).toBeNull();
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
