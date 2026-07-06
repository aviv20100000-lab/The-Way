"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CoachInsightClient, InsightStatus } from "@/lib/coach-insights";

interface InsightsResponse {
  generated_at: string;
  summary: Record<InsightStatus, number>;
  clients: CoachInsightClient[];
}

const STATUS: Record<InsightStatus, { label: string; icon: string; badge: string }> = {
  at_risk: { label: "דורש טיפול", icon: "!", badge: "border-red-400/40 bg-red-400/10 text-red-200" },
  needs_attention: { label: "תשומת לב", icon: "•", badge: "border-amber-300/40 bg-amber-300/10 text-amber-200" },
  on_track: { label: "במסלול", icon: "✓", badge: "border-[#c3f400]/40 bg-[#c3f400]/10 text-[#c3f400]" },
  insufficient_data: { label: "אין מספיק נתונים", icon: "?", badge: "border-[#636863] bg-[#282a2b] text-[#c4c9ac]" },
};

function shortDay(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("he-IL", { weekday: "short" });
}

function WeightChart({ client, range }: { client: CoachInsightClient; range: 30 | 90 }) {
  const cutoff = Date.now() - range * 86_400_000;
  const values = client.weights.filter((item) => new Date(`${item.day}T12:00:00`).getTime() >= cutoff);
  if (values.length === 0) return <p className="py-8 text-center text-sm text-[#8e9379]">אין שקילות בטווח הזה</p>;

  const allValues = [...values.map((item) => item.value), ...(client.target_weight ? [client.target_weight] : [])];
  const min = Math.min(...allValues) - 1;
  const max = Math.max(...allValues) + 1;
  const width = 320;
  const height = 150;
  const x = (index: number) => 18 + (values.length === 1 ? 142 : (index / (values.length - 1)) * 284);
  const y = (value: number) => 12 + ((max - value) / Math.max(max - min, 1)) * 108;
  const points = values.map((item, index) => `${x(index)},${y(item.value)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label={`מגמת משקל: ${values.map((item) => `${item.day} ${item.value} קילוגרם`).join(", ")}`}>
        {[0, 1, 2].map((line) => <line key={line} x1="18" x2="302" y1={20 + line * 45} y2={20 + line * 45} stroke="#343936" strokeWidth="1" />)}
        {client.target_weight && <line x1="18" x2="302" y1={y(client.target_weight)} y2={y(client.target_weight)} stroke="#c3f400" strokeDasharray="5 5" strokeWidth="1.5" />}
        {values.length > 1 && <polyline points={points} fill="none" stroke="#c3f400" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
        {values.map((item, index) => (
          <g key={`${item.day}-${index}`}>
            <circle cx={x(index)} cy={y(item.value)} r="4" fill="#c3f400" stroke="#161e00" strokeWidth="2" />
            {(index === 0 || index === values.length - 1) && <text x={x(index)} y={y(item.value) - 9} fill="#ffffff" fontSize="10" textAnchor="middle">{item.value}</text>}
          </g>
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-[#8e9379]">
        <span>{values[0]?.day}</span>
        {client.target_weight && <span className="text-[#c3f400]">קו מקווקו: יעד {client.target_weight} ק״ג</span>}
        <span>{values.at(-1)?.day}</span>
      </div>
    </div>
  );
}

function SevenDayBars({ values, goal, color, unit }: { values: { day: string; value: number; hasData: boolean }[]; goal: number | null; color: string; unit: string }) {
  const max = Math.max(goal ?? 0, ...values.map((item) => item.value), 1);
  return (
    <div className="space-y-2">
      <div className="relative flex h-32 items-end gap-2 border-b border-[#444933] px-1">
        {goal && <div className="absolute inset-x-0 border-t border-dashed border-[#c3f400]/70" style={{ bottom: `${Math.min(100, (goal / max) * 100)}%` }}><span className="absolute -top-4 end-0 text-[9px] text-[#c3f400]">יעד</span></div>}
        {values.map((item) => (
          <div key={item.day} className="relative z-10 flex h-full flex-1 items-end justify-center" title={`${item.day}: ${item.hasData ? `${item.value} ${unit}` : "אין נתון"}`}>
            {item.hasData ? <div className={`w-full max-w-7 rounded-t-md ${color}`} style={{ height: `${Math.max(5, (item.value / max) * 100)}%` }} /> : <div className="mb-1 h-1 w-full max-w-7 rounded bg-[#343936]" />}
          </div>
        ))}
      </div>
      <div className="flex gap-2 px-1 text-center text-[9px] text-[#8e9379]">
        {values.map((item) => <span key={item.day} className="flex-1">{shortDay(item.day)}</span>)}
      </div>
    </div>
  );
}

export default function CoachInsightsPanel({
  onViewClient,
  onEditGoals,
}: {
  onViewClient: (clientId: string) => void;
  onEditGoals: (clientId: string) => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | InsightStatus>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [weightRange, setWeightRange] = useState<30 | 90>(30);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/coach/insights", { cache: "no-store" });
      if (!response.ok) throw new Error(`Insights request failed: ${response.status}`);
      setData(await response.json());
      setError("");
    } catch {
      setError("לא הצלחנו לטעון את התובנות");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedId(null); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedId]);

  const visibleClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("he");
    return (data?.clients ?? []).filter((client) =>
      (filter === "all" || client.status === filter) && (!normalized || client.name.toLocaleLowerCase("he").includes(normalized))
    );
  }, [data, filter, query]);
  const selected = data?.clients.find((client) => client.id === selectedId) ?? null;
  const urgent = (data?.summary.at_risk ?? 0) + (data?.summary.needs_attention ?? 0);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton h-28 rounded-2xl" />)}</div>;
  if (error) return <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-center"><p className="text-red-200">{error}</p><button type="button" onClick={() => void load()} className="mt-3 font-bold text-[#c3f400]">נסה שוב</button></div>;
  if (!data || data.clients.length === 0) return <p className="py-12 text-center text-sm text-[#8e9379]">התובנות יופיעו לאחר הוספת מתאמנים</p>;

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-xl font-bold text-white">תובנות</h2><p className="mt-1 text-xs text-[#8e9379]">סטטוס לפי 7 ימים מלאים שהסתיימו אתמול</p></div>
        <button type="button" onClick={() => void load()} className="min-h-11 rounded-xl border border-[#444933] px-3 text-xs font-bold text-[#c3f400]">רענון</button>
      </div>
      <p className="-mt-3 text-[10px] text-[#8e9379]">עודכן {new Date(data.generated_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })}</p>

      <div className="grid grid-cols-2 gap-2" aria-live="polite">
        {([
          ["at_risk", "דורשים טיפול"], ["needs_attention", "תשומת לב"], ["on_track", "במסלול"], ["insufficient_data", "אין מספיק מידע"],
        ] as [InsightStatus, string][]).map(([status, label]) => (
          <button key={status} type="button" onClick={() => setFilter((current) => current === status ? "all" : status)} className={`rounded-2xl border p-3 text-right transition-colors ${filter === status ? STATUS[status].badge : "border-[#444933] bg-[#171919]"}`}>
            <span className="block text-2xl font-black text-white">{data.summary[status] ?? 0}</span><span className="text-xs text-[#c4c9ac]">{label}</span>
          </button>
        ))}
      </div>

      <div className={`rounded-2xl border p-4 ${urgent ? "border-amber-300/25 bg-amber-300/5" : "border-[#c3f400]/25 bg-[#c3f400]/5"}`}>
        <p className="font-bold text-white">{urgent ? `${urgent} מתאמנים דורשים מעבר שלך` : "כולם נראים במסלול כרגע"}</p>
        <p className="mt-1 text-xs text-[#8e9379]">הסטטוס הוא כלי תיעדוף, לא אבחון רפואי.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש מתאמן..." className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#444933] bg-[#282a2b] px-4 text-sm text-white placeholder:text-[#8e9379]" />
          {filter !== "all" && <button type="button" onClick={() => setFilter("all")} className="min-h-11 rounded-xl border border-[#444933] px-3 text-xs text-[#c4c9ac]">נקה סינון</button>}
        </div>

        {visibleClients.map((client) => (
          <article key={client.id} className="rounded-2xl border border-[#444933] bg-[#171919] p-4">
            <button type="button" onClick={() => setSelectedId(client.id)} className="w-full text-right">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate font-bold text-white">{client.name}</p><p className="mt-1 text-xs text-[#c4c9ac]">{client.reasons[0]}</p>{client.reasons.length > 1 && <p className="mt-1 text-[10px] text-[#8e9379]">ועוד {client.reasons.length - 1} סיבות</p>}</div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${STATUS[client.status].badge}`}>{STATUS[client.status].icon} {STATUS[client.status].label}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#343936] pt-3 text-center">
                <div><p className="text-sm font-bold text-white">{client.reported_days_7}/7</p><p className="text-[9px] text-[#8e9379]">ימי תזונה · שבוע מלא</p></div>
                <div><p className="text-sm font-bold text-white">{client.calorie_adherence === null ? "—" : `${client.calorie_adherence}%`}</p><p className="text-[9px] text-[#8e9379]">עמידה בקלוריות</p></div>
                <div><p className="text-sm font-bold text-white">{client.average_steps_7 ? client.average_steps_7.toLocaleString() : "—"}</p><p className="text-[9px] text-[#8e9379]">ממוצע צעדים</p></div>
              </div>
            </button>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => router.push(`/chat?with=${encodeURIComponent(client.id)}`)} className="min-h-11 flex-1 rounded-xl bg-[#c3f400] px-3 text-sm font-bold text-[#161e00]">שלח הודעה</button>
              <button type="button" onClick={() => onViewClient(client.id)} className="min-h-11 rounded-xl border border-[#444933] px-3 text-xs font-bold text-white">פרטים</button>
            </div>
          </article>
        ))}
        {visibleClients.length === 0 && <p className="py-8 text-center text-sm text-[#8e9379]">לא נמצאו מתאמנים בסינון הזה</p>}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => setSelectedId(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="insight-client-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#444933] bg-[#111414] p-5" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 mb-4 flex items-start justify-between bg-[#111414] pb-3">
              <div><h3 id="insight-client-title" className="text-lg font-bold text-white">{selected.name}</h3><span className={`mt-1 inline-block rounded-full border px-2.5 py-1 text-[10px] font-bold ${STATUS[selected.status].badge}`}>{STATUS[selected.status].label}</span></div>
              <button type="button" onClick={() => setSelectedId(null)} className="min-h-11 min-w-11 rounded-xl text-2xl text-[#8e9379]" aria-label="סגור">×</button>
            </div>

            <div className="mb-4 rounded-2xl border border-[#444933] bg-[#171919] p-4"><p className="text-sm font-bold text-white">סיכום</p><ul className="mt-2 space-y-1 text-xs text-[#c4c9ac]">{selected.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul></div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[#444933] bg-[#171919] p-4">
                <div className="mb-3 flex items-center justify-between"><div><p className="font-bold text-white">מגמת משקל</p><p className="text-xs text-[#8e9379]">{selected.latest_weight ? `אחרון: ${selected.latest_weight} ק״ג` : "אין שקילה אחרונה"}</p></div><div className="flex rounded-lg bg-[#282a2b] p-1">{([30, 90] as const).map((range) => <button key={range} type="button" onClick={() => setWeightRange(range)} className={`rounded-md px-2 py-1 text-[10px] ${weightRange === range ? "bg-[#c3f400] font-bold text-[#161e00]" : "text-[#c4c9ac]"}`}>{range} יום</button>)}</div></div>
                <WeightChart client={selected} range={weightRange} />
              </div>

              <div className="rounded-2xl border border-[#444933] bg-[#171919] p-4">
                <div className="mb-4"><p className="font-bold text-white">קלוריות — 7 ימים כולל היום</p><p className="text-xs text-[#8e9379]">הסטטוס מחושב בנפרד לפי 7 ימים מלאים · יעד: {selected.calorie_goal ?? "לא הוגדר"}</p></div>
                <SevenDayBars values={selected.daily.slice(-7).map((item) => ({ day: item.day, value: item.calories, hasData: item.reported }))} goal={selected.calorie_goal} color="bg-amber-300" unit="קלוריות" />
                <div className="mt-5 border-t border-[#343936] pt-4">
                  <div className="flex items-center justify-between text-xs"><span className="font-bold text-white">חלבון — ממוצע בשבוע המלא</span><span className="text-[#c4c9ac]">{selected.average_protein_7 || "—"} / {selected.protein_goal ?? "—"} גרם</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#282a2b]"><div className="h-full rounded-full bg-[#c3f400]" style={{ width: `${selected.protein_goal ? Math.min(100, (selected.average_protein_7 / selected.protein_goal) * 100) : 0}%` }} /></div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#444933] bg-[#171919] p-4"><div className="mb-4"><p className="font-bold text-white">צעדים — 7 ימים כולל היום</p><p className="text-xs text-[#8e9379]">הסטטוס מחושב לפי השבוע המלא · יעד: {selected.steps_goal?.toLocaleString() ?? "לא הוגדר"}</p></div><SevenDayBars values={selected.daily.slice(-7).map((item) => ({ day: item.day, value: item.steps, hasData: item.steps > 0 }))} goal={selected.steps_goal} color="bg-sky-400" unit="צעדים" /></div>

              <div className="rounded-2xl border border-[#444933] bg-[#171919] p-4"><p className="font-bold text-white">התמדה בתזונה</p><div className="mt-3 grid grid-cols-7 gap-1">{selected.daily.slice(-7).map((item) => <div key={item.day} className="text-center"><div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${item.reported ? "bg-[#c3f400] text-[#161e00]" : "bg-[#282a2b] text-[#8e9379]"}`}>{item.reported ? "✓" : "—"}</div><span className="mt-1 block text-[9px] text-[#8e9379]">{shortDay(item.day)}</span></div>)}</div></div>
            </div>

            <div className="sticky bottom-0 mt-5 grid grid-cols-3 gap-2 bg-[#111414] pt-3">
              <button type="button" onClick={() => router.push(`/chat?with=${encodeURIComponent(selected.id)}`)} className="col-span-2 min-h-12 rounded-xl bg-[#c3f400] font-bold text-[#161e00]">שלח הודעה</button>
              <button type="button" onClick={() => { setSelectedId(null); onEditGoals(selected.id); }} className="min-h-12 rounded-xl border border-[#444933] text-sm font-bold text-white">ערוך יעדים</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
