export type InsightStatus = "at_risk" | "needs_attention" | "on_track" | "insufficient_data";

export interface InsightClientInput {
  id: string;
  name: string;
  avatar_url: string | null;
  daily_calories: number | null;
  daily_protein_g: number | null;
  daily_steps: number | null;
  target_weight_kg: number | null;
  weigh_in_frequency_weeks: number | null;
  created_at: string;
}

export interface InsightMealInput {
  user_id: string;
  total_calories: number;
  protein_g: number;
  logged_at: string;
}

export interface InsightWeightInput {
  user_id: string;
  weight_kg: number;
  logged_at: string;
}

export interface InsightStepsInput {
  user_id: string;
  steps: number;
  logged_at: string;
}

// A client who eats exactly the coach's menu and marks it has reported their
// nutrition just as much as one who photographs every plate. Without this the
// most compliant clients showed up as "0 days reported" / at_risk.
export interface InsightMenuSelectionInput {
  user_id: string;
  day_key: string;
  status: "planned" | "other";
  calories: number;
  protein_g: number;
}

export interface CoachInsightClient {
  id: string;
  name: string;
  avatar_url: string | null;
  status: InsightStatus;
  reasons: string[];
  reported_days_7: number;
  average_calories_7: number;
  calorie_goal: number | null;
  calorie_adherence: number | null;
  average_protein_7: number;
  protein_goal: number | null;
  average_steps_7: number;
  steps_goal: number | null;
  menu_marked_days_7: number;
  menu_off_plan_meals_7: number;
  latest_weight: number | null;
  target_weight: number | null;
  weight_change_30: number | null;
  days_since_activity: number | null;
  daily: { day: string; calories: number; protein: number; steps: number; reported: boolean; source: "log" | "menu" | "none" }[];
  weights: { day: string; value: number }[];
}

const JERUSALEM_TZ = "Asia/Jerusalem";

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JERUSALEM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function asDate(value: string) {
  if (value.includes("T")) return new Date(value);
  return new Date(`${value.replace(" ", "T")}Z`);
}

function recentDayKeys(days: number, now: Date) {
  const today = dayKey(now);
  const cursor = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(cursor);
    date.setUTCDate(cursor.getUTCDate() - (days - 1 - index));
    return dayKey(date);
  });
}

