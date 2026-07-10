"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { withCsrf } from "@/lib/csrf-client";

type Food = { id: string; name_he: string; name_en: string | null; calories: number };
type MealType = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: "breakfast", label: "ארוחת בוקר", icon: "🌅" },
  { value: "lunch", label: "ארוחת צהריים", icon: "☀️" },
  { value: "dinner", label: "ארוחת ערב", icon: "🌙" },
  { value: "snack", label: "חטיף", icon: "🍎" },
];

export function QuickMealLogger({ onSaved }: { onSaved?: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (query.trim().length < 1) { setResults([]); return; }
      try {
        const res = await fetch(`/api/foods?q=${encodeURIComponent(query)}`);
        if (res.ok) setResults(await res.json());
      } catch { /* ignore */ }
    }, 300);
  }, [query, selected]);

  const estimatedCalories = selected
    ? Math.round((parseFloat(quantity) || 0) * selected.calories / 100)
    : null;

  async function handleLog() {
    if (!selected || !quantity) return;
    setSaving(true);
    setError(null);
    try {
      const headers = await withCsrf({ "Content-Type": "application/json" });
      const res = await fetch("/api/meals/quick", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ foodId: selected.id, quantity: parseFloat(quantity), mealType }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "שגיאה בשמירה");
      } else {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          setSelected(null);
          setQuery("");
          setQuantity("100");
          onSaved?.();
        }, 1500);
      }
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4" dir="rtl" style={{ border: "1px solid #444933" }}>
      <p className="text-sm font-semibold text-white">⚡ רישום מהיר</p>

      <div className="grid grid-cols-4 gap-1.5">
        {MEAL_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setMealType(t.value)}
            className={`rounded-xl py-2 text-xs font-semibold transition-all ${
              mealType === t.value
                ? "bg-[#c3f400] text-[#161e00]"
                : "bg-[#282a2b] text-[#8e9379] border border-[#444933] hover:border-[#c3f400]/50"
            }`}
          >
            <div>{t.icon}</div>
            <div className="mt-0.5 leading-tight">{t.label.replace("ארוחת ", "")}</div>
          </button>
        ))}
      </div>

      {!selected ? (
        <div className="relative">
          <label className="mb-1 block text-xs font-medium text-[#c4c9ac]" htmlFor="food-search">
            חיפוש מזון
          </label>
          <input
            id="food-search"
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setResults([]); }}
            placeholder="עגבנייה, חזה עוף, קוטג׳..."
            autoComplete="off"
            className="w-full rounded-xl border border-[#444933] bg-[#282a2b] text-white placeholder:text-[#8e9379] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#c3f400]/30 focus:border-[#c3f400] transition-all"
          />
          <AnimatePresence>
            {results.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute z-10 mt-1 w-full rounded-xl border border-[#444933] bg-[#1e2020] shadow-lg overflow-hidden"
              >
                {results.map((food) => (
                  <li key={food.id}>
                    <button
                      onClick={() => { setSelected(food); setResults([]); }}
                      className="w-full px-4 py-3 text-end text-sm hover:bg-[#282a2b] flex justify-between items-center transition-colors"
                    >
                      <span className="font-medium text-white">{food.name_he}</span>
                      <span className="text-xs text-[#8e9379]">{food.calories} קל׳/100g</span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl bg-[#c3f400]/10 border border-[#c3f400]/30 px-4 py-3">
          <div>
            <p className="font-semibold text-white">{selected.name_he}</p>
            <p className="text-xs text-[#c4c9ac]">{selected.calories} קל׳ ל-100g</p>
          </div>
          <button
            onClick={() => { setSelected(null); setQuery(""); }}
            className="text-xs text-[#c3f400] underline"
          >
            החלף
          </button>
        </div>
      )}

      {selected && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
          <div className="flex-1">
            <label htmlFor="food-quantity" className="mb-1 block text-xs font-medium text-[#c4c9ac]">כמות (גרם)</label>
            <input
              id="food-quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              aria-label={`כמות ב-גרם של ${selected?.name_he ?? 'מזון'}`}
              className="w-full rounded-xl border border-[#444933] bg-[#282a2b] text-white px-4 py-3 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#c3f400]/30 focus:border-[#c3f400] transition-all"
            />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-[#c4c9ac]">קלוריות</p>
            <p className="text-2xl font-bold text-[#c3f400]">{estimatedCalories ?? 0}</p>
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {saved ? (
          <motion.div
            key="saved"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-xl bg-[#c3f400]/10 border border-[#c3f400]/30 py-3 text-center font-semibold text-[#c3f400]"
          >
            ✅ נשמר!
          </motion.div>
        ) : (
          <motion.button
            key="btn"
            onClick={handleLog}
            disabled={!selected || saving}
            whileTap={{ scale: 0.98 }}
            className="w-full rounded-full bg-[#c3f400] py-3 font-bold text-[#161e00] disabled:opacity-40 transition-all"
          >
            {saving ? "שומר..." : "שמור ארוחה"}
          </motion.button>
        )}
      </AnimatePresence>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
