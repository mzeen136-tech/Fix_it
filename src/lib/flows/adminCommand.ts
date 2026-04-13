import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

const VALID_TRADES = ["Plumber", "Electrician", "HVAC", "Carpenter", "Painter", "Other"];

/**
 * Flow 1 — Admin command
 * Trigger: sender === ADMIN_PHONE && message starts with /add
 * Format:  /add Trade, Name, 923XXXXXXXXX, City
 */
export async function handleAdminCommand(
  adminPhone: string,
  messageText: string
): Promise<void> {
  console.log(`[Flow1] Admin command: ${messageText}`);

  const parts = messageText.replace("/add", "").split(",").map((s) => s.trim());

  if (parts.length < 4) {
    await sendWhatsAppMessage(
      adminPhone,
      "❌ Wrong format.\n\nUse:\n/add Trade, Name, 923XXXXXXXXX, City\n\nExample:\n/add Plumber, Ali, 923001234567, Islamabad"
    );
    return;
  }

  const [trade, name, phone_number, service_area] = parts;

  // Validate trade
  if (!VALID_TRADES.includes(trade)) {
    await sendWhatsAppMessage(
      adminPhone,
      `❌ Invalid trade: "${trade}"\n\nValid trades:\n${VALID_TRADES.join(", ")}`
    );
    return;
  }

  // Validate phone number format (Pakistani numbers: 923XXXXXXXXX)
  if (!/^923\d{9}$/.test(phone_number)) {
    await sendWhatsAppMessage(
      adminPhone,
      `❌ Invalid phone: "${phone_number}"\n\nUse format: 923001234567 (no spaces, no +)`
    );
    return;
  }

  // Upsert — allows re-adding an existing tech to update their details
  const { error } = await supabase.from("technicians").upsert(
    { phone_number, name, trade, service_area, is_active: true },
    { onConflict: "phone_number" }
  );

  if (error) {
    console.error("[Flow1] Supabase upsert error:", error);
    await sendWhatsAppMessage(adminPhone, `❌ Database error: ${error.message}`);
    return;
  }

  await sendWhatsAppMessage(
    adminPhone,
    `✅ *${name}* saved as *${trade}* in ${service_area}.\nPhone: ${phone_number}`
  );

  console.log(`[Flow1] Saved technician: ${name} (${phone_number})`);
}
