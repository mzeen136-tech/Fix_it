import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ error: "Phone required" }, { status: 400 });
  }

  const { data: tech } = await supabase
    .from("technicians")
    .select("telegram_chat_id")
    .eq("phone_number", phone)
    .single();

  return NextResponse.json({ 
    linked: !!tech?.telegram_chat_id,
    telegram_chat_id: tech?.telegram_chat_id || null 
  });
}