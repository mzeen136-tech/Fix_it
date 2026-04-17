import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Model setup ───────────────────────────────────────────────────────────────
// Uses lazy init — no crash if env vars missing at module load time.
// Primary:  gemini-2.5-flash-lite  (fast, cheap — your preference)
// Backup:   gemini-2.5-flash       (smarter, used if primary fails)

function getModels() {
  const key       = process.env.GEMINI_API_KEY;
  const backupKey = process.env.GEMINI_BACKUP_API_KEY || key;
  if (!key) throw new Error("[Gemini] GEMINI_API_KEY is not set in environment");

  const primary = new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-06-17" });
  const backup  = new GoogleGenerativeAI(backupKey!).getGenerativeModel({ model: "gemini-2.5-flash" });
  return { primary, backup };
}

// ── Types — these must match exactly what customerIntake.ts expects ───────────

export interface MessageAnalysis {
  language:            "english" | "urdu";
  is_general_question: boolean;
  has_problem:         boolean;
  has_location:        boolean;
  trade:               string;
  summary:             string;
  city:                string;
  area:                string;
  follow_up:           string;
}

export interface JobExtraction {
  trade:   string;
  summary: string;
}

export interface BidExtraction {
  price: string;
  eta:   string;
}

// ── Keyword tables (zero API cost) ────────────────────────────────────────────

const VALID_TRADES = ["Plumber","Electrician","HVAC","Carpenter","Painter","Other"] as const;

const TRADE_KEYWORDS: Record<string, string[]> = {
  HVAC:        ["ac","a/c","air condition","hvac","cooling","heater","heating","geyser",
                 "geysir","air cool","ac not","gas leakage","kharab ac","thanda nahi",
                 "theek nai","theek nahi","cool","coolant"],
  Plumber:     ["water","pipe","leak","tap","flush","toilet","drain","sewage","plumb",
                 "nali","pani","nal","blockage","choked","naali"],
  Electrician: ["electric","light","power","wiring","switch","socket","mcb","short circuit",
                 "bijli","current","voltage","trip","fuse","load"],
  Carpenter:   ["door","window","wood","cabinet","furniture","carpenter","almari","darwaza",
                 "shelf","wardrobe","درواز"],
  Painter:     ["paint","wall","colour","color","crack","plaster","whitewash","ceiling"],
};

const CITY_LIST = [
  "islamabad","rawalpindi","lahore","karachi","peshawar","multan",
  "faisalabad","quetta","abbottabad","murree","barakau","barakhu",
  "gujranwala","sialkot","hyderabad","sukkur",
];

const AREA_LIST = [
  "f-6","f-7","f-8","f-10","g-9","g-10","g-11","i-8","i-9","i-10",
  "dha","bahria","gulberg","johar","clifton","defence","blue area",
  "pwd","cbr","satellite town","wah","taxila",
];

const FAQ_PATTERNS = [
  "what service","which service","kya service","what do you","how does","kya karte",
  "kya offer","tell me about","what kind","what type","apkon si services","konsi services",
  "kya facilities","kya milta","explain","about you","what is this","who are you",
  "timing","hours","coverage","rate kya","charges kya","kitna charge",
];

const GREETING_PATTERN =
  /^(hi|hello|hey|salam|assalam|aoa|helo|hii|good morning|good evening|good afternoon|ok|okay|k|👋|السلام|جی)\b/i;

// ── Urdu number dictionary (for bid parsing) ──────────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  aik:1, ek:1, do:2, teen:3, char:4, paanch:5,
  cheh:6, saat:7, aath:8, nau:9, das:10,
  pandrah:15, bees:20, pachees:25, tees:30,
  chalis:40, pachaas:50, saath:60, sattar:70,
  assi:80, nabbe:90, so:100, sau:100,
  hazar:1000, hazaar:1000,
  one:1, two:2, three:3, four:4, five:5,
  six:6, seven:7, eight:8, nine:9, ten:10,
  twenty:20, thirty:30, forty:40, fifty:50,
  hundred:100, thousand:1000,
};

const SPECIAL_NUMBERS: Record<string, number> = {
  dedh:1500, derh:1500, dhaai:2500, dhai:2500,
};

