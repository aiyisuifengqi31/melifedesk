import {
  hydrateLoveSharedValue,
  saveLoveSharedValue
} from "@/features/love/loveSharedCloud";

function createSharedClient(options?: { coupleId?: string | null; row?: unknown; userId?: string }) {
  const calls = {
    eq: [] as Array<{ column: string; value: unknown }>,
    from: [] as string[],
    maybeSingle: 0,
    rpc: [] as Array<{ args: unknown; name: string }>,
    select: [] as string[],
    upsert: [] as unknown[]
  };
  const userId = options?.userId ?? "user-a";
  type QueryMock = {
    eq: jest.Mock<QueryMock, [string, unknown]>;
    maybeSingle: jest.Mock<Promise<{ data: unknown; error: null }>, []>;
  };
  const query: QueryMock = {
    eq: jest.fn((column: string, value: unknown) => {
      calls.eq.push({ column, value });
      return query;
    }),
    maybeSingle: jest.fn(async () => {
      calls.maybeSingle += 1;
      return { data: options?.row ?? null, error: null };
    })
  };
  const client = {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: userId } }, error: null }))
    },
    from: jest.fn((table: string) => {
      calls.from.push(table);
      return {
        select: jest.fn((columns: string) => {
          calls.select.push(columns);
          return query;
        }),
        upsert: jest.fn(async (rows: unknown, opts: unknown) => {
          calls.upsert.push({ opts, rows });
          return { data: null, error: null };
        })
      };
    }),
    rpc: jest.fn(async (name: string, args: unknown) => {
      calls.rpc.push({ args, name });
      if (name === "current_active_couple_id") {
        return { data: options?.coupleId ?? null, error: null };
      }
      return { data: null, error: null };
    })
  };

  return { calls, client };
}

describe("love shared cloud state", () => {
  it("saves love tab data by active couple id instead of user id", async () => {
    const { calls, client } = createSharedClient({ coupleId: "couple-1", userId: "user-a" });
    const gifts = [{ id: "gift-1", name: "花", date: "2026-08-10" }];

    await saveLoveSharedValue("love.gifts.v1", gifts, client as never);

    expect(calls.rpc).toContainEqual({
      args: { p_user_id: "user-a" },
      name: "current_active_couple_id"
    });
    expect(calls.from).toContain("love_shared_state");
    expect(calls.upsert[0]).toEqual({
      opts: { onConflict: "couple_id,key" },
      rows: {
        couple_id: "couple-1",
        key: "love.gifts.v1",
        updated_at: expect.any(String),
        updated_by: "user-a",
        value: gifts
      }
    });
  });

  it("loads love tab data from the active couple row", async () => {
    const gifts = [{ id: "gift-1", name: "花", date: "2026-08-10" }];
    const { calls, client } = createSharedClient({
      coupleId: "couple-1",
      row: { value: gifts },
      userId: "user-b"
    });
    const writeLocal = jest.fn();

    const result = await hydrateLoveSharedValue("love.gifts.v1", [], writeLocal, client as never);

    expect(result).toEqual(gifts);
    expect(writeLocal).toHaveBeenCalledWith(gifts);
    expect(calls.eq).toContainEqual({ column: "couple_id", value: "couple-1" });
    expect(calls.eq).toContainEqual({ column: "key", value: "love.gifts.v1" });
  });

  it("migrates existing local love tab data into the couple row when cloud is empty", async () => {
    const localAnniversaries = [{ id: "anniversary-1", title: "在一起", date: "2026-08-10" }];
    const { calls, client } = createSharedClient({ coupleId: "couple-1" });

    const result = await hydrateLoveSharedValue("love.anniversaries.v1", localAnniversaries, jest.fn(), client as never);

    expect(result).toEqual(localAnniversaries);
    expect(calls.upsert[0]).toEqual({
      opts: { onConflict: "couple_id,key" },
      rows: expect.objectContaining({
        couple_id: "couple-1",
        key: "love.anniversaries.v1",
        value: localAnniversaries
      })
    });
  });
});
