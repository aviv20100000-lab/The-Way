"use client";

import { useMemo, useState } from "react";
import MealHistory, { type Meal } from "@/components/MealHistory";

export interface CoachMealLog extends Meal {
  client_id: string;
  client_name: string;
  client_avatar_url: string | null;
  photo_url: string | null;
  source: "ai" | "quick";
}

interface MealClient {
  id: string;
  name: string;
  avatar_url: string | null;
}

function dayKey(value: string) {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

export default function CoachMealsPanel({
  clients,
  meals,
  loading,
  error,
  onRetry,
}: {
  clients: MealClient[];
  meals: CoachMealLog[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  const [selectedClientId, setSelectedClientId] = useState("all");
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const byClient = new Map<string, CoachMealLog[]>();
    for (const meal of meals) {
      const current = byClient.get(meal.client_id) ?? [];
      current.push(meal);
      byClient.set(meal.client_id, current);
    }
    return byClient;
  }, [meals]);

  const visibleClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("he");
    return clients
      .filter((client) => !normalized || client.name.toLocaleLowerCase("he").includes(normalized))
      .sort((a, b) => {
        const latestA = grouped.get(a.id)?.[0]?.logged_at ?? "";
        const latestB = grouped.get(b.id)?.[0]?.logged_at ?? "";
        return latestB.localeCompare(latestA) || a.name.localeCompare(b.name, "he");
      });
  }, [clients, grouped, query]);

  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const selectedMeals = selectedClientId === "all" ? meals : grouped.get(selectedClientId) ?? [];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const todayMeals = selectedMeals.filter((meal) => dayKey(meal.logged_at) === today);
  const todayCalories = todayMeals.reduce((sum, meal) => sum + (Number(meal.total_calories) || 0), 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">ארוחות לפי מתאמן</h2>
          <p className="mt-1 text-xs text-[#8e9379]">ארוחות מצולמות ומהירות, ב־35 הימים האחרונים</p>
        </div>
        <button type="button" onClick={onRetry} className="shrink-0 text-sm font-semibold text-[#c3f400]">
          רענון
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl border border-[#444933] p-4 text-center">
          <p className="text-xs text-[#8e9379]">ארוחות היום</p>
          <p className="mt-1 text-2xl font-bold text-white">{todayMeals.length}</p>
        </div>
        <div className="glass-card rounded-2xl border border-[#444933] p-4 text-center">
          <p className="text-xs text-[#8e9379]">קלוריות היום</p>
          <p className="mt-1 text-2xl font-bold text-[#c3f400]">{Math.round(todayCalories)}</p>
        </div>
      </div>

      <label className="block">
        <span className="sr-only">חיפוש מתאמן</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש מתאמן..."
          className="w-full rounded-xl border border-[#444933] bg-[#282a2b] px-4 py-3 text-white placeholder:text-[#8e9379]"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="סינון ארוחות לפי מתאמן">
        <button
          type="button"
          onClick={() => setSelectedClientId("all")}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${selectedClientId === "all" ? "bg-[#c3f400] text-[#161e00]" : "bg-[#282a2b] text-[#c4c9ac]"}`}
        >
          כל המתאמנים
        </button>
        {visibleClients.map((client) => (
          <button
            key={client.id}
            type="button"
            onClick={() => setSelectedClientId(client.id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${selectedClientId === client.id ? "bg-[#c3f400] text-[#161e00]" : "bg-[#282a2b] text-[#c4c9ac]"}`}
          >
            {client.name}
          </button>
        ))}
      </div>

      {loading && <p className="py-10 text-center text-sm text-[#8e9379]">טוען ארוחות...</p>}

      {!loading && error && (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-center">
          <p className="text-sm text-red-200">{error}</p>
          <button type="button" onClick={onRetry} className="mt-3 text-sm font-semibold text-[#c3f400]">נסה שוב</button>
        </div>
      )}

      {!loading && !error && selectedClient && (
        <div className="glass-card rounded-2xl border border-[#444933] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">{selectedClient.name}</p>
              <p className="text-xs text-[#8e9379]">{selectedMeals.length} ארוחות בתקופה</p>
            </div>
            <button type="button" onClick={() => setSelectedClientId("all")} className="text-xs font-semibold text-[#c3f400]">חזרה לכולם</button>
          </div>
          <MealHistory meals={selectedMeals} title="" />
        </div>
      )}

      {!loading && !error && selectedClientId === "all" && (
        <div className="space-y-3">
          {visibleClients.map((client) => {
            const clientMeals = grouped.get(client.id) ?? [];
            const todayForClient = clientMeals.filter((meal) => dayKey(meal.logged_at) === today);
            const calories = todayForClient.reduce((sum, meal) => sum + (Number(meal.total_calories) || 0), 0);
            return (
              <button
                key={client.id}
                type="button"
                onClick={() => setSelectedClientId(client.id)}
                className="glass-card w-full rounded-2xl border border-[#444933] p-4 text-right transition-colors hover:border-[#c3f400]/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{client.name}</p>
                    <p className="mt-1 text-xs text-[#8e9379]">
                      {clientMeals.length ? `${clientMeals.length} ארוחות בתקופה` : "לא נרשמו ארוחות בתקופה"}
                    </p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="font-bold text-[#c3f400]">{Math.round(calories)} קל׳</p>
                    <p className="text-xs text-[#8e9379]">{todayForClient.length} היום</p>
                  </div>
                </div>
              </button>
            );
          })}
          {visibleClients.length === 0 && <p className="py-8 text-center text-sm text-[#8e9379]">לא נמצאו מתאמנים</p>}
        </div>
      )}
    </section>
  );
}
