import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import db, { initDb } from "@/lib/db";

const QUOTES = [
  { text: "כל צעד קטן הוא ניצחון. חגוג כל אחד מהם.", author: "המאמן שלך" },
  { text: "אתה לא בתחרות עם אף אחד אחר. אתה בתחרות עם הגרסה שלך מאתמול.", author: "המאמן שלך" },
  { text: "התשוקה יוצרת תוכנית. מסדר יוצר תוצאות.", author: "המאמן שלך" },
  { text: "הגוף שלך יכול לעשות הרבה יותר מאשר המוח שלך חושב שהוא יכול.", author: "המאמן שלך" },
  { text: "זה לא תמיד קל. בדיוק בגלל זה זה עובד.", author: "המאמן שלך" },
  { text: "אנו לא מחזיקים הסדר על ידי כושר פיזי — אנו מחזיקים הסדר על ידי כושר רוח.", author: "המאמן שלך" },
  { text: "הבריאות שלך היא השקעה, לא עלות.", author: "המאמן שלך" },
  { text: "אתה לא צריך להיות מעולה כדי להתחיל. אבל אתה צריך להתחיל כדי להיות מעולה.", author: "זיג זיגלר" },
  { text: "הדרך הטובה ביותר לחזות את העתיד היא ליצור אותו.", author: "המאמן שלך" },
  { text: "עוצמה אינה מגיעה מהגוף. היא מגיעה מהרצון.", author: "המאמן שלך" },
  { text: "אתה חזק יותר ממה שאתה חושב.", author: "המאמן שלך" },
  { text: "כל יום הוא הזדמנות חדשה להיות טוב יותר.", author: "המאמן שלך" },
];

export async function GET(req: NextRequest) {
  if (!process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Admin token not configured" }, { status: 500 });
  }

  const token = req.nextUrl.searchParams.get("token");
  if (token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "ללא הרשאה" }, { status: 401 });
  }

  await initDb();

  // Check if quotes already exist
  const checkRes = await db.execute("SELECT COUNT(*) as c FROM quotes");
  const count = (checkRes.rows[0]?.c as number) || 0;

  if (count > 0) {
    return NextResponse.json({ message: "ציטוטים כבר קיימים", count });
  }

  // Add quotes
  for (const quote of QUOTES) {
    await db.execute({
      sql: "INSERT INTO quotes (id, text, author, active) VALUES (?, ?, ?, 1)",
      args: [uuid(), quote.text, quote.author],
    });
  }

  return NextResponse.json({ message: "הוסיפו ציטוטים בהצלחה", added: QUOTES.length });
}
