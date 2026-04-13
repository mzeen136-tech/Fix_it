import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

// ── Keyword-based fallback (runs when Gemini fails) ───────────────────────────

const TRADE_KEYWORDS: Record<string, string[]> = {
  HVAC:        ["ac","a/c","air condition","hvac","cooling","heat","heater","heating","geyser","geysir","fan","air cool","leakage from ac","ac not","gas"],
  Plumber:     ["water","pipe","leak","tap","flush","toilet","drain","sewage","plumb","nali","pani"],
  Electrician: ["electric","light","power","wiring","switch","socket","mcb","short circuit","bijli","current","voltage"],
  Carpenter:   ["door","window","wood","cabinet","furniture","carpenter","almari","darwaza"],
  Painter:     ["paint","wall","colour","color","crack","plaster"],
};

const CITY_KEYWORDS = ["islamabad","rawalpindi","lahore","karachi","peshawar","multan","faisalabad","quetta","abbottabad","murree"];
const AREA_KEYWORDS = ["barakhu","barakau","f-6","f-7","f-8","f-10","g-9","g-10","g-11","dha","bahria","gulberg","johar","clifton","defence","blue area","i-8","i-9","i-10","pwd","cbr","satellite town","pindi"];

function keywordFallback(text: string): MessageAnalysis {
  const lower = text.toLowerCase();
  let trade = "Other";
  for (const [t, keywords] of Object.entries(TRADE_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) { trade = t; break; }
  }
  const city = CITY_KEYWORDS.find(c => lower.includes(c)) ?? "";
  const area = AREA_KEYWORDS.find(a => lower.includes(a)) ?? "";
  const has_problem = trade !== "Other" || lower.length > 10;
  const has_location = !!(city || area);
  let follow_up = "";
  if (!has_problem) follow_up = "Hi! Please describe your home service problem and tell us your city and area so we can find the right technician for you.";
  else if (!has_location) follow_up = "Got it! Now please share your city and area. Example: Islamabad, Barakhu";
  return { language: "english", has_problem, has_location, trade, summary: text.slice(0, 100), city, area, follow_up };
}

function keywordExtractJob(text: string): JobExtraction {
  const lower = text.toLowerCase();
  let trade = "Other";
  for (const [t, keywords] of Object.entries(TRADE_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) { trade = t; break; }
  }
  return { trade, summary: text.slice(0, 100) };
}

// ── Bid fallback: regex-based price + ETA extraction ─────────────────────────

function regexExtractBid(text: string): BidExtraction {
  const lower = text.toLowerCase();

  // Price: match patterns like "2000", "rs 2000", "2,000", "PKR 2500", "price: 2000"
  let price = "Not specified";
  const priceMatch = lower.match(/(?:rs\.?|pkr|price[:\s]+|rupees?\s*)?\s*([\d,]+)\s*(?:rs|pkr|rupees?)?/i);
  if (priceMatch) {
    const num = priceMatch[1].replace(/,/g, "");
    if (parseInt(num) > 99) price = `Rs. ${num}`; // ignore tiny numbers like "1 hour"
  }

  // ETA: match patterns like "1 hour", "30 minutes", "30 min", "2 hrs", "eta: 1 hour", "45mins"
  let eta = "Not specified";
  const etaMatch = lower.match(/(?:eta[:\s]+|in\s+)?(\d+)\s*(hour|hr|hrs|minute|min|mins|h\b)/i);
  if (etaMatch) {
    const num = etaMatch[1];
    const unit = etaMatch[2].toLowerCase();
    if (unit.startsWith("h")) eta = `${num} hour${num === "1" ? "" : "s"}`;
    else eta = `${num} minute${num === "1" ? "" : "s"}`;
  }

  return { price, eta };
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
    console.error("[Gemini] analyzeCustomerMessage failed:", err);
    return keywordFallback(text);
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
    console.error("[Gemini] extractJobDetails failed:", err);
    return keywordExtractJob(text);
  }
}

// ── Flow 3: extract price + ETA from technician bid ──────────────────────────

export async function extractBidDetails(text: string): Promise<BidExtraction> {
  if (!text?.trim()) return { price: "Not specified", eta: "Not specified" };
  const prompt = `Technician bidding on a job in Pakistan. Their message: "${text}"
Extract the price (in Pakistani Rupees) and ETA (arrival time).
Respond ONLY with valid JSON (no markdown):
{"price":"Rs. 2500","eta":"1 hour"}
Examples:
- "2000 , 1 hour" → {"price":"Rs. 2000","eta":"1 hour"}
- "price: 2000, ETA 1 hour" → {"price":"Rs. 2000","eta":"1 hour"}
- "1500 30 minutes" → {"price":"Rs. 1500","eta":"30 minutes"}
If a field is truly unclear, write "Not specified" for that field only.`;
  let raw = "";
  try {
    const result = await model.generateContent(prompt);
    raw = clean(result.response.text());
    const e = JSON.parse(raw) as BidExtraction;
    e.price = e.price?.trim() || "Not specified";
    e.eta   = e.eta?.trim()   || "Not specified";
    return e;
  } catch (err) {
    console.error("[Gemini] extractBidDetails failed, using regex fallback:", err);
    // Regex fallback so bid is never lost even if Gemini fails
    return regexExtractBid(text);
  }
}