const BASE_URL = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

// ── Core text sender with retry + exponential back-off ────────────────────────

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
    } catch (netErr) {
      if (attempt === maxRetries) throw netErr;
      await sleep(backoff(attempt));
      continue;
    }

    if (res.ok) { console.log(`[WA] ✅ Text sent to ${to}`); return; }

    const errBody = await res.json().catch(() => ({}));
    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      console.warn(`[WA] ${res.status} — retry ${attempt}/${maxRetries}`);
      await sleep(backoff(attempt));
      continue;
    }
    console.error(`[WA] ❌ Failed to ${to} (${res.status}):`, errBody);
    throw new Error(`WA API ${res.status}: ${JSON.stringify(errBody)}`);
  }
}

// ── Template sender — for approved WhatsApp Business templates ────────────────
// Used for tech job alerts: Meta requires approved templates for outbound messages
// to users who haven't messaged in the last 24 hours.
//
// Set WHATSAPP_JOB_ALERT_TEMPLATE in Vercel env vars = your approved template name.
// Template must have these body parameters in order:
//   {{1}} = trade (e.g. "HVAC")
//   {{2}} = problem summary
//   {{3}} = location (or "Not specified")
//
// If template name is not set, falls back to plain text.

export async function sendJobAlertTemplate(
  to: string,
  trade: string,
  summary: string,
  location: string
): Promise<void> {
  const templateName = process.env.WHATSAPP_JOB_ALERT_TEMPLATE;

  console.log(`[WA] sendJobAlertTemplate called: to=${to}, template=${templateName}, trade=${trade}`);

  // No template configured — FAIL loudly (Meta blocks plain text to new contacts)
  if (!templateName) {
    console.error(`[WA] ❌ WHATSAPP_JOB_ALERT_TEMPLATE not set! Template required for tech notifications.`);
    throw new Error("WHATSAPP_JOB_ALERT_TEMPLATE env var must be set in Vercel");
  }

  // Use approved template - single param with full job info
  const jobInfo = `${trade} repair job${location ? ` in ${location}` : ""}`;
  const payload = JSON.stringify({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: jobInfo },
          ],
        },
      ],
    },
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
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
    } catch (netErr) {
      if (attempt === 3) throw netErr;
      await sleep(backoff(attempt));
      continue;
    }

    if (res.ok) { console.log(`[WA] ✅ Template sent to ${to}`); return; }

    const errBody = await res.json().catch(() => ({}));
    console.warn(`[WA] Template failed (${res.status}), falling back to text:`, errBody);
    // Template failed — fall back to plain text immediately
    const msg =
      `🚨 *NEW JOB ALERT*\n🔧 Trade: ${trade}\n📋 Problem: ${summary}\n` +
      (location ? `📍 Location: ${location}\n` : "") +
      `\nReply with your *price and ETA* to bid.\nExample: "Rs. 2500, 30 minutes"`;
    return sendWhatsAppMessage(to, msg);
  }
}

// ── Broadcast: send to multiple techs using template ──────────────────────────

export async function broadcastJobAlert(
  recipients: string[],
  trade: string,
  summary: string,
  location: string
): Promise<void> {
  console.log(`[WA] Broadcasting job alert to ${recipients.length} tech(s)`);
  await Promise.allSettled(
    recipients.map(phone => sendJobAlertTemplate(phone, trade, summary, location))
  );
}

// ── Plain broadcast (used for non-job messages) ───────────────────────────────

export async function broadcastWhatsAppMessage(
  recipients: string[],
  message: string
): Promise<void> {
  await Promise.allSettled(
    recipients.map(phone => sendWhatsAppMessage(phone, message))
  );
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function backoff(attempt: number) { return Math.min(Math.pow(2, attempt) * 1000, 10_000); }
