import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const TABLES = [
  "users",
  "foods",
  "meals",
  "meal_items",
  "weight_logs",
  "goals",
  "steps_logs",
  "water_logs",
  "quotes",
  "push_subscriptions",
  "ai_meal_logs",
  "water_streak",
  "chat_messages",
  "chat_groups",
  "chat_group_members",
  "chat_message_reactions",
  "audit_log",
] as const;

function timingSafeCompare(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  // Unlike health-check, this endpoint dumps the entire database — it must
  // never be reachable without a configured secret.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  const qs = req.nextUrl.searchParams.get("secret");
  const authValid = auth ? timingSafeCompare(auth, `Bearer ${secret}`) : false;
  const qsValid = qs ? timingSafeCompare(qs, secret) : false;
  if (!authValid && !qsValid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await initDb();
  const results = await Promise.all(TABLES.map((table) => db.execute(`SELECT * FROM ${table}`)));
  const tables = Object.fromEntries(TABLES.map((table, index) => [table, results[index].rows]));

  return NextResponse.json(
    { created_at: new Date().toISOString(), tables },
    { headers: { "Cache-Control": "no-store" } }
  );
}
