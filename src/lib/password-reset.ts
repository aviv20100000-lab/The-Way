import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";

const RESET_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-for-reset-tokens"
);

interface ResetToken {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export async function generateResetToken(userId: string, email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 15 * 60) // 15 minutes
    .sign(RESET_SECRET);
}

export async function verifyResetToken(token: string): Promise<ResetToken | null> {
  try {
    const { payload } = await jwtVerify(token, RESET_SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

export function generateSecureCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export function hashResetCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
