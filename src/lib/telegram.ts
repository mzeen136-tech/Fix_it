import TelegramBot from "node-telegram-bot-api";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

const bot = TELEGRAM_BOT_TOKEN ? new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false }) : null;

interface TelegramButton {
  text: string;
  url: string;
}

export async function sendTelegramMessage(
  chatId: string,
  message: string,
  buttons?: TelegramButton[]
): Promise<boolean> {
  if (!bot) {
    console.warn("[Telegram] Bot not configured");
    return false;
  }

  try {
    const options: TelegramBot.SendMessageOptions = {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    };

    if (buttons && buttons.length > 0) {
      options.reply_markup = {
        inline_keyboard: buttons.map((btn) => [{ text: btn.text, url: btn.url }]),
      };
    }

    await bot.sendMessage(chatId, message, options);
    console.log(`[Telegram] ✅ Sent to ${chatId}`);
    return true;
  } catch (err) {
    console.error(`[Telegram] ❌ Failed to ${chatId}:`, err);
    return false;
  }
}

export async function broadcastTelegramMessage(
  recipients: { chatId: string; name: string }[],
  message: string,
  buttons?: TelegramButton[]
): Promise<{ sent: number; failed: number }> {
  console.log(`[Telegram] Broadcasting to ${recipients.length} recipient(s)`);

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const success = await sendTelegramMessage(recipient.chatId, message, buttons);
    if (success) sent++;
    else failed++;
  }

  console.log(`[Telegram] Broadcast: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}