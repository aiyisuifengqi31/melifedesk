import type { SupabaseClient } from "@supabase/supabase-js";

import type { Visibility } from "@/features/finance/financeRepository";

export type GiftDirection = "sent" | "received";

export type GiftRecordInput = {
  amount: string;
  contactId: string;
  coupleId?: string | null;
  direction: GiftDirection;
  eventDate: string;
  eventType: string;
  needReturn: boolean;
  note?: string | null;
  place?: string | null;
  returnReminderDate?: string | null;
  syncFinance: boolean;
  visibility: Visibility;
};

export async function listGiftContacts(client: SupabaseClient, ownerUserId: string, searchText?: string) {
  let query = client.from("gift_contacts").select("*").eq("owner_user_id", ownerUserId).is("deleted_at", null).order("name");
  if (searchText) {
    query = query.ilike("name", `%${searchText}%`);
  }
  return query;
}

export async function listGiftRecords(client: SupabaseClient, ownerUserId: string, year: string) {
  return client
    .from("gift_records")
    .select("*, gift_contacts(name, relationship), finance_transactions(id)")
    .eq("owner_user_id", ownerUserId)
    .gte("event_date", `${year}-01-01`)
    .lte("event_date", `${year}-12-31`)
    .is("deleted_at", null)
    .order("event_date", { ascending: false });
}

export async function createGiftRecord(client: SupabaseClient, ownerUserId: string, input: GiftRecordInput) {
  return client
    .from("gift_records")
    .insert({
      amount: input.amount,
      contact_id: input.contactId,
      couple_id: input.coupleId ?? null,
      direction: input.direction,
      event_date: input.eventDate,
      event_type: input.eventType,
      need_return: input.needReturn,
      note: input.note ?? null,
      owner_user_id: ownerUserId,
      place: input.place ?? null,
      return_reminder_date: input.returnReminderDate ?? null,
      sync_finance: input.syncFinance,
      visibility: input.visibility
    })
    .select("*")
    .single();
}

export async function createGiftFinanceTransaction(client: SupabaseClient, giftRecordId: string) {
  return client.rpc("create_gift_finance_transaction", { p_gift_record_id: giftRecordId });
}

export async function softDeleteGiftRecord(client: SupabaseClient, giftRecordId: string, deleteLinkedFinance: boolean) {
  return client.rpc("soft_delete_gift_record", { p_delete_linked_finance: deleteLinkedFinance, p_gift_record_id: giftRecordId });
}
