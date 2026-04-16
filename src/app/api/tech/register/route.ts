import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase, TRADES, CITIES } from "@/lib/supabase";

function normalizePhone(raw: string): string {
  let p = raw.trim().replace(/[\s\-().]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0"))  p = "92" + p.slice(1);
  return p;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone_number: rawPhone, trade, city, area, experience_years, password } = body;

  const phone_number = normalizePhone(rawPhone ?? "");

  // ── Validation ────────────────────────────────────────────────────────────
  const errs: string[] = [];

  if (!name?.trim() || name.trim().length < 2)
    errs.push("Full name must be at least 2 characters.");

  if (!/^923\d{9}$/.test(phone_number))
    errs.push("Phone must be 11–12 digits in format 923001234567 (or 03001234567).");

  if (!(TRADES as readonly string[]).includes(trade))
    errs.push(`Trade must be one of: ${(TRADES as readonly string[]).join(", ")}.`);

  if (!(CITIES as readonly string[]).includes(city))
    errs.push("Please select a valid city.");

  if (!password || password.length < 6)
    errs.push("Password must be at least 6 characters.");

  if (errs.length > 0)
    return NextResponse.json({ error: errs.join(" ") }, { status: 400 });

  // ── Duplicate check ───────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("technicians").select("phone_number, name")
    .eq("phone_number", phone_number).maybeSingle();

  if (existing)
    return NextResponse.json(
      { error: `Phone ${phone_number} is already registered as ${existing.name}. Contact admin if you need to update your details.` },
      { status: 409 }
    );

  const password_hash = await bcrypt.hash(password, 10);

  const { error } = await supabase.from("technicians").insert({
    phone_number,
    name: name.trim(),
    trade,
    city,
    area: area?.trim() || null,
    service_area: [city, area?.trim()].filter(Boolean).join(", "),
    experience_years: Math.max(0, parseInt(experience_years) || 0),
    password_hash,
    is_active: false,
    approval_status: "pending",
    registration_source: "portal",
  });

  if (error) {
    console.error("[Tech Register]", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
