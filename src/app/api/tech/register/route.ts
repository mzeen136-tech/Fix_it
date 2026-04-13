import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase, TRADES, CITIES } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone_number, trade, city, area, experience_years, password } = body;

  // Validation
  if (!name || !phone_number || !trade || !city || !password) {
    return NextResponse.json({ error: "All required fields must be filled." }, { status: 400 });
  }
  if (!/^923\d{9}$/.test(phone_number)) {
    return NextResponse.json({ error: "Phone must be format: 923001234567" }, { status: 400 });
  }
  if (!(TRADES as readonly string[]).includes(trade)) {
    return NextResponse.json({ error: "Invalid trade selected." }, { status: 400 });
  }
  if (!(CITIES as readonly string[]).includes(city)) {
    return NextResponse.json({ error: "Invalid city selected." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  // Check if already registered
  const { data: existing } = await supabase
    .from("technicians")
    .select("phone_number")
    .eq("phone_number", phone_number)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "This phone number is already registered." }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { error } = await supabase.from("technicians").insert({
    phone_number,
    name,
    trade,
    city,
    area: area || null,
    service_area: [city, area].filter(Boolean).join(", "),
    experience_years: parseInt(experience_years) || 0,
    password_hash,
    is_active: false,               // inactive until admin approves
    approval_status: "pending",
    registration_source: "portal",
  });

  if (error) {
    console.error("[Tech Register]", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
