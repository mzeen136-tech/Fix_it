import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function normalizePhone(raw: string): string {
  let p = (raw ?? "").trim().replace(/[\s\-().]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = "92" + p.slice(1);
  return p;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone_number, telegram_chat_id } = body;

    if (!phone_number || !telegram_chat_id) {
      return NextResponse.json(
        { error: "phone_number and telegram_chat_id are required" },
        { status: 400 }
      );
    }

    const phone = normalizePhone(phone_number);

    const { error } = await supabase
      .from("technicians")
      .update({ telegram_chat_id })
      .eq("phone_number", phone);

    if (error) {
      console.error("[Telegram Link] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Telegram linked successfully" });
  } catch (err) {
    console.error("[Telegram Link] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}