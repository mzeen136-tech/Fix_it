import { supabase } from "@/lib/supabase";
import { analyzeCustomerMessage } from "@/lib/gemini";
import { broadcastJobAlert, sendWhatsAppMessage } from "@/lib/whatsapp";
import { getConversation, saveConversation, clearConversation } from "@/lib/conversation";

// ── Static responses ──────────────────────────────────────────────────────────

const SERVICES_MSG =
  `🔧 *SnapFix Services*\n\n` +
  `We connect you with trusted technicians for:\n\n` +
  `💧 *Plumber* — taps, pipes, leaks, drainage\n` +
  `⚡ *Electrician* — wiring, sockets, power issues\n` +
  `❄️ *HVAC* — AC repair, installation, gas refill\n` +
  `🪵 *Carpenter* — doors, furniture, woodwork\n` +
  `🎨 *Painter* — interior & exterior painting\n\n` +
  `Just describe your problem and your city/area — we'll find you someone fast! 🚀`;

const CONTACT_REQUEST_MSG =
  `🔍 Looking for a specific technician? Unfortunately we can't search by name — ` +
  `but we can find you the *best available* technician for your trade right now!\n\n` +
  `Just describe your problem and city. Example:\n` +
  `_"AC not cooling, Islamabad, Barakau"_`;

// ── Patterns that should NEVER create a job ───────────────────────────────────

const NON_JOB_PATTERNS = [
  /someone named/i,
  /previously worked/i,
  /koi hai jo/i,
  /wahi wala/i,
  /contact number/i,
  /give me.*number/i,
  /number do/i,
  /referral/i,
  /recommend/i,
];

function isContactRequest(text: string): boolean {
  return NON_JOB_PATTERNS.some(p => p.test(text));
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleCustomerIntake(
  customerPhone: string,
  messageText: string
): Promise<void> {

  // Guard: contact requests (e.g. "someone named dawood")
  if (isContactRequest(messageText)) {
    await sendWhatsAppMessage(customerPhone, CONTACT_REQUEST_MSG);
    return;
  }

  const conv = await getConversation(customerPhone);

  // ── Resuming: waiting for location ───────────────────────────────────────
  if (conv?.state === "awaiting_location") {
    const analysis = await analyzeCustomerMessage(messageText);

    // Customer sent another problem instead of location — reset and re-analyze
    if (analysis.has_problem && !analysis.has_location && analysis.trade !== "Other") {
      await clearConversation(customerPhone);
      await handleCustomerIntake(customerPhone, messageText);
      return;
    }

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
    if (!analysis.has_problem) {
      // Still no problem — don't loop, just re-ask once
      await sendWhatsAppMessage(customerPhone,
        analysis.language === "urdu"
          ? "Aap apna masla bata dein — kya kharab hai?"
          : "Please describe what's broken or not working, and I'll find you a technician right away!"
      );
      return;
    }
    if (analysis.has_problem && analysis.has_location) {
      await clearConversation(customerPhone);
      await dispatch(customerPhone, analysis.summary || messageText, analysis.trade, analysis.city, analysis.area);
    } else {
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
    }
    return;
  }

  // ── Fresh message ─────────────────────────────────────────────────────────
  const analysis = await analyzeCustomerMessage(messageText);

  // General question — services menu, NO conversation state saved
  if (analysis.is_general_question) {
    await sendWhatsAppMessage(customerPhone, SERVICES_MSG);
    return;
  }

  // No problem detected — ask, but ONLY save state if message is meaningful
  if (!analysis.has_problem) {
    // Short/unclear message — just ask, don't save state (prevents state accumulation)
    if (messageText.trim().length < 8) {
      await sendWhatsAppMessage(customerPhone,
        "👋 Please describe your home service problem and city. I'll find you a technician!\n\n" +
        "Example: _\"AC not cooling, Islamabad F-7\"_"
      );
      return;
    }
    await saveConversation(customerPhone, {
      state: "awaiting_problem",
      language: analysis.language,
    });
    await sendWhatsAppMessage(customerPhone, analysis.follow_up ||
      "Please describe what needs fixing — AC, pipe, wiring, etc. — and your city/area."
    );
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
    await sendWhatsAppMessage(customerPhone, analysis.follow_up ||
      "Got it! Which city and area are you in? Example: Islamabad, F-7"
    );
    return;
  }

  // Has both — dispatch immediately
  await clearConversation(customerPhone);
  await dispatch(customerPhone, analysis.summary, analysis.trade, analysis.city, analysis.area);
}

// ── Dispatch: create job + alert matching techs ───────────────────────────────

async function dispatch(
  customerPhone: string,
  problem: string,
  trade: string,
  city: string,
  area: string
): Promise<void> {

  // Guard 1: Validate we have a real problem
  if (!problem?.trim() || problem.trim().length < 3) {
    await sendWhatsAppMessage(customerPhone,
      "Please describe your problem in a bit more detail so we can find the right technician!"
    );
    return;
  }

  // Guard 2: Prevent duplicate active jobs from same customer
  const { data: existingJob } = await supabase
    .from("active_jobs")
    .select("job_id, trade_required, created_at")
    .eq("customer_phone", customerPhone)
    .eq("status", "bidding")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingJob) {
    const ageMinutes = Math.floor(
      (Date.now() - new Date(existingJob.created_at).getTime()) / 60000
    );
    await sendWhatsAppMessage(customerPhone,
      `⏳ You already have an active *${existingJob.trade_required}* job waiting for bids ` +
      `(posted ${ageMinutes} min ago).\n\n` +
      `Technicians are reviewing it. You'll receive bids shortly!\n\n` +
      `To cancel and post a new job, wait for bids to expire (3 hours) or contact support.`
    );
    return;
  }

  // Ensure valid trade
  const VALID = ["Plumber","Electrician","HVAC","Carpenter","Painter","Other"];
  const safeTrade = VALID.includes(trade) ? trade : "Other";
  const locationStr = [city, area].filter(Boolean).join(", ");

  await sendWhatsAppMessage(
    customerPhone,
    locationStr
      ? `⏳ Finding ${safeTrade}s in ${locationStr}…`
      : `⏳ Finding available ${safeTrade}s near you…`
  );

  // Truncate summary for clean DB storage
  const summary = problem.slice(0, 120);

  const { data: job, error: jobErr } = await supabase
    .from("active_jobs")
    .insert({
      customer_phone:  customerPhone,
      customer_city:   city   || null,
      customer_area:   area   || null,
      trade_required:  safeTrade,
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
  const { data: techs } = await supabase
    .from("technicians")
    .select("phone_number, name")
    .eq("trade", safeTrade)
    .eq("is_active", true)
    .eq("approval_status", "approved");

  if (!techs || techs.length === 0) {
    await sendWhatsAppMessage(customerPhone,
      `😔 No *${safeTrade}s* are available right now.\n\n` +
      `We'll keep your job posted and alert you as soon as a technician is available!`
    );
    return;
  }

  // Send job alerts using approved template (with text fallback)
  try {
    await broadcastJobAlert(
      techs.map(t => t.phone_number),
      job.job_id,
      safeTrade,
      locationStr,
      summary
    );
  } catch (e) {
    console.error("[Flow2] Broadcast error:", e);
  }

  await sendWhatsAppMessage(customerPhone,
    `✅ We've alerted *${techs.length} ${safeTrade}(s)*. Bids coming your way soon!\n\n` +
    `To hire someone, reply:\n*ACCEPT [Name]*\nExample: ACCEPT Ali`
  );

  console.log(`[Flow2] Job ${job.job_id} (${safeTrade}) dispatched to ${techs.length} tech(s)`);
}
