import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter"); // "pending" | "active" | "all"

  let query = supabase
    .from("technicians")
    .select("phone_number,name,trade,city,area,service_area,is_active,approval_status,experience_years,total_jobs_done,registration_source,created_at")
    .order("created_at", { ascending: false });

  if (filter === "pending")  query = query.eq("approval_status", "pending");
  if (filter === "active")   query = query.eq("is_active", true).eq("approval_status", "approved");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const { phone_number, action } = await req.json();

  let update: Record<string, unknown> = {};
  if (action === "approve")     update = { approval_status: "approved", is_active: true };
  if (action === "reject")      update = { approval_status: "rejected", is_active: false };
  if (action === "deactivate")  update = { is_active: false };
  if (action === "activate")    update = { is_active: true };

  const { error } = await supabase
    .from("technicians")
    .update(update)
    .eq("phone_number", phone_number);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { phone_number } = await req.json();
  const { error } = await supabase
    .from("technicians")
    .delete()
    .eq("phone_number", phone_number);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
