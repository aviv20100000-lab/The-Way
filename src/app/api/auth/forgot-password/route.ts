import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, getUserByUsername } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { generateResetToken } from "@/lib/password-reset";
import { checkPersistentRateLimit } from "@/lib/ratelimit";
import { sendSecurityAlert } from "@/lib/security-alerts";
import { validateEmail } from "@/lib/validation";
import { sendTelegramAlert } from "@/lib/telegram";

const RESET_RESPONSE = {
  message: "אם החשבון קיים, תקבל קישור לאיפוס הסיסמה",
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
  const rateLimit = await checkPersistentRateLimit(`reset:${clientIp}`, "auth");

  if (!rateLimit.allowed) {
    await sendSecurityAlert({
      event: "forgot_password_rate_limited",
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
    const { email } = body;

    // Users log in with a username, not email — accept either here.
    const identifier = typeof email === "string" ? email.trim() : "";
    const isEmail = identifier.includes("@");
    if (!identifier || identifier.length > 100 || (isEmail && !validateEmail(identifier))) {
      await sendSecurityAlert({
        event: "forgot_password_invalid_email",
        severity: "medium",
        ip: clientIp,
        identifier: identifier || null,
        cooldownMs: 10 * 60 * 1000,
      });

      return NextResponse.json({ error: "אימייל או שם משתמש לא תקין" }, { status: 400 });
    }

    const user = isEmail ? await getUserByEmail(identifier) : await getUserByUsername(identifier);
    if (!user) {
      return NextResponse.json(RESET_RESPONSE, { status: 200 });
    }

    const resetToken = await generateResetToken(user.id, user.email);
    const resetLink = `${req.nextUrl.origin}/reset-password?token=${resetToken}`;
    await sendTelegramAlert(
      `<b>בקשת איפוס סיסמה</b>\nשם: ${escapeHtml(user.name)}\nאימייל: ${escapeHtml(user.email)}\n${resetLink}`
    );
    const responseBody: { message: string; resetLink?: string } = {
      ...RESET_RESPONSE,
    };

    if (process.env.NODE_ENV !== "production") {
      responseBody.resetLink = resetLink;
    }

    return NextResponse.json(responseBody, { status: 200 });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "אירעה שגיאה. נסה שוב מאוחר יותר." },
      { status: 500 }
    );
  }
}
