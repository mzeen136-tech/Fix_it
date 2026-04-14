import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { handleAdminCommand }       from "@/lib/flows/adminCommand";
import { handleCustomerIntake }     from "@/lib/flows/customerIntake";
import { handleTechnicianBid }      from "@/lib/flows/technicianBid";
import { handleCustomerAcceptance } from "@/lib/flows/customerAccept";
import { sendWhatsAppMessage }      from "@/lib/whatsapp";

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
    if (!message) return NextResponse.json({ status: "ok" }, { status: 200 });

    const senderPhone: string = message.from;
    const messageType: string = message.type;

    // Extract text — also pull caption from media messages so we don't lose info
    const messageText: string =
      message.text?.body?.trim() ||
      message.image?.caption?.trim() ||
      message.video?.caption?.trim() ||
      message.document?.caption?.trim() ||
      "";

    // If truly no text and it's a media type, pass a typed placeholder
    const effectiveText: string = messageText || (messageType !== "text" ? `[${messageType} received]` : "");

    if (!senderPhone) return NextResponse.json({ status: "ok" }, { status: 200 });

    console.log(`[SnapFix] ${messageType} from ${senderPhone}: "${effectiveText}"`);

    const isAdmin  = senderPhone === process.env.ADMIN_PHONE;
    const isAccept = effectiveText.toUpperCase().startsWith("ACCEPT");

    // ── Identify if sender is a registered technician ────────────────────────
    let isTech = false;
    let techStatus: string | null = null;

    if (!isAdmin) {
      const { data } = await supabase
        .from("technicians")
        .select("phone_number, approval_status")
        .eq("phone_number", senderPhone)
        .eq("is_active", true)
        .maybeSingle();

      if (data) {
        techStatus = data.approval_status;
        isTech = data.approval_status === "approved";
      }

      // Registered but not yet approved — tell them to wait
      if (techStatus === "pending") {
        await sendWhatsAppMessage(
          senderPhone,
          "⏳ Your SnapFix account is pending approval. You'll be notified once activated.\n\nآپ کا اکاؤنٹ زیر جائزہ ہے۔"
        );
        return NextResponse.json({ status: "ok" }, { status: 200 });
      }

      // Unknown sender sending a bid-like message → redirect to register
      if (!data && !isAdmin) {
        const looksLikeBid = /\b(rs\.?|pkr|rupee|\d{3,})\b/i.test(effectiveText) &&
                             /\b(hour|hr|min|minute|eta|arrive)\b/i.test(effectiveText);
        if (looksLikeBid) {
          const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tech/register`;
          await sendWhatsAppMessage(
            senderPhone,
            `🔧 Want to receive jobs on SnapFix?\n\nRegister as a technician here:\n${portalUrl}\n\nکام پانے کے لیے رجسٹر کریں:\n${portalUrl}`
          );
          return NextResponse.json({ status: "ok" }, { status: 200 });
        }
      }
    }

    // ── Main Router ───────────────────────────────────────────────────────────

    if (isAdmin) {
      if (effectiveText.startsWith("/add")) {
        // Admin adding a technician
        await handleAdminCommand(senderPhone, effectiveText);
      } else if (effectiveText.startsWith("/")) {
        // Admin sent an unknown / command — give helpful feedback
        await sendWhatsAppMessage(
          senderPhone,
          "❓ Unknown command.\n\nAvailable commands:\n*/add Trade, Name, 923XXXXXXXXX, City*\n\nExample:\n/add HVAC, Dawood, 923001234567, Islamabad"
        );
      } else {
        // Admin sent a plain message — treat as test/no-op, acknowledge it
        await sendWhatsAppMessage(
          senderPhone,
          "👋 Admin panel active. Use */add Trade, Name, Phone, City* to register a technician."
        );
      }

    } else if (isTech) {
      if (isAccept) {
        // Technician tried to accept — clarify they're not a customer
        await sendWhatsAppMessage(
          senderPhone,
          "ℹ️ You're registered as a *technician* on SnapFix. Only customers can accept bids.\n\nTo place a bid, simply reply with your *price and ETA*.\nExample: Rs. 2500, 30 minutes"
        );
      } else {
        // Normal technician bid or message
        await handleTechnicianBid(senderPhone, effectiveText);
      }

    } else if (!isAdmin && isAccept) {
      // Customer accepting a bid
      await handleCustomerAcceptance(senderPhone, effectiveText);

    } else {
      // Regular customer intake
      await handleCustomerIntake(senderPhone, effectiveText);
    }

  } catch (err) {
    console.error("[SnapFix] Webhook error:", err);
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
