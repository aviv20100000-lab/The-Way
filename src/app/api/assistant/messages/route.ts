import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { checkPersistentRateLimit, formatResetIn } from "@/lib/ratelimit";
import { getDayRangeUtc, getTodayDayKey } from "@/lib/daily-summary";
import { weekdayOfDayKey } from "@/lib/menu-week";
import type { AssistantMenuMeal, AssistantMenuOption } from "@/lib/assistant-context";
import { buildPreferenceSummary, parseMemoryList, parsePreferenceProfile } from "@/lib/assistant-learning";
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
  if (session.role !== "client") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

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

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

type MenuRow = {
  meal_id: string;
  meal_label: string;
  option_id: string;
  option_label: string;
  name_he: string | null;
  grams: number | null;
  calories: number | null;
  selection_status: string | null;
};

// The join returns one row per menu item, so fold it back into meals -> options -> items.
function groupTodayMenu(rows: MenuRow[]): AssistantMenuMeal[] {
  const meals = new Map<string, AssistantMenuMeal & { optionIndex: Map<string, AssistantMenuOption> }>();
  for (const row of rows) {
    let meal = meals.get(row.meal_id);
    if (!meal) {
      const status = row.selection_status === "planned" || row.selection_status === "other" ? row.selection_status : null;
      meal = { label: String(row.meal_label), status, options: [], optionIndex: new Map() };
      meals.set(row.meal_id, meal);
    }
    let option = meal.optionIndex.get(row.option_id);
    if (!option) {
      option = { label: String(row.option_label), calories: 0, items: [] };
      meal.optionIndex.set(row.option_id, option);
      meal.options.push(option);
    }
    if (row.name_he) {
      option.items.push(`${row.name_he} ${Math.round(Number(row.grams) || 0)} ג׳`);
      option.calories += Math.round(Number(row.calories) || 0);
    }
  }
  return [...meals.values()].map(({ label, status, options }) => ({ label, status, options }));
}

async function loadUserContext(userId: string, name: string): Promise<AssistantUserContext> {
  // Jerusalem day, like every other endpoint — a UTC date would make the bot
  // quote yesterday's calorie total to anyone chatting before 03:00.
  const todayKey = getTodayDayKey();
  const { startUtc, endUtc } = getDayRangeUtc(todayKey);
  const [goalsRes, caloriesRes, weightRes, preferencesRes, menuRes] = await Promise.all([
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
                WHERE m.user_id = ? AND m.logged_at >= ? AND m.logged_at < ?
              ), 0)
              +
              COALESCE((
                SELECT ROUND(SUM(total_calories))
                FROM ai_meal_logs
                WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
              ), 0) AS total_calories`,
      args: [userId, startUtc, endUtc, userId, startUtc, endUtc],
    }),
    db.execute({
      sql: "SELECT weight_kg FROM weight_logs WHERE user_id = ? ORDER BY logged_at DESC LIMIT 1",
      args: [userId],
    }),
    db.execute({
      sql: "SELECT liked_notes, disliked_notes, saved_notes, profile_json, feedback_count FROM assistant_preferences WHERE user_id = ?",
      args: [userId],
    }),
    // Today's slice of the coach's published menu, plus what the client already
    // marked today. Without this the bot invents food instead of steering him to
    // the plan the coach actually wrote.
    db.execute({
      sql: `SELECT mm.id AS meal_id, mm.label AS meal_label, mm.sort_order AS meal_order,
                   mo.id AS option_id, mo.label AS option_label, mo.sort_order AS option_order,
                   mi.name_he, mi.grams, mi.calories,
                   s.status AS selection_status
            FROM menu_plans mp
            JOIN menu_days md ON md.menu_plan_id = mp.id
            JOIN menu_meals mm ON mm.menu_day_id = md.id
            JOIN menu_meal_options mo ON mo.menu_meal_id = mm.id
            LEFT JOIN menu_items mi ON mi.menu_meal_option_id = mo.id
            LEFT JOIN menu_meal_selections s ON s.menu_meal_id = mm.id AND s.day_key = ?
            WHERE md.day_index = ?
              AND mp.id = (
                SELECT id FROM menu_plans
                WHERE client_id = ? AND status = 'published'
                ORDER BY updated_at DESC, created_at DESC LIMIT 1
              )
            ORDER BY mm.sort_order, mo.sort_order, mi.rowid`,
      args: [todayKey, weekdayOfDayKey(todayKey), userId],
    }),
  ]);

  const goals = goalsRes.rows[0] as
    | { daily_calories?: number | null; daily_protein_g?: number | null; target_weight_kg?: number | null }
    | undefined;
  const menu = groupTodayMenu(menuRes.rows as unknown as MenuRow[]);
  const preferenceRow = preferencesRes.rows[0] as
    | { liked_notes?: string | null; disliked_notes?: string | null; saved_notes?: string | null; profile_json?: string | null; feedback_count?: number | null }
    | undefined;

  return {
    name,
    dailyCalories: goals?.daily_calories ? Number(goals.daily_calories) : null,
    dailyProteinG: goals?.daily_protein_g ? Number(goals.daily_protein_g) : null,
    todayCalories: Math.round(Number(caloriesRes.rows[0]?.total_calories) || 0),
    latestWeightKg: weightRes.rows[0]?.weight_kg ? Number(weightRes.rows[0].weight_kg) : null,
    targetWeightKg: goals?.target_weight_kg ? Number(goals.target_weight_kg) : null,
    todayMenu: menu.length ? menu : null,
    todayMenuDayName: menu.length ? DAY_NAMES[weekdayOfDayKey(todayKey)] : null,
    preferenceSummary: preferenceRow
      ? buildPreferenceSummary({
          likedNotes: parseMemoryList(preferenceRow.liked_notes),
          dislikedNotes: parseMemoryList(preferenceRow.disliked_notes),
          savedNotes: parseMemoryList(preferenceRow.saved_notes),
          feedbackCount: Number(preferenceRow.feedback_count) || 0,
          profile: parsePreferenceProfile(preferenceRow.profile_json),
        })
      : null,
  };
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (session.role !== "client") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

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
