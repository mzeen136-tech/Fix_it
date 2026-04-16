import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const { data: staleJobs, error } = await supabase
    .from("active_jobs")
    .select("job_id, customer_phone, trade_required, problem_summary")
    .eq("status", "bidding")
    .lt("created_at", cutoff);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!staleJobs || staleJobs.length === 0) return NextResponse.json({ expired: 0 });

  await supabase
    .from("active_jobs")
    .update({ status: "completed" })
    .in("job_id", staleJobs.map(j => j.job_id));

  await Promise.allSettled(staleJobs.map(job =>
    sendWhatsAppMessage(job.customer_phone,
      `😔 Your *${job.trade_required}* job received no bids in 3 hours and has expired.\n\n` +
      `_"${job.problem_summary}"_\n\n` +
      `Send a new message anytime to try again!`
    ).catch(e => console.error(`[Cron] notify fail ${job.customer_phone}:`, e))
  ));

  console.log(`[Cron] Expired ${staleJobs.length} stale jobs`);
  return NextResponse.json({ expired: staleJobs.length });
}
