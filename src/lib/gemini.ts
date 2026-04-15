import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const genAI2 = new GoogleGenerativeAI(process.env.GEMINI_BACKUP_API_KEY || process.env.GEMINI_API_KEY!);

// Primary: gemini-2.5-flash-lite (fast, cheap, your preference)
// Backup:  gemini-2.5-flash (more capable, used if primary fails)
const primaryModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-06-17" });
const backupModel  = genAI2.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });

export interface JobExtraction { trade: string; summary: string; }
export interface BidExtraction  { price: string; eta: string; }
export interface MessageAnalysis {
  language: "english" | "urdu";
  has_problem: boolean;
  has_location: boolean;
  is_general_question: boolean;
  trade: string;
  summary: string;
  city: string;
  area: string;
  follow_up: string;
}

const VALID_TRADES = ["Plumber","Electrician","HVAC","Carpenter","Painter","Other"] as const;

function clean(raw: string) {
  return raw.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
}

// ── Core: try primary model, fall back to backup on any error ─────────────────

async function generate(prompt: string): Promise<string> {
  try {
    const result = await primaryModel.generateContent(prompt);
    const text = result.response.text();
    if (!text?.trim()) throw new Error("Empty response from primary");
    console.log("[Gemini] Primary model used");
    return clean(text);
  } catch (primaryErr) {
    console.warn("[Gemini] Primary failed, trying backup:", primaryErr);
    try {
      const result = await backupModel.generateContent(prompt);
      const text = result.response.text();
      if (!text?.trim()) throw new Error("Empty response from backup");
      console.log("[Gemini] Backup model used");
      return clean(text);
    } catch (backupErr) {
      console.error("[Gemini] Both models failed:", backupErr);
      throw backupErr;
    }
  }
}

// ── Full message analysis — customer intake ────────────────────────────────────

export async function analyzeCustomerMessage(text: string): Promise<MessageAnalysis> {
  const prompt = `You are SnapFix, a WhatsApp home services bot in Pakistan.
Analyze this customer message carefully: "${text}"

Rules:
- has_problem = true ONLY if they described a specific home service issue (broken tap, no electricity, AC not cooling, etc.)
- has_problem = false for greetings (hi, hello, salam), general questions (what services?, how does this work?), or unclear messages
- is_general_question = true if they are asking about services, how the app works, pricing in general, or anything not a specific job request
- has_location = true if they mentioned a city, town, area, or neighbourhood in Pakistan
- summary = describe ONLY the problem itself — do NOT include location words in the summary
- city = extract only the city/town name (Islamabad, Lahore, Karachi, Barakau, etc.), empty if not mentioned
- area = neighbourhood or area within a city (DHA, F-7, Gulberg, etc.), empty if not mentioned
- language = "urdu" if message uses Urdu script OR Roman Urdu (e.g. "Mera AC kharab hai"), otherwise "english"
- follow_up = warm reply in SAME language customer used, asking ONLY for what is missing

Return ONLY valid JSON, no markdown, no explanation:
{
  "language": "english",
  "has_problem": true,
  "has_location": false,
  "is_general_question": false,
  "trade": "HVAC",
  "summary": "AC is not cooling the room",
  "city": "",
  "area": "",
  "follow_up": "Got it! Which city and area are you in? Example: Islamabad, F-7"
}

Trade must be exactly one of: Plumber, Electrician, HVAC, Carpenter, Painter, Other`;

  let raw = "";
  try {
    raw = await generate(prompt);
    const parsed = JSON.parse(raw) as MessageAnalysis;
    if (!(VALID_TRADES as readonly string[]).includes(parsed.trade)) parsed.trade = "Other";
    parsed.summary = (parsed.summary ?? "").slice(0, 120);
    // Safety: strip location words from summary if they leaked in
    parsed.summary = parsed.summary
      .replace(/\b(barakau|islamabad|lahore|karachi|rawalpindi|dha|f-\d|gulberg)\b/gi, "")
      .replace(/\s{2,}/g, " ").trim();
    return parsed;
  } catch (err) {
    console.error("[Gemini] analyzeCustomerMessage failed:", raw, err);
    return {
      language: "english", has_problem: false, has_location: false,
      is_general_question: false, trade: "Other", summary: "",
      city: "", area: "",
      follow_up: "Assalam o Alaikum! 👋 Welcome to SnapFix.\n\nPlease describe your home service problem and share your city/area — we'll find you the right technician right away!",
    };
  }
}

