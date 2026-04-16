import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

function normalizePhone(raw: string): string {
  let p = (raw ?? "").trim().replace(/[\s\-().]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0"))  p = "92" + p.slice(1);
  return p;
}

// ── GET — list techs ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");

  let query = supabase
    .from("technicians")
    .select("phone_number,name,trade,city,area,service_area,is_active,approval_status,experience_years,total_jobs_done,registration_source,created_at")
    .order("created_at", { ascending: false });

  if (filter === "pending") query = query.eq("approval_status", "pending");
  if (filter === "active")  query = query.eq("is_active", true).eq("approval_status", "approved");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ── POST — add single tech (manual form) ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone_number: rawPhone, trade, city, area, experience_years, cnic } = body;

  const phone_number = normalizePhone(rawPhone ?? "");

  if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!/^923\d{9}$/.test(phone_number))
    return NextResponse.json({ error: "Invalid phone. Use 923001234567 or 03001234567." }, { status: 400 });
  if (!trade) return NextResponse.json({ error: "Trade is required." }, { status: 400 });

  // Check duplicate
  const { data: exists } = await supabase
    .from("technicians").select("phone_number")
    .eq("phone_number", phone_number).maybeSingle();

  if (exists)
    return NextResponse.json({ error: "duplicate", phone_number }, { status: 409 });

  // Generate a default password (tech resets via portal if needed)
  const password_hash = await bcrypt.hash(phone_number.slice(-6), 10);

  const { error } = await supabase.from("technicians").upsert({
    phone_number,
    name: name.trim(),
    trade,
    city: city || null,
    area: area?.trim() || null,
    service_area: [city, area?.trim()].filter(Boolean).join(", ") || city || "Pakistan",
    experience_years: parseInt(experience_years) || 0,
    cnic: cnic?.trim() || null,
    password_hash,
    is_active: true,
    approval_status: "approved",
    registration_source: "admin",
  }, { onConflict: "phone_number" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── PUT — bulk import from Excel (parsed client-side, sent as JSON array) ─────
export async function PUT(req: NextRequest) {
  const { rows } = await req.json() as { rows: Record<string, string>[] };
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "No rows provided." }, { status: 400 });

  const results: { phone: string; name: string; status: "added" | "duplicate" | "error"; reason?: string }[] = [];

  for (const row of rows) {
    const phone_number = normalizePhone(row.phone ?? row.Phone ?? row.phone_number ?? "");
    const name  = (row.name  ?? row.Name  ?? "").trim();
    const trade = (row.trade ?? row.Trade ?? "").trim();
    const city  = (row.city  ?? row.City  ?? "").trim();
    const area  = (row.area  ?? row.Area  ?? "").trim();
    const cnic  = (row.cnic  ?? row.CNIC  ?? "").trim();
    const exp   = parseInt(row.experience_years ?? row.Experience ?? "0") || 0;

    if (!name || !/^923\d{9}$/.test(phone_number)) {
      results.push({ phone: phone_number, name, status: "error", reason: "Invalid name or phone" });
      continue;
    }

    const { data: exists } = await supabase
      .from("technicians").select("phone_number")
      .eq("phone_number", phone_number).maybeSingle();

    if (exists) {
      results.push({ phone: phone_number, name, status: "duplicate" });
      continue;
    }

    const password_hash = await bcrypt.hash(phone_number.slice(-6), 10);
    const { error } = await supabase.from("technicians").insert({
      phone_number, name, trade: trade || "Other",
      city: city || null, area: area || null,
      service_area: [city, area].filter(Boolean).join(", ") || "Pakistan",
      experience_years: exp,
      cnic: cnic || null,
      password_hash,
      is_active: true, approval_status: "approved", registration_source: "admin",
    });

    results.push({
      phone: phone_number, name,
      status: error ? "error" : "added",
      reason: error?.message,
    });
  }

  return NextResponse.json({ results });
}

// ── PATCH — update status ─────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const { phone_number, action } = await req.json();
  const map: Record<string, Record<string, unknown>> = {
    approve:    { approval_status: "approved", is_active: true },
    reject:     { approval_status: "rejected", is_active: false },
    deactivate: { is_active: false },
    activate:   { is_active: true },
  };
  const update = map[action];
  if (!update) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const { error } = await supabase.from("technicians").update(update).eq("phone_number", phone_number);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { phone_number } = await req.json();
  const { error } = await supabase.from("technicians").delete().eq("phone_number", phone_number);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