// ── Local helpers ─────────────────────────────────────────────────────────────

function detectTrade(text: string): string {
  const lower = text.toLowerCase();
  for (const [trade, kws] of Object.entries(TRADE_KEYWORDS)) {
    if (kws.some(k => lower.includes(k))) return trade;
  }
  return "Other";
}

function detectCity(text: string): string {
  const lower = text.toLowerCase();
  return CITY_LIST.find(c => lower.includes(c)) ?? "";
}

function detectArea(text: string): string {
  const lower = text.toLowerCase();
  return AREA_LIST.find(a => lower.includes(a)) ?? "";
}

function detectLanguage(text: string): "english" | "urdu" {
  if (/[\u0600-\u06FF]/.test(text)) return "urdu";
  const markers = ["kya","mera","meri","nahi","masla","pani","bijli",
                   "darwaza","hai","acha","theek","aur","main","yar","gar","ghar"];
  const hits = markers.filter(w => text.toLowerCase().includes(w)).length;
  return hits >= 2 ? "urdu" : "english";
}

function isGeneralQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return FAQ_PATTERNS.some(p => lower.includes(p));
}

function buildFollowUp(lang: "english"|"urdu", needProblem: boolean, needLocation: boolean): string {
  if (!needProblem && !needLocation) return "";
  if (lang === "urdu") {
    if (needProblem && needLocation) return "Aap apna masla aur city/area bata dein. Mثال: AC kharab hai, Islamabad, Barakau";
    if (needProblem)   return "Aap apna masla thora detail mein bata dein.";
    return "Aap apna city aur area bata dein. Mثال: Islamabad, Barakau";
  }
  if (needProblem && needLocation) return "Please describe your problem and share your city/area. Example: AC not cooling, Islamabad, F-7";
  if (needProblem)   return "Please describe the problem briefly.";
  return "Please share your city and area. Example: Islamabad, F-7";
}

