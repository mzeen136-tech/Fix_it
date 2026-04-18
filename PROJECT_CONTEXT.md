# SnapFix - Project Context (April 2026)

## Current Status

### Working ✅
- WhatsApp customer flow (create job, receive bids, accept)
- Technician registration & login
- Admin panel for managing technicians
- WhatsApp free-form messages (work when tech messaged first within 24h)

### Issues Being Worked On
- Template messages (WhatsApp) - in review on Meta Business Console
- Telegram integration - deployed but needs techs to link accounts

---

## What's Been Done

### Recent Changes
1. **Fixed Gemini Model** - Changed from `gemini-2.5-flash-lite-preview-06-17` (broken) to `gemini-2.5-flash-lite`
2. **Added Telegram** - Free job alerts via Telegram bot
3. **Fixed WhatsApp link** - Button now opens admin phone number directly
4. **Added debug logging** - More visibility into job dispatch process

### Files Changed
- `src/lib/gemini.ts` - Model names
- `src/lib/telegram.ts` - New Telegram sender
- `src/lib/flows/customerIntake.ts` - Telegram + WhatsApp dispatch
- `src/lib/whatsapp.ts` - Template message support

---

## What To Test Tomorrow

### 1. WhatsApp Template
- **Status:** Template "job_alert" submitted for review
- **Check:** Meta Business Console → Message Templates
- **If approved:** Job alerts should go to techs automatically

### 2. Telegram Flow
- Add `TELEGRAM_BOT_TOKEN` to Vercel if not done
- Run SQL: `ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;`
- Tech goes to `/tech/link-telegram` to connect Telegram
- Test: create job → tech receives on Telegram

---

## To Disable Telegram (If Template Works)

In `src/lib/flows/customerIntake.ts`, comment out Telegram section:

```typescript
// // Send via Telegram first (FREE)
// if (telegramTechs.length > 0) {
//   ...telegram code...
// }
```

Or remove `telegram_chat_id` from the select query.

---

## Environment Variables (Local)

```
WHATSAPP_ACCESS_TOKEN=EAARhZClkokn8BRB8pyYNgpQzB1zLzv3RhZAqZAvutGZAwJY3faKcjOD6cuAcaEygC42Sk0P8Ehcq7KFtaj8STkZADQ4O5OUMtFUV8sG2DaNT12M7iSqg5rKaXQLuzTKuYPRPt30u1q6Mr4nnuhpJbd1soj0wzYBmqMjUtiNz7WqXESazmF9lV7nPYZAlMDQ1A25gZDZD
WHATSAPP_PHONE_NUMBER_ID=1084410291416827
TELEGRAM_BOT_TOKEN=8557150917:AAHwQpnF4U3nGCsUoiEp3BLYYpbeTfXUr_g
```

---

## Quick Test Commands

```bash
# Build locally
npm run build

# Deploy (git push to main triggers Vercel)
```

---

## Next Steps
1. Check if template approved
2. Test job dispatch with template
3. If works → disable Telegram
4. If not → continue fixing Telegram

---

## Contacts
- Admin Phone: 923157276899
- Telegram Bot: @Job_getbot