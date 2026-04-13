import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit  = parseInt(searchParams.get("limit") ?? "50");

  let query = supabase
    .from("active_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const { job_id, status } = await req.json();
  const { error } = await supabase
    .from("active_jobs")
    .update({ status })
    .eq("job_id", job_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
