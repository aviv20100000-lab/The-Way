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
