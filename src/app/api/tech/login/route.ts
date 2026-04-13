import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { signToken, TECH_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { phone_number, password } = await req.json();

  const { data: tech } = await supabase
    .from("technicians")
    .select("phone_number, name, password_hash, approval_status, is_active")
    .eq("phone_number", phone_number)
    .single();

  if (!tech || !tech.password_hash) {
    return NextResponse.json({ error: "Phone number not found." }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, tech.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  if (tech.approval_status === "pending") {
    return NextResponse.json({
      error: "Your account is pending admin approval. You'll be notified on WhatsApp once approved.",
    }, { status: 403 });
  }

  if (tech.approval_status === "rejected") {
    return NextResponse.json({
      error: "Your registration was not approved. Please contact support.",
    }, { status: 403 });
  }

  const token = await signToken({
    sub: tech.phone_number,
    role: "tech",
    name: tech.name,
  });

  const res = NextResponse.json({ ok: true, name: tech.name });
  res.cookies.set(TECH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return res;
}
