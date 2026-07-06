import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { checkPersistentRateLimit, formatResetIn } from "@/lib/ratelimit";
import {
  generateAssistantReply,
  ASSISTANT_MAX_INPUT_CHARS,
  ASSISTANT_HISTORY_LIMIT,
  type AssistantHistoryMessage,
  type AssistantUserContext,
} from "@/lib/assistant";

export interface AssistantMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

function toMessageRow(row: Record<string, unknown>): AssistantMessageRow {
  return {
    id: String(row.id),
    role: row.role === "assistant" ? "assistant" : "user",
    content: String(row.content ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const result = await db.execute({
    sql: `SELECT id, role, content, created_at FROM (
            SELECT id, role, content, created_at
            FROM assistant_messages
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT 60
          ) ORDER BY created_at ASC, id ASC`,
    args: [session.id],
  });

  return NextResponse.json({
    messages: result.rows.map((row) => toMessageRow(row as Record<string, unknown>)),
  });
}

async function loadUserContext(userId: string, name: string): Promise<AssistantUserContext> {
  const today = new Date().toISOString().split("T")[0];
  const [goalsRes, caloriesRes, weightRes] = await Promise.all([
    db.execute({
      sql: "SELECT daily_calories, daily_protein_g, target_weight_kg FROM goals WHERE user_id = ?",
      args: [userId],
    }),
    db.execute({
      sql: `SELECT
              COALESCE((
                SELECT ROUND(SUM(mi.quantity * f.calories / 100.0))
                FROM meals m
                JOIN meal_items mi ON mi.meal_id = m.id
                JOIN foods f ON f.id = mi.food_id
                WHERE m.user_id = ? AND DATE(m.logged_at) = ?
              ), 0)
              +
              COALESCE((
                SELECT ROUND(SUM(total_calories))
                FROM ai_meal_logs
                WHERE user_id = ? AND DATE(logged_at) = ?
              ), 0) AS total_calories`,
      args: [userId, today, userId, today],
    }),
    db.execute({
      sql: "SELECT weight_kg FROM weight_logs WHERE user_id = ? ORDER BY logged_at DESC LIMIT 1",
      args: [userId],
    }),
  ]);

  const goals = goalsRes.rows[0] as
    | { daily_calories?: number | null; daily_protein_g?: number | null; target_weight_kg?: number | null }
    | undefined;

  return {
    name,
    dailyCalories: goals?.daily_calories ? Number(goals.daily_calories) : null,
    dailyProteinG: goals?.daily_protein_g ? Number(goals.daily_protein_g) : null,
    todayCalories: Math.round(Number(caloriesRes.rows[0]?.total_calories) || 0),
    latestWeightKg: weightRes.rows[0]?.weight_kg ? Number(weightRes.rows[0].weight_kg) : null,
    targetWeightKg: goals?.target_weight_kg ? Number(goals.target_weight_kg) : null,
  };
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  let body: { content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "הודעה ריקה" }, { status: 400 });
  if (content.length > ASSISTANT_MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: `ההודעה ארוכה מדי (עד ${ASSISTANT_MAX_INPUT_CHARS} תווים)` },
      { status: 400 }
    );
  }

  await initDb();

  const rateLimit = await checkPersistentRateLimit(`assistant:${session.id}`, "assistant");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `הגעת למגבלת 30 הודעות ליום עם העוזר — נסה שוב בעוד ${formatResetIn(rateLimit.resetIn)} 🙏` },
      { status: 429 }
    );
  }

  const historyRes = await db.execute({
    sql: `SELECT role, content FROM (
            SELECT role, content, created_at, id
            FROM assistant_messages
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
          ) ORDER BY created_at ASC, id ASC`,
    args: [session.id, ASSISTANT_HISTORY_LIMIT],
  });
  const history: AssistantHistoryMessage[] = historyRes.rows.map((row) => ({
    role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: String(row.content ?? ""),
  }));

  const context = await loadUserContext(session.id, session.name);

  let reply: string;
  try {
    reply = await generateAssistantReply(context, history, content);
  } catch (error) {
    console.error("assistant reply failed", error);
    return NextResponse.json(
      { error: "העוזר לא זמין כרגע — נסה שוב עוד רגע 🙏" },
      { status: 502 }
    );
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const userMessage: AssistantMessageRow = {
    id: randomUUID(),
    role: "user",
    content,
    created_at: now,
  };
  const assistantMessage: AssistantMessageRow = {
    id: randomUUID(),
    role: "assistant",
    content: reply,
    created_at: now,
  };

  await db.batch([
    {
      sql: "INSERT INTO assistant_messages (id, user_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)",
      args: [userMessage.id, session.id, userMessage.content, userMessage.created_at],
    },
    {
      sql: "INSERT INTO assistant_messages (id, user_id, role, content, created_at) VALUES (?, ?, 'assistant', ?, ?)",
      args: [assistantMessage.id, session.id, assistantMessage.content, assistantMessage.created_at],
    },
  ]);

  return NextResponse.json({ messages: [userMessage, assistantMessage] });
}
