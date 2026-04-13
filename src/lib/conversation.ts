import { supabase } from "@/lib/supabase";

export type ConversationState =
  | "idle"
  | "awaiting_problem"
  | "awaiting_location";

export interface ConversationData {
  phone: string;
  state: ConversationState;
  partial_problem: string | null;
  partial_trade: string | null;
  partial_city: string | null;
  partial_area: string | null;
  language: "english" | "urdu";
}

// ── Get current conversation state for a phone number ─────────────────────────

export async function getConversation(
  phone: string
): Promise<ConversationData | null> {
  const { data } = await supabase
    .from("conversation_state")
    .select("*")
    .eq("phone", phone)
    .single();

  return data ?? null;
}

// ── Save / update conversation state ─────────────────────────────────────────

export async function saveConversation(
  phone: string,
  update: Partial<ConversationData>
): Promise<void> {
  await supabase
    .from("conversation_state")
    .upsert({ phone, ...update }, { onConflict: "phone" });
}

// ── Clear conversation state (after job is dispatched) ────────────────────────

export async function clearConversation(phone: string): Promise<void> {
  await supabase
    .from("conversation_state")
    .delete()
    .eq("phone", phone);
}
