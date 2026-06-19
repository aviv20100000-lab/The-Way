import { NextRequest, NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { verifyResetToken } from "@/lib/password-reset";
import { validatePassword } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
  const rateLimit = checkRateLimit(`password-reset:${clientIp}`, "auth");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "יותר מדי בקשות. נסה שוב בעוד כמה דקות." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) } }
    );
  }

  try {
    await initDb();
    const body = await req.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json({ error: "חסרים פרטים נדרשים" }, { status: 400 });
    }

    const resetData = await verifyResetToken(token);

    if (!resetData) {
      return NextResponse.json(
        { error: "קישור איפוס הסיסמה פג או לא תקין" },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.error }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    await db.execute({
      sql: "UPDATE users SET password_hash = ? WHERE id = ?",
      args: [passwordHash, resetData.userId],
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
