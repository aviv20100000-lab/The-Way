import { NextRequest, NextResponse } from "next/server";
import {
  getUserByEmail,
  getUserByUsername,
  setSession,
  verifyPassword,
} from "@/lib/auth";
import {
  checkPersistentRateLimit,
  clearPersistentRateLimitEntry,
  formatResetIn,
} from "@/lib/ratelimit";
import { sendSecurityAlert } from "@/lib/security-alerts";
import { ensureSeed } from "@/lib/seed";

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
  const { identifier, email, username, password } = await req.json();
  const loginIdentifier =
    typeof identifier === "string" && identifier.trim()
      ? identifier.trim()
      : typeof email === "string" && email.trim()
        ? email.trim()
        : typeof username === "string" && username.trim()
          ? username.trim()
          : "";

  if (!loginIdentifier || !password) {
    return NextResponse.json(
      { error: "נא למלא מייל או שם משתמש וסיסמה" },
      { status: 400 }
    );
  }

  const normalizedIdentifier = loginIdentifier.toLowerCase();
  const rateLimitKey = `login:${clientIp}:${encodeURIComponent(normalizedIdentifier)}`;
  const rateLimit = await checkPersistentRateLimit(rateLimitKey, "auth");

  if (!rateLimit.allowed) {
    await sendSecurityAlert({
      event: "login_rate_limited",
      severity: "high",
      ip: clientIp,
      identifier: loginIdentifier,
      cooldownMs: 15 * 60 * 1000,
    });

    return NextResponse.json(
      { error: `יותר מדי ניסיונות התחברות. נסה שוב בעוד ${formatResetIn(rateLimit.resetIn)}.` },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) },
      }
    );
  }

  await ensureSeed();

  let user = await getUserByEmail(loginIdentifier);
  if (!user) {
    user = await getUserByUsername(loginIdentifier);
  }

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await sendSecurityAlert({
      event: "login_failed",
      severity: "medium",
      ip: clientIp,
      identifier: loginIdentifier,
      cooldownMs: 10 * 60 * 1000,
    });

    return NextResponse.json(
      { error: "מייל, שם משתמש או סיסמה שגויים" },
      { status: 401 }
    );
  }

  // Checked only after the password is verified, so a switched-off account is not
  // a way to probe which usernames exist.
  if (!user.active) {
    return NextResponse.json(
      { error: "החשבון הזה כבוי. פנה למאמן שלך." },
      { status: 403 }
    );
  }

  await clearPersistentRateLimitEntry(rateLimitKey);

  await setSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    coach_id: user.coach_id,
  });

  return NextResponse.json({ role: user.role, name: user.name });
}
