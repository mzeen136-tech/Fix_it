// WhatsApp Cloud API sender utility
// Handles single sends and parallel broadcast with exponential-backoff retry.

const BASE_URL = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

// ── Core sender with retry + exponential back-off ────────────────────────────

export async function sendWhatsAppMessage(
  to: string,
  body: string,
  maxRetries = 3
): Promise<void> {
  const payload = JSON.stringify({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let res: Response;

    try {
      res = await fetch(BASE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: payload,
      });
    } catch (networkErr) {
      // Network-level failure (DNS, timeout, etc.)
      if (attempt === maxRetries) {
        console.error(`[WA] Network error after ${maxRetries} attempts to ${to}:`, networkErr);
        throw networkErr;
      }
      await sleep(backoff(attempt));
      continue;
    }

    if (res.ok) {
      console.log(`[WA] ✅ Sent to ${to}`);
      return;
    }

    const errBody = await res.json().catch(() => ({}));

    if (res.status === 429 || res.status >= 500) {
      // Rate-limited or server error — retry
      if (attempt < maxRetries) {
        console.warn(`[WA] ${res.status} on attempt ${attempt}/${maxRetries}. Retrying…`);
        await sleep(backoff(attempt));
        continue;
      }
    }

    // 4xx client error — don't retry, throw immediately
    console.error(`[WA] ❌ Failed to send to ${to} (${res.status}):`, errBody);
    throw new Error(`WhatsApp API error ${res.status}: ${JSON.stringify(errBody)}`);
  }
}

// ── Broadcast: parallel send to multiple recipients ───────────────────────────
// Uses Promise.allSettled so ONE failed delivery never kills the others.
// Returns counts so callers can report accurate results to the customer.

export async function broadcastWhatsAppMessage(
  recipients: string[],
  message: string
): Promise<{ sent: number; failed: number }> {
  console.log(`[WA] Broadcasting to ${recipients.length} recipient(s)`);

  const results = await Promise.allSettled(
    recipients.map((phone) => sendWhatsAppMessage(phone, message))
  );

  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") sent++;
    else {
      failed++;
      console.error("[WA] Broadcast send failed:", r.reason);
    }
  }

  if (failed > 0) {
    console.warn(`[WA] Broadcast: ${sent} sent, ${failed} failed`);
  }
  return { sent, failed };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoff(attempt: number) {
  // 2s, 4s, 8s … capped at 10s
  return Math.min(Math.pow(2, attempt) * 1000, 10_000);
}
