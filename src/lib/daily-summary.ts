import db, { initDb } from "@/lib/db";

export interface DailySummaryItem {
  client_id: string;
  client_name: string;
  reported: boolean;
  calories: number;
  calorie_goal: number | null;
  water_ml: number;
  water_goal: number;
  steps: number;
  steps_goal: number | null;
  weight_kg: number | null;
  flags: string[];
}

type SummaryMap = Map<string, DailySummaryItem>;

const JERUSALEM_TZ = "Asia/Jerusalem";
const NO_REPORT_FLAG = "לא דיווח";
const CALORIE_OVER_FLAG = "חריגה מיעד קלוריות";
const WATER_GOAL_FLAG = "יעד מים הושג";
const STEPS_GOAL_FLAG = "יעד צעדים הושג";

export function formatDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JERUSALEM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const valueOf = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    valueOf("year"),
    valueOf("month") - 1,
    valueOf("day"),
    valueOf("hour"),
    valueOf("minute"),
    valueOf("second")
  );

  return (asUtc - date.getTime()) / 60000;
}

function utcFromJerusalemParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMinutes = getOffsetMinutes(guess, JERUSALEM_TZ);
  return new Date(guess.getTime() - offsetMinutes * 60000);
}

export function getDayRangeUtc(dayKey: string) {
  const [yearText, monthText, dayText] = dayKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const start = utcFromJerusalemParts(year, month, day, 0, 0, 0);
  const nextDay = utcFromJerusalemParts(year, month, day + 1, 0, 0, 0);

  return {
    startUtc: start.toISOString().slice(0, 19).replace("T", " "),
    endUtc: nextDay.toISOString().slice(0, 19).replace("T", " "),
  };
}

export function getYesterdayDayKey(now = new Date()): string {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return formatDayKey(yesterday);
}

export function getTodayDayKey(now = new Date()): string {
  return formatDayKey(now);
}

function createBaseSummary(row: { client_id: string; client_name: string; daily_calories: number | null; daily_water_ml: number | null; daily_steps: number | null; }): DailySummaryItem {
  return {
    client_id: row.client_id,
    client_name: row.client_name,
    reported: false,
    calories: 0,
    calorie_goal: row.daily_calories,
    water_ml: 0,
    water_goal: row.daily_water_ml ?? 2000,
    steps: 0,
    steps_goal: row.daily_steps,
    weight_kg: null,
    flags: [],
  };
}

function markReported(item: DailySummaryItem, hasData: boolean) {
  if (hasData) {
    item.reported = true;
  }
}

function applyFlags(item: DailySummaryItem) {
  const flags: string[] = [];

  if (!item.reported) {
    flags.push(NO_REPORT_FLAG);
  }

  if (item.calorie_goal !== null && item.calories > item.calorie_goal * 1.1) {
    flags.push(CALORIE_OVER_FLAG);
  }

  if (item.water_ml >= item.water_goal) {
    flags.push(WATER_GOAL_FLAG);
  }

  if (item.steps_goal !== null && item.steps >= item.steps_goal) {
    flags.push(STEPS_GOAL_FLAG);
  }

  item.flags = flags;
}

