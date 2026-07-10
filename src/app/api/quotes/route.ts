import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import db, { initDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const action = req.nextUrl.searchParams.get("action");

  if (action === "list") {
    const res = await db.execute(
      "SELECT * FROM quotes WHERE active = 1 ORDER BY created_at DESC"
    );
    return NextResponse.json(res.rows);
  }

  // Default: get random quote
  const res = await db.execute(
    "SELECT * FROM quotes WHERE active = 1 ORDER BY RANDOM() LIMIT 1"
  );

  const quote = res.rows[0] || { text: "כל שלב הוא הצלחה. תמשיך להלוך." };
  return NextResponse.json(quote);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  
  const userRes = await db.execute({
    sql: "SELECT role FROM users WHERE id = ?",
    args: [user.id],
  });
  
  const userData = userRes.rows[0] as unknown as { role: string };
  if (userData?.role !== "coach") {
    return NextResponse.json({ error: "רק מאמנים יכולים להוסיף ציטוטים" }, { status: 403 });
  }

  const { text, author } = await req.json();
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "ציטוט לא יכול להיות ריק" }, { status: 400 });
  }

  if (text.length > 1000) {
    return NextResponse.json({ error: "ציטוט ארוך מדי (מקסימום 1000 תווים)" }, { status: 400 });
  }

  if (author && typeof author !== "string") {
    return NextResponse.json({ error: "שם מחבר לא תקין" }, { status: 400 });
  }

  if (author && author.length > 100) {
    return NextResponse.json({ error: "שם מחבר ארוך מדי (מקסימום 100 תווים)" }, { status: 400 });
  }

  const id = uuid();
  await db.execute({
    sql: `INSERT INTO quotes (id, text, author, active)
          VALUES (?, ?, ?, 1)`,
    args: [id, text.trim(), author?.trim() || null],
  });

  return NextResponse.json({ id, text, author });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  
  const userRes = await db.execute({
    sql: "SELECT role FROM users WHERE id = ?",
    args: [user.id],
  });
  
  const userData = userRes.rows[0] as unknown as { role: string };
  if (userData?.role !== "coach") {
    return NextResponse.json({ error: "רק מאמנים יכולים למחוק ציטוטים" }, { status: 403 });
  }

  const { quoteId } = await req.json();
  await db.execute({
    sql: "UPDATE quotes SET active = 0 WHERE id = ?",
    args: [quoteId],
  });

  return NextResponse.json({ success: true });
}
