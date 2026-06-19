import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, setSession, verifyPassword } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { checkRateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
  const rateLimit = checkRateLimit(clientIp, "auth");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "יותר מדי ניסיונות התחברות. נסה שוב בעוד כמה דקות." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) } }
    );
  }

  await ensureSeed();
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "נא למלא אימייל וסיסמה" }, { status: 400 });

  const user = await getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: "אימייל או סיסמה שגויים" }, { status: 401 });
  }

  await setSession({ id: user.id, name: user.name, email: user.email, role: user.role, coach_id: user.coach_id });
  return NextResponse.json({ role: user.role, name: user.name });
}
