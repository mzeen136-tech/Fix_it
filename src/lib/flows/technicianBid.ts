import { supabase, Bid } from "@/lib/supabase";
import { extractBidDetails } from "@/lib/gemini";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

/**
 * Flow 3 — Technician bid
 * Trigger: sender IS a technician AND message does NOT start with ACCEPT
 * Action:  Gemini parses price + ETA → appends/updates bid → notifies customer
 *
 * Techs can update their bid freely by sending another message.
 * We replace their existing bid rather than block the update.
 */
export async function handleTechnicianBid(
  techPhone: string,
  messageText: string
): Promise<void> {
  console.log(`[Flow3] Bid from ${techPhone}: "${messageText}"`);

  // 1. Get technician details
  const { data: tech, error: techErr } = await supabase
    .from("technicians")
    .select("name, trade")
    .eq("phone_number", techPhone)
    .eq("is_active", true)
    .single();

  if (techErr || !tech) {
    console.warn(`[Flow3] Tech not found or inactive: ${techPhone}`);
    await sendWhatsAppMessage(
      techPhone,
      "❌ Your account is not active. Please contact the admin."
    );
    return;
  }

  // 2. Find the most recent bidding job for this trade
  const { data: job, error: jobErr } = await supabase
    .from("active_jobs")
    .select("*")
    .eq("trade_required", tech.trade)
    .eq("status", "bidding")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (jobErr || !job) {
    console.log(`[Flow3] No bidding jobs for trade: ${tech.trade}`);
    await sendWhatsAppMessage(
      techPhone,
      "ℹ️ There are no open jobs for your trade right now. We'll alert you when one comes in."
    );
    return;
  }

  // 3. Parse price + ETA with Gemini
  const { price, eta } = await extractBidDetails(messageText);

  // 4. Build updated bids array:
  //    - If tech has bid before on this job → REPLACE (update their bid)
  //    - Otherwise → APPEND (new bid)
  const existingBids: Bid[] = job.bids ?? [];
  const alreadyBid = existingBids.some((b) => b.tech_phone === techPhone);

  const newBid: Bid = {
    tech_phone: techPhone,
    tech_name: tech.name,
    price,
    eta,
    received_at: new Date().toISOString(),
  };

  const updatedBids: Bid[] = alreadyBid
    ? existingBids.map((b) => (b.tech_phone === techPhone ? newBid : b))
    : [...existingBids, newBid];

  // 5. Persist the updated bids
  const { error: updateErr } = await supabase
    .from("active_jobs")
    .update({ bids: updatedBids })
    .eq("job_id", job.job_id);

  if (updateErr) {
    console.error("[Flow3] Failed to update bids:", updateErr);
    await sendWhatsAppMessage(techPhone, "❌ Failed to submit your bid. Please try again.");
    return;
  }

  // 6. Notify the customer
  const bidWord = alreadyBid ? "Updated bid" : "New bid";
  await sendWhatsAppMessage(
    job.customer_phone,
    `💬 *${bidWord}* from *${tech.name}* (${tech.trade}):\n` +
    `💰 Price: ${price}\n` +
    `⏱ ETA: ${eta}\n\n` +
    `To accept, reply: *ACCEPT ${tech.name}*`
  );

  // 7. Confirm to the technician
  const updateNote = alreadyBid ? " (your previous bid was updated)" : "";
  await sendWhatsAppMessage(
    techPhone,
    `✅ Bid sent${updateNote}!\n💰 Price: ${price}\n⏱ ETA: ${eta}\n\nWe'll notify you if the customer accepts.`
  );

  console.log(`[Flow3] ${alreadyBid ? "Updated" : "New"} bid from ${tech.name} on job ${job.job_id}`);
}
