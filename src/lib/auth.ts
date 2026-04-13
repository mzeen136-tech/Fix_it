import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "snapfix-fallback-secret-change-in-production"
);

export type JWTPayload = {
  sub: string;       // phone number (tech) or "admin"
  role: "admin" | "tech";
  name?: string;
};

// ── Sign a new JWT (24h expiry) ───────────────────────────────────────────────

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}

// ── Verify a JWT — returns payload or null ────────────────────────────────────

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// ── Cookie name constants ─────────────────────────────────────────────────────

export const ADMIN_COOKIE = "snapfix_admin";
export const TECH_COOKIE  = "snapfix_tech";
