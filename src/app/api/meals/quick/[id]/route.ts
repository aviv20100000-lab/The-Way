import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "׳׳ ׳׳—׳•׳‘׳¨" }, { status: 401 });

  const { id } = await context.params;

  await initDb();
  await db.execute({
    sql: "DELETE FROM meals WHERE id = ? AND user_id = ?",
    args: [id, user.id],
  });
  return NextResponse.json({ ok: true });
}
