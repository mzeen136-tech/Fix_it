import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { handleAdminCommand }      from "@/lib/flows/adminCommand";
import { handleCustomerIntake }    from "@/lib/flows/customerIntake";
import { handleTechnicianBid }     from "@/lib/flows/technicianBid";
import { handleCustomerAcceptance } from "@/lib/flows/customerAccept";
import { sendWhatsAppMessage }     from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[SnapFix] Webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body    = await req.json();
    const value   = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message) return NextResponse.json({ status:"ok" }, { status:200 });

    const senderPhone: string = message.from;
    const messageType: string = message.type;
    const messageText: string = message.text?.body?.trim() ?? "";

    if (!senderPhone) return NextResponse.json({ status:"ok" }, { status:200 });

    console.log(`[SnapFix] ${messageType} from ${senderPhone}: "${messageText}"`);

    const isAdmin  = senderPhone === process.env.ADMIN_PHONE;
    const isAccept = messageText.toUpperCase().startsWith("ACCEPT");

    let isTech = false;
    if (!isAdmin) {
      const { data } = await supabase
        .from("technicians")
        .select("phone_number, approval_status")
        .eq("phone_number", senderPhone)
        .eq("is_active", true)
        .maybeSingle();
      isTech = !!data && data.approval_status === "approved";

      // Registered but not yet approved — tell them to wait
      if (data && data.approval_status === "pending") {
        await sendWhatsAppMessage(senderPhone,
          "⏳ Your SnapFix account is pending approval. You'll be notified once activated.\n\n" +
          "آپ کا اکاؤنٹ زیر جائزہ ہے۔");
        return NextResponse.json({ status:"ok" }, { status:200 });
      }

      // Unregistered tech trying to bid — redirect to portal
      if (!data && !isAdmin && !isTech && messageText.match(/^(rs\.|rupee|price|2\d{3}|\d+\s*minute)/i)) {
        const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tech/register`;
        await sendWhatsAppMessage(senderPhone,
          `🔧 Want to receive jobs on SnapFix?\n\nRegister as a technician here:\n${portalUrl}\n\n` +
          `کام پانے کے لیے رجسٹر کریں:\n${portalUrl}`);
        return NextResponse.json({ status:"ok" }, { status:200 });
      }
    }

    // Router
    if (isAdmin && messageText.startsWith("/add")) {
      await handleAdminCommand(senderPhone, messageText);
    } else if (!isTech && !isAdmin && isAccept) {
      await handleCustomerAcceptance(senderPhone, messageText);
    } else if (!isTech && !isAdmin) {
      await handleCustomerIntake(senderPhone, messageText || `[${messageType} received]`);
    } else if (isTech && !isAccept) {
      await handleTechnicianBid(senderPhone, messageText);
    } else {
      console.log(`[SnapFix] No route matched for ${senderPhone}`);
    }

  } catch (err) {
    console.error("[SnapFix] Webhook error:", err);
  }
  return NextResponse.json({ status:"ok" }, { status:200 });
}
