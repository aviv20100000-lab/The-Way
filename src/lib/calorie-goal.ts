import db from "@/lib/db";

export type CalorieGoalSource = "menu" | "general" | null;

export interface EffectiveCalorieGoal {
  goal: number | null;
  source: CalorieGoalSource;
}

/**
 * A published menu's daily calorie target overrides the trainee's profile goal
 * (this is what /api/home already does for the trainee's own screen). Coach-facing
 * screens used to read the profile goal directly, so a coach saw a stale number
 * the moment a menu with a different target went live — this is the single place
 * both sides now compute from.
 */
export async function getEffectiveCalorieGoals(
  clientIds: string[],
  profileGoals: Map<string, number | null>
): Promise<Map<string, EffectiveCalorieGoal>> {
  const result = new Map<string, EffectiveCalorieGoal>();
  if (clientIds.length === 0) return result;

  const placeholders = clientIds.map(() => "?").join(",");
  const menuRes = await db.execute({
    sql: `SELECT client_id, daily_calories_target, updated_at, created_at
          FROM menu_plans
          WHERE client_id IN (${placeholders})
            AND status = 'published'
            AND daily_calories_target IS NOT NULL`,
    args: clientIds,
  });

  const menuGoalByClient = new Map<string, number>();
  for (const row of menuRes.rows as unknown as { client_id: string; daily_calories_target: number }[]) {
    // Multiple published menus per client shouldn't normally happen, but if they
    // do, keep only the first one seen — the query has no ORDER BY guarantee to
    // rely on here, so this just needs to be deterministic, not "most recent".
    if (!menuGoalByClient.has(row.client_id)) menuGoalByClient.set(row.client_id, Number(row.daily_calories_target));
  }

  for (const clientId of clientIds) {
    const menuGoal = menuGoalByClient.get(clientId) ?? null;
    const generalGoal = profileGoals.get(clientId) ?? null;
    result.set(clientId, {
      goal: menuGoal ?? generalGoal,
      source: menuGoal !== null ? "menu" : generalGoal !== null ? "general" : null,
    });
  }

  return result;
}
