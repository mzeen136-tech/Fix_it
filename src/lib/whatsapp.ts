// WhatsApp Cloud API sender utility
// Handles single sends and parallel broadcast with exponential-backoff retry.
// Uses template messages for business-initiated outreach (required by Meta)

const BASE_URL = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

interface WhatsAppError {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_data?: {
      messaging_product?: string;
      details?: string;
    };
  };
}

// ── Template message sender ───────────────────────────────────────────────────
// Meta requires template messages for business-initiated conversations
// Template must be created in Meta Business Console: https://business.facebook.com/

async function sendTemplateMessage(to: string, body: string): Promise<boolean> {
  // Template payload - will fail if template doesn't exist, which is expected
  const templatePayload = JSON.stringify({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: "job_alert",
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: body.slice(0, 60) }
          ]
        }
      ]
    }
  });

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: templatePayload,
  });

  if (!res.ok) {
    const err: WhatsAppError = await res.json().catch(() => ({}));
    console.warn(`[WA] Template failed for ${to}: ${res.status} - ${err?.error?.message || 'unknown'}`);
    return false;
  }

  return true;
}

// ── Core sender with retry + fallback ─────────────────────────────────────────

export async function sendWhatsAppMessage(
  to: string,
  body: string,
  maxRetries = 3
): Promise<void> {
  // First try template message (required for business-initiated outreach)
  try {
    const templateWorked = await sendTemplateMessage(to, body);
    if (templateWorked) {
      console.log(`[WA] ✅ Template sent to ${to}`);
      return;
    }
  } catch (e) {
    console.warn(`[WA] Template attempt failed:`, e);
  }

  // If template fails, try free-form text (works if customer replied within 24h)
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
      if (attempt === maxRetries) {
        console.error(`[WA] Network error after ${maxRetries} attempts to ${to}:`, networkErr);
        throw networkErr;
      }
      await sleep(backoff(attempt));
      continue;
    }

    if (res.ok) {
      console.log(`[WA] ✅ Free-form sent to ${to}`);
      return;
    }

    const errBody = await res.json().catch(() => ({}));
    console.error(`[WA] ❌ Failed to send to ${to} (${res.status}):`, errBody);

    // Don't throw for 4xx - just log and return
    if (res.status >= 400 && res.status < 500) {
      console.warn(`[WA] Client error ${res.status} for ${to}`);
      return;
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt < maxRetries) {
        console.warn(`[WA] ${res.status} on attempt ${attempt}/${maxRetries}. Retrying…`);
        await sleep(backoff(attempt));
        continue;
      }
    }

    throw new Error(`WhatsApp API error ${res.status}: ${JSON.stringify(errBody)}`);
  }
}

// ── Broadcast ─────────────────────────────────────────────────────────────────

export async function broadcastWhatsAppMessage(
  recipients: string[],
  message: string
): Promise<{ sent: number; failed: number }> {
  console.log(`[WA] Broadcasting to ${recipients.length} recipient(s):`, recipients);

  const results = await Promise.allSettled(
    recipients.map((phone) => sendWhatsAppMessage(phone, message))
  );

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const phone = recipients[i];
    if (r.status === "fulfilled") {
      sent++;
      console.log(`[WA] ✅ Delivered to ${phone}`);
    } else {
      failed++;
      console.error(`[WA] ❌ Failed to ${phone}:`, r.reason);
    }
  }

  console.warn(`[WA] Broadcast: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoff(attempt: number) {
  return Math.min(Math.pow(2, attempt) * 1000, 10_000);
}