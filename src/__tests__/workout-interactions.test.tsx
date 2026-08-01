import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { WorkoutPanel } from "@/features/workout/WorkoutPanel";
import { loadLocalWorkouts, saveLocalWorkouts, type WorkoutLog } from "@/features/workout/workoutStorage";

const storageKey = "fanfan-guanguan.workouts.v1";

function makeStorage() {
  const data = new Map<string, string>();

  return {
    clear: () => data.clear(),
    getItem: jest.fn((key: string) => data.get(key) ?? null),
    removeItem: jest.fn((key: string) => data.delete(key)),
    setItem: jest.fn((key: string, value: string) => {
      data.set(key, value);
    })
  };
}

describe("workout storage", () => {
  it("saves and loads workout logs from localStorage-compatible storage", () => {
    const storage = makeStorage();
    const log: WorkoutLog = {
      createTime: "2026-07-31T09:00:00.000Z",
      durationMinutes: 10,
      feeling: "轻松",
      id: "workout-1",
      intensity: "moderate",
      kcal: 200,
      kcalSource: "manual",
      notes: "",
      parts: ["背"],
      sessionDate: "2026-07-31",
      status: "trained",
      title: "背部训练"
    };

    saveLocalWorkouts([log], storage);

    expect(storage.setItem).toHaveBeenCalledWith(storageKey, JSON.stringify([log]));
    expect(loadLocalWorkouts(storage)).toEqual([log]);
  });
});

describe("WorkoutPanel interactions", () => {
  it("creates, persists, and deletes a real workout log", async () => {
    const storage = makeStorage();
    const { rerender } = render(<WorkoutPanel storage={storage} />);

    fireEvent.press(screen.getByRole("button", { name: "选择背" }));
    fireEvent.press(screen.getByRole("button", { name: "选择背" }));
    fireEvent.changeText(screen.getByPlaceholderText("训练项目"), "背部训练");
    fireEvent.changeText(screen.getByPlaceholderText("训练时长"), "10");
    fireEvent.changeText(screen.getByPlaceholderText("消耗热量"), "200");
    fireEvent.press(screen.getByRole("button", { name: "高强度" }));
    fireEvent.press(screen.getByRole("button", { name: "保存记录" }));

    expect(await screen.findByText("背部训练")).toBeOnTheScreen();
    expect(screen.getByText("10分钟 · 200千卡 · 高强度")).toBeOnTheScreen();
    expect(screen.getByText("训练记录已保存。")).toBeOnTheScreen();

    rerender(<WorkoutPanel storage={storage} />);
    expect(await screen.findByText("背部训练")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "删除训练记录：背部训练" }));
    await waitFor(() => expect(screen.queryByText("背部训练")).toBeNull());
    expect(screen.getByText("训练记录已删除。")).toBeOnTheScreen();
  });
});
