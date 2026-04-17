import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

const bot = TELEGRAM_BOT_TOKEN ? new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false }) : null;

export async function POST(req: NextRequest) {
  if (!bot) {
    return NextResponse.json({ error: "Telegram bot not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { chatId, message, buttons } = body;

    if (!chatId || !message) {
      return NextResponse.json({ error: "Missing chatId or message" }, { status: 400 });
    }

    const options: TelegramBot.SendMessageOptions = {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    };

    if (buttons && buttons.length > 0) {
      options.reply_markup = {
        inline_keyboard: buttons.map((btn: { text: string; url: string }) => [
          { text: btn.text, url: btn.url },
        ]),
      };
    }

    await bot.sendMessage(chatId, message, options);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Telegram] Error:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (token !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse("OK", { status: 200 });
}