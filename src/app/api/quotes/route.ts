import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { v4 as uuid } from "uuid";

export async function GET() {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  if (session.role === "coach") {
    const rows = (await db.execute("SELECT * FROM quotes ORDER BY created_at DESC")).rows;
    return NextResponse.json(rows);
  }

  const rows = (await db.execute("SELECT * FROM quotes WHERE active=1 ORDER BY RANDOM() LIMIT 1")).rows;
  return NextResponse.json(rows[0] ?? { text: "הדרך מתחילה בצעד אחד." });
}

export async function POST(req: NextRequest) {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session || session.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { text, author } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "טקסט חסר" }, { status: 400 });

  const id = uuid();
  await db.execute({ sql: "INSERT INTO quotes (id, text, author) VALUES (?,?,?)", args: [id, text.trim(), author || null] });
  return NextResponse.json({ id });
}

export async function DELETE(req: NextRequest) {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session || session.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { id } = await req.json();
  await db.execute({ sql: "DELETE FROM quotes WHERE id=?", args: [id] });
  return NextResponse.json({ ok: true });
}
