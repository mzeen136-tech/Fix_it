import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

const VALID_TRADES = ["Plumber", "Electrician", "HVAC", "Carpenter", "Painter", "Other"];

const USAGE_MSG =
  "📋 *Format:*\n/add Trade, Name, 923XXXXXXXXX, City\n\n" +
  "✅ *Example:*\n/add HVAC, Ahmed, 923001234567, Islamabad\n\n" +
  `Valid trades: ${VALID_TRADES.join(", ")}`;

interface ParsedAdd {
  trade: string;
  name: string;
  phone_number: string;
  service_area: string;
}

/**
 * Flexible parser — supports both:
 *   Comma:  /add HVAC, Ahmed, 923001234567, Islamabad
 *   Space:  /add HVAC Ahmed 923001234567 Islamabad
 *   Mixed:  /add 923001234567 Ahmed HVAC Islamabad  (any order — phone+trade auto-detected)
 */
function parseAddCommand(raw: string): ParsedAdd | null {
  // Remove the /add prefix
  const text = raw.replace(/^\/add\s*/i, "").trim();
  if (!text) return null;

  // ── Try comma-separated first (most explicit, preferred format) ──────────
  const commaParts = text.split(",").map(s => s.trim()).filter(Boolean);
  if (commaParts.length >= 3) {
    // Standard: Trade, Name, Phone[, City]
    const phone = commaParts.find(p => /^92\d{10}$/.test(p));
    const trade = commaParts.find(p => VALID_TRADES.map(t => t.toLowerCase()).includes(p.toLowerCase()));
    if (phone && trade) {
      const tradeNorm = VALID_TRADES.find(t => t.toLowerCase() === trade.toLowerCase())!;
      const remaining = commaParts.filter(p => p !== phone && p.toLowerCase() !== trade.toLowerCase());
      return {
        trade: tradeNorm,
        name: remaining[0] || "Unknown",
        phone_number: phone,
        service_area: remaining.slice(1).join(", ") || "Not specified",
      };
    }
  }

  // ── Flexible auto-detect: phone by regex, trade by list ─────────────────
  // Normalize phone: +923... or 03... → 923...
  const phoneMatch = text.match(/\b(\+?92\d{10}|0\d{10})\b/);
  const rawPhone = phoneMatch?.[1];
  if (!rawPhone) return null; // phone is mandatory, can't proceed without it

  const normalizedPhone = rawPhone.startsWith("+")
    ? rawPhone.slice(1)
    : rawPhone.startsWith("0")
    ? "92" + rawPhone.slice(1)
    : rawPhone;

  // Find trade (case-insensitive)
  const tradeMatch = VALID_TRADES.find(t =>
    new RegExp(`\\b${t}\\b`, "i").test(text)
  );
  if (!tradeMatch) return null; // trade is mandatory

  // Strip phone and trade from text to extract name + city
  let remaining = text
    .replace(phoneMatch![0], "")
    .replace(new RegExp(`\\b${tradeMatch}\\b`, "i"), "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // If comma in remaining: "Name, City"
  if (remaining.includes(",")) {
    const [namePart, ...cityParts] = remaining.split(",").map(s => s.trim());
    return {
      trade: tradeMatch,
      name: namePart || "Unknown",
      phone_number: normalizedPhone,
      service_area: cityParts.join(", ") || "Not specified",
    };
  }

  // Known cities — extract city from remaining
  const KNOWN_CITIES = ["islamabad", "rawalpindi", "lahore", "karachi", "peshawar", "multan", "faisalabad", "quetta"];
  const cityFound = KNOWN_CITIES.find(c => remaining.toLowerCase().includes(c));

  if (cityFound) {
    const name = remaining.toLowerCase().replace(cityFound, "").replace(/\s+/g, " ").trim();
    return {
      trade: tradeMatch,
      name: name || "Unknown",
      phone_number: normalizedPhone,
      service_area: cityFound.charAt(0).toUpperCase() + cityFound.slice(1),
    };
  }

  // Last resort: first word(s) = name, rest = city
  const words = remaining.split(" ").filter(Boolean);
  return {
    trade: tradeMatch,
    name: words[0] || "Unknown",
    phone_number: normalizedPhone,
    service_area: words.slice(1).join(" ") || "Not specified",
  };
}

/**
 * Flow 1 — Admin command
 * Trigger: sender === ADMIN_PHONE && message starts with /add
 */
export async function handleAdminCommand(
  adminPhone: string,
  messageText: string
): Promise<void> {
  console.log(`[Flow1] Admin command: ${messageText}`);

  const parsed = parseAddCommand(messageText);

  if (!parsed) {
    await sendWhatsAppMessage(adminPhone, `❌ Could not parse the command.\n\n${USAGE_MSG}`);
    return;
  }

  const { trade, name, phone_number, service_area } = parsed;

  // Validate trade
  if (!VALID_TRADES.includes(trade)) {
    await sendWhatsAppMessage(
      adminPhone,
      `❌ Invalid trade: "${trade}"\n\nValid trades: ${VALID_TRADES.join(", ")}\n\n${USAGE_MSG}`
    );
    return;
  }

  // Validate phone (must be 923XXXXXXXXX — 12 digits)
  if (!/^923\d{9}$/.test(phone_number)) {
    await sendWhatsAppMessage(
      adminPhone,
      `❌ Invalid phone: "${phone_number}"\n\nUse format: 923001234567 (12 digits, no +, no spaces)\n\n${USAGE_MSG}`
    );
    return;
  }

  // Upsert — allows re-adding an existing tech to update their details
  const { error } = await supabase.from("technicians").upsert(
    { phone_number, name, trade, service_area, is_active: true, approval_status: "approved" },
    { onConflict: "phone_number" }
  );

  if (error) {
    console.error("[Flow1] Supabase upsert error:", error);
    await sendWhatsAppMessage(adminPhone, `❌ Database error: ${error.message}`);
    return;
  }

  await sendWhatsAppMessage(
    adminPhone,
    `✅ *${name}* saved!\n🔧 Trade: ${trade}\n📍 City: ${service_area}\n📞 Phone: ${phone_number}`
  );

  console.log(`[Flow1] Saved technician: ${name} (${phone_number})`);
}
