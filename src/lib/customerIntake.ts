import { supabase } from "@/lib/supabase";
import { analyzeCustomerMessage, extractJobDetails } from "@/lib/gemini";
import { broadcastJobAlert, sendWhatsAppMessage } from "@/lib/whatsapp";
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

const CONTACT_REQUEST_PATTERNS = [
  /someone named/i, /previously worked/i, /koi hai jo/i,
  /wahi wala/i, /contact number/i, /give me.*number/i, /number do/i,
];

function isContactRequest(text: string): boolean {
  return CONTACT_REQUEST_PATTERNS.some(p => p.test(text));
}

// ── Generate clean human-readable job reference ───────────────────────────────
// job_number is a SERIAL column — auto-increments per row.
// Result: SF-0001, SF-0042, SF-1337

function makeJobRef(jobNumber: number): string {
  return `SF-${String(jobNumber).padStart(4, "0")}`;
}

export async function handleCustomerIntake(
  customerPhone: string,
  messageText: string
): Promise<void> {

  if (isContactRequest(messageText)) {
    await sendWhatsAppMessage(customerPhone,
      `🔍 Looking for a specific technician? We can't search by name, but we'll find you the *best available* one right now!\n\nJust describe your problem and city. Example:\n_"AC not cooling, Islamabad, Barakau"_`
    );
    return;
  }

  const conv = await getConversation(customerPhone);

  // ── Resuming: waiting for location ───────────────────────────────────────
  if (conv?.state === "awaiting_location") {
    const analysis = await analyzeCustomerMessage(messageText);
    const city = analysis.city || messageText.split(",")[0]?.trim() || "";
    const area = analysis.area || messageText.split(",").slice(1).join(",")?.trim() || "";
    await clearConversation(customerPhone);
    await dispatch(customerPhone, conv.partial_problem || messageText,
      conv.partial_trade || analysis.trade, city, area);
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
      await dispatch(customerPhone, analysis.summary || messageText,
        analysis.trade, analysis.city, analysis.area);
    } else if (analysis.has_problem) {
      await saveConversation(customerPhone, {
        state: "awaiting_location",
        partial_problem: analysis.summary || messageText,
        partial_trade: analysis.trade,
        language: analysis.language,
      });
      await sendWhatsAppMessage(customerPhone,
        analysis.language === "urdu"
          ? "شکریہ! اب اپنا شہر اور علاقہ بتائیں۔\nمثال: اسلام آباد، براکاؤ"
          : "Got it! 📍 Now please share your city and area.\nExample: Islamabad, Barakau"
      );
    } else {
      await sendWhatsAppMessage(customerPhone, analysis.follow_up);
    }
    return;
  }

  // ── Fresh message ─────────────────────────────────────────────────────────
  const analysis = await analyzeCustomerMessage(messageText);

  if (analysis.is_general_question) {
    await sendWhatsAppMessage(customerPhone, SERVICES_MSG);
    return;
  }

  if (analysis.has_problem && analysis.has_location) {
    await clearConversation(customerPhone);
    await dispatch(customerPhone, analysis.summary, analysis.trade, analysis.city, analysis.area);
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

  // No problem — ask for it
  if (messageText.trim().length < 8) {
    await sendWhatsAppMessage(customerPhone,
      "👋 Please describe your home service problem and city. I'll find you a technician!\n\nExample: _\"AC not cooling, Islamabad F-7\"_"
    );
    return;
  }

  await saveConversation(customerPhone, {
    state: "awaiting_problem",
    language: analysis.language,
  });
  await sendWhatsAppMessage(customerPhone,
    analysis.follow_up || "Please describe what needs fixing and your city/area."
  );
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

  // Guard: reject trivially short/empty problems
  if (!rawProblem?.trim() || rawProblem.trim().length < 3) {
    await sendWhatsAppMessage(customerPhone,
      "Please describe your problem in a bit more detail so we can find the right technician!"
    );
    return;
  }

  // Guard: no duplicate active jobs from same customer
  const { data: existingJob } = await supabase
    .from("active_jobs")
    .select("job_number, trade_required, created_at")
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
      `⏳ You already have an active *${existingJob.trade_required}* job ` +
      `(${makeJobRef(existingJob.job_number)}, posted ${ageMinutes} min ago).\n\n` +
      `Technicians are reviewing it. Bids coming soon!`
    );
    return;
  }

  await sendWhatsAppMessage(customerPhone,
    locationStr
      ? `⏳ Finding ${rawTrade}s in ${locationStr}…`
      : `⏳ Finding available ${rawTrade}s near you…`
  );

  const { trade, summary } = await extractJobDetails(rawProblem);

  // Insert job — job_number auto-assigned by SERIAL column
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
    .select("job_id, job_number, trade_required, problem_summary")
    .single();

  if (jobErr || !job) {
    console.error("[Flow2] Job insert failed:", jobErr);
    await sendWhatsAppMessage(customerPhone, "❌ Something went wrong. Please try again.");
    return;
  }

  // ── Clean human-readable reference: SF-0042 ───────────────────────────────
  const jobRef = makeJobRef(job.job_number);
  console.log(`[Flow2] Job created: ${jobRef} (${job.job_id})`);

  // Find active approved techs for this trade (single clean query)
  const { data: techs, error: techErr } = await supabase
    .from("technicians")
    .select("phone_number, name, telegram_chat_id")
    .eq("trade", trade)
    .eq("is_active", true)
    .eq("approval_status", "approved");

  if (techErr) console.error("[Flow2] Tech query error:", techErr);

  if (!techs || techs.length === 0) {
    await sendWhatsAppMessage(customerPhone,
      `😔 No *${trade}s* are available right now.\n\nWe'll keep your job posted and alert you as soon as one is available!`
    );
    return;
  }

  // Broadcast using clean SF-XXXX reference in template {{1}}
  const techPhones = techs.map(t => t.phone_number);
  await broadcastJobAlert(techPhones, jobRef, trade, locationStr || "", summary);

  await sendWhatsAppMessage(customerPhone,
    `✅ We've alerted *${techs.length} ${trade}(s)*. Bids coming your way soon!\n\n` +
    `To hire someone, reply:\n*ACCEPT [Name]*\nExample: ACCEPT Ali`
  );

  console.log(`[Flow2] ${jobRef} dispatched to ${techs.length} tech(s)`);
}
