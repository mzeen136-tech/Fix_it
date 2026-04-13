import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export interface JobExtraction { trade: string; summary: string; }
export interface BidExtraction  { price: string; eta: string; }

export interface MessageAnalysis {
  language: "english" | "urdu";
  has_problem: boolean;
  has_location: boolean;
  trade: string;
  summary: string;
  city: string;
  area: string;
  follow_up: string;
}

function clean(raw: string) {
  return raw.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
}

// ── Full message analysis for conversation flow ───────────────────────────────

export async function analyzeCustomerMessage(text: string): Promise<MessageAnalysis> {
  const prompt = `You are SnapFix, a WhatsApp home services bot in Pakistan.
Analyze this customer message: "${text}"

Return ONLY valid JSON with no markdown:
{
  "language": "english" or "urdu",
  "has_problem": true/false (did they describe a home service problem?),
  "has_location": true/false (did they mention a city or area?),
  "trade": "Plumber"|"Electrician"|"HVAC"|"Carpenter"|"Painter"|"Other",
  "summary": "one sentence problem description, empty string if no problem",
  "city": "city name if mentioned, empty string otherwise",
  "area": "area/neighbourhood if mentioned, empty string otherwise",
  "follow_up": "your reply asking for what is MISSING. If problem missing, ask them to describe it. If location missing, ask for their city and area. Reply in the SAME LANGUAGE the customer used. Keep it warm and brief."
}`;

  let raw = "";
  try {
    const result = await model.generateContent(prompt);
    raw = clean(result.response.text());
    const parsed = JSON.parse(raw) as MessageAnalysis;
    if (!["Plumber","Electrician","HVAC","Carpenter","Painter","Other"].includes(parsed.trade)) {
      parsed.trade = "Other";
    }
    return parsed;
  } catch (err) {
    console.error("[Gemini] analyzeCustomerMessage failed:", raw, err);
    return {
      language: "english",
      has_problem: false,
      has_location: false,
      trade: "Other",
      summary: "",
      city: "",
      area: "",
      follow_up: "Hi! Please describe your home service problem and tell us your city and area so we can find the right technician for you.",
    };
  }
}

// ── Flow 2: extract from combined problem + location text ─────────────────────

export async function extractJobDetails(text: string): Promise<JobExtraction> {
  if (!text?.trim()) return { trade: "Other", summary: "No description provided" };
  const prompt = `Home services dispatcher in Pakistan. Customer message: "${text}"
Respond ONLY with valid JSON (no markdown):
{"trade":"Plumber","summary":"one sentence under 100 chars"}
Trade must be one of: Plumber, Electrician, HVAC, Carpenter, Painter, Other`;
  let raw = "";
  try {
    const result = await model.generateContent(prompt);
    raw = clean(result.response.text());
    const e = JSON.parse(raw) as JobExtraction;
    e.trade = ["Plumber","Electrician","HVAC","Carpenter","Painter","Other"].includes(e.trade) ? e.trade : "Other";
    e.summary = (e.summary ?? text).slice(0, 100);
    return e;
  } catch (err) {
    console.error("[Gemini] extractJobDetails failed:", raw, err);
    return { trade: "Other", summary: text.slice(0, 100) };
  }
}

// ── Flow 3: extract price + ETA from technician bid ──────────────────────────

export async function extractBidDetails(text: string): Promise<BidExtraction> {
  if (!text?.trim()) return { price: "Not specified", eta: "Not specified" };
  const prompt = `Technician bidding on a job in Pakistan. Their message: "${text}"
Respond ONLY with valid JSON (no markdown):
{"price":"Rs. 2500","eta":"30 minutes"}
If unclear, write "Not specified" for that field.`;
  let raw = "";
  try {
    const result = await model.generateContent(prompt);
    raw = clean(result.response.text());
    const e = JSON.parse(raw) as BidExtraction;
    e.price = e.price?.trim() || "Not specified";
    e.eta   = e.eta?.trim()   || "Not specified";
    return e;
  } catch (err) {
    console.error("[Gemini] extractBidDetails failed:", raw, err);
    return { price: "Not specified", eta: "Not specified" };
  }
}
