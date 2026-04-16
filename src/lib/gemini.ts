// ─── Gemini Clean + Stable Integration ───────────────────────────────────────

import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── API KEYS ────────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const genAI2 = new GoogleGenerativeAI(process.env.GEMINI_BACKUP_API_KEY!);

// ─── MODEL SETUP ─────────────────────────────────────────────────────────────

// Primary → smarter
const primaryModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-latest",
});

// Backup → cheaper fallback
const backupModel = genAI2.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
});

// ─── PROMPT BUILDER ──────────────────────────────────────────────────────────
function buildPrompt(action: string, text: string, tone: string = "professional") {
  return `
You are an AI assistant.

Action: ${action}
Tone: ${tone}

User Message:
${text}

Instructions:
- Be clear and concise
- Maintain proper tone
- No unnecessary text
`;
}

// ─── MAIN GENERATE FUNCTION ──────────────────────────────────────────────────
export async function generateResponse({
  action,
  text,
  tone = "professional",
}: {
  action: string;
  text: string;
  tone?: string;
}) {
  const prompt = buildPrompt(action, text, tone);

  try {
    const result = await primaryModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.warn("Primary failed → switching to backup", error);

    try {
      const result = await backupModel.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err) {
      console.error("Both models failed:", err);
      throw new Error("AI generation failed");
    }
  }
}

// ─── ADMIN COMMAND DETECTOR (FIX FOR YOUR ERROR) ─────────────────────────────
export function looksLikeAdminCommand(message: string): boolean {
  if (!message) return false;

  const msg = message.toLowerCase();

  return (
    msg.startsWith("add tech") ||
    msg.startsWith("delete tech") ||
    msg.startsWith("list tech") ||
    msg.startsWith("admin") ||
    msg.includes("technician list") ||
    msg.includes("register technician")
  );
}
// ─── GREETING DETECTOR (FIX) ────────────────────────────────────────────────
export function isGreeting(message: string): boolean {
  if (!message) return false;

  const msg = message.toLowerCase().trim();

  return (
    msg === "hi" ||
    msg === "hello" ||
    msg === "hey" ||
    msg === "assalamualaikum" ||
    msg === "aoa" ||
    msg.includes("salam")
  );
}

// ─── EXTRA HELPERS REQUIRED BY FLOWS ─────────────────────────────────────────

// Analyze general customer intent
export async function analyzeCustomerMessage(message: string) {
  return generateResponse({
    action: "Analyze customer intent and summarize clearly",
    text: message,
  });
}

// Extract structured job details
export async function extractJobDetails(message: string) {
  return generateResponse({
    action:
      "Extract structured job details: problem, service type, location, urgency, budget (if any)",
    text: message,
  });
}

// Extract technician bid details
export async function extractBidDetails(message: string) {
  return generateResponse({
    action:
      "Extract bid details: price, time estimate, technician message",
    text: message,
  });
}