function roundedAverage(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function daysSince(value: Date | null, now: Date) {
  if (!value) return null;
  return Math.max(0, Math.floor((now.getTime() - value.getTime()) / 86_400_000));
}

export function buildCoachInsights({
  clients,
  meals,
  weights,
  steps,
  menuSelections = [],
  now = new Date(),
}: {
  clients: InsightClientInput[];
  meals: InsightMealInput[];
  weights: InsightWeightInput[];
  steps: InsightStepsInput[];
  menuSelections?: InsightMenuSelectionInput[];
  now?: Date;
}) {
  const days30 = recentDayKeys(30, now);
  // Status is based on seven completed days; today's partial data is shown in charts only.
  const days7 = days30.slice(-8, -1);
  const day30Set = new Set(days30);

  const mealsByClient = new Map<string, InsightMealInput[]>();
  const weightsByClient = new Map<string, InsightWeightInput[]>();
  const stepsByClient = new Map<string, InsightStepsInput[]>();
  const menuByClient = new Map<string, InsightMenuSelectionInput[]>();
  for (const selection of menuSelections) {
    const group = menuByClient.get(selection.user_id) ?? [];
    group.push(selection);
    menuByClient.set(selection.user_id, group);
  }
  for (const meal of meals) { const group = mealsByClient.get(meal.user_id) ?? []; group.push(meal); mealsByClient.set(meal.user_id, group); }
  for (const weight of weights) { const group = weightsByClient.get(weight.user_id) ?? []; group.push(weight); weightsByClient.set(weight.user_id, group); }
  for (const step of steps) { const group = stepsByClient.get(step.user_id) ?? []; group.push(step); stepsByClient.set(step.user_id, group); }

  const result: CoachInsightClient[] = clients.map((client) => {
    const mealByDay = new Map<string, { calories: number; protein: number }>();
    let latestActivity: Date | null = null;
    for (const meal of mealsByClient.get(client.id) ?? []) {
      const date = asDate(meal.logged_at);
      if (!latestActivity || date > latestActivity) latestActivity = date;
      const key = dayKey(date);
      if (!day30Set.has(key)) continue;
      const current = mealByDay.get(key) ?? { calories: 0, protein: 0 };
      current.calories += Number(meal.total_calories) || 0;
      current.protein += Number(meal.protein_g) || 0;
      mealByDay.set(key, current);
    }

    const stepsByDay = new Map<string, number>();
    for (const log of stepsByClient.get(client.id) ?? []) {
      const date = asDate(log.logged_at);
      if (!latestActivity || date > latestActivity) latestActivity = date;
      const key = dayKey(date);
      if (day30Set.has(key)) stepsByDay.set(key, Math.max(stepsByDay.get(key) ?? 0, Number(log.steps) || 0));
    }

    // Menu marks are a second, equally valid nutrition report. Days that contain an
    // "ate something else" mark are counted as reported but kept out of the calorie
    // average — their real calories are unknown and would fake a below-target warning.
    const menuByDay = new Map<string, { calories: number; protein: number }>();
    const menuUnknownDays = new Set<string>();
    const offPlanByDay = new Map<string, number>();
    for (const selection of menuByClient.get(client.id) ?? []) {
      if (!day30Set.has(selection.day_key)) continue;
      const date = new Date(`${selection.day_key}T12:00:00Z`);
      if (!latestActivity || date > latestActivity) latestActivity = date;
      const current = menuByDay.get(selection.day_key) ?? { calories: 0, protein: 0 };
      if (selection.status === "other") {
        menuUnknownDays.add(selection.day_key);
        offPlanByDay.set(selection.day_key, (offPlanByDay.get(selection.day_key) ?? 0) + 1);
      } else {
        current.calories += Number(selection.calories) || 0;
        current.protein += Number(selection.protein_g) || 0;
      }
      menuByDay.set(selection.day_key, current);
    }

    const clientWeights = (weightsByClient.get(client.id) ?? [])
      .map((log) => ({ day: dayKey(asDate(log.logged_at)), value: Number(log.weight_kg), date: asDate(log.logged_at) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const weight of clientWeights) {
      if (!latestActivity || weight.date > latestActivity) latestActivity = weight.date;
    }

    const daily = days30.map((day) => {
      const logged = mealByDay.get(day);
      const fromMenu = menuByDay.get(day);
      const source: "log" | "menu" | "none" = logged ? "log" : fromMenu ? "menu" : "none";
      const totals = logged ?? fromMenu ?? { calories: 0, protein: 0 };
      return {
        day,
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        steps: Math.round(stepsByDay.get(day) ?? 0),
        reported: source !== "none",
        source,
      };
    });
    const week = daily.filter((item) => days7.includes(item.day));
    const reportedWeek = week.filter((item) => item.reported);
    const reportedDays = reportedWeek.length;
    const menuMarkedDays = week.filter((item) => item.source === "menu").length;
    // Only days with a trustworthy calorie total feed the averages.
    const measurableWeek = reportedWeek.filter((item) => item.source === "log" || !menuUnknownDays.has(item.day));
    const averageCalories = roundedAverage(measurableWeek.map((item) => item.calories));
    const averageProtein = roundedAverage(measurableWeek.map((item) => item.protein));
    const reportedSteps = week.filter((item) => item.steps > 0);
    const averageSteps = roundedAverage(reportedSteps.map((item) => item.steps));
    const offPlanMealsWeek = days7.reduce((sum, day) => sum + (offPlanByDay.get(day) ?? 0), 0);
    const calorieAdherence = client.daily_calories && measurableWeek.length
      ? Math.round((measurableWeek.filter((item) => Math.abs(item.calories - client.daily_calories!) / client.daily_calories! <= 0.15).length / measurableWeek.length) * 100)
      : null;
    const calorieOverage = client.daily_calories && measurableWeek.length
      ? (averageCalories - client.daily_calories) / client.daily_calories
      : 0;

    const latestWeight = clientWeights.at(-1) ?? null;
    const weight30 = clientWeights.filter((item) => day30Set.has(item.day));
    const weightChange = weight30.length >= 2
      ? Math.round((weight30.at(-1)!.value - weight30[0].value) * 10) / 10
      : null;
    const daysSinceAnyActivity = daysSince(latestActivity, now);
    const daysSinceWeight = daysSince(latestWeight?.date ?? null, now);

    const critical: string[] = [];
    const warnings: string[] = [];
    const accountAgeDays = daysSince(asDate(client.created_at), now) ?? 0;
    const inGracePeriod = accountAgeDays < 7;
    const hasCoreGoal = Boolean(client.daily_calories || client.daily_protein_g || client.daily_steps || client.target_weight_kg);

    if (daysSinceAnyActivity === null && !inGracePeriod && hasCoreGoal) critical.push("עדיין לא נרשמה פעילות");
    else if (daysSinceAnyActivity !== null && daysSinceAnyActivity >= 5) critical.push(`אין פעילות ${daysSinceAnyActivity} ימים`);
    else if (daysSinceAnyActivity !== null && daysSinceAnyActivity >= 3) warnings.push(`אין פעילות ${daysSinceAnyActivity} ימים`);
    if (client.daily_calories && reportedDays <= 1) critical.push(`רק ${reportedDays} ימי תזונה בשבוע שהסתיים`);
    else if (client.daily_calories && reportedDays <= 3) warnings.push(`${reportedDays} מתוך 7 ימי תזונה`);
    if (calorieOverage > 0.3 && measurableWeek.length >= 3) critical.push("ממוצע הקלוריות גבוה ביותר מ־30% מהיעד");
    else if (calorieOverage > 0.15 && measurableWeek.length >= 3) warnings.push("ממוצע הקלוריות גבוה מהיעד");
    if (client.daily_calories && measurableWeek.length >= 5 && averageCalories < client.daily_calories * 0.7) warnings.push("ממוצע הקלוריות נמוך משמעותית מהיעד");
    if (offPlanMealsWeek >= 5) warnings.push(`${offPlanMealsWeek} ארוחות מחוץ לתפריט השבוע`);
    const weighCadenceDays = client.weigh_in_frequency_weeks ? client.weigh_in_frequency_weeks * 7 + 2 : null;
    if (weighCadenceDays && (daysSinceWeight === null || daysSinceWeight > weighCadenceDays)) warnings.push(daysSinceWeight === null ? "עדיין לא נרשמה שקילה" : `השקילה באיחור של ${daysSinceWeight - weighCadenceDays} ימים`);
    if (client.daily_steps && reportedSteps.length >= 4 && averageSteps < client.daily_steps * 0.7) warnings.push("ממוצע הצעדים נמוך מהיעד");

    let status: InsightStatus;
    if (inGracePeriod || !hasCoreGoal) status = "insufficient_data";
    else if (critical.length > 0) status = "at_risk";
    else if (warnings.length > 0) status = "needs_attention";
    else if (reportedDays >= 4 || reportedSteps.length >= 4) status = "on_track";
    else status = "insufficient_data";
    const reasons = [...critical, ...warnings].slice(0, 3);
    if (status === "insufficient_data") reasons.splice(0, reasons.length, inGracePeriod ? "מתאמן חדש — עדיין בתקופת הסתגלות" : !hasCoreGoal ? "צריך להגדיר יעדים כדי לחשב תובנות" : "אין עדיין מספיק נתונים להשוואה");
    else if (reasons.length === 0) reasons.push("דיווח עקבי וללא חריגות בולטות");

    return {
      id: client.id,
      name: client.name,
      avatar_url: client.avatar_url,
      status,
      reasons,
      reported_days_7: reportedDays,
      average_calories_7: averageCalories,
      calorie_goal: client.daily_calories,
      calorie_adherence: calorieAdherence,
      average_protein_7: averageProtein,
      protein_goal: client.daily_protein_g,
      average_steps_7: averageSteps,
      steps_goal: client.daily_steps,
      menu_marked_days_7: menuMarkedDays,
      menu_off_plan_meals_7: offPlanMealsWeek,
      latest_weight: latestWeight?.value ?? null,
      target_weight: client.target_weight_kg,
      weight_change_30: weightChange,
      days_since_activity: daysSinceAnyActivity,
      daily,
      weights: clientWeights.map(({ day, value }) => ({ day, value })),
    };
  });

  const order: Record<InsightStatus, number> = { at_risk: 0, needs_attention: 1, on_track: 2, insufficient_data: 3 };
  result.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name, "he"));

  return {
    generated_at: now.toISOString(),
    summary: {
      at_risk: result.filter((client) => client.status === "at_risk").length,
      needs_attention: result.filter((client) => client.status === "needs_attention").length,
      on_track: result.filter((client) => client.status === "on_track").length,
      insufficient_data: result.filter((client) => client.status === "insufficient_data").length,
    },
    clients: result,
  };
}
