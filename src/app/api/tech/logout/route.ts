import { NextResponse } from "next/server";
import { TECH_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TECH_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
