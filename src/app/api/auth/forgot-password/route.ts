import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/auth";
import { generateResetToken } from "@/lib/password-reset";
import { validateEmail } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";
import { initDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
  const rateLimit = checkRateLimit(`reset:${clientIp}`, "auth");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "יותר מדי בקשות. נסה שוב בעוד כמה דקות." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) } }
    );
  }

  try {
    await initDb();
    const body = await req.json();
    const { email } = body;

    if (!email || !validateEmail(email)) {
      return NextResponse.json({ error: "אימייל לא תקין" }, { status: 400 });
    }

    const user = await getUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { message: "אם כתובת האימייל קיימת, תקבל הודעה לאיפוס הסיסמה" },
        { status: 200 }
      );
    }

    const resetToken = await generateResetToken(user.id, user.email);

    return NextResponse.json(
      {
        message: "קישור איפוס סיסמה נשלח לאימייל שלך",
        resetLink: `/reset-password?token=${resetToken}`,
      },
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
