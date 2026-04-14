import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing");
}

const genAI = new GoogleGenerativeAI(apiKey);

const liteModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
});

const flashModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export interface JobExtraction {
  trade: string;
  summary: string;
}

export interface BidExtraction {
  price: string;
  eta: string;
}

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

type CacheEntry<T> = {
  value: T;
  ts: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

const analysisCache = new Map<string, CacheEntry<MessageAnalysis>>();
const jobCache = new Map<string, CacheEntry<JobExtraction>>();
const bidCache = new Map<string, CacheEntry<BidExtraction>>();

const TRADE_KEYWORDS: Record<string, string[]> = {
  HVAC: [
    "ac",
    "a/c",
    "air condition",
    "hvac",
    "cooling",
    "heat",
    "heater",
    "heating",
    "geyser",
    "geysir",
    "fan",
    "air cool",
    "leakage from ac",
    "ac not",
    "gas leakage",
  ],
  Plumber: [
    "water",
    "pipe",
    "leak",
    "tap",
    "flush",
    "toilet",
    "drain",
    "sewage",
    "plumb",
    "nali",
    "pani",
  ],
  Electrician: [
    "electric",
    "light",
    "power",
    "wiring",
    "switch",
    "socket",
    "mcb",
    "short circuit",
    "bijli",
    "current",
    "voltage",
  ],
  Carpenter: ["door", "window", "wood", "cabinet", "furniture", "carpenter", "almari", "darwaza"],
  Painter: ["paint", "wall", "colour", "color", "crack", "plaster"],
};

const CITY_KEYWORDS = [
  "islamabad",
  "rawalpindi",
  "lahore",
  "karachi",
  "peshawar",
  "multan",
  "faisalabad",
  "quetta",
  "abbottabad",
  "murree",
];

const AREA_KEYWORDS = [
  "barakhu",
  "barakau",
  "f-6",
  "f-7",
  "f-8",
  "f-10",
  "g-9",
  "g-10",
  "g-11",
  "dha",
  "bahria",
  "gulberg",
  "johar",
  "clifton",
  "defence",
  "blue area",
  "i-8",
  "i-9",
  "i-10",
  "pwd",
  "cbr",
  "satellite town",
  "pindi",
];

const FAQ_WORDS = [
  "what service",
  "what do you",
  "how does",
  "how do you",
  "what trades",
  "like what",
  "tell me about",
  "what kind",
  "what type",
  "kya karte",
  "kya services",
  "explain",
  "introduce",
  "about you",
  "what is this",
  "who are you",
  "what are you",
  "weekend",
  "timing",
  "hours",
  "coverage",
  "area serve",
];

function normalizeKey(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function clean(raw: string) {
  return raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

function extractJsonObject(raw: string): string {
  const cleaned = clean(raw);

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`No JSON object found in model response: ${cleaned}`);
    return match[0];
  }
}

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { value, ts: Date.now() });
}

function isUrduScript(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function detectLanguage(text: string): "english" | "urdu" {
  if (isUrduScript(text)) return "urdu";

  const lower = text.toLowerCase();
  const urduMarkers = ["kya", "mera", "meri", "nahi", "nahi", "masla", "masla hai", "pani", "bijli", "qarz", "darwaza", "khula", "band", "hai", "acha", "theek"];
  const hitCount = urduMarkers.reduce((count, word) => count + (lower.includes(word) ? 1 : 0), 0);

  return hitCount >= 2 ? "urdu" : "english";
}

function isGeneralQuestion(text: string) {
  const lower = text.toLowerCase();
  return FAQ_WORDS.some((k) => lower.includes(k));
}

function detectTrade(text: string): string {
  const lower = text.toLowerCase();
  for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return trade;
  }
  return "Other";
}

function detectCity(text: string): string {
  const lower = text.toLowerCase();
  return CITY_KEYWORDS.find((c) => lower.includes(c)) ?? "";
}

function detectArea(text: string): string {
  const lower = text.toLowerCase();
  return AREA_KEYWORDS.find((a) => lower.includes(a)) ?? "";
}

function makeSummary(text: string) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.slice(0, 100);
}

