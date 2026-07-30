import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkoutVisibility = "private" | "couple_read" | "couple_edit";
export type KcalSource = "manual" | "estimated";
export type WorkoutIntensity = "easy" | "moderate" | "hard";

export type WorkoutSessionInput = {
  coupleId?: string | null;
  durationMinutes?: number | null;
  feeling?: string | null;
  intensity?: WorkoutIntensity | null;
  kcal?: number | null;
  kcalSource: KcalSource;
  notes?: string | null;
  sessionDate: string;
  title: string;
  visibility: WorkoutVisibility;
};

export type WorkoutPhotoInput = {
  ownerUserId: string;
  sessionId: string;
  storagePath: string;
};

function mapSessionInput(ownerUserId: string, input: WorkoutSessionInput) {
  return {
    couple_id: input.coupleId ?? null,
    duration_minutes: input.durationMinutes ?? null,
    feeling: input.feeling ?? null,
    intensity: input.intensity ?? null,
    kcal: input.kcal ?? null,
    kcal_source: input.kcalSource,
    notes: input.notes ?? null,
    owner_user_id: ownerUserId,
    session_date: input.sessionDate,
    title: input.title,
    visibility: input.visibility
  };
}

function mapSessionUpdate(update: Partial<WorkoutSessionInput>) {
  return {
    duration_minutes: update.durationMinutes,
    feeling: update.feeling,
    intensity: update.intensity,
    kcal: update.kcal,
    kcal_source: update.kcalSource,
    notes: update.notes,
    session_date: update.sessionDate,
    title: update.title,
    visibility: update.visibility
  };
}

export async function listWorkoutSessions(client: SupabaseClient, ownerUserId: string, dateFrom: string, dateTo: string) {
  return client
    .from("workout_sessions")
    .select("*, workout_parts(*), workout_photos(*)")
    .eq("owner_user_id", ownerUserId)
    .gte("session_date", dateFrom)
    .lte("session_date", dateTo)
    .is("deleted_at", null)
    .order("session_date", { ascending: false });
}

export async function createWorkoutSession(client: SupabaseClient, ownerUserId: string, input: WorkoutSessionInput) {
  return client.from("workout_sessions").insert(mapSessionInput(ownerUserId, input)).select("*").single();
}

export async function updateWorkoutSession(client: SupabaseClient, sessionId: string, update: Partial<WorkoutSessionInput>) {
  return client.from("workout_sessions").update(mapSessionUpdate(update)).eq("id", sessionId).is("deleted_at", null).select("*").single();
}

export async function softDeleteWorkoutSession(client: SupabaseClient, sessionId: string) {
  return client.rpc("soft_delete_workout_session", { p_session_id: sessionId });
}

export async function addWorkoutPart(client: SupabaseClient, sessionId: string, part: string) {
  return client.from("workout_parts").insert({ part, session_id: sessionId }).select("*").single();
}

export async function addWorkoutPhoto(client: SupabaseClient, input: WorkoutPhotoInput) {
  return client
    .from("workout_photos")
    .insert({
      bucket_id: "workout-photos",
      owner_user_id: input.ownerUserId,
      session_id: input.sessionId,
      storage_path: input.storagePath
    })
    .select("*")
    .single();
}
