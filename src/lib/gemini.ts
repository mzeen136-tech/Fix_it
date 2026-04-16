import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Model setup — lazy init to avoid cold-start crashes ──────────────────────
// Primary:  gemini-2.5-flash-lite-preview-06-17  (fast, cheap)
// Backup:   gemini-2.5-flash-preview-04-17       (more capable)

function getModels() {
  const key = process.env.GEMINI_API_KEY;
  const backupKey = process.env.GEMINI_BACKUP_API_KEY || key;
  if (!key) throw new Error("[Gemini] GEMINI_API_KEY is not set");

  const primary = new GoogleGenerativeAI(key).getGenerativeModel({
    model: "gemini-2.5-flash-lite-preview-06-17",
  });
  const backup = new GoogleGenerativeAI(backupKey!).getGenerativeModel({
    model: "gemini-2.5-flash-preview-04-17",
  });
  return { primary, backup };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JobExtraction { trade: string; summary: string; }
export interface BidExtraction { price: string; eta: string; confidence: number; }
export interface MessageAnalysis {
  language: "english" | "urdu";
  is_general_question: boolean;
  has_problem: boolean;
  has_location: boolean;
  trade: string;
  summary: string;
  city: string;
  area: string;
  follow_up: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_TRADES = ["Plumber","Electrician","HVAC","Carpenter","Painter","Other"] as const;

const TRADE_KEYWORDS: Record<string, string[]> = {
  HVAC:        ["ac","a/c","air condition","hvac","cooling","heater","heating","geyser",
                 "geysir","air cool","leakage from ac","ac not","gas leakage","kharab ac",
                 "thanda nahi","heat pump"],
  Plumber:     ["water","pipe","leak","tap","flush","toilet","drain","sewage","plumb",
                 "nali","pani","nal","blockage","choked"],
  Electrician: ["electric","light","power","wiring","switch","socket","mcb","short circuit",
                 "bijli","current","voltage","trip","fuse","load shedding issue"],
  Carpenter:   ["door","window","wood","cabinet","furniture","carpenter","almari","darwaza",
                 "shelf","wardrobe"],
  Painter:     ["paint","wall","colour","color","crack","plaster","whitewash","ceiling"],
};

const CITY_KEYWORDS = [
  "islamabad","rawalpindi","lahore","karachi","peshawar","multan",
  "faisalabad","quetta","abbottabad","murree","barakau","barakhu",
  "gujranwala","sialkot","hyderabad","sukkur","larkana",
];

const AREA_KEYWORDS = [
  "f-6","f-7","f-8","f-10","g-9","g-10","g-11","i-8","i-9","i-10",
  "dha","bahria","gulberg","johar","clifton","defence","blue area",
  "pwd","cbr","satellite town","pindi","wah","taxila","attock",
];

const FAQ_WORDS = [
  "what service","what do you","how does","how do you","what trades","like what",
  "tell me about","what kind","what type","kya karte","kya services","explain",
  "introduce","about you","what is this","who are you","what are you",
  "weekend","timing","hours","coverage","area serve","charges kya","rate kya",
];

const GREETING_PATTERN =
  /^(hi|hello|hey|salam|assalam|aoa|helo|hii|good morning|good evening|good afternoon|ok|okay|k|👋|السلام|جی)\b/i;

// ── Number dictionary (English + Roman Urdu + Urdu script) ────────────────────

const NUMBER_WORDS: Record<string, number> = {
  // English
  one:1, two:2, three:3, four:4, five:5,
  six:6, seven:7, eight:8, nine:9, ten:10,
  twenty:20, thirty:30, forty:40, fifty:50,
  hundred:100, thousand:1000,
  // Roman Urdu
  aik:1, ek:1, do:2, teen:3, char:4, paanch:5,
  cheh:6, saat:7, aath:8, nau:9, das:10,
  pandrah:15, bees:20, pachees:25, tees:30,
  chalis:40, pachaas:50, saath:60, sattar:70,
  assi:80, nabbe:90, so:100, sau:100,
  hazar:1000, hazaar:1000,
  // Urdu script
  "ایک":1,"دو":2,"تین":3,"چار":4,"پانچ":5,
  "دس":10,"بیس":20,"سو":100,"ہزار":1000,
};

const SPECIAL_NUMBERS: Record<string, number> = {
  dedh:1500, derh:1500, dhaai:2500, dhai:2500,
  "ڈیڑھ":1500, "ڈھائی":2500,
};

// ── Local number parser ───────────────────────────────────────────────────────

function extractNumberSmart(text: string): number | null {
  const lower = text.toLowerCase();

  // 1k / 1.5k / 2k
  const kMatch = lower.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);

  // Plain digit
  const digitMatch = lower.match(/\b(\d{1,6})\b/);
  if (digitMatch) return parseInt(digitMatch[1]);

  // Special phrases ("dedh", "dhaai")
  for (const [word, val] of Object.entries(SPECIAL_NUMBERS)) {
    if (lower.includes(word)) return val;
  }

  // Word-based accumulation
  let total = 0;
  for (const [word, val] of Object.entries(NUMBER_WORDS)) {
    if (lower.includes(word)) {
      if (val === 1000 && total > 0) { total *= 1000; }
      else if (val === 100 && total > 0) { total *= 100; }
      else total += val;
    }
  }
  return total > 0 ? total : null;
}

// ── Local time parser ─────────────────────────────────────────────────────────

function extractTimeSmart(text: string): { eta: string; confidence: number } {
  const lower = text.toLowerCase();

  // Numeric with unit: "10 min", "1 hour", "2 ghanta"
  const numeric = lower.match(/(\d+)\s*(min(?:ute)?s?|hr?s?|hour|ghanta(?:y)?|منٹ|گھنٹے?)/);
  if (numeric) {
    const n = numeric[1];
    const unit = numeric[2].toLowerCase();
    const isHour = /^(h|gh|گ)/.test(unit);
    return { eta: `${n} ${isHour ? "hour" : "minute"}${n === "1" ? "" : "s"}`, confidence: 0.95 };
  }

  // Quick words
  if (/\b(abhi|jaldi|foran|turant|فوری|ابھی)\b/.test(lower)) {
    return { eta: "Soon", confidence: 0.65 };
  }

  // Word-based number with contextual unit
  const num = extractNumberSmart(text);
  if (num) {
    const isHour = /\b(ghanta|ghantay|hour|hr|گھنٹ)\b/.test(lower);
    return { eta: `${num} ${isHour ? "hour" : "minute"}${num === 1 ? "" : "s"}`, confidence: 0.78 };
  }

  return { eta: "Not specified", confidence: 0 };
}

// ── Local bid parser (zero API cost) ─────────────────────────────────────────

export function extractBidLocal(text: string): BidExtraction {
  const lower = text.toLowerCase();

  // Price
  let price = "Not specified";
  let priceConf = 0;

  const num = extractNumberSmart(text);
  const hasCurrencyHint = /\b(rs|pkr|rupee|rup|price|hazar|hazaar|thousand|k\b)/i.test(text);

  if (num && (num >= 200 || hasCurrencyHint)) {
    price = `Rs. ${num.toLocaleString()}`;
    priceConf = hasCurrencyHint ? 0.9 : 0.7;
  }

  // ETA
  const { eta, confidence: etaConf } = extractTimeSmart(text);

  const overallConf = (priceConf * 0.6) + (etaConf * 0.4);

  return { price, eta, confidence: Math.min(overallConf, 1) };
}

// ── Heuristic message analysis (zero API cost) ────────────────────────────────

function detectTrade(text: string): string {
  const lower = text.toLowerCase();
  for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return trade;
  }
  return "Other";
}

