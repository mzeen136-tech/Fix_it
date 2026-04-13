import { supabase, Bid } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

/**
 * Flow 4 — Match & Handshake
 * Trigger: customer sends "ACCEPT [Name]"
 * Action:  Find bid → update job to assigned → send phone numbers to both parties
 */
export async function handleCustomerAcceptance(
  customerPhone: string,
  messageText: string
): Promise<void> {
  console.log(`[Flow4] Acceptance from ${customerPhone}: "${messageText}"`);

  // Parse "ACCEPT Ali" → acceptedName = "Ali"
  const acceptedName = messageText.trim().split(/\s+/).slice(1).join(" ").trim();

  if (!acceptedName) {
    await sendWhatsAppMessage(
      customerPhone,
      "❌ Please include the technician's name.\n\nExample: *ACCEPT Ali*"
    );
    return;
  }

  // Find the customer's most recent bidding job
  const { data: job, error: jobErr } = await supabase
    .from("active_jobs")
    .select("*")
    .eq("customer_phone", customerPhone)
    .eq("status", "bidding")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (jobErr || !job) {
    await sendWhatsAppMessage(
      customerPhone,
      "❌ No active job found. Please describe your problem first so we can find you a technician."
    );
    return;
  }

  // Match bid by name (case-insensitive)
  const matchedBid: Bid | undefined = job.bids?.find(
    (b: Bid) => b.tech_name.toLowerCase() === acceptedName.toLowerCase()
  );

  if (!matchedBid) {
    const bidList =
      job.bids?.length > 0
        ? job.bids.map((b: Bid) => `• *${b.tech_name}* — ${b.price}, ${b.eta}`).join("\n")
        : "No bids received yet.";

    await sendWhatsAppMessage(
      customerPhone,
      `❌ No bid found from "${acceptedName}".\n\nCurrent bids:\n${bidList}\n\nCheck the name and try again.`
    );
    return;
  }

  // Update job status to assigned
  const { error: updateErr } = await supabase
    .from("active_jobs")
    .update({
      status: "assigned",
      assigned_tech_phone: matchedBid.tech_phone,
    })
    .eq("job_id", job.job_id)
    .eq("status", "bidding"); // Guard against race condition

  if (updateErr) {
    console.error("[Flow4] Failed to assign job:", updateErr);
    await sendWhatsAppMessage(
      customerPhone,
      "❌ Something went wrong. The job may have already been assigned. Please try again."
    );
    return;
  }

  // ── Handshake: exchange phone numbers between both parties ────────────────

  // To the winning technician
  await sendWhatsAppMessage(
    matchedBid.tech_phone,
    `🎉 *You got the job!*\n\n` +
    `📋 Problem: ${job.problem_summary}\n` +
    `📞 Customer: *${customerPhone}*\n\n` +
    `Please contact the customer within 10 minutes to confirm your arrival. Good luck! 🛠️`
  );

  // To the customer
  await sendWhatsAppMessage(
    customerPhone,
    `✅ *${matchedBid.tech_name}* is confirmed!\n\n` +
    `📞 Their number: *${matchedBid.tech_phone}*\n` +
    `💰 Agreed price: ${matchedBid.price}\n` +
    `⏱ ETA: ${matchedBid.eta}\n\n` +
    `They'll reach out to you shortly. 🔧`
  );

  console.log(`[Flow4] Job ${job.job_id} assigned to ${matchedBid.tech_name} (${matchedBid.tech_phone})`);
}