// ── Job extraction ─────────────────────────────────────────────────────────────

export async function extractJobDetails(text: string): Promise<JobExtraction> {
  if (!text?.trim()) return { trade: "Other", summary: "No description provided" };
  const prompt = `Home services dispatcher in Pakistan. Extract the trade and problem from this message: "${text}"

Rules:
- summary must describe ONLY the problem — no location names
- trade must be exactly one of: Plumber, Electrician, HVAC, Carpenter, Painter, Other
- summary under 100 characters

Return ONLY valid JSON (no markdown):
{"trade":"Plumber","summary":"Kitchen tap is leaking under the sink"}`;

  let raw = "";
  try {
    raw = await generate(prompt);
    const e = JSON.parse(raw) as JobExtraction;
    e.trade = (VALID_TRADES as readonly string[]).includes(e.trade) ? e.trade : "Other";
    e.summary = (e.summary ?? text).slice(0, 100);
    return e;
  } catch (err) {
    console.error("[Gemini] extractJobDetails failed:", raw, err);
    return { trade: "Other", summary: text.slice(0, 100) };
  }
}

// ── Bid extraction — handles English, Urdu, Roman Urdu ────────────────────────

export async function extractBidDetails(text: string): Promise<BidExtraction> {
  if (!text?.trim()) return { price: "Not specified", eta: "Not specified" };
  const prompt = `A technician in Pakistan is replying to a job with their price and arrival time.
Their message: "${text}"

IMPORTANT: The message may be in English, Urdu, or Roman Urdu. Extract accordingly:
- "Do hazar" or "2 hazar" = Rs. 2000
- "Ek hazar" or "1000" = Rs. 1000
- "teen hazar" = Rs. 3000
- "Das minute" or "10 minute" = 10 minutes
- "Aadha ghanta" = 30 minutes
- "Ek ghanta" = 1 hour
- "Pachas minute" = 50 minutes

Return ONLY valid JSON (no markdown):
{"price":"Rs. 2000","eta":"10 minutes"}

If price is completely unclear, write "Not specified".
If ETA is completely unclear, write "Not specified".`;

  let raw = "";
  try {
    raw = await generate(prompt);
    const e = JSON.parse(raw) as BidExtraction;
    e.price = e.price?.trim() || "Not specified";
    e.eta   = e.eta?.trim()   || "Not specified";
    // Normalize — add "Rs." prefix if missing
    if (e.price !== "Not specified" && !/^Rs\./i.test(e.price)) {
      const num = e.price.replace(/[^0-9]/g, "");
      if (num) e.price = `Rs. ${parseInt(num).toLocaleString()}`;
    }
    return e;
  } catch (err) {
    console.error("[Gemini] extractBidDetails failed:", raw, err);
    return { price: "Not specified", eta: "Not specified" };
  }
}

// ── Greeting detection (no Gemini needed — pure string match) ─────────────────

export function isGreeting(text: string): boolean {
  const t = text.toLowerCase().trim();
  return /^(hi|hello|hey|salam|assalam|aoa|helo|hii|helo|good morning|good evening|good afternoon|ok|okay|k|👋)/.test(t)
    && t.length < 30;
}

// ── General question detection ────────────────────────────────────────────────

export function looksLikeAdminCommand(text: string): boolean {
  return text.trim().startsWith("/");
}
