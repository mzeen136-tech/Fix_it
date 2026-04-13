import { supabase } from "@/lib/supabase";
import { analyzeCustomerMessage, extractJobDetails } from "@/lib/gemini";
import { broadcastWhatsAppMessage, sendWhatsAppMessage } from "@/lib/whatsapp";
import {
  getConversation, saveConversation, clearConversation,
} from "@/lib/conversation";

export async function handleCustomerIntake(
  customerPhone: string,
  messageText: string
): Promise<void> {
  const conv = await getConversation(customerPhone);

  // ── Resuming: waiting for location ────────────────────────────────────────
  if (conv?.state === "awaiting_location") {
    const analysis = await analyzeCustomerMessage(messageText);
    const city = analysis.city || messageText.split(",")[0]?.trim() || "Not specified";
    const area = analysis.area || messageText.split(",")[1]?.trim() || "";
    await clearConversation(customerPhone);
    await dispatch(customerPhone, conv.partial_problem || messageText,
      conv.partial_trade || analysis.trade, city, area);
    return;
  }

  // ── Resuming: waiting for problem ─────────────────────────────────────────
  if (conv?.state === "awaiting_problem") {
    const analysis = await analyzeCustomerMessage(messageText);
    if (analysis.has_location) {
      await clearConversation(customerPhone);
      await dispatch(customerPhone, analysis.summary || messageText,
        analysis.trade, analysis.city, analysis.area);
    } else {
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
    }
    return;
  }

  // ── Fresh message — analyze everything at once ────────────────────────────
  const analysis = await analyzeCustomerMessage(messageText);

  if (analysis.has_problem && analysis.has_location) {
    await clearConversation(customerPhone);
    await dispatch(customerPhone, analysis.summary, analysis.trade,
      analysis.city, analysis.area);
    return;
  }

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

  // Missing problem (or both missing)
  await saveConversation(customerPhone, {
    state: "awaiting_problem",
    language: analysis.language,
  });
  await sendWhatsAppMessage(customerPhone, analysis.follow_up);
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
    await sendWhatsAppMessage(customerPhone,
      `😔 No ${trade}s are available right now. We'll notify you as soon as one is free.`);
    return;
  }

  const locationStr = [city, area].filter(Boolean).join(", ");
  const alert =
    `🚨 *NEW JOB ALERT*\n` +
    `🔧 Trade: ${trade}\n` +
    `📋 Problem: ${summary}\n` +
    (locationStr ? `📍 Location: ${locationStr}\n` : "") +
    `\nReply with your *price and ETA* to bid.\nExample: "Rs. 2500, 30 minutes"`;

  try {
    await broadcastWhatsAppMessage(techs.map(t => t.phone_number), alert);
  } catch (e) {
    console.error("[Flow2] Broadcast error:", e);
  }

  await sendWhatsAppMessage(customerPhone,
    `✅ We've alerted *${techs.length} ${trade}(s)*. You'll receive bids shortly.\n\nTo hire: *ACCEPT [Name]*`);
}