function buildFollowUp(language: "english" | "urdu", missingProblem: boolean, missingLocation: boolean) {
  if (!missingProblem && !missingLocation) return "";

  if (language === "urdu") {
    if (missingProblem && missingLocation) return "Aap please masla aur apna city/area bata dein.";
    if (missingProblem) return "Aap please apna masla thora detail mein bata dein.";
    return "Aap please apna city aur area bata dein.";
  }

  if (missingProblem && missingLocation) return "Please share the problem and your city/area.";
  if (missingProblem) return "Please describe the problem briefly.";
  return "Please share your city and area.";
}

function keywordFallback(text: string): MessageAnalysis {
  const language = detectLanguage(text);
  const lower = text.toLowerCase();

  const is_general_question = isGeneralQuestion(text);
  const trade = detectTrade(text);
  const city = detectCity(text);
  const area = detectArea(text);

  const has_problem = trade !== "Other" || (!is_general_question && lower.length > 10);
  const has_location = Boolean(city || area);

  return {
    language,
    is_general_question,
    has_problem,
    has_location,
    trade,
    summary: makeSummary(text),
    city,
    area,
    follow_up: is_general_question ? "" : buildFollowUp(language, !has_problem, !has_location),
  };
}

function keywordExtractJob(text: string): JobExtraction {
  return {
    trade: detectTrade(text),
    summary: makeSummary(text),
  };
}

function regexExtractBid(text: string): BidExtraction {
  const lower = text.toLowerCase();

  let price = "Not specified";
  const priceMatch = lower.match(
    /(?:rs\.?\s*|pkr\s*|price\s*[:\s]+|rupees?\s*[:\s]*)?(\d[\d,]{2,})(?:\s*(?:rs|pkr|rupees?))?/i,
  );
  if (priceMatch) {
    const num = priceMatch[1].replace(/,/g, "");
    if (Number(num) >= 100) price = `Rs. ${num}`;
  }

  let eta = "Not specified";
  const etaMatch = lower.match(/(?:eta\s*[:\s]+|in\s+)?(\d+)\s*(hour|hr|hrs|minute|min|mins|h\b)/i);
  if (etaMatch) {
    const num = etaMatch[1];
    const unit = etaMatch[2].toLowerCase();
    eta = unit.startsWith("h") ? `${num} hour${num === "1" ? "" : "s"}` : `${num} minute${num === "1" ? "" : "s"}`;
  }

  return { price, eta };
}

async function generateWithFallback(prompt: string) {
  try {
    return await liteModel.generateContent(prompt);
  } catch (liteErr) {
    console.warn("[Gemini] Flash Lite failed, falling back to Flash:", liteErr);
    return await flashModel.generateContent(prompt);
  }
}

function validateTrade(trade: unknown) {
  return ["Plumber", "Electrician", "HVAC", "Carpenter", "Painter", "Other"].includes(String(trade));
}

function validateLanguage(language: unknown): "english" | "urdu" {
  return language === "urdu" ? "urdu" : "english";
}

export async function analyzeCustomerMessage(text: string): Promise<MessageAnalysis> {
  const input = text ?? "";
  const cacheKey = normalizeKey(input);
  const cached = getCached(analysisCache, cacheKey);
  if (cached) return cached;

  const heuristic = keywordFallback(input);

  // Save money on obvious cases.
  if (heuristic.is_general_question) {
    setCached(analysisCache, cacheKey, heuristic);
    return heuristic;
  }

  if (heuristic.trade !== "Other" && heuristic.has_location) {
    setCached(analysisCache, cacheKey, heuristic);
    return heuristic;
  }

  if (input.trim().length < 12) {
    setCached(analysisCache, cacheKey, heuristic);
    return heuristic;
  }

  const prompt = `Classify this SnapFix customer message for Pakistan:\n${JSON.stringify(input)}\n\nReturn JSON with keys: language, is_general_question, has_problem, has_location, trade, summary, city, area, follow_up.\nAllowed trade values: Plumber, Electrician, HVAC, Carpenter, Painter, Other.\nfollow_up must be in the customer's language and should ask only for the missing detail.`;

  try {
    const result = await generateWithFallback(prompt);
    const raw = extractJsonObject(result.response.text());
    const parsed = JSON.parse(raw) as Partial<MessageAnalysis>;

    const finalResult: MessageAnalysis = {
      language: validateLanguage(parsed.language),
      is_general_question: Boolean(parsed.is_general_question),
      has_problem: Boolean(parsed.has_problem),
      has_location: Boolean(parsed.has_location),
      trade: validateTrade(parsed.trade) ? String(parsed.trade) : "Other",
      summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim().slice(0, 100) : makeSummary(input),
      city: typeof parsed.city === "string" ? parsed.city.trim() : "",
      area: typeof parsed.area === "string" ? parsed.area.trim() : "",
      follow_up: typeof parsed.follow_up === "string" ? parsed.follow_up.trim() : "",
    };

    if (!finalResult.follow_up) {
      finalResult.follow_up = finalResult.is_general_question
        ? ""
        : buildFollowUp(finalResult.language, !finalResult.has_problem, !finalResult.has_location);
    }

    setCached(analysisCache, cacheKey, finalResult);
    return finalResult;
  } catch (err) {
    console.error("[Gemini] analyzeCustomerMessage failed, using keyword fallback:", err);
    setCached(analysisCache, cacheKey, heuristic);
    return heuristic;
  }
}

