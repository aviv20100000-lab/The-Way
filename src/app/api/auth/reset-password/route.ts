import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { consumeResetToken } from "@/lib/password-reset";
import { checkPersistentRateLimit } from "@/lib/ratelimit";
import { sendSecurityAlert } from "@/lib/security-alerts";
import { validatePassword } from "@/lib/validation";
import { logAuditEvent } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
  const rateLimit = await checkPersistentRateLimit(`password-reset:${clientIp}`, "auth");

  if (!rateLimit.allowed) {
    await sendSecurityAlert({
      event: "reset_password_rate_limited",
      severity: "high",
      ip: clientIp,
      cooldownMs: 15 * 60 * 1000,
    });

    return NextResponse.json(
      { error: "יותר מדי בקשות. נסה שוב בעוד כמה דקות." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) },
      }
    );
  }

  try {
    await initDb();
    const body = await req.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json({ error: "חסרים פרטים נדרשים" }, { status: 400 });
    }

    const resetData = await consumeResetToken(token);
    if (!resetData) {
      await sendSecurityAlert({
        event: "reset_password_invalid_token",
        severity: "high",
        ip: clientIp,
        cooldownMs: 15 * 60 * 1000,
      });

      return NextResponse.json(
        { error: "קישור איפוס הסיסמה פג או לא תקין" },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    await db.execute({
      sql: "UPDATE users SET password_hash = ?, session_version = COALESCE(session_version, 1) + 1 WHERE id = ?",
      args: [passwordHash, resetData.userId],
    });

    void logAuditEvent("password_reset_success", {
      userId: resetData.userId,
      ip: clientIp,
    });

    return NextResponse.json(
      { message: "הסיסמה שונתה בהצלחה. כעת אתה יכול להתחבר." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "אירעה שגיאה. נסה שוב מאוחר יותר." },
      { status: 500 }
    );
  }
}
