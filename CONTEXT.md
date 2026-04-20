# SnapFix - Current Context (2026-04-18)

## What's Working
- ✅ Customer intake flow ("electric fan problem, Islamabad")
- ✅ AI classifies trade (Electrician, HVAC, etc.)
- ✅ Location detection
- ✅ DB job creation
- ✅ Tech lookup with filters (is_active + approval_status)
- ✅ WhatsApp template sending ("job_alert")
- ✅ Button click handling (tech clicks BID → gets price prompt)

## Known Issues
- ❓ WhatsApp template returns 200 ✅ but tech NOT receiving message
- Logs show: `[WA] ✅ Template sent to 923209021535`
- But technician reports: no message received
- Template "job_alert" appears approved in Meta Business Manager

## Latest Changes Made
1. Added `fan` to Electrician keywords
2. Using `job_alert` template (not `job_alert_en`)
3. Template has 1 parameter: `{{1}}` = "Electrician repair job in Islamabad"
4. Added detailed logging for WhatsApp API calls

## Vercel Env Vars Check
- WHATSAPP_JOB_ALERT_TEMPLATE = job_alert (must be set)
- WHATSAPP_ACCESS_TOKEN = set
- WHATSAPP_PHONE_NUMBER_ID = 1084410291416827

## Next Steps to Debug
1. Check Meta Business Manager → WhatsApp Manager → Templates
   - Confirm "job_alert" status is exactly "APPROVED"
   - Check if there's version mismatch
2. Check phone number format in DB matches exactly (923209021535)
3. Check if template has any hidden issues (category, language)
4. Try sending to HVAC tech (923455060752) again to compare

## Files Changed
- src/lib/gemini.ts - added "fan" keyword
- src/lib/whatsapp.ts - template params, logging
- src/lib/flows/customerIntake.ts - tech filtering
- src/app/api/whatsapp/route.ts - button handling