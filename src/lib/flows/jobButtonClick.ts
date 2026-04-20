import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

/**
 * Handle job alert button clicks (Accept/Reject)
 * Trigger: technician clicks Accept or Reject on a job alert template
 */
export async function handleJobButtonClick(
  techPhone: string,
  buttonPayload: string
): Promise<void> {
  console.log(`[Flow5] Button click from ${techPhone}, payload=${buttonPayload}`);

  // Verify sender is an approved technician
  const { data: tech, error: techErr } = await supabase
    .from("technicians")
    .select("phone_number, name, is_active, approval_status, trade")
    .eq("phone_number", techPhone)
    .single();

  if (techErr || !tech) {
    await sendWhatsAppMessage(
      techPhone,
      "Your number is not registered as a technician. Register at: https://snapfix.com/tech/register"
    );
    return;
  }

  if (tech.is_active !== true || tech.approval_status !== "approved") {
    await sendWhatsAppMessage(
      techPhone,
      "Your account is not yet approved. Please wait for admin approval."
    );
    return;
  }

  if (buttonPayload === "ACCEPT_JOB") {
    // Find the most recent job for this tech's trade that's still in bidding
    const { data: job, error: jobErr } = await supabase
      .from("active_jobs")
      .select("*")
      .eq("trade_required", tech.trade)
      .eq("status", "bidding")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (jobErr || !job) {
      await sendWhatsAppMessage(
        techPhone,
        "No active job found for your trade at the moment. Check back soon!"
      );
      return;
    }

    // Add this tech's bid to the job
    const existingBids = job.bids || [];
    const alreadyBid = existingBids.some((b: any) => b.tech_phone === techPhone);

    if (alreadyBid) {
      await sendWhatsAppMessage(
        techPhone,
        "You've already bid on this job. Reply with your *price and ETA* to update:\n\nExample: Rs. 2500, 30 minutes"
      );
      return;
    }

    // Add initial bid (placeholder - tech still needs to send price/ETA)
    const newBid = {
      tech_name: tech.name,
      tech_phone: techPhone,
      price: "TBD",
      eta: "TBD",
      accepted_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabase
      .from("active_jobs")
      .update({
        bids: [...existingBids, newBid],
      })
      .eq("job_id", job.job_id);

    if (updateErr) {
      console.error("[Flow5] Failed to add bid:", updateErr);
      await sendWhatsAppMessage(
        techPhone,
        "Something went wrong. Please try again."
      );
      return;
    }

    // Notify tech
    await sendWhatsAppMessage(
      techPhone,
      `Great! You've accepted the job.\n\nNow send your *price and ETA*:\n\nExample: "Rs. 2500, 30 minutes"`
    );

    // Notify customer
    await sendWhatsAppMessage(
      job.customer_phone,
      `${tech.name} has accepted your job! Waiting for their price and ETA...`
    );

    console.log(`[Flow5] ${tech.name} accepted job ${job.job_id}`);
  }

  else if (buttonPayload === "REJECT_JOB") {
    await sendWhatsAppMessage(
      techPhone,
      "Thanks for letting us know. We'll find another technician for this job."
    );

    console.log(`[Flow5] ${tech.name} rejected job alert`);
  }
}
