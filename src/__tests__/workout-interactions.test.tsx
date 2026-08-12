import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { WorkoutPanel } from "@/features/workout/WorkoutPanel";
import { loadLoveSharedValue, saveLoveSharedValue } from "@/features/love/loveSharedCloud";
import { addWorkoutPart, createWorkoutSession, listPartnerWorkoutSessions } from "@/features/workout/workoutRepository";
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
const mockRpc = jest.fn(async (name: string) => {
  if (name === "current_active_partner_id") return { data: "user-b", error: null };
  if (name === "current_active_couple_id") return { data: "couple-1", error: null };
  return { data: null, error: null };
});

jest.mock("@/auth/supabaseClient", () => ({
  getSupabaseClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: "user-a", user_metadata: { display_name: "王凡" } } }, error: null }))
    },
    rpc: mockRpc,
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(async () => ({ data: { id: "remote-workout-1" }, error: null }))
        }))
      }))
    }))
  }))
}));

jest.mock("@/features/sync/cloudSync", () => ({
  hydrateFromCloud: jest.fn(async (_key: string, fallback: unknown) => fallback),
  saveCloudValue: jest.fn(async () => undefined)
}));

jest.mock("@/features/love/loveSharedCloud", () => ({
  loadLoveSharedValue: jest.fn(async (_key: string, fallback: unknown) => fallback),
  saveLoveSharedValue: jest.fn(async () => undefined)
}));

