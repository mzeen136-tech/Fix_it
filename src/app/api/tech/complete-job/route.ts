import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyToken, TECH_COOKIE } from "@/lib/auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TECH_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyToken(token);
  if (!payload || payload.role !== "tech") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { job_id } = await req.json();
  const techPhone = payload.sub;

  const { data: job } = await supabase
    .from("active_jobs")
    .select("*")
    .eq("job_id", job_id)
    .eq("assigned_tech_phone", techPhone)
    .eq("status", "assigned")
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found or already completed." }, { status: 404 });
  }

  await supabase
    .from("active_jobs")
    .update({ status: "completed" })
    .eq("job_id", job_id);

  // Increment tech's completed job count
  await supabase.rpc("increment_jobs_done", { tech_phone: techPhone }).catch(() => {});

  // Notify customer
  try {
    await sendWhatsAppMessage(
      job.customer_phone,
      `✅ *Job completed!*\n\nYour ${job.trade_required} job has been marked as done by your technician.\n\nThank you for using SnapFix! 🔧`
    );
  } catch (e) {
    console.error("[CompleteJob] WhatsApp notify failed:", e);
  }

  return NextResponse.json({ ok: true });
}