function detectCity(text: string): string {
  const lower = text.toLowerCase();
  return CITY_KEYWORDS.find(c => lower.includes(c)) ?? "";
}

function detectArea(text: string): string {
  const lower = text.toLowerCase();
  return AREA_KEYWORDS.find(a => lower.includes(a)) ?? "";
}

function detectLanguage(text: string): "english" | "urdu" {
  if (/[\u0600-\u06FF]/.test(text)) return "urdu";
  const markers = ["kya","mera","meri","nahi","masla","pani","bijli",
                   "darwaza","hai","acha","theek","aur","main","mujhe"];
  const hits = markers.filter(w => text.toLowerCase().includes(w)).length;
  return hits >= 2 ? "urdu" : "english";
}

function isGeneralQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return FAQ_WORDS.some(k => lower.includes(k));
}

function buildFollowUp(
  language: "english" | "urdu",
  needProblem: boolean,
  needLocation: boolean
): string {
  if (!needProblem && !needLocation) return "";
  if (language === "urdu") {
    if (needProblem && needLocation) return "Aap please masla aur apna city/area bata dein.";
    if (needProblem) return "Aap please apna masla thora detail mein bata dein.";
    return "Aap please apna city aur area bata dein. Mثال: Islamabad, Barakau";
  }
  if (needProblem && needLocation) return "Please describe the problem and share your city/area.";
  if (needProblem) return "Please describe the problem briefly.";
  return "Please share your city and area. Example: Islamabad, F-7";
}

