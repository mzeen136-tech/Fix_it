# 🔧 SnapFix — WhatsApp Home Services Dispatch Agent

A serverless WhatsApp bot that connects customers with technicians in real time. Built with Next.js, Supabase, Gemini AI, and Meta WhatsApp Cloud API.

---

## How It Works

```
Customer sends problem → Gemini extracts trade → Techs get alerted → Techs bid → Customer accepts → Both get each other's phone
```

### The 4 Flows

| Flow | Who | Trigger | What happens |
|------|-----|---------|--------------|
| 1 | Admin | `/add ...` | Adds a technician to the database |
| 2 | Customer | Any message | Gemini parses problem, dispatches to matching techs |
| 3 | Technician | Reply with price/ETA | Bid saved, customer notified |
| 4 | Customer | `ACCEPT [Name]` | Job assigned, both parties get each other's number |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

### 3. Set up Supabase

Paste the contents of `database-setup.sql` into your **Supabase SQL Editor** and run it.

### 4. Run locally

```bash
# Terminal 1 — Next.js dev server
npm run dev

# Terminal 2 — ngrok tunnel (gives Meta a public URL)
npx ngrok http 3000
```

### 5. Configure Meta Webhook

In the [Meta Developer Console](https://developers.facebook.com):

1. Go to your app → **WhatsApp** → **Configuration**
2. Set **Callback URL** to: `https://YOUR-NGROK-URL.ngrok-free.app/api/whatsapp`
3. Set **Verify Token** to match `WHATSAPP_VERIFY_TOKEN` in your `.env.local`
4. Click **Verify and Save**
5. Subscribe to the **messages** webhook field

---

## Admin Commands

From the `ADMIN_PHONE` WhatsApp number:

```
/add Trade, Name, 923XXXXXXXXX, City
```

Example:
```
/add Plumber, Ali, 923001234567, Islamabad
```

Valid trades: `Plumber`, `Electrician`, `HVAC`, `Carpenter`, `Painter`, `Other`

---

## Customer Flow

1. Customer sends any message describing their problem (text)
2. SnapFix replies: "Finding technicians…"
3. Matching techs receive a job alert
4. Techs reply with price and ETA (Gemini parses it)
5. Customer receives each bid and can reply: `ACCEPT [TechName]`
6. Both parties receive each other's phone number

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel deploy
```

Add all `.env.local` values as **Environment Variables** in Vercel dashboard, then update the Meta webhook URL to your production Vercel domain.

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── whatsapp/
│   │       └── route.ts        ← GET (verify) + POST (router)
│   ├── layout.tsx
│   └── page.tsx                ← Status page
└── lib/
    ├── supabase.ts             ← DB client + types
    ├── whatsapp.ts             ← sendWhatsAppMessage + broadcast
    ├── gemini.ts               ← extractJobDetails + extractBidDetails
    └── flows/
        ├── adminCommand.ts     ← Flow 1
        ├── customerIntake.ts   ← Flow 2
        ├── technicianBid.ts    ← Flow 3
        └── customerAccept.ts  ← Flow 4
```
