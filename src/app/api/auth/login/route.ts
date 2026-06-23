import { NextRequest, NextResponse } from "next/server";
import { getUserByUsername, setSession, verifyPassword } from "@/lib/auth";
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
  const { username, password } = await req.json();
  if (!username || !password) return NextResponse.json({ error: "נא למלא שם משתמש וסיסמה" }, { status: 400 });

  const user = await getUserByUsername(username);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: "שם משתמש או סיסמה שגויים" }, { status: 401 });
  }

  await setSession({ id: user.id, name: user.name, email: user.email, role: user.role, coach_id: user.coach_id });
  return NextResponse.json({ role: user.role, name: user.name });
}
