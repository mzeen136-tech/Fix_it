import { supabase } from "@/lib/supabase";
import { analyzeCustomerMessage, extractJobDetails } from "@/lib/gemini";
import { broadcastWhatsAppMessage, sendWhatsAppMessage } from "@/lib/whatsapp";
import {
  getConversation, saveConversation, clearConversation,
} from "@/lib/conversation";

// ── Services info reply ───────────────────────────────────────────────────────

const SERVICES_REPLY =
  `👋 *Welcome to SnapFix!*\n\n` +
  `We connect you with trusted home service technicians across Pakistan.\n\n` +
  `🔧 *Services we offer:*\n` +
  `• ❄️ HVAC — AC repair, gas refill, heating, geysers\n` +
  `• 🔌 Electrician — wiring, switches, MCB, power issues\n` +
  `• 🚿 Plumber — pipes, leaks, taps, drains, toilets\n` +
  `• 🪚 Carpenter — doors, windows, furniture, cabinets\n` +
  `• 🖌️ Painter — wall painting, plastering\n\n` +
  `⏰ *Available:* 7 days a week, 8am–10pm\n\n` +
  `Simply describe your problem and share your city/area — we'll find the right technician for you! 😊`;

// ── FAQ keyword detection (fast path — avoids Gemini call) ───────────────────

const FAQ_KEYWORDS = [
  "what service", "what do you", "services you provide", "what can you", "how does",
  "how do you", "what trades", "like what", "tell me about", "what kind", "what type",
  "kya karte", "kya services", "kya kaam", "help karo", "kya ho", "konsi service",
  "explain", "introduce", "about you", "what is this", "who are you", "what are you",
  "weekend", "timing", "hours", "coverage", "do you work", "kab available",
];

function isFaqQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return FAQ_KEYWORDS.some(k => lower.includes(k));
}