jest.mock("@/features/workout/workoutRepository", () => {
  const actual = jest.requireActual("@/features/workout/workoutRepository");
  return {
    ...actual,
    addWorkoutPart: jest.fn(async () => ({ data: { id: "part-1" }, error: null })),
    createWorkoutSession: jest.fn(async () => ({ data: { id: "remote-workout-1" }, error: null })),
    listPartnerWorkoutSessions: jest.fn(async () => ({
      data: [
        {
          duration_minutes: 40,
          id: "partner-session-1",
          intensity: "moderate",
          session_date: "2026-08-10",
          title: "肩",
          workout_parts: [{ part: "肩" }]
        },
        {
          duration_minutes: 30,
          id: "partner-session-2",
          intensity: "moderate",
          session_date: "2026-08-11",
          title: "有氧",
          workout_parts: [{ part: "有氧" }]
        }
      ],
      error: null
    })),
    softDeleteWorkoutSession: jest.fn(async () => ({ data: "remote-workout-1", error: null }))
  };
});

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
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockImplementation(async (name: string) => {
      if (name === "current_active_partner_id") return { data: "user-b", error: null };
      if (name === "current_active_couple_id") return { data: "couple-1", error: null };
      return { data: null, error: null };
    });
  });

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

  it("shows partner workout stats as read-only without body data or write actions", async () => {
    render(<WorkoutPanel storage={makeStorage()} />);

    expect(await screen.findByRole("button", { name: "查看TA的运动" })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "查看TA的运动" }));

    expect(await screen.findByText("🔒 TA的运动数据 · 只读")).toBeOnTheScreen();
    expect(listPartnerWorkoutSessions).toHaveBeenCalledWith(expect.anything(), "user-b");
    expect(screen.getByText("本周运动")).toBeOnTheScreen();
    expect(screen.getByText("2 次")).toBeOnTheScreen();
    expect(screen.getByText("70 分钟")).toBeOnTheScreen();
    expect(screen.getAllByText("08/10").length).toBeGreaterThan(0);
    expect(screen.getByText("训练分布")).toBeOnTheScreen();
    expect(screen.getAllByText("最近训练").length).toBeGreaterThan(0);

    expect(screen.queryByText("身体记录")).toBeNull();
    expect(screen.queryByText("记录训练")).toBeNull();
    expect(screen.queryByPlaceholderText("体重")).toBeNull();
    expect(screen.queryByPlaceholderText("体脂率")).toBeNull();
    expect(screen.queryByRole("button", { name: "保存身体数据" })).toBeNull();
    expect(screen.queryByRole("button", { name: "保存记录" })).toBeNull();
    expect(screen.queryByText("体脂")).toBeNull();
    expect(screen.queryByText("体重")).toBeNull();
    expect(screen.queryByText("•••")).toBeNull();
  });

  it("keeps the partner tab visible while partnership is still resolving", () => {
    mockRpc.mockImplementation(() => new Promise(() => undefined));

    render(<WorkoutPanel storage={makeStorage()} />);

    expect(screen.getByRole("button", { name: /我的运动/ })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /TA/ })).toBeOnTheScreen();
  });

  it("keeps existing partner workouts visible while refreshing them", async () => {
    let resolveSecondLoad: (value: unknown) => void = () => undefined;
    (listPartnerWorkoutSessions as jest.Mock)
      .mockResolvedValueOnce({
        data: [
          {
            duration_minutes: 40,
            id: "partner-visible-session",
            intensity: "moderate",
            session_date: "2026-08-10",
            title: "肩",
            workout_parts: [{ part: "肩" }]
          }
        ],
        error: null
      })
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveSecondLoad = resolve;
      }));

    render(<WorkoutPanel storage={makeStorage()} />);
    fireEvent.press(await screen.findByRole("button", { name: /TA/ }));

    expect(await screen.findByText("本周运动")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "查看TA的运动" }));

    expect(screen.getByText("本周运动")).toBeOnTheScreen();
    expect(screen.queryByText("正在加载TA的运动数据…")).toBeNull();
    resolveSecondLoad({ data: [], error: null });
  });

  it("shows cached partner workouts immediately before the refresh finishes", async () => {
    let resolveLoad: (value: unknown) => void = () => undefined;
    const storage = makeStorage();
    storage.setItem("fanfan-guanguan.workouts.partner-cache.user-b", JSON.stringify([
      {
        createTime: "2026-08-10T08:00:00.000Z",
        durationMinutes: 55,
        id: "cached-partner-workout",
        intensity: "moderate",
        kcal: 0,
        kcalSource: "manual",
        parts: ["背"],
        sessionDate: "2026-08-10",
        status: "trained",
        title: "背"
      }
    ]));
    (listPartnerWorkoutSessions as jest.Mock).mockReturnValueOnce(new Promise((resolve) => {
      resolveLoad = resolve;
    }));
    (loadLoveSharedValue as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));

    render(<WorkoutPanel storage={storage} />);
    fireEvent.press(await screen.findByRole("button", { name: /TA/ }));

    expect(screen.getByText("本周运动")).toBeOnTheScreen();
    expect(screen.getByText("55 分钟")).toBeOnTheScreen();
    expect(screen.queryByText("正在加载TA的运动数据…")).toBeNull();
    resolveLoad({ data: [], error: null });
  });

  it("allows opening the partner tab from the cached partner id before binding RPC finishes", () => {
    const storage = makeStorage();
    storage.setItem("fanfan-guanguan.workouts.partner-user.v1", "user-b");
    storage.setItem("fanfan-guanguan.workouts.partner-cache.user-b", JSON.stringify([
      {
        createTime: "2026-08-10T08:00:00.000Z",
        durationMinutes: 35,
        id: "cached-before-rpc",
        intensity: "moderate",
        kcal: 0,
        kcalSource: "manual",
        parts: ["肩"],
        sessionDate: "2026-08-10",
        status: "trained",
        title: "肩"
      }
    ]));
    mockRpc.mockImplementation(() => new Promise(() => undefined));

    render(<WorkoutPanel storage={storage} />);
    fireEvent.press(screen.getByRole("button", { name: "查看TA的运动" }));

    expect(screen.getByText("本周运动")).toBeOnTheScreen();
    expect(screen.getByText("35 分钟")).toBeOnTheScreen();
  });

  it("uploads unsynced local workouts as couple-readable sessions when the user is bound", async () => {
    const storage = makeStorage();
    const localOnlyLog: WorkoutLog = {
      createTime: "2026-08-11T08:00:00.000Z",
      durationMinutes: 25,
      id: "local-only-workout",
      intensity: "moderate",
      kcal: 0,
      kcalSource: "manual",
      parts: ["有氧"],
      sessionDate: "2026-08-11",
      status: "trained",
      title: "有氧"
    };
    saveLocalWorkouts([localOnlyLog], storage);

    render(<WorkoutPanel storage={storage} />);

    await waitFor(() =>
      expect(createWorkoutSession).toHaveBeenCalledWith(
        expect.anything(),
        "user-a",
        expect.objectContaining({
          coupleId: "couple-1",
          durationMinutes: 25,
          sessionDate: "2026-08-11",
          title: "有氧",
          visibility: "couple_read"
        })
      )
    );
    expect(addWorkoutPart).toHaveBeenCalledWith(expect.anything(), "remote-workout-1", "有氧");
    await waitFor(() => expect(loadLocalWorkouts(storage)[0].remoteId).toBe("remote-workout-1"));
  });

  it("stores own workouts in the couple shared state and reads partner workouts from it", async () => {
    const storage = makeStorage();
    const ownLog: WorkoutLog = {
      createTime: "2026-08-11T08:00:00.000Z",
      durationMinutes: 35,
      id: "own-shared-workout",
      intensity: "moderate",
      kcal: 0,
      kcalSource: "manual",
      parts: ["背"],
      sessionDate: "2026-08-11",
      status: "trained",
      title: "背"
    };
    const partnerSharedLog: WorkoutLog = {
      createTime: "2026-08-10T08:00:00.000Z",
      durationMinutes: 45,
      id: "partner-shared-workout",
      intensity: "moderate",
      kcal: 0,
      kcalSource: "manual",
      parts: ["肩"],
      sessionDate: "2026-08-10",
      status: "trained",
      title: "肩"
    };
    saveLocalWorkouts([ownLog], storage);
    (listPartnerWorkoutSessions as jest.Mock).mockResolvedValueOnce({ data: [], error: null });
    (loadLoveSharedValue as jest.Mock).mockImplementation(async (key: string, fallback: unknown) =>
      key === "fanfan-guanguan.workouts.shared.user-b" ? [partnerSharedLog] : fallback
    );

    render(<WorkoutPanel storage={storage} />);

    await waitFor(() =>
      expect(saveLoveSharedValue).toHaveBeenCalledWith(
        "fanfan-guanguan.workouts.shared.user-a",
        expect.arrayContaining([expect.objectContaining({ id: "own-shared-workout", title: "背" })]),
        expect.anything()
      )
    );
    fireEvent.press(await screen.findByRole("button", { name: "查看TA的运动" }));

    await waitFor(() => expect(screen.getAllByText("08/10").length).toBeGreaterThan(1));
  });

  it("reloads partner workouts from couple shared state when opening the partner tab", async () => {
    const storage = makeStorage();
    const partnerSharedLog: WorkoutLog = {
      createTime: "2026-08-11T08:00:00.000Z",
      durationMinutes: 80,
      id: "partner-late-shared-workout",
      intensity: "moderate",
      kcal: 0,
      kcalSource: "manual",
      parts: ["胸"],
      sessionDate: "2026-08-11",
      status: "trained",
      title: "胸"
    };
    let sharedReady = false;
    (listPartnerWorkoutSessions as jest.Mock).mockResolvedValue({ data: [], error: null });
    (loadLoveSharedValue as jest.Mock).mockImplementation(async (key: string, fallback: unknown) =>
      sharedReady && key === "fanfan-guanguan.workouts.shared.user-b" ? [partnerSharedLog] : fallback
    );

    render(<WorkoutPanel storage={storage} />);

    sharedReady = true;
    fireEvent.press(await screen.findByRole("button", { name: "查看TA的运动" }));

    expect(await screen.findByText("80 分钟")).toBeOnTheScreen();
  });
});
