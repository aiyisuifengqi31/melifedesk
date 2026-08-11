import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { WorkoutPanel } from "@/features/workout/WorkoutPanel";
import {
  BODY_METRIC_STORAGE_KEY,
  loadLocalBodyMetrics,
  loadLocalWorkouts,
  saveLocalBodyMetrics,
  saveLocalWorkouts,
  type BodyMetricLog,
  type WorkoutLog
} from "@/features/workout/workoutStorage";

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

  it("saves and loads body metrics from localStorage-compatible storage", () => {
    const storage = makeStorage();
    const first: BodyMetricLog = {
      bodyFatPercent: 18.6,
      createTime: "2026-08-10T09:00:00.000Z",
      id: "body-1",
      recordDate: "2026-08-10",
      updateTime: "2026-08-10T09:00:00.000Z",
      weightKg: 72.4
    };
    const second: BodyMetricLog = {
      bodyFatPercent: null,
      createTime: "2026-08-11T09:00:00.000Z",
      id: "body-2",
      recordDate: "2026-08-11",
      updateTime: "2026-08-11T09:00:00.000Z",
      weightKg: 72.2
    };

    saveLocalBodyMetrics([first, second], storage);

    expect(storage.setItem).toHaveBeenCalledWith(BODY_METRIC_STORAGE_KEY, JSON.stringify([second, first]));
    expect(loadLocalBodyMetrics(storage)).toEqual([second, first]);
  });
});

describe("WorkoutPanel interactions", () => {
  it("does not render removed feeling or notes fields", () => {
    render(<WorkoutPanel storage={makeStorage()} />);

    expect(screen.queryByPlaceholderText("自我感受")).toBeNull();
    expect(screen.queryByPlaceholderText("备注")).toBeNull();
    expect(screen.getByRole("button", { name: "选择训练部位" })).toHaveStyle({
      flexDirection: "row"
    });
    expect(screen.queryByText("最近30天")).toBeNull();
    expect(screen.queryByText("连续训练")).toBeNull();
    expect(screen.queryByText("高频部位")).toBeNull();
  });

  it("creates, persists, and deletes a real workout log", async () => {
    const storage = makeStorage();
    const { rerender } = render(<WorkoutPanel storage={storage} />);

    fireEvent.press(screen.getByRole("button", { name: "选择训练部位" }));
    fireEvent.press(screen.getByRole("button", { name: "选择训练部位：背" }));
    fireEvent.press(screen.getByRole("button", { name: "保存记录" }));

    expect(await screen.findAllByText("40分钟")).toHaveLength(2);
    expect(screen.getByText("✓ 已记录：背 · 40分钟")).toBeOnTheScreen();

    rerender(<WorkoutPanel storage={storage} />);
    expect(await screen.findAllByText("40分钟")).toHaveLength(2);

    fireEvent.press(screen.getByRole("button", { name: "打开训练记录菜单：背" }));
    fireEvent.press(screen.getByRole("button", { name: "删除训练记录：背" }));
    await waitFor(() => expect(screen.queryAllByText("40分钟")).toHaveLength(1));
    expect(screen.getByText("训练记录已删除。")).toBeOnTheScreen();
  });

  it("records body metrics, persists the latest weight, and switches data trends", async () => {
    const storage = makeStorage();
    const { rerender } = render(<WorkoutPanel storage={storage} />);

    fireEvent.changeText(screen.getByPlaceholderText("体重"), "72.4");
    fireEvent.changeText(screen.getByPlaceholderText("体脂率"), "18.6");
    fireEvent.press(screen.getByRole("button", { name: "保存身体数据" }));

    expect(await screen.findByText("✓ 身体数据已记录")).toBeOnTheScreen();
    expect(screen.getByText("72.4 kg")).toBeOnTheScreen();

    rerender(<WorkoutPanel storage={storage} />);
    expect(screen.getByText("72.4 kg")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "查看体重趋势" }));
    expect(screen.getByText("最新 72.4kg")).toBeOnTheScreen();
    expect(screen.getByText("较区间开始 0kg")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "查看体脂趋势" }));
    expect(screen.getByText("最新 18.6%")).toBeOnTheScreen();
  });
});
