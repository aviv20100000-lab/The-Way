import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import db, { initDb } from "./db";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required for password reset tokens");
}

const RESET_SECRET = new TextEncoder().encode(jwtSecret);

interface ResetToken {
  userId: string;
  email: string;
  jti: string;
  iat: number;
  exp: number;
}

export async function generateResetToken(userId: string, email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  await initDb();
  await db.execute({
    sql: "INSERT INTO password_reset_tokens (jti, user_id, expires_at, used_at) VALUES (?, ?, datetime('now', '+15 minutes'), NULL)",
    args: [jti, userId],
  });

  return new SignJWT({ userId, email, jti })
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
      jti: payload.jti as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

export async function consumeResetToken(token: string): Promise<ResetToken | null> {
  const resetData = await verifyResetToken(token);
  if (!resetData) return null;

  await initDb();
  const tokenRow = await db.execute({
    sql: `
      SELECT jti
      FROM password_reset_tokens
      WHERE jti = ?
        AND user_id = ?
        AND used_at IS NULL
        AND expires_at > datetime('now')
    `,
    args: [resetData.jti, resetData.userId],
  });

  if (!tokenRow.rows[0]) {
    return null;
  }

  await db.execute({
    sql: "UPDATE password_reset_tokens SET used_at = datetime('now') WHERE jti = ?",
    args: [resetData.jti],
  });

  return resetData;
}