export async function extractJobDetails(text: string): Promise<JobExtraction> {
  const input = text ?? "";
  if (!input.trim()) return { trade: "Other", summary: "No description provided" };

  const cacheKey = normalizeKey(input);
  const cached = getCached(jobCache, cacheKey);
  if (cached) return cached;

  const heuristic = keywordExtractJob(input);

  // Use rules for clear cases; reserve AI for ambiguous descriptions.
  if (heuristic.trade !== "Other" || input.trim().length < 30) {
    setCached(jobCache, cacheKey, heuristic);
    return heuristic;
  }

  const prompt = `Identify the home-service trade from this message and give a short summary.\nMessage: ${JSON.stringify(input)}\n\nReturn JSON with keys: trade, summary.\nAllowed trade values: Plumber, Electrician, HVAC, Carpenter, Painter, Other.`;

  try {
    const result = await generateWithFallback(prompt);
    const raw = extractJsonObject(result.response.text());
    const parsed = JSON.parse(raw) as Partial<JobExtraction>;

    const finalResult: JobExtraction = {
      trade: validateTrade(parsed.trade) ? String(parsed.trade) : heuristic.trade,
      summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim().slice(0, 100) : heuristic.summary,
    };

    setCached(jobCache, cacheKey, finalResult);
    return finalResult;
  } catch (err) {
    console.error("[Gemini] extractJobDetails failed, using keyword fallback:", err);
    setCached(jobCache, cacheKey, heuristic);
    return heuristic;
  }
}

export async function extractBidDetails(text: string): Promise<BidExtraction> {
  const input = text ?? "";
  if (!input.trim()) return { price: "Not specified", eta: "Not specified" };

  const cacheKey = normalizeKey(input);
  const cached = getCached(bidCache, cacheKey);
  if (cached) return cached;

  const regexResult = regexExtractBid(input);

  // If both are already captured by regex, skip AI entirely.
  if (regexResult.price !== "Not specified" && regexResult.eta !== "Not specified") {
    setCached(bidCache, cacheKey, regexResult);
    return regexResult;
  }

  const prompt = `Extract only the explicitly stated bid details from this technician message.\nMessage: ${JSON.stringify(input)}\n\nReturn JSON with keys: price, eta.\nUse exactly "Not specified" for any missing field.`;

  try {
    const result = await generateWithFallback(prompt);
    const raw = extractJsonObject(result.response.text());
    const parsed = JSON.parse(raw) as Partial<BidExtraction>;

    const finalResult: BidExtraction = {
      price: typeof parsed.price === "string" && parsed.price.trim() ? parsed.price.trim() : regexResult.price,
      eta: typeof parsed.eta === "string" && parsed.eta.trim() ? parsed.eta.trim() : regexResult.eta,
    };

    setCached(bidCache, cacheKey, finalResult);
    return finalResult;
  } catch (err) {
    console.error("[Gemini] extractBidDetails failed, using regex fallback:", err);
    setCached(bidCache, cacheKey, regexResult);
    return regexResult;
  }
}
