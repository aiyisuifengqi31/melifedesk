import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/auth/supabaseClient";

type LoveClient = SupabaseClient;

export type DiaryLikeSummary = {
  count: number;
  likedByMe: boolean;
};

type DiaryLikeRow = {
  created_at: string | null;
  diary_id: string;
  id: string;
  user_id: string;
};

export async function loadDiaryLikesFromCloud(
  diaryIds: string[],
  client: LoveClient | null = getSupabaseClient()
): Promise<Record<string, DiaryLikeSummary>> {
  const session = await getLoveSession(client);
  if (!session || diaryIds.length === 0) return {};

  const { data, error } = await session.client
    .from("diary_likes")
    .select("id, diary_id, user_id, created_at")
    .in("diary_id", diaryIds);

  if (error || !Array.isArray(data)) return {};
  return data.reduce<Record<string, DiaryLikeSummary>>((summary, row) => {
    const like = row as DiaryLikeRow;
    const current = summary[like.diary_id] ?? { count: 0, likedByMe: false };
    current.count += 1;
    current.likedByMe = current.likedByMe || like.user_id === session.userId;
    summary[like.diary_id] = current;
    return summary;
  }, {});
}

export async function toggleDiaryLikeInCloud(
  diaryId: string,
  liked: boolean,
  client: LoveClient | null = getSupabaseClient()
): Promise<boolean> {
  const session = await getLoveSession(client);
  if (!session) return liked;

  if (liked) {
    const { error } = await session.client
      .from("diary_likes")
      .delete()
      .eq("diary_id", diaryId)
      .eq("user_id", session.userId);
    if (error) throw error;
    return false;
  }

  const { error } = await session.client.from("diary_likes").upsert([
    {
      diary_id: diaryId,
      user_id: session.userId
    }
  ], { onConflict: "diary_id,user_id" });
  if (error) throw error;
  return true;
}

async function getLoveSession(client: LoveClient | null): Promise<{ client: LoveClient; userId: string } | null> {
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}