function heuristicAnalysis(text: string): MessageAnalysis {
  const language     = detectLanguage(text);
  const lower        = text.toLowerCase();
  const is_general   = isGeneralQuestion(text);
  const trade        = detectTrade(text);
  const city         = detectCity(text);
  const area         = detectArea(text);
  const has_problem  = trade !== "Other" || (!is_general && lower.trim().length > 12);
  const has_location = !!(city || area);

  return {
    language,
    is_general_question: is_general,
    has_problem,
    has_location,
    trade,
    summary: text.trim().slice(0, 100),
    city,
    area,
    follow_up: is_general ? "" : buildFollowUp(language, !has_problem, !has_location),
  };
}

// ── JSON extraction — robust against markdown fences ──────────────────────────

function extractJson(raw: string): string {
  const cleaned = raw.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
  try { JSON.parse(cleaned); return cleaned; } catch { /* fall through */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return match[0];
  throw new Error(`No JSON in response: ${cleaned.slice(0, 200)}`);
}

// ── Gemini generate with primary → backup fallback ────────────────────────────

async function generate(prompt: string): Promise<string> {
  const { primary, backup } = getModels();
  try {
    const r = await primary.generateContent(prompt);
    const t = r.response.text();
    if (!t?.trim()) throw new Error("Empty primary response");
    return extractJson(t);
  } catch (e1) {
    console.warn("[Gemini] Primary failed:", (e1 as Error).message);
    try {
      const r = await backup.generateContent(prompt);
      const t = r.response.text();
      if (!t?.trim()) throw new Error("Empty backup response");
      return extractJson(t);
    } catch (e2) {
      throw new Error(`Both models failed. Backup error: ${(e2 as Error).message}`);
    }
  }
}

function validateField<T extends readonly string[]>(
  val: unknown, allowed: T, fallback: T[number]
): T[number] {
  return (allowed as readonly string[]).includes(String(val))
    ? (val as T[number])
    : fallback;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

// ── 1. analyzeCustomerMessage ─────────────────────────────────────────────────
// Strategy: heuristic first → skip Gemini for clear cases → Gemini for ambiguous

export async function analyzeCustomerMessage(text: string): Promise<MessageAnalysis> {
  const input = (text ?? "").trim();
  const h = heuristicAnalysis(input);

  // Clear cases — never burn a Gemini call
  if (h.is_general_question) return h;
  if (input.length < 12)     return h;
  if (GREETING_PATTERN.test(input) && input.length < 25) return h;

  // Confident heuristic — trade found AND location found
  if (h.trade !== "Other" && h.has_location) return h;

  // Ambiguous — let Gemini decide
  const prompt =
    `You are SnapFix, a Pakistani WhatsApp home services bot.\n` +
    `Analyze: ${JSON.stringify(input)}\n\n` +
    `Rules:\n` +
    `- has_problem: true only for specific home service issues\n` +
    `- is_general_question: true for "what services", "how does this work", general queries\n` +
    `- summary: problem description ONLY, no location words\n` +
    `- trade: Plumber|Electrician|HVAC|Carpenter|Painter|Other\n` +
    `- city: city/town name only (empty string if none)\n` +
    `- area: neighbourhood/sector only (empty string if none)\n` +
    `- language: "urdu" if Urdu script or Roman Urdu, else "english"\n` +
    `- follow_up: warm reply in customer's language asking ONLY for what is missing\n\n` +
    `Return ONLY valid JSON:\n` +
    `{"language":"english","is_general_question":false,"has_problem":true,"has_location":false,` +
    `"trade":"HVAC","summary":"AC is not cooling","city":"","area":"","follow_up":"Which city and area are you in?"}`;

  try {
    const raw  = await generate(prompt);
    const p    = JSON.parse(raw) as Partial<MessageAnalysis>;
    const lang = validateField(p.language, ["english","urdu"] as const, "english");
    const result: MessageAnalysis = {
      language:            lang,
      is_general_question: Boolean(p.is_general_question),
      has_problem:         Boolean(p.has_problem),
      has_location:        Boolean(p.has_location),
      trade:               validateField(p.trade, VALID_TRADES, "Other"),
      summary:             (typeof p.summary === "string" ? p.summary : h.summary).slice(0,100),
      city:                typeof p.city  === "string" ? p.city.trim()  : h.city,
      area:                typeof p.area  === "string" ? p.area.trim()  : h.area,
      follow_up:           typeof p.follow_up === "string" ? p.follow_up.trim() : h.follow_up,
    };
    if (!result.follow_up) {
      result.follow_up = buildFollowUp(lang, !result.has_problem, !result.has_location);
    }
    return result;
  } catch (err) {
    console.error("[Gemini] analyzeCustomerMessage fell back to heuristic:", (err as Error).message);
    return h;
  }
}

// ── 2. extractJobDetails ──────────────────────────────────────────────────────
// Strategy: keyword detection → Gemini only when trade unclear

export async function extractJobDetails(text: string): Promise<JobExtraction> {
  const input = (text ?? "").trim();
  if (!input) return { trade: "Other", summary: "No description provided" };

  const trade = detectTrade(input);

  // Trade clearly identified locally — no API needed
  if (trade !== "Other" || input.length < 25) {
    return { trade, summary: input.slice(0, 100) };
  }

  const prompt =
    `Home services dispatcher in Pakistan.\n` +
    `Customer message: ${JSON.stringify(input)}\n\n` +
    `Return ONLY JSON (no markdown):\n` +
    `{"trade":"Plumber","summary":"one sentence under 100 chars, problem only, no location"}\n` +
    `trade must be one of: Plumber, Electrician, HVAC, Carpenter, Painter, Other`;

  try {
    const raw = await generate(prompt);
    const e = JSON.parse(raw) as Partial<JobExtraction>;
    return {
      trade:   validateField(e.trade, VALID_TRADES, trade),
      summary: (typeof e.summary === "string" ? e.summary : input).slice(0, 100),
    };
  } catch (err) {
    console.error("[Gemini] extractJobDetails fallback:", (err as Error).message);
    return { trade, summary: input.slice(0, 100) };
  }
}

// ── 3. extractBidDetails ──────────────────────────────────────────────────────
// Strategy: elite local parser → Gemini ONLY when confidence < 0.55

export async function extractBidDetails(text: string): Promise<Omit<BidExtraction, "confidence">> {
  const input = (text ?? "").trim();
  if (!input) return { price: "Not specified", eta: "Not specified" };

  const local = extractBidLocal(input);

  // High confidence — skip API entirely
  if (local.confidence >= 0.55) {
    console.log(`[Gemini] Bid parsed locally (conf=${local.confidence.toFixed(2)})`);
    return { price: local.price, eta: local.eta };
  }

  // Low confidence — let Gemini handle it
  console.log(`[Gemini] Bid confidence low (${local.confidence.toFixed(2)}), calling AI`);

  const prompt =
    `Pakistani technician bidding on a home service job.\n` +
    `Message: ${JSON.stringify(input)}\n\n` +
    `Extract price and ETA. Message may be English, Urdu, or Roman Urdu:\n` +
    `- "Do hazar" = Rs. 2000 | "Teen hazar" = Rs. 3000 | "Dedh hazar" = Rs. 1500\n` +
    `- "Das minute" = 10 minutes | "Aadha ghanta" = 30 minutes | "Ek ghanta" = 1 hour\n\n` +
    `Return ONLY JSON:\n{"price":"Rs. 2000","eta":"10 minutes"}\n` +
    `Use "Not specified" if genuinely unclear.`;

  try {
    const raw = await generate(prompt);
    const e = JSON.parse(raw) as { price?: string; eta?: string };
    let price = typeof e.price === "string" && e.price.trim() ? e.price.trim() : local.price;
    let eta   = typeof e.eta   === "string" && e.eta.trim()   ? e.eta.trim()   : local.eta;

    // Normalise: ensure "Rs." prefix
    if (price !== "Not specified" && !/^Rs\./i.test(price)) {
      const n = price.replace(/[^0-9]/g, "");
      if (n) price = `Rs. ${parseInt(n).toLocaleString()}`;
    }
    return { price, eta };
  } catch (err) {
    console.error("[Gemini] extractBidDetails fallback:", (err as Error).message);
    return { price: local.price, eta: local.eta };
  }
}

// ── 4. Utility exports ────────────────────────────────────────────────────────

export function isGreeting(text: string): boolean {
  return GREETING_PATTERN.test(text.trim()) && text.trim().length < 30;
}

export function looksLikeAdminCommand(text: string): boolean {
  return text.trim().startsWith("/");
}