function isMediaMessage(text: string): boolean {
  return /^\[(image|audio|video|document|sticker) received\]$/i.test(text.trim());
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleCustomerIntake(
  customerPhone: string,
  messageText: string
): Promise<void> {
  const conv = await getConversation(customerPhone);

  // ── Handle media messages ─────────────────────────────────────────────────
  if (isMediaMessage(messageText)) {
    await sendWhatsAppMessage(
      customerPhone,
      "📝 Please describe your problem in text so we can find the right technician.\n\nExample: *My AC is not cooling, Islamabad, Barakhu*"
    );
    return;
  }

  // ── FAQ check — ALWAYS, even mid-conversation ─────────────────────────────
  // Keyword check is instant. If matched, answer and preserve conversation state.
  if (isFaqQuery(messageText)) {
    await sendWhatsAppMessage(customerPhone, SERVICES_REPLY);
    // If mid-conversation, remind them where they left off
    if (conv?.state === "awaiting_location") {
      await sendWhatsAppMessage(
        customerPhone,
        "📍 Now please share your city and area so we can find a technician for you."
      );
    } else if (conv?.state === "awaiting_problem") {
      await sendWhatsAppMessage(
        customerPhone,
        "📝 Please describe your home service problem to get started."
      );
    }
    return;
  }

  // ── Resuming: waiting for location ───────────────────────────────────────
  if (conv?.state === "awaiting_location") {
    const analysis = await analyzeCustomerMessage(messageText);

    // User answered a general question instead of giving location — already handled above
    // But if Gemini detects it as general question (not in keyword list), handle here
    if (analysis.is_general_question) {
      await sendWhatsAppMessage(customerPhone, SERVICES_REPLY);
      await sendWhatsAppMessage(
        customerPhone,
        "📍 Now please share your city and area so we can send a technician."
      );
      return;
    }

    const city = analysis.city || messageText.split(",")[0]?.trim() || "Not specified";
    const area = analysis.area || messageText.split(",")[1]?.trim() || "";
    await clearConversation(customerPhone);
    await dispatch(
      customerPhone,
      conv.partial_problem || messageText,
      conv.partial_trade || analysis.trade,
      city,
      area
    );
    return;
  }

  // ── Resuming: waiting for problem ─────────────────────────────────────────
  if (conv?.state === "awaiting_problem") {
    const analysis = await analyzeCustomerMessage(messageText);

    if (analysis.is_general_question) {
      await sendWhatsAppMessage(customerPhone, SERVICES_REPLY);
      await sendWhatsAppMessage(customerPhone, "📝 Please describe your home service problem to get started.");
      return;
    }

    if (analysis.has_location && analysis.has_problem) {
      await clearConversation(customerPhone);
      await dispatch(customerPhone, analysis.summary || messageText, analysis.trade, analysis.city, analysis.area);
    } else if (analysis.has_problem) {
      await saveConversation(customerPhone, {
        state: "awaiting_location",
        partial_problem: analysis.summary || messageText,
        partial_trade: analysis.trade,
        language: analysis.language,
      });
      const msg = analysis.language === "urdu"
        ? "شکریہ! اب اپنا شہر اور علاقہ بتائیں۔ مثال: لاہور، ڈی ایچ اے"
        : "Got it! Now please share your city and area. Example: Lahore, DHA";
      await sendWhatsAppMessage(customerPhone, msg);
    } else {
      // Still no problem described — gently re-ask
      await sendWhatsAppMessage(
        customerPhone,
        analysis.follow_up ||
        "Please describe your problem. Example: *AC not cooling*, *water leakage*, *lights not working*"
      );
    }
    return;
  }

  // ── Fresh message — analyze intent ────────────────────────────────────────
  const analysis = await analyzeCustomerMessage(messageText);

  // Gemini detected a general/FAQ question
  if (analysis.is_general_question) {
    await sendWhatsAppMessage(customerPhone, SERVICES_REPLY);
    await sendWhatsAppMessage(
      customerPhone,
      "💬 Describe your problem and share your city/area — we'll find the right technician for you!"
    );
    return;
  }

  // Full info — dispatch immediately
  if (analysis.has_problem && analysis.has_location) {
    await clearConversation(customerPhone);
    await dispatch(customerPhone, analysis.summary, analysis.trade, analysis.city, analysis.area);
    return;
  }

  // Problem but no location
  if (analysis.has_problem && !analysis.has_location) {
    await saveConversation(customerPhone, {
      state: "awaiting_location",
      partial_problem: analysis.summary,
      partial_trade: analysis.trade,
      language: analysis.language,
    });
    await sendWhatsAppMessage(customerPhone, analysis.follow_up);
    return;
  }

  // No problem (or nothing useful)
  await saveConversation(customerPhone, {
    state: "awaiting_problem",
    language: analysis.language,
  });
  await sendWhatsAppMessage(
    customerPhone,
    analysis.follow_up ||
    "👋 Hi! I'm SnapFix. Describe your home service problem and share your city/area.\n\nExample: *My AC is not cooling, Islamabad, Barakhu*"
  );
}

// ── Dispatch: create job + alert techs ───────────────────────────────────────

async function dispatch(
  customerPhone: string,
  rawProblem: string,
  rawTrade: string,
  city: string,
  area: string
): Promise<void> {
  await sendWhatsAppMessage(
    customerPhone,
    city && city !== "Not specified"
      ? `⏳ Finding ${rawTrade}s in ${city}${area ? ", " + area : ""}...`
      : "⏳ Finding available technicians for you..."
  );

  const { trade, summary } = await extractJobDetails(rawProblem);

  const { data: job, error: jobErr } = await supabase
    .from("active_jobs")
    .insert({
      customer_phone: customerPhone,
      customer_city: city || null,
      customer_area: area || null,
      trade_required: trade,
      problem_summary: summary,
      status: "bidding",
      bids: [],
    })
    .select()
    .single();

  if (jobErr || !job) {
    console.error("[Flow2] Job insert failed:", jobErr);
    await sendWhatsAppMessage(customerPhone, "❌ Something went wrong. Please try again.");
    return;
  }

  const { data: techs } = await supabase
    .from("technicians")
    .select("phone_number, name")
    .eq("trade", trade)
    .eq("is_active", true)
    .eq("approval_status", "approved");

  if (!techs || techs.length === 0) {
    await sendWhatsAppMessage(
      customerPhone,
      `😔 No ${trade}s are available right now in your area. We'll notify you as soon as one becomes available.`
    );
    return;
  }

  const locationStr = [city, area].filter(Boolean).join(", ");
  const alert =
    `🚨 *NEW JOB ALERT*\n` +
    `🔧 Trade: ${trade}\n` +
    `📋 Problem: ${summary}\n` +
    (locationStr ? `📍 Location: ${locationStr}\n` : "") +
    `\nReply with your *price and ETA* to bid.\nExample: Rs. 2500, 30 minutes`;

  try {
    await broadcastWhatsAppMessage(techs.map(t => t.phone_number), alert);
  } catch (e) {
    console.error("[Flow2] Broadcast error:", e);
  }

  await sendWhatsAppMessage(
    customerPhone,
    `✅ We've alerted *${techs.length} ${trade}${techs.length > 1 ? "s" : ""}*. You'll receive bids shortly.\n\nTo hire: reply *ACCEPT [Name]*`
  );
}
