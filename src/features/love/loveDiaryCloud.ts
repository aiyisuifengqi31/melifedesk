import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/auth/supabaseClient";

import type { DiaryEntry } from "./LovePanel";

type DiaryRow = {
  body: string | null;
  category: string | null;
  created_at: string | null;
  entry_date: string | null;
  id: string;
  owner_user_id: string;
  title: string | null;
  tags: string[] | null;
  updated_at: string | null;
  updated_by: string | null;
  visibility: DiaryEntry["visibility"];
};

type LoveClient = SupabaseClient;

const BASE_DIARY_COLUMNS = "id, owner_user_id, visibility, entry_date, title, body, tags, created_at, updated_at";
const ENRICHED_DIARY_COLUMNS = "id, owner_user_id, updated_by, visibility, entry_date, title, body, category, tags, created_at, updated_at";

export async function loadDiariesFromCloud(
  localDiaries: DiaryEntry[],
  writeLocal: (entries: DiaryEntry[]) => void,
  client: LoveClient | null = getSupabaseClient()
): Promise<DiaryEntry[]> {
  const session = await getLoveSession(client);
  if (!session) return localDiaries;
  const activeCoupleId = await getActiveLoveCoupleId(session.client);

  // Access is decided by RLS (owner + current active partner of owner), so we
  // no longer filter by the stored couple_id. A user with or without a partner
  // still loads their own cloud diaries; the active partner's shared diaries are
  // returned by RLS automatically.
  const { data, error } = await selectDiaryRows(session.client, ENRICHED_DIARY_COLUMNS);

  if (error) {
    if (!isMissingColumnError(error)) return localDiaries;
    const fallback = await selectDiaryRows(session.client, BASE_DIARY_COLUMNS);
    if (fallback.error || !Array.isArray(fallback.data)) return localDiaries;
    return handleLoadedDiaryRows(fallback.data, localDiaries, writeLocal, session.client, session.userId, activeCoupleId);
  }
  if (!Array.isArray(data)) return localDiaries;

  return handleLoadedDiaryRows(data, localDiaries, writeLocal, session.client, session.userId, activeCoupleId);
}

async function handleLoadedDiaryRows(
  data: unknown[],
  localDiaries: DiaryEntry[],
  writeLocal: (entries: DiaryEntry[]) => void,
  client: LoveClient,
  userId: string,
  activeCoupleId: string | null
): Promise<DiaryEntry[]> {
  if (data.length === 0 && localDiaries.length > 0) {
    if (!activeCoupleId) return localDiaries;
    const migratedDiaries = localDiaries.map((entry) => ({ ...entry, visibility: "couple_edit" as const }));
    await upsertOwnedDiaries(client, userId, activeCoupleId, migratedDiaries);
    writeLocal(migratedDiaries);
    return migratedDiaries;
  }

  const diaries = data.map((row) => mapDiaryRow(row as DiaryRow));
  writeLocal(diaries);
  return diaries;
}

async function selectDiaryRows(client: LoveClient, columns: string) {
  return client
    .from("diary_entries")
    .select(columns)
    .is("deleted_at", null)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
}

export async function saveDiariesToCloud(
  entries: DiaryEntry[],
  client: LoveClient | null = getSupabaseClient()
): Promise<void> {
  const session = await getLoveSession(client);
  if (!session) return;

  const activeCoupleId = await getActiveLoveCoupleId(session.client);
  await upsertOwnedDiaries(session.client, session.userId, activeCoupleId, entries);
}

export async function deleteDiaryFromCloud(
  diaryId: string,
  client: LoveClient | null = getSupabaseClient()
): Promise<void> {
  const session = await getLoveSession(client);
  if (!session) return;
  await session.client.rpc("soft_delete_diary_entry", { p_diary_id: diaryId });
}

export async function getCurrentLoveUserId(client: LoveClient | null = getSupabaseClient()): Promise<string | null> {
  const session = await getLoveSession(client);
  return session?.userId ?? null;
}

export async function getActiveLoveCoupleId(client: LoveClient | null = getSupabaseClient()): Promise<string | null> {
  const session = await getLoveSession(client);
  if (!session) return null;
  const { data, error } = await session.client.rpc("current_active_couple_id", { p_user_id: session.userId });
  if (error || typeof data !== "string" || !data) return null;
  return data;
}

async function upsertOwnedDiaries(
  client: LoveClient,
  userId: string,
  activeCoupleId: string | null,
  entries: DiaryEntry[]
) {
  const hasSharedEntries = entries.some((entry) => entry.visibility !== "private");
  if (hasSharedEntries && !activeCoupleId) {
    throw new Error("not_bound_to_partner");
  }

  const rows = entries
    .filter((entry) => entry.visibility !== "private" ? Boolean(activeCoupleId) : (!entry.ownerUserId || entry.ownerUserId === userId))
    .map((entry) => {
      const canShare = entry.visibility !== "private" && Boolean(activeCoupleId);
      const ownerUserId = entry.ownerUserId ?? userId;
      return {
        ...(isUuid(entry.id) ? { id: entry.id } : {}),
        body: entry.content,
        category: entry.category ?? "日常记录",
        couple_id: canShare ? activeCoupleId : null,
        entry_date: entry.date,
        owner_user_id: ownerUserId,
        title: entry.title || entry.content.slice(0, 24) || "恋爱日记",
        tags: entry.mood ? [`mood:${entry.mood}`] : [],
        updated_at: new Date().toISOString(),
        updated_by: userId,
        visibility: canShare ? "couple_edit" : "private"
      };
    });

  if (rows.length === 0) return;
  const { error } = await client.from("diary_entries").upsert(rows, { onConflict: "id" });
  if (error && isMissingColumnError(error)) {
    const fallback = await client.from("diary_entries").upsert(rows.map(({ category: _category, updated_by: _updatedBy, ...row }) => row), { onConflict: "id" });
    if (fallback.error) throw fallback.error;
    return;
  }
  if (error) throw error;
}

async function getLoveSession(client: LoveClient | null): Promise<{ client: LoveClient; userId: string } | null> {
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

function mapDiaryRow(row: DiaryRow): DiaryEntry {
  return {
    content: row.body ?? "",
    createTime: row.created_at ?? new Date().toISOString(),
    category: row.category ?? "日常记录",
    date: row.entry_date ?? new Date().toISOString().slice(0, 10),
    id: row.id,
    mood: extractMood(row.tags),
    ownerUserId: row.owner_user_id,
    title: row.title ?? row.body?.slice(0, 24) ?? "恋爱日记",
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    updatedBy: row.updated_by ?? row.owner_user_id,
    visibility: row.visibility
  };
}

function extractMood(tags: string[] | null) {
  const moodTag = tags?.find((tag) => tag.startsWith("mood:"));
  return moodTag ? moodTag.slice("mood:".length) : "平静";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isMissingColumnError(error: unknown) {
  const message = typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message) : String(error);
  return /column .* (category|updated_by).* does not exist|Could not find .*['"]?(category|updated_by)['"]?/i.test(message);
}
