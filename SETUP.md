# SnapFix - WhatsApp Home Services Dispatch

## 🚀 Quick Start Guide

Follow these steps to get SnapFix running locally.

### Prerequisites

1. **Supabase Account** - [Create free account](https://supabase.com)
2. **Meta Developer Account** - [Create app](https://developers.facebook.com)
3. **Google AI Studio** - Get [Gemini API key](https://aistudio.google.com)
4. **Node.js 18+** - [Download](https://nodejs.org)

### Step 1: Environment Setup

1. **Clone and navigate:**
   ```bash
   cd snapfix
   ```

2. **Fill environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your actual values.

### Step 2: Database Setup

1. **Go to Supabase Dashboard** → Your Project → **SQL Editor**
2. **Copy and paste** the entire `database-setup.sql` file
3. **Run the query** - you should see "Success" messages

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Run Development Server

```bash
npm run dev
```
Your server will run on `http://localhost:3000`

### Step 5: Setup ngrok for Local Testing

1. **In a new terminal:**
   ```bash
   npx ngrok http 3000
   ```

2. **Copy the ngrok URL** (e.g., `https://abc123.ngrok-free.app`)

### Step 6: Configure Meta WhatsApp

1. **Go to Meta Developer Console** → Your App → **WhatsApp**
2. **Configuration:**
   - **Callback URL:** `https://your-ngrok-url.ngrok-free.app/api/whatsapp`
   - **Verify Token:** `snapfix-local-dev-token-change-me` (match your `.env.local`)
   - **Webhook fields:** Check `messages`

3. **API Setup:**
   - **Phone Number ID:** Copy from Meta
   - **Access Token:** Generate temporary token

4. **Update `.env.local`** with Meta values

### Step 7: Test Your System

#### Test Admin Flow:
```bash
# Send this from your WhatsApp to your Meta number
/add Plumber, Test Tech, 923001234567, Islamabad
```
Expected response: `✅ Test Tech added as Plumber (Islamabad).`

#### Test Customer Flow:
```bash
# From a different number
My bathroom tap is leaking badly
```
Expected response: Job created and technicians notified.

## 📋 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `WHATSAPP_VERIFY_TOKEN` | ✅ | Meta webhook verification token |
| `WHATSAPP_ACCESS_TOKEN` | ✅ | Meta WhatsApp access token |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ | Meta phone number ID |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `ADMIN_PHONE` | ✅ | Your WhatsApp number (format: 923XXXXXXXXX) |

## 🔧 Performance Optimizations

The system includes:
- **Gemini AI caching** (5-minute TTL)
- **WhatsApp retry logic** (exponential backoff)
- **Database indexing** for fast queries
- **Rate limiting protection**
- **Error handling** at all levels

## 🧪 Testing Commands

```bash
# Test admin command
/add Electrician, John Doe, 923002345678, Lahore

# Test customer request
Kitchen light not working, sparking sounds

# Test technician bid
Rs. 1500, 30 minutes

# Test customer acceptance
ACCEPT John Doe
```

## 📊 Monitoring

Check system stats:
```sql
SELECT * FROM get_system_stats();
```

View active bidding jobs:
```sql
SELECT * FROM active_bidding_jobs;
```

## 🚀 Next Steps

1. **Test all flows** with real messages
2. **Deploy to Vercel** when ready
3. **Set permanent Meta token**
4. **Add multimodal support** (images/audio)

## 🆘 Troubleshooting

- **Webhook fails:** Check ngrok URL is accessible and `.env.local` values
- **Messages not sending:** Verify Meta token and phone number ID
- **AI not working:** Check Gemini API key
- **DB errors:** Verify Supabase credentials and table creation

## 📞 Support

For issues:
1. Check logs: `npm run dev`
2. Verify all environment variables
3. Ensure database tables exist
4. Test with ngrok URL in browser

---

**Ready to start? Run `npm run dev` and begin testing!** 🎉