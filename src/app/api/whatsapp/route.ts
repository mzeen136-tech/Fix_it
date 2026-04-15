import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { handleAdminCommand }       from "@/lib/flows/adminCommand";
import { handleCustomerIntake }     from "@/lib/flows/customerIntake";
import { handleTechnicianBid }      from "@/lib/flows/technicianBid";
import { handleCustomerAcceptance } from "@/lib/flows/customerAccept";
import { sendWhatsAppMessage }      from "@/lib/whatsapp";
import { isGreeting, looksLikeAdminCommand } from "@/lib/gemini";

// ── GET — Meta webhook verification ──────────────────────────────────────────

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

// ── POST — Incoming message router ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body    = await req.json();
    const value   = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    // Ignore delivery receipts, read notifications, etc.
    if (!message) return NextResponse.json({ status:"ok" }, { status:200 });

    const senderPhone: string = message.from;
    const messageType: string = message.type; // text | image | audio | document
    const messageText: string = message.text?.body?.trim() ?? "";

    if (!senderPhone) return NextResponse.json({ status:"ok" }, { status:200 });

    console.log(`[SnapFix] ${messageType} from ${senderPhone}: "${messageText}"`);

    // ── Step 1: Admin check — ALWAYS first, before any DB lookup ─────────────
    // Critical: admin phone may also be registered as a tech.
    // Admin commands must never be routed to the tech bid flow.

    const isAdmin = senderPhone === process.env.ADMIN_PHONE;

    if (isAdmin) {
      if (messageText.toLowerCase().startsWith("/add")) {
        await handleAdminCommand(senderPhone, messageText);
      } else if (messageText.startsWith("/")) {
        // Unknown slash command from admin
        await sendWhatsAppMessage(senderPhone,
          `❓ Unknown command.\n\nAvailable commands:\n/add Trade, Name, 923XXXXXXXXX, City\n\nExample:\n/add Plumber, Ali, 923001234567, Islamabad`
        );
      } else {
        // Admin sending a plain message — treat as customer for testing
        await handleCustomerIntake(senderPhone, messageText);
      }
      return NextResponse.json({ status:"ok" }, { status:200 });
    }

    // ── Step 2: Block non-text messages early ─────────────────────────────────
    // Image/audio/doc with no prior conversation context → ask for text

    if (messageType !== "text") {
      const { data: conv } = await supabase
        .from("conversation_state")
        .select("state")
        .eq("phone", senderPhone)
        .maybeSingle();

      if (!conv || conv.state === "idle") {
        await sendWhatsAppMessage(senderPhone,
          "📸 We received your file! Please *describe your problem in text* so we can find you the right technician.\n\nExample: \"My kitchen pipe is leaking\" or \"AC is not cooling\""
        );
        return NextResponse.json({ status:"ok" }, { status:200 });
      }
      // If they're mid-conversation, continue with empty text — state machine handles it
    }

    // ── Step 3: Block slash commands from non-admins ──────────────────────────
    if (looksLikeAdminCommand(messageText)) {
      await sendWhatsAppMessage(senderPhone,
        "❌ That command is not recognised. If you need help, just describe your home service problem!"
      );
      return NextResponse.json({ status:"ok" }, { status:200 });
    }

    // ── Step 4: Tech lookup ───────────────────────────────────────────────────

    const { data: techRow } = await supabase
      .from("technicians")
      .select("phone_number, approval_status")
      .eq("phone_number", senderPhone)
      .eq("is_active", true)
      .maybeSingle();

    const isTech = !!techRow && techRow.approval_status === "approved";

    if (techRow && techRow.approval_status === "pending") {
      await sendWhatsAppMessage(senderPhone,
        "⏳ Your SnapFix account is pending admin approval.\nYou'll be notified on WhatsApp once activated.\n\nآپ کا اکاؤنٹ زیر جائزہ ہے۔"
      );
      return NextResponse.json({ status:"ok" }, { status:200 });
    }

    // Unregistered person sending what looks like a bid — redirect to portal
    if (!techRow && !isTech && messageText.match(/^(rs\.|rupees?|hazar|rupe|pkr|\d{3,5})/i)) {
      const url = `${process.env.NEXT_PUBLIC_APP_URL}/tech/register`;
      await sendWhatsAppMessage(senderPhone,
        `🔧 Want to receive jobs on SnapFix?\n\nRegister as a technician:\n${url}\n\nکام پانے کے لیے رجسٹر کریں:\n${url}`
      );
      return NextResponse.json({ status:"ok" }, { status:200 });
    }

    // ── Step 5: Route ─────────────────────────────────────────────────────────

    const isAccept = messageText.toUpperCase().startsWith("ACCEPT");

    if (!isTech && isAccept) {
      await handleCustomerAcceptance(senderPhone, messageText);

    } else if (!isTech) {
      // Handle greetings without burning a Gemini call
      if (isGreeting(messageText) && !await hasOpenConversation(senderPhone)) {
        await sendWhatsAppMessage(senderPhone,
          "Assalam o Alaikum! 👋 Welcome to *SnapFix*.\n\n" +
          "I connect you with trusted home service technicians — Plumbers, Electricians, HVAC, Carpenters, and Painters.\n\n" +
          "Just describe your problem and share your city/area to get started!\n\n" +
          "_واٹس ایپ پر بھروسہ مند تکنیشن سے جڑیں_"
        );
      } else {
        await handleCustomerIntake(senderPhone, messageText);
      }

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

// ── Helper: check if customer has an open conversation ────────────────────────

async function hasOpenConversation(phone: string): Promise<boolean> {
  const { data } = await supabase
    .from("conversation_state")
    .select("state")
    .eq("phone", phone)
    .neq("state", "idle")
    .maybeSingle();
  return !!data;
}
