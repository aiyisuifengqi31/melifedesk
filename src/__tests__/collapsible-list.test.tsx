import { fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text, View } from "react-native";

import { CollapsibleSectionFooter, DEFAULT_COLLAPSED_COUNT, ShowMoreButton, sortByNewest, useCollapsibleList } from "@/shared/ui/CollapsibleList";

describe("sortByNewest", () => {
  it("puts newest-first by a single key", () => {
    const items = [
      { id: "a", date: "2024-01-01" },
      { id: "b", date: "2024-03-01" },
      { id: "c", date: "2024-02-01" }
    ];
    expect(sortByNewest(items, (item) => item.date).map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("compares multiple keys in priority order", () => {
    const items = [
      { id: "a", date: "2024-01-01", createTime: "10:00" },
      { id: "b", date: "2024-01-01", createTime: "09:00" },
      { id: "c", date: "2024-02-01", createTime: "08:00" }
    ];
    expect(sortByNewest(items, (item) => [item.date, item.createTime]).map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("is stable for equal keys (preserves original order)", () => {
    const items = [
      { id: "a", date: "2024-01-01" },
      { id: "b", date: "2024-01-01" },
      { id: "c", date: "2024-01-01" }
    ];
    expect(sortByNewest(items, (item) => item.date).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const items = [
      { id: "a", date: "2024-01-01" },
      { id: "b", date: "2024-03-01" }
    ];
    const snapshot = JSON.stringify(items);
    sortByNewest(items, (item) => item.date);
    expect(JSON.stringify(items)).toEqual(snapshot);
  });
});

type HarnessProps = {
  collapsedCount?: number;
  items: { id: string }[];
};

function Harness({ collapsedCount, items }: HarnessProps) {
  const list = useCollapsibleList(items, collapsedCount);
  return (
    <View>
      <Text testID="total">{String(list.total)}</Text>
      <Text testID="visible">{String(list.visibleItems.length)}</Text>
      <Text testID="canExpand">{String(list.canExpand)}</Text>
      <Text testID="hidden">{String(list.hiddenCount)}</Text>
      <Text testID="expanded">{String(list.expanded)}</Text>
      <Pressable accessibilityRole="button" onPress={list.toggle} testID="toggle">
        <Text>toggle</Text>
      </Pressable>
    </View>
  );
}

describe("useCollapsibleList", () => {
  it("defaults to showing 3 items and exposes total/canExpand/hiddenCount", () => {
    const items = Array.from({ length: 6 }, (_, index) => ({ id: String(index) }));
    render(<Harness items={items} />);
    expect(screen.getByTestId("total").props.children).toBe("6");
    expect(screen.getByTestId("visible").props.children).toBe("3");
    expect(screen.getByTestId("canExpand").props.children).toBe("true");
    expect(screen.getByTestId("hidden").props.children).toBe("3");
    expect(screen.getByTestId("expanded").props.children).toBe("false");
  });

  it("does not offer expand when total is at or below the collapsed count", () => {
    const items = Array.from({ length: 3 }, (_, index) => ({ id: String(index) }));
    render(<Harness items={items} />);
    expect(screen.getByTestId("canExpand").props.children).toBe("false");
    expect(screen.getByTestId("visible").props.children).toBe("3");
  });

  it("expands to show all items after toggle, collapses back on second toggle", () => {
    const items = Array.from({ length: 5 }, (_, index) => ({ id: String(index) }));
    render(<Harness items={items} />);
    fireEvent.press(screen.getByTestId("toggle"));
    expect(screen.getByTestId("expanded").props.children).toBe("true");
    expect(screen.getByTestId("visible").props.children).toBe("5");
    fireEvent.press(screen.getByTestId("toggle"));
    expect(screen.getByTestId("expanded").props.children).toBe("false");
    expect(screen.getByTestId("visible").props.children).toBe(String(DEFAULT_COLLAPSED_COUNT));
  });

  it("honors a custom collapsed count", () => {
    const items = Array.from({ length: 10 }, (_, index) => ({ id: String(index) }));
    render(<Harness collapsedCount={2} items={items} />);
    expect(screen.getByTestId("visible").props.children).toBe("2");
  });
});

describe("ShowMoreButton", () => {
  it("renders the collapsed label with hidden count and unit '条'", () => {
    render(<ShowMoreButton expanded={false} hiddenCount={4} name="日记" onPress={() => {}} testID="x-show-more" />);
    expect(screen.getByTestId("x-show-more")).toBeOnTheScreen();
    expect(screen.getByText(/查看更多 4 条/)).toBeOnTheScreen();
  });

  it("renders the expanded label", () => {
    render(<ShowMoreButton expanded hiddenCount={0} name="日记" onPress={() => {}} testID="x-show-more" />);
    expect(screen.getByText(/收起/)).toBeOnTheScreen();
  });

  it("uses a custom unit", () => {
    render(<ShowMoreButton expanded={false} hiddenCount={2} name="照片墙月份" unit="个月" onPress={() => {}} testID="x-show-more" />);
    expect(screen.getByText(/查看更多 2 个月/)).toBeOnTheScreen();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    render(<ShowMoreButton expanded={false} hiddenCount={2} name="日记" onPress={onPress} testID="x-show-more" />);
    fireEvent.press(screen.getByTestId("x-show-more"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("CollapsibleSectionFooter", () => {
  it("renders nothing when not visible", () => {
    const { queryByTestId } = render(
      <CollapsibleSectionFooter expanded={false} hiddenCount={3} name="日记" onPress={() => {}} testID="x-show-more" visible={false} />
    );
    expect(queryByTestId("x-show-more")).toBeNull();
  });

  it("renders the button when visible", () => {
    render(
      <CollapsibleSectionFooter expanded={false} hiddenCount={3} name="日记" onPress={() => {}} testID="x-show-more" visible />
    );
    expect(screen.getByTestId("x-show-more")).toBeOnTheScreen();
  });
});
