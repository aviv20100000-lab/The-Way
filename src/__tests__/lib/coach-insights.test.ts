import { buildCoachInsights, type InsightClientInput } from "@/lib/coach-insights";

const baseClient: InsightClientInput = {
  id: "client-1",
  name: "נועה",
  avatar_url: null,
  created_at: "2026-06-01 08:00:00",
  daily_calories: 2000,
  daily_protein_g: 120,
  daily_steps: 10000,
  target_weight_kg: 65,
  weigh_in_frequency_weeks: null,
};

const now = new Date("2026-07-10T12:00:00Z");

describe("buildCoachInsights", () => {
  it("marks an established client with no activity as at risk", () => {
    const result = buildCoachInsights({ clients: [baseClient], meals: [], weights: [], steps: [], now });
    expect(result.clients[0].status).toBe("at_risk");
    expect(result.clients[0].reasons).toContain("עדיין לא נרשמה פעילות");
  });

  it("uses completed days and keeps consistent clients on track", () => {
    const meals = [5, 6, 7, 8, 9].map((day) => ({
      user_id: "client-1", total_calories: 1980, protein_g: 118, logged_at: `2026-07-${String(day).padStart(2, "0")} 12:00:00`,
    }));
    const steps = [6, 7, 8, 9].map((day) => ({ user_id: "client-1", steps: 9000, logged_at: `2026-07-${String(day).padStart(2, "0")} 18:00:00` }));
    const result = buildCoachInsights({ clients: [baseClient], meals, weights: [], steps, now });
    expect(result.clients[0]).toMatchObject({ status: "on_track", reported_days_7: 5, calorie_adherence: 100 });
  });

  it("does not treat low reported calories as a risk signal", () => {
    const meals = [5, 6, 7, 8, 9].map((day) => ({
      user_id: "client-1", total_calories: 1200, protein_g: 80, logged_at: `2026-07-${String(day).padStart(2, "0")} 12:00:00`,
    }));
    const result = buildCoachInsights({ clients: [{ ...baseClient, daily_steps: null }], meals, weights: [], steps: [], now });
    expect(result.clients[0].status).toBe("needs_attention");
    expect(result.clients[0].reasons).toContain("ממוצע הקלוריות נמוך משמעותית מהיעד");
    expect(result.clients[0].reasons).not.toContain("ממוצע הקלוריות גבוה מהיעד");
  });

  it("counts menu marks as a nutrition report, not as silence", () => {
    const menuSelections = [5, 6, 7, 8, 9].map((day) => ({
      user_id: "client-1",
      day_key: `2026-07-${String(day).padStart(2, "0")}`,
      status: "planned" as const,
      calories: 1980,
      protein_g: 118,
    }));
    const result = buildCoachInsights({ clients: [baseClient], meals: [], weights: [], steps: [], menuSelections, now });
    expect(result.clients[0]).toMatchObject({
      status: "on_track",
      reported_days_7: 5,
      menu_marked_days_7: 5,
      average_calories_7: 1980,
    });
    expect(result.clients[0].reasons).not.toContain("עדיין לא נרשמה פעילות");
    expect(result.clients[0].daily.find((d) => d.day === "2026-07-05")?.source).toBe("menu");
  });

  it("keeps off-plan days out of the calorie average but still counts them as reported", () => {
    const menuSelections = [5, 6, 7, 8, 9].map((day) => ({
      user_id: "client-1",
      day_key: `2026-07-${String(day).padStart(2, "0")}`,
      status: day === 9 ? ("other" as const) : ("planned" as const),
      calories: day === 9 ? 0 : 1980,
      protein_g: day === 9 ? 0 : 118,
    }));
    const result = buildCoachInsights({ clients: [baseClient], meals: [], weights: [], steps: [], menuSelections, now });
    // The off-plan day would have dragged the average to ~1584 if it counted.
    expect(result.clients[0].reported_days_7).toBe(5);
    expect(result.clients[0].average_calories_7).toBe(1980);
    expect(result.clients[0].menu_off_plan_meals_7).toBe(1);
    expect(result.clients[0].reasons).not.toContain("ממוצע הקלוריות נמוך משמעותית מהיעד");
  });

  it("prefers a real food log over the menu mark for the same day", () => {
    const result = buildCoachInsights({
      clients: [baseClient],
      meals: [{ user_id: "client-1", total_calories: 2500, protein_g: 130, logged_at: "2026-07-08 12:00:00" }],
      weights: [],
      steps: [],
      menuSelections: [{ user_id: "client-1", day_key: "2026-07-08", status: "planned", calories: 1980, protein_g: 118 }],
      now,
    });
    const day = result.clients[0].daily.find((entry) => entry.day === "2026-07-08");
    expect(day).toMatchObject({ source: "log", calories: 2500 });
  });

  it("gives new clients a neutral insufficient-data status", () => {
    const client = { ...baseClient, created_at: "2026-07-08 08:00:00" };
    const result = buildCoachInsights({ clients: [client], meals: [], weights: [], steps: [], now });
    expect(result.clients[0].status).toBe("insufficient_data");
  });

  it("uses the highest steps upload per day instead of double counting", () => {
    const meals = [3, 4, 5, 6, 7].map((day) => ({ user_id: "client-1", total_calories: 2000, protein_g: 100, logged_at: `2026-07-0${day} 12:00:00` }));
    const steps = [
      { user_id: "client-1", steps: 4000, logged_at: "2026-07-03 10:00:00" },
      { user_id: "client-1", steps: 6500, logged_at: "2026-07-03 18:00:00" },
    ];
    const result = buildCoachInsights({ clients: [baseClient], meals, weights: [], steps, now });
    expect(result.clients[0].daily.find((item) => item.day === "2026-07-03")?.steps).toBe(6500);
  });
});
