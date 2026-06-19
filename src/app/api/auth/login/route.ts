import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, setSession, verifyPassword } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";

export async function POST(req: NextRequest) {
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