export async function getDailySummary(coachId: string, dayKey: string): Promise<DailySummaryItem[]> {
  await initDb();

  const { startUtc, endUtc } = getDayRangeUtc(dayKey);

  const [clientsRes, aiMealsRes, quickMealsRes, waterRes, stepsRes, weightRes] = await Promise.all([
    db.execute({
      sql: `SELECT u.id AS client_id,
                   u.name AS client_name,
                   g.daily_calories,
                   g.daily_water_ml,
                   g.daily_steps
            FROM users u
            LEFT JOIN goals g ON g.user_id = u.id
            WHERE u.role = 'client' AND u.coach_id = ?
            ORDER BY u.name COLLATE NOCASE ASC`,
      args: [coachId],
    }),
    db.execute({
      sql: `SELECT user_id, COALESCE(SUM(total_calories), 0) AS calories
            FROM ai_meal_logs
            WHERE logged_at >= ? AND logged_at < ?
              AND user_id IN (
                SELECT id FROM users WHERE role = 'client' AND coach_id = ?
              )
            GROUP BY user_id`,
      args: [startUtc, endUtc, coachId],
    }),
    db.execute({
      sql: `SELECT m.user_id,
                   COALESCE(ROUND(SUM(mi.quantity * f.calories / 100.0)), 0) AS calories
            FROM meals m
            JOIN meal_items mi ON mi.meal_id = m.id
            JOIN foods f ON f.id = mi.food_id
            WHERE m.logged_at >= ? AND m.logged_at < ?
              AND m.user_id IN (
                SELECT id FROM users WHERE role = 'client' AND coach_id = ?
              )
            GROUP BY m.user_id`,
      args: [startUtc, endUtc, coachId],
    }),
    db.execute({
      sql: `SELECT user_id, COALESCE(SUM(amount_ml), 0) AS water_ml
            FROM water_logs
            WHERE logged_at >= ? AND logged_at < ?
              AND user_id IN (
                SELECT id FROM users WHERE role = 'client' AND coach_id = ?
              )
            GROUP BY user_id`,
      args: [startUtc, endUtc, coachId],
    }),
    db.execute({
      sql: `SELECT user_id, COALESCE(SUM(steps), 0) AS steps
            FROM steps_logs
            WHERE logged_at >= ? AND logged_at < ?
              AND user_id IN (
                SELECT id FROM users WHERE role = 'client' AND coach_id = ?
              )
            GROUP BY user_id`,
      args: [startUtc, endUtc, coachId],
    }),
    db.execute({
      sql: `SELECT wl.user_id, wl.weight_kg
            FROM weight_logs wl
            JOIN (
              SELECT user_id, MAX(logged_at) AS latest_logged_at
              FROM weight_logs
              WHERE logged_at >= ? AND logged_at < ?
                AND user_id IN (
                  SELECT id FROM users WHERE role = 'client' AND coach_id = ?
                )
              GROUP BY user_id
            ) latest
              ON latest.user_id = wl.user_id
             AND latest.latest_logged_at = wl.logged_at`,
      args: [startUtc, endUtc, coachId],
    }),
  ]);

  const summary: SummaryMap = new Map(
    clientsRes.rows.map((row) => [
      String(row.client_id),
      createBaseSummary({
        client_id: String(row.client_id),
        client_name: String(row.client_name),
        daily_calories: row.daily_calories === null ? null : Number(row.daily_calories),
        daily_water_ml: row.daily_water_ml === null ? null : Number(row.daily_water_ml),
        daily_steps: row.daily_steps === null ? null : Number(row.daily_steps),
      }),
    ])
  );

  for (const row of aiMealsRes.rows) {
    const item = summary.get(String(row.user_id));
    if (!item) continue;
    item.calories += Number(row.calories) || 0;
    markReported(item, true);
  }

  for (const row of quickMealsRes.rows) {
    const item = summary.get(String(row.user_id));
    if (!item) continue;
    item.calories += Number(row.calories) || 0;
    markReported(item, true);
  }

  for (const row of waterRes.rows) {
    const item = summary.get(String(row.user_id));
    if (!item) continue;
    item.water_ml = Number(row.water_ml) || 0;
    markReported(item, true);
  }

  for (const row of stepsRes.rows) {
    const item = summary.get(String(row.user_id));
    if (!item) continue;
    item.steps = Number(row.steps) || 0;
    markReported(item, true);
  }

  for (const row of weightRes.rows) {
    const item = summary.get(String(row.user_id));
    if (!item) continue;
    item.weight_kg = row.weight_kg === null ? null : Number(row.weight_kg);
    markReported(item, item.weight_kg !== null);
  }

  const items = Array.from(summary.values()).map((item) => {
    item.calories = Math.round(item.calories);
    applyFlags(item);
    return item;
  });

  items.sort((a, b) => {
    const aNoReport = a.flags.includes(NO_REPORT_FLAG) ? 0 : 1;
    const bNoReport = b.flags.includes(NO_REPORT_FLAG) ? 0 : 1;
    if (aNoReport !== bNoReport) return aNoReport - bNoReport;
    return a.client_name.localeCompare(b.client_name, "he");
  });

  return items;
}
