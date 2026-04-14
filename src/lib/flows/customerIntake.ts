import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { supabase } from "@/lib/supabase";

/**
 * Simple user state (stored in DB table: user_states)
 * Columns:
 * - phone (string, primary key)
 * - step (string)
 * - problem (string | null)
 */

type UserState = {
  step: "idle" | "awaiting_location";
  problem?: string;
};

// ---------------- STATE HELPERS ----------------

async function getUserState(phone: string): Promise<UserState> {
  const { data } = await supabase
    .from("user_states")
    .select("*")
    .eq("phone", phone)
    .single();

  if (!data) {
    return { step: "idle" };
  }

  return data;
}

async function saveUserState(phone: string, state: UserState) {
  await supabase.from("user_states").upsert({
    phone,
    ...state,
  });
}

async function clearUserState(phone: string) {
  await supabase.from("user_states").delete().eq("phone", phone);
}

// ---------------- SMART DETECTION ----------------

// Detect if message already contains location
function extractLocation(text: string): string | null {
  const patterns = [
    /phase\s?\d+/i,
    /sector\s?[a-z0-9]+/i,
    /block\s?[a-z]/i,
    /dha/i,
    /bahria/i,
    /saddar/i,
    /near\s.+/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  return null;
}

// Basic trade detection (can expand later)
function detectTrade(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes("ac")) return "HVAC";
  if (lower.includes("electric")) return "Electrician";
  if (lower.includes("pipe") || lower.includes("water")) return "Plumber";

  return "General";
}

// ---------------- MAIN FLOW ----------------

export async function handleCustomerFlow(
  userPhone: string,
  messageText: string
) {
  console.log(`[CustomerFlow] ${userPhone}: "${messageText}"`);

  const state = await getUserState(userPhone);

  // ✅ CASE 1: User already sent problem + location in one message
  const detectedLocation = extractLocation(messageText);

  if (state.step === "idle" && detectedLocation) {
    const trade = detectTrade(messageText);

    await sendWhatsAppMessage(
      userPhone,
      `⏳ Finding ${trade} technicians near ${detectedLocation}...`
    );

    await supabase.from("active_jobs").insert({
      customer_phone: userPhone,
      problem: messageText,
      location: detectedLocation,
      trade_required: trade,
      status: "bidding",
    });

    return;
  }

  // ✅ STEP 1: Collect problem
  if (state.step === "idle") {
    await saveUserState(userPhone, {
      step: "awaiting_location",
      problem: messageText,
    });

    await sendWhatsAppMessage(
      userPhone,
      "📍 Could you please share your location?\n(e.g., Bahria Phase 7, DHA, Saddar, etc.)"
    );

    return;
  }

  // ✅ STEP 2: Collect location
  if (state.step === "awaiting_location") {
    const problem = state.problem!;
    const location = messageText;
    const trade = detectTrade(problem);

    await clearUserState(userPhone);

    await sendWhatsAppMessage(
      userPhone,
      `⏳ Finding ${trade} technicians near ${location}...`
    );

    await supabase.from("active_jobs").insert({
      customer_phone: userPhone,
      problem,
      location,
      trade_required: trade,
      status: "bidding",
    });

    return;
  }
}