// Heuristic analysis — runs locally, zero cost
function heuristicAnalysis(text: string): MessageAnalysis {
  const language    = detectLanguage(text);
  const lower       = text.toLowerCase().trim();
  const is_general  = isGeneralQuestion(text);
  const trade       = detectTrade(text);
  const city        = detectCity(text);
  const area        = detectArea(text);
  const has_problem = trade !== "Other" || (!is_general && lower.length > 10);
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

// JSON extraction — tolerates markdown fences
function extractJson(raw: string): string {
  const cleaned = raw.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
  try { JSON.parse(cleaned); return cleaned; } catch { /* fall through */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return match[0];
  throw new Error(`No JSON found in response: ${cleaned.slice(0, 200)}`);
}

function validateTrade(val: unknown): string {
  return (VALID_TRADES as readonly string[]).includes(String(val)) ? String(val) : "Other";
}

// ── Core: primary → backup with 429 retry ────────────────────────────────────

async function generate(prompt: string): Promise<string> {
  const { primary, backup } = getModels();

  // Try primary — retry once on 429
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await primary.generateContent(prompt);
      const t = r.response.text();
      if (!t?.trim()) throw new Error("Empty response");
      return extractJson(t);
    } catch (e) {
      const msg = String(e);
      if (msg.includes("429") && attempt === 1) {
        console.warn("[Gemini] Primary rate limited, retrying in 2s…");
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      console.warn(`[Gemini] Primary failed (attempt ${attempt}):`, msg);
      break;
    }
  }

  // Fallback to backup
  try {
    console.log("[Gemini] Switching to backup model");
    const r = await backup.generateContent(prompt);
    const t = r.response.text();
    if (!t?.trim()) throw new Error("Empty backup response");
    return extractJson(t);
  } catch (e) {
    throw new Error(`Both Gemini models failed: ${String(e)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

// ── analyzeCustomerMessage ────────────────────────────────────────────────────
// Returns MessageAnalysis object — NOT a plain string.
// Heuristic-first: skips Gemini for clear cases to save API quota.

export async function analyzeCustomerMessage(text: string): Promise<MessageAnalysis> {
  const input = (text ?? "").trim();
  const h = heuristicAnalysis(input);

  // Skip Gemini for obvious cases
  if (h.is_general_question)                     return h;
  if (input.length < 10)                         return h;
  if (GREETING_PATTERN.test(input) && input.length < 25) return h;
  if (h.trade !== "Other" && h.has_location)     return h; // fully confident

  // Ambiguous — call Gemini
  const prompt =
    `You are SnapFix, a Pakistani WhatsApp home services bot.\n` +
    `Analyze this message: ${JSON.stringify(input)}\n\n` +
    `Return ONLY valid JSON (no markdown, no explanation):\n` +
    `{"language":"english","is_general_question":false,"has_problem":true,"has_location":false,` +
    `"trade":"HVAC","summary":"AC is not cooling","city":"","area":"","follow_up":"Which city and area are you in?"}\n\n` +
    `Rules:\n` +
    `- has_problem: true only for specific home service issues\n` +
    `- is_general_question: true for "what services", "how does this work", general queries\n` +
    `- summary: problem description ONLY, no location words, max 100 chars\n` +
    `- trade: must be one of Plumber|Electrician|HVAC|Carpenter|Painter|Other\n` +
    `- language: "urdu" if Urdu script or Roman Urdu, else "english"\n` +
    `- follow_up: in customer's language, asking only for what is missing`;

  try {
    const raw  = await generate(prompt);
    const p    = JSON.parse(raw) as Partial<MessageAnalysis>;
    const lang = p.language === "urdu" ? "urdu" : "english";
    return {
      language:            lang,
      is_general_question: Boolean(p.is_general_question),
      has_problem:         Boolean(p.has_problem),
      has_location:        Boolean(p.has_location),
      trade:               validateTrade(p.trade),
      summary:             (typeof p.summary === "string" ? p.summary : h.summary).slice(0, 100),
      city:                typeof p.city  === "string" ? p.city.trim()  : h.city,
      area:                typeof p.area  === "string" ? p.area.trim()  : h.area,
      follow_up:           typeof p.follow_up === "string" ? p.follow_up.trim()
                             : buildFollowUp(lang, !Boolean(p.has_problem), !Boolean(p.has_location)),
    };
  } catch (err) {
    console.error("[Gemini] analyzeCustomerMessage → heuristic fallback:", String(err));
    return h;
  }
}

// ── extractJobDetails ─────────────────────────────────────────────────────────
// Returns JobExtraction object — NOT a plain string.

export async function extractJobDetails(text: string): Promise<JobExtraction> {
  const input = (text ?? "").trim();
  if (!input) return { trade: "Other", summary: "No description provided" };

  const localTrade = detectTrade(input);

  // Trade clearly found — no API needed
  if (localTrade !== "Other" || input.length < 25) {
    return { trade: localTrade, summary: input.slice(0, 100) };
  }

  const prompt =
    `Pakistani home services dispatcher.\n` +
    `Customer message: ${JSON.stringify(input)}\n\n` +
    `Return ONLY valid JSON:\n` +
    `{"trade":"Plumber","summary":"one sentence, problem only, no location, max 100 chars"}\n` +
    `trade must be one of: Plumber, Electrician, HVAC, Carpenter, Painter, Other`;

  try {
    const raw = await generate(prompt);
    const e = JSON.parse(raw) as Partial<JobExtraction>;
    return {
      trade:   validateTrade(e.trade) !== "Other" ? validateTrade(e.trade) : localTrade,
      summary: (typeof e.summary === "string" ? e.summary : input).slice(0, 100),
    };
  } catch {
    return { trade: localTrade, summary: input.slice(0, 100) };
  }
}

// ── extractBidDetails ─────────────────────────────────────────────────────────
// Returns BidExtraction object — NOT a plain string.
// Local parser handles 90% of cases (Urdu + English + Roman Urdu).

export async function extractBidDetails(text: string): Promise<BidExtraction> {
  const input = (text ?? "").trim();
  if (!input) return { price: "Not specified", eta: "Not specified" };

  // ── Local extraction first ────────────────────────────────────────────────

  let price = "Not specified";
  let eta   = "Not specified";
  let priceConf = 0;

  const lower = input.toLowerCase();

  // Price: digit or word-based number
  const digitMatch = lower.match(/\b(\d{3,6})\b/);
  const kMatch     = lower.match(/(\d+(?:\.\d+)?)\s*k\b/);

  let num: number | null = null;
  if (kMatch) num = Math.round(parseFloat(kMatch[1]) * 1000);
  else if (digitMatch) num = parseInt(digitMatch[1]);
  else {
    // Word-based
    for (const [word, val] of Object.entries(SPECIAL_NUMBERS)) {
      if (lower.includes(word)) { num = val; break; }
    }
    if (!num) {
      let total = 0;
      for (const [word, val] of Object.entries(NUMBER_WORDS)) {
        if (lower.includes(word)) {
          if (val === 1000 && total > 0) total *= 1000;
          else if (val === 100 && total > 0) total *= 100;
          else total += val;
        }
      }
      if (total >= 100) num = total;
    }
  }

  const hasCurrencyHint = /\b(rs\.?|pkr|rupee|rup|hazar|hazaar|thousand|k\b)/i.test(input);
  if (num && (num >= 200 || hasCurrencyHint)) {
    price = `Rs. ${num.toLocaleString()}`;
    priceConf = hasCurrencyHint ? 0.9 : 0.65;
  }

  // ETA: numeric
  const etaNum = lower.match(/(\d+)\s*(min(?:ute)?s?|hr?s?|hour|ghanta(?:y)?)/);
  if (etaNum) {
    const n = etaNum[1]; const unit = etaNum[2].toLowerCase();
    const isHour = /^(h|gh)/.test(unit);
    eta = `${n} ${isHour ? "hour" : "minute"}${n === "1" ? "" : "s"}`;
  } else if (/\b(jaldi|abhi|foran)\b/.test(lower)) {
    eta = "Soon";
  } else {
    // Word-based time
    let tTotal = 0;
    for (const [word, val] of Object.entries(NUMBER_WORDS)) {
      if (lower.includes(word)) tTotal += val;
    }
    if (tTotal > 0 && tTotal < 300) {
      const isHour = /\b(ghanta|ghantay|hour)\b/.test(lower);
      eta = `${tTotal} ${isHour ? "hour" : "minute"}${tTotal === 1 ? "" : "s"}`;
    }
  }

  const etaConf = eta !== "Not specified" ? 0.8 : 0;
  const confidence = priceConf * 0.6 + etaConf * 0.4;

  // High confidence — return local result, no API call
  if (confidence >= 0.5) {
    console.log(`[Gemini] Bid parsed locally (conf=${confidence.toFixed(2)})`);
    return { price, eta };
  }

  // Low confidence — call Gemini
  const prompt =
    `Pakistani technician bidding on a home service job.\n` +
    `Message: ${JSON.stringify(input)}\n\n` +
    `Message may be English, Roman Urdu, or Urdu. Examples:\n` +
    `"Do hazar" = Rs. 2000 | "Teen hazar" = Rs. 3000 | "Dedh hazar" = Rs. 1500\n` +
    `"Das minute" = 10 minutes | "Aadha ghanta" = 30 minutes | "Ek ghanta" = 1 hour\n\n` +
    `Return ONLY valid JSON:\n{"price":"Rs. 2000","eta":"10 minutes"}\n` +
    `Use "Not specified" if genuinely unclear.`;

  try {
    const raw = await generate(prompt);
    const e = JSON.parse(raw) as { price?: string; eta?: string };
    let finalPrice = typeof e.price === "string" && e.price.trim() ? e.price.trim() : price;
    const finalEta = typeof e.eta   === "string" && e.eta.trim()   ? e.eta.trim()   : eta;
    // Normalise Rs. prefix
    if (finalPrice !== "Not specified" && !/^Rs\./i.test(finalPrice)) {
      const n = finalPrice.replace(/[^0-9]/g, "");
      if (n) finalPrice = `Rs. ${parseInt(n).toLocaleString()}`;
    }
    return { price: finalPrice, eta: finalEta };
  } catch {
    return { price, eta };
  }
}

// ── Utility exports ───────────────────────────────────────────────────────────

export function isGreeting(text: string): boolean {
  return GREETING_PATTERN.test((text ?? "").trim()) && text.trim().length < 30;
}

export function looksLikeAdminCommand(text: string): boolean {
  return (text ?? "").trim().startsWith("/");
}
