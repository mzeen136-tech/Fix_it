import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyToken, TECH_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(TECH_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyToken(token);
  if (!payload || payload.role !== "tech") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phone = payload.sub;

  // Get tech profile
  const { data: tech } = await supabase
    .from("technicians")
    .select("name,trade,city,area,experience_years,total_jobs_done,is_active,approval_status,created_at")
    .eq("phone_number", phone)
    .single();

  // Get jobs where this tech was assigned
  const { data: jobs } = await supabase
    .from("active_jobs")
    .select("job_id,trade_required,problem_summary,status,customer_city,customer_area,bids,created_at,updated_at")
    .eq("assigned_tech_phone", phone)
    .order("updated_at", { ascending: false })
    .limit(20);

  // Get open bidding jobs for this trade
  const { data: openJobs } = await supabase
    .from("active_jobs")
    .select("job_id,trade_required,problem_summary,customer_city,customer_area,bids,created_at")
    .eq("trade_required", tech?.trade ?? "Other")
    .eq("status", "bidding")
    .order("created_at", { ascending: false })
    .limit(10);

  // Calculate earnings from bids on assigned jobs
  const earnings = (jobs ?? [])
    .filter(j => j.status === "completed")
    .map(j => {
      const myBid = (j.bids ?? []).find((b: { tech_phone: string }) => b.tech_phone === phone);
      const numStr = myBid?.price?.replace(/[^0-9]/g, "") ?? "0";
      return parseInt(numStr) || 0;
    })
    .reduce((a: number, b: number) => a + b, 0);

  return NextResponse.json({ tech, jobs, openJobs, earnings });
}
