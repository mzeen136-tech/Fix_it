import { supabase } from "@/lib/supabase";
import { analyzeCustomerMessage, extractJobDetails } from "@/lib/gemini";
import { broadcastWhatsAppMessage, sendWhatsAppMessage } from "@/lib/whatsapp";
import { getConversation, saveConversation, clearConversation } from "@/lib/conversation";

const SERVICES_MSG =
  `🔧 *SnapFix Services*\n\n` +
  `We connect you with trusted technicians for:\n\n` +
  `💧 *Plumber* — taps, pipes, leaks, drainage\n` +
  `⚡ *Electrician* — wiring, sockets, power issues\n` +
  `❄️ *HVAC* — AC repair, installation, gas refill\n` +
  `🪵 *Carpenter* — doors, furniture, woodwork\n` +
  `🎨 *Painter* — interior & exterior painting\n\n` +
  `Just describe your problem and your city/area — we'll find you someone fast! 🚀`;

export async function handleCustomerIntake(
  customerPhone: string,
  messageText: string
): Promise<void> {
  const conv = await getConversation(customerPhone);

  // ── Resuming: waiting for location ───────────────────────────────────────
  if (conv?.state === "awaiting_location") {
    const analysis = await analyzeCustomerMessage(messageText);
    const city = analysis.city || messageText.split(",")[0]?.trim() || "";
    const area = analysis.area || messageText.split(",").slice(1).join(",")?.trim() || "";
    await clearConversation(customerPhone);
    await dispatch(
      customerPhone,
      conv.partial_problem || messageText,
      conv.partial_trade   || analysis.trade,
      city, area
    );
    return;
  }

  // ── Resuming: waiting for problem ─────────────────────────────────────────
  if (conv?.state === "awaiting_problem") {
    const analysis = await analyzeCustomerMessage(messageText);
    if (analysis.is_general_question) {
      await sendWhatsAppMessage(customerPhone, SERVICES_MSG);
      return;
    }
    if (analysis.has_problem && analysis.has_location) {
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
        ? "شکریہ! اب اپنا شہر اور علاقہ بتائیں۔\nمثال: اسلام آباد، براکاؤ"
        : "Got it! 📍 Now please share your city and area.\nExample: Islamabad, Barakau";
      await sendWhatsAppMessage(customerPhone, msg);
    } else {
      await sendWhatsAppMessage(customerPhone, analysis.follow_up);
    }
    return;
  }

  // ── Fresh message ─────────────────────────────────────────────────────────
  const analysis = await analyzeCustomerMessage(messageText);

  // General question (what services, how does this work, pricing, etc.)
  if (analysis.is_general_question) {
    await sendWhatsAppMessage(customerPhone, SERVICES_MSG);
    return;
  }

  // Has everything — dispatch immediately
  if (analysis.has_problem && analysis.has_location) {
    await clearConversation(customerPhone);
    await dispatch(customerPhone, analysis.summary, analysis.trade, analysis.city, analysis.area);
    return;
  }

  // Has problem but no location
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

  // No problem detected — ask
  await saveConversation(customerPhone, {
    state: "awaiting_problem",
    language: analysis.language,
  });
  await sendWhatsAppMessage(customerPhone, analysis.follow_up);
}

// ── Dispatch: create job + alert matching techs ───────────────────────────────

async function dispatch(
  customerPhone: string,
  rawProblem: string,
  rawTrade: string,
  city: string,
  area: string
): Promise<void> {
  const locationStr = [city, area].filter(Boolean).join(", ");

  await sendWhatsAppMessage(
    customerPhone,
    locationStr
      ? `⏳ Finding ${rawTrade}s in ${locationStr}…`
      : `⏳ Finding available ${rawTrade}s near you…`
  );

  const { trade, summary } = await extractJobDetails(rawProblem);

  const { data: job, error: jobErr } = await supabase
    .from("active_jobs")
    .insert({
      customer_phone:  customerPhone,
      customer_city:   city   || null,
      customer_area:   area   || null,
      trade_required:  trade,
      problem_summary: summary,
      status:          "bidding",
      bids:            [],
    })
    .select()
    .single();

  if (jobErr || !job) {
    console.error("[Flow2] Job insert failed:", jobErr);
    await sendWhatsAppMessage(customerPhone, "❌ Something went wrong. Please try again.");
    return;
  }

  // Find active approved techs for this trade
  const { data: techs, error: techsErr } = await supabase
    .from("technicians")
    .select("phone_number, name")
    .eq("trade", trade)
    .eq("is_active", true)
    .eq("approval_status", "approved");

  if (techsErr) {
    console.error("[Flow2] Technician query failed:", techsErr);
  }

  if (!techs || techs.length === 0) {
    await sendWhatsAppMessage(customerPhone,
      `😔 No ${trade}s are available right now. We'll notify you as soon as one is free.`
    );
    return;
  }

  const alert =
    `🚨 *NEW JOB ALERT*\n` +
    `🔧 Trade: ${trade}\n` +
    `📋 Problem: ${summary}\n` +
    (locationStr ? `📍 Location: ${locationStr}\n` : "") +
    `\nReply with your *price and ETA* to bid.\n` +
    `Example: "Rs. 2500, 30 minutes"`;

  const { sent, failed } = await broadcastWhatsAppMessage(
    techs.map(t => t.phone_number),
    alert
  );

  if (failed > 0) {
    console.warn(`[Flow2] Job ${job.job_id}: ${sent} of ${techs.length} tech(s) reached`);
  }

  if (sent === 0) {
    await sendWhatsAppMessage(customerPhone,
      `😔 No ${trade}s are reachable right now. We'll try again shortly.`
    );
    return;
  }

  await sendWhatsAppMessage(customerPhone,
    `✅ We've alerted *${sent} ${trade}(s)*. Bids coming your way soon!\n\nTo hire someone, reply:\n*ACCEPT [Name]*\nExample: ACCEPT Ali`
  );

  console.log(`[Flow2] Job ${job.job_id} dispatched — ${sent} sent, ${failed} failed`);
}
