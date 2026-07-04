"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { withCsrf } from "@/lib/csrf-client";

type Food = { id: string; name_he: string; name_en: string | null; calories: number };
type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type BasketItem = { food: Food; grams: number };

const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: "breakfast", label: "ארוחת בוקר", icon: "🌅" },
  { value: "lunch", label: "ארוחת צהריים", icon: "☀️" },
  { value: "dinner", label: "ארוחת ערב", icon: "🌙" },
  { value: "snack", label: "חטיף", icon: "🍎" },
];

const itemCalories = (item: BasketItem) => Math.round(item.grams * item.food.calories / 100);

export function QuickMealLogger({ onSaved }: { onSaved?: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [basket, setBasket] = useState<BasketItem[]>([]);
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

  const pendingItem: BasketItem | null = selected
    ? { food: selected, grams: parseFloat(quantity) || 0 }
    : null;
  const estimatedCalories = pendingItem ? itemCalories(pendingItem) : null;
  const basketTotal = basket.reduce((sum, item) => sum + itemCalories(item), 0);
  const hasAnything = basket.length > 0 || (pendingItem !== null && pendingItem.grams > 0);

  function addToBasket() {
    if (!pendingItem || pendingItem.grams <= 0) return;
    setBasket((prev) => [...prev, pendingItem]);
    setSelected(null);
    setQuery("");
    setQuantity("100");
    setResults([]);
  }

  function removeFromBasket(index: number) {
    setBasket((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleLog() {
    // Whatever is still in the picker joins the meal too — saves a tap
    const items = [...basket, ...(pendingItem && pendingItem.grams > 0 ? [pendingItem] : [])];
    if (items.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const headers = await withCsrf({ "Content-Type": "application/json" });
      const res = await fetch("/api/meals/quick", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          items: items.map((item) => ({ foodId: item.food.id, quantity: item.grams })),
          mealType,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "שגיאה בשמירה");
      } else {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          setBasket([]);
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

      {basket.length > 0 && (
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {basket.map((item, i) => (
              <motion.div
                key={`${item.food.id}-${i}`}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="flex items-center justify-between rounded-xl bg-[#282a2b] border border-[#444933] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.food.name_he}</p>
                  <p className="text-xs text-[#8e9379]">{item.grams} גרם</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-[#c3f400]">{itemCalories(item)} קל׳</span>
                  <button
                    onClick={() => removeFromBasket(i)}
                    aria-label={`הסר ${item.food.name_he}`}
                    className="text-red-400 hover:text-red-300 text-xs p-1 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="flex items-center justify-between px-1 pt-0.5">
            <span className="text-xs text-[#8e9379]">{basket.length} פריטים</span>
            <span className="text-sm font-bold text-[#c3f400]">{basketTotal} קל׳</span>
          </div>
        </div>
      )}

      {!selected ? (
        <div className="relative">
          <label className="mb-1 block text-xs font-medium text-[#c4c9ac]" htmlFor="food-search">
            {basket.length > 0 ? "הוסף עוד מאכל" : "חיפוש מזון"}
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex items-center gap-3">
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
          </div>
          <button
            onClick={addToBasket}
            disabled={!pendingItem || pendingItem.grams <= 0}
            className="w-full rounded-xl border border-[#c3f400]/40 bg-[#c3f400]/10 py-2.5 text-sm font-bold text-[#c3f400] hover:bg-[#c3f400]/20 disabled:opacity-40 transition-all"
          >
            ➕ הוסף עוד מאכל לארוחה
          </button>
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
            disabled={!hasAnything || saving}
            whileTap={{ scale: 0.98 }}
            className="w-full rounded-full bg-[#c3f400] py-3 font-bold text-[#161e00] disabled:opacity-40 transition-all"
          >
            {saving
              ? "שומר..."
              : basket.length > 0
                ? `שמור ארוחה (${basketTotal + (pendingItem && pendingItem.grams > 0 ? itemCalories(pendingItem) : 0)} קל׳)`
                : "שמור ארוחה"}
          </motion.button>
        )}
      </AnimatePresence>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
