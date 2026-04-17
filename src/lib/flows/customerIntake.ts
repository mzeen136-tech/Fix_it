import { supabase } from "@/lib/supabase";
import { analyzeCustomerMessage, extractJobDetails } from "@/lib/gemini";
import { broadcastWhatsAppMessage, sendWhatsAppMessage } from "@/lib/whatsapp";
import { broadcastTelegramMessage } from "@/lib/telegram";
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

  console.log(`[Flow2] dispatch called with: rawTrade=${rawTrade}, rawProblem=${rawProblem.substring(0, 50)}`);
  
  const { trade, summary } = await extractJobDetails(rawProblem);
  
  console.log(`[Flow2] extractJobDetails returned: trade=${trade}, summary=${summary.substring(0, 50)}`);

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

  // Find active approved techs for this trade (with Telegram info)
  console.log(`[Flow2] Looking for techs: trade=${trade}, is_active=true, approval_status=approved`);
  
  const { data: allTechsForTrade, error: allTechsErr } = await supabase
    .from("technicians")
    .select("phone_number, name, telegram_chat_id, is_active, approval_status, trade")
    .eq("trade", trade);

  console.log(`[Flow2] All techs for ${trade} (before filtering):`, allTechsForTrade);

  const { data: techs, error: techsErr } = await supabase
    .from("technicians")
    .select("phone_number, name, telegram_chat_id")
    .eq("trade", trade)
    .eq("is_active", true)
    .eq("approval_status", "approved");

  console.log(`[Flow2] Filtered techs for ${trade}:`, techs);

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

  // Separate techs by channel
  const telegramTechs = techs.filter(t => t.telegram_chat_id);
  const whatsappTechs = techs.filter(t => !t.telegram_chat_id);

  let telegramSent = 0;
  let whatsappSent = 0;
  let whatsappFailed = 0;

  // Send via Telegram first (FREE)
  if (telegramTechs.length > 0) {
    const tgAlert = `🚨 *NEW JOB ALERT*\n🔧 ${trade}\n📋 ${summary}${locationStr ? `\n📍 ${locationStr}` : ""}\n\n💰 Reply with price & ETA to bid\nExample: Rs. 2500, 30 min`;
    
    const tgButtons = [{ text: "💬 Reply on WhatsApp", url: `https://wa.me/${process.env.WHATSAPP_PHONE_NUMBER_ID}` }];
    
    const tgResult = await broadcastTelegramMessage(
      telegramTechs.map(t => ({ chatId: t.telegram_chat_id, name: t.name })),
      tgAlert,
      tgButtons
    );
    telegramSent = tgResult.sent;
    console.log(`[Flow2] Telegram: ${telegramSent} sent, ${tgResult.failed} failed`);
  }

  // Fall back to WhatsApp for techs without Telegram
  if (whatsappTechs.length > 0) {
    const waResult = await broadcastWhatsAppMessage(
      whatsappTechs.map(t => t.phone_number),
      alert
    );
    whatsappSent = waResult.sent;
    whatsappFailed = waResult.failed;
  }

  const totalSent = telegramSent + whatsappSent;
  const totalFailed = whatsappFailed;

  if (totalSent === 0) {
    await sendWhatsAppMessage(customerPhone,
      `😔 No ${trade}s are reachable right now. We'll try again shortly.`
    );
    return;
  }

  const tgMsg = telegramSent > 0 ? ` (${telegramSent} via Telegram)` : "";
  await sendWhatsAppMessage(customerPhone,
    `✅ We've alerted *${totalSent} ${trade}(s)*${tgMsg}. Bids coming your way soon!\n\nTo hire someone, reply:\n*ACCEPT [Name]*\nExample: ACCEPT Ali`
  );

  console.log(`[Flow2] Job ${job.job_id} dispatched — ${totalSent} sent, ${totalFailed} failed`);
}
