import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

const VALID_TRADES = ["Plumber","Electrician","HVAC","Carpenter","Painter","Other"];

const HELP =
  `📋 *SnapFix Admin — Add Technician*\n\n` +
  `*Format (comma):*\n/add Trade, Name, 923XXXXXXXXX, City\n\n` +
  `*Format (space, short):*\n/add Trade Name 923XXXXXXXXX\n\n` +
  `*Examples:*\n` +
  `/add Plumber, Ali, 923001234567, Islamabad\n` +
  `/add HVAC Ahmed 923455060752\n` +
  `/add Electrician, Sara, 923119876543, Lahore\n\n` +
  `*Valid trades:* ${VALID_TRADES.join(", ")}`;

/**
 * Parses /add in multiple formats:
 *   Comma:        /add Plumber, Ali, 923001234567, Islamabad
 *   Space (3):    /add HVAC Ahmed 923455060752          (no city = "Other")
 *   Space (4):    /add HVAC Ahmed 923455060752 Islamabad
 *   Mixed:        / add,923239852242, dawood, plumber   (WhatsApp auto-link format)
 */
function parseAddCommand(raw: string): {
  trade: string; name: string; phone_number: string; service_area: string;
} | null {
  // Strip the command prefix — handle "/ add" (space after slash, WhatsApp quirk)
  const body = raw.replace(/^\/\s*add\s*/i, "").trim();
  if (!body) return null;

  // Normalise: collapse multiple spaces
  const normalised = body.replace(/\s+/g, " ");

  // ── Try comma-separated first ─────────────────────────────────────────────
  if (normalised.includes(",")) {
    const parts = normalised.split(",").map(s => s.trim()).filter(Boolean);

    // Detect if user put phone first (WhatsApp auto-link format):
    // /add,923239852242, dawood, plumber  → phone, name, trade
    const phonePattern = /^923\d{9}$/;

    if (phonePattern.test(parts[0])) {
      // Order: phone, name, trade [, city]
      const [phone_number, name, trade, service_area = "Other"] = parts;
      return { trade, name, phone_number, service_area };
    }

    // Normal order: trade, name, phone [, city]
    if (parts.length >= 3) {
      const [trade, name, phone_number, service_area = "Pakistan"] = parts;
      return { trade, name, phone_number, service_area };
    }

    return null;
  }

  // ── Space-separated ───────────────────────────────────────────────────────
  const tokens = normalised.split(" ");
  if (tokens.length < 3) return null;

  // Find the phone token (923XXXXXXXXX pattern)
  const phoneIdx = tokens.findIndex(t => /^923\d{9}$/.test(t));
  if (phoneIdx === -1) return null;

  const phone_number = tokens[phoneIdx];

  // Everything before phone: first token = trade, rest = name
  const before = tokens.slice(0, phoneIdx);
  if (before.length < 2) return null;
  const trade = before[0];
  const name  = before.slice(1).join(" ");

  // Everything after phone = city
  const service_area = tokens.slice(phoneIdx + 1).join(" ") || "Pakistan";

  return { trade, name, phone_number, service_area };
}

export async function handleAdminCommand(
  adminPhone: string,
  messageText: string
): Promise<void> {
  console.log(`[Flow1] Admin command: ${messageText}`);

  const parsed = parseAddCommand(messageText);

  if (!parsed) {
    await sendWhatsAppMessage(adminPhone, HELP);
    return;
  }

  const { trade, name, phone_number, service_area } = parsed;

  // Validate trade (case-insensitive match)
  const matchedTrade = VALID_TRADES.find(t => t.toLowerCase() === trade.toLowerCase());
  if (!matchedTrade) {
    await sendWhatsAppMessage(adminPhone,
      `❌ Invalid trade: "${trade}"\n\nValid trades:\n${VALID_TRADES.join(", ")}\n\nTry again or send /add for help.`
    );
    return;
  }

  // Validate phone
  if (!/^923\d{9}$/.test(phone_number)) {
    await sendWhatsAppMessage(adminPhone,
      `❌ Invalid phone: "${phone_number}"\n\nFormat: 923001234567 (no + or spaces)\n\nExample: 923001234567`
    );
    return;
  }

  // Upsert — adding existing tech updates their info
  const { error } = await supabase.from("technicians").upsert(
    {
      phone_number,
      name: name.trim(),
      trade: matchedTrade,
      service_area,
      city: service_area !== "Pakistan" && service_area !== "Other" ? service_area : null,
      is_active: true,
      approval_status: "approved",
      registration_source: "admin",
    },
    { onConflict: "phone_number" }
  );

  if (error) {
    console.error("[Flow1] Supabase error:", error);
    await sendWhatsAppMessage(adminPhone, `❌ Database error: ${error.message}`);
    return;
  }

  await sendWhatsAppMessage(adminPhone,
    `✅ *${name.trim()}* saved as *${matchedTrade}*\n📍 ${service_area}\n📞 ${phone_number}\n\nThey can now receive job alerts.`
  );

  console.log(`[Flow1] Saved: ${name} (${phone_number}) as ${matchedTrade}`);
}
