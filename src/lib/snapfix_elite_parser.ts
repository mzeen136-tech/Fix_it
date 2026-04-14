// ELITE SNAPFIX PARSER (ENGLISH + URDU + ROMAN URDU + CONFIDENCE ENGINE)

export interface BidExtraction {
  price: string;
  eta: string;
  confidence: number; // 0 → 1
}

// ---------------- NUMBER SYSTEM ----------------

const NUMBER_WORDS: Record<string, number> = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  hundred: 100, thousand: 1000,

  // Roman Urdu
  aik: 1, do: 2, teen: 3, char: 4, paanch: 5,
  cheh: 6, saat: 7, aath: 8, nau: 9, das: 10,
  bees: 20, tees: 30, chalis: 40, pachaas: 50,
  so: 100, sau: 100, hazar: 1000, hazaar: 1000,

  // Urdu
  "ایک": 1, "دو": 2, "تین": 3, "چار": 4,
  "پانچ": 5, "دس": 10, "بیس": 20,
  "سو": 100, "ہزار": 1000,
};

// Special composite values
const SPECIAL_NUMBERS: Record<string, number> = {
  dedh: 1500,
  derh: 1500,
  dhaai: 2500,
  dhai: 2500,
  saade: 500,
  aadha: 0.5,
};

// Handles: 1k, 1.5k, 2k
function extractKFormat(text: string): number | null {
  const match = text.toLowerCase().match(/(\d+(\.\d+)?)\s*k/);
  if (match) {
    return Math.round(parseFloat(match[1]) * 1000);
  }
  return null;
}

function extractNumberSmart(text: string): number | null {
  const lower = text.toLowerCase();

  // 1. Handle 1k / 2k / 1.5k
  const kVal = extractKFormat(lower);
  if (kVal) return kVal;

  // 2. direct number
  const digit = lower.match(/\d{1,5}/);
  if (digit) return parseInt(digit[0]);

  // 3. special phrases
  for (const [word, val] of Object.entries(SPECIAL_NUMBERS)) {
    if (lower.includes(word)) {
      if (word === "aadha") return 30; // assume minutes
      return val;
    }
  }

  let total = 0;

  for (const [word, val] of Object.entries(NUMBER_WORDS)) {
    if (lower.includes(word)) {
      if (val === 1000 && total > 0) total *= 1000;
      else if (val === 100 && total > 0) total *= 100;
      else total += val;
    }
  }

  return total > 0 ? total : null;
}

// ---------------- TIME PARSER ----------------

function extractTimeSmart(text: string): { eta: string; confidence: number } {
  const lower = text.toLowerCase();

  // numeric time
  const numeric = lower.match(/(\d+)\s*(min|minute|minutes|hour|hr|ghanta|ghantay)/);
  if (numeric) {
    const num = numeric[1];
    const isHour =
      numeric[2].startsWith("h") || numeric[2].includes("gh");

    return {
      eta: `${num} ${isHour ? "hour" : "minute"}${num === "1" ? "" : "s"}`,
      confidence: 0.95,
    };
  }

  // words like "jaldi", "abhi"
  if (lower.includes("jaldi") || lower.includes("abhi")) {
    return { eta: "Soon", confidence: 0.6 };
  }

  const num = extractNumberSmart(text);
  if (!num) return { eta: "Not specified", confidence: 0 };

  if (lower.includes("ghanta") || lower.includes("hour")) {
    return { eta: `${num} hours`, confidence: 0.85 };
  }

  return { eta: `${num} minutes`, confidence: 0.75 };
}

// ---------------- INTENT DETECTION ----------------

function detectIntent(text: string) {
  const lower = text.toLowerCase();

  return {
    isBid:
      /\d/.test(text) ||
      lower.includes("rs") ||
      lower.includes("pkr") ||
      lower.includes("price") ||
      lower.includes("hazar") ||
      lower.includes("thousand") ||
      lower.includes("derh") ||
      lower.includes("dhai") ||
      lower.includes("k"),

    isLanguageQuestion:
      lower.includes("urdu") &&
      (lower.includes("likh") || lower.includes("bol")),
  };
}

// ---------------- CONFIDENCE ENGINE ----------------

function calculateConfidence(priceDetected: boolean, etaConfidence: number): number {
  let score = 0;

  if (priceDetected) score += 0.5;
  if (etaConfidence > 0) score += 0.3;

  score += etaConfidence * 0.2;

  return Math.min(score, 1);
}

// ---------------- MAIN PARSER ----------------

export function extractBidElite(
  text: string
): BidExtraction | { reply: string } {
  const intent = detectIntent(text);

  // Language question
  if (intent.isLanguageQuestion) {
    return {
      reply: "Ji bilkul! Aap Urdu ya Roman Urdu dono mein likh sakte hain 😊",
    };
  }

  // Not a bid
  if (!intent.isBid) {
    return {
      price: "Not specified",
      eta: "Not specified",
      confidence: 0,
    };
  }

  // PRICE
  let price = "Not specified";
  const num = extractNumberSmart(text);

  let priceDetected = false;

  const lower = text.toLowerCase();
  const hasCurrencyHint =
    lower.includes("rs") ||
    lower.includes("pkr") ||
    lower.includes("rup") ||
    lower.includes("price");

  if (num && (num >= 100 || hasCurrencyHint)) {
    price = `Rs. ${num}`;
    priceDetected = true;
  }

  // TIME
  const timeData = extractTimeSmart(text);

  const confidence = calculateConfidence(
    priceDetected,
    timeData.confidence
  );

  return {
    price,
    eta: timeData.eta,
    confidence,
  };
}

// ---------------- GEMINI DECISION ----------------

export function shouldCallGemini(result: BidExtraction): boolean {
  return result.confidence < 0.6;
}