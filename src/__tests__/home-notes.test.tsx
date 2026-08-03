import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { UiTokens } from "@/shared/ui/primitives";

import { HomePanel } from "@/features/home/HomePanel";
import { loadNotes, saveNotes, type NoteItem } from "@/features/home/notesStorage";

const testTokens: UiTokens = {
  accent: "#7cb87c",
  accentSoft: "#e2f2e2",
  background: "#f0f7f0",
  border: "#d8e8d8",
  surface: "#ffffff",
  surfaceMuted: "#f6faf6",
  text: "#1f2937",
  textMuted: "#6b7c6b"
};

function makeNote(id: string, title: string): NoteItem {
  return {
    category: "生活",
    content: `${title} 的正文内容`,
    createTime: "2026-08-02T08:00:00.000Z",
    id,
    title
  };
}

function makeStorage() {
  const data = new Map<string, string>();

  return {
    getItem: jest.fn((key: string) => data.get(key) ?? null),
    removeItem: jest.fn((key: string) => data.delete(key)),
    setItem: jest.fn((key: string, value: string) => {
      data.set(key, value);
    })
  };
}

describe("HomePanel notes", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: makeStorage()
    });
    Object.defineProperty(window, "confirm", {
      configurable: true,
      value: jest.fn()
    });
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps home notes compact as a quick entry and opens the full notes page", async () => {
    saveNotes([makeNote("1", "买菜清单"), makeNote("2", "周末安排"), makeNote("3", "读书摘记"), makeNote("4", "旅行备忘")], window.localStorage);

    render(<HomePanel themeTokens={testTokens} />);

    expect(screen.getByTestId("home-notes-quick-entry")).toBeOnTheScreen();
    expect(screen.getByText("已有 4 条")).toBeOnTheScreen();
    expect(screen.queryByText("买菜清单")).toBeNull();
    expect(screen.queryByRole("button", { name: "删除备忘：周末安排" })).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "快速记一条备忘" }));

    await waitFor(() => expect(screen.getByText("买菜清单")).toBeOnTheScreen());
    expect(loadNotes(window.localStorage).map((note) => note.title)).toEqual(["买菜清单", "周末安排", "读书摘记", "旅行备忘"]);
  });
});
