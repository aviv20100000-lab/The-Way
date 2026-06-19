import { motion } from "framer-motion";
import type { Food, NutritionTotals } from "@/lib/types";
import { calcItemNutrition, MEAL_TYPE_LABELS } from "@/lib/types";
import type { MealType } from "@/lib/types";

const nutrientColors = {
  calories: {
    gradient: "from-orange-600 to-orange-500",
    emoji: "🔥",
    icon: "kcal"
  },
  protein: {
    gradient: "from-blue-600 to-blue-500",
    emoji: "💪",
    icon: "g"
  },
  carbs: {
    gradient: "from-amber-600 to-amber-500",
    emoji: "⚡",
    icon: "g"
  },
  fat: {
    gradient: "from-purple-600 to-purple-500",
    emoji: "💧",
    icon: "g"
  },
};

export function NutritionBadge({ totals }: { totals: NutritionTotals }) {
  const nutrients = [
    { label: "קלוריות", value: totals.calories, icon: "🔥", gradient: "from-orange-600 to-orange-500" },
    { label: "חלבון", value: `${totals.protein}`, icon: "💪", gradient: "from-blue-600 to-blue-500" },
    { label: "פחמימות", value: `${totals.carbs}`, icon: "⚡", gradient: "from-amber-600 to-amber-500" },
    { label: "שומן", value: `${totals.fat}`, icon: "💧", gradient: "from-purple-600 to-purple-500" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {nutrients.map((nutrient, i) => (
        <motion.div
          key={nutrient.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className={`rounded-2xl bg-gradient-to-br ${nutrient.gradient} p-5 text-center text-white shadow-md hover:shadow-lg transition-shadow duration-300`}
        >
          <div className="text-3xl mb-2">{nutrient.icon}</div>
          <div className="font-bold text-xl">{nutrient.value}</div>
          <div className="text-xs opacity-90 font-medium">{nutrient.label}</div>
        </motion.div>
      ))}
    </div>
  );
}

const mealTypeEmojis: Record<MealType, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍿",
};

export function MealCard({
  mealType,
  loggedAt,
  photoUrl,
  items,
  userName,
  notes,
}: {
  mealType: MealType;
  loggedAt: string;
  photoUrl: string | null;
  items: { food: Food; quantity: number }[];
  userName?: string;
  notes?: string | null;
}) {
  const totals = items.reduce(
    (acc, item) => {
      const n = calcItemNutrition(item.food, item.quantity);
      return {
        calories: acc.calories + n.calories,
        protein: acc.protein + n.protein,
        carbs: acc.carbs + n.carbs,
        fat: acc.fat + n.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const time = new Date(loggedAt).toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const mealEmoji = mealTypeEmojis[mealType] || "🍽️";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 100, damping: 15 }}
      className="overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-white/50 hover:shadow-floating hover:scale-105 transition-all duration-300"
    >
      {photoUrl && (
        <div className="relative aspect-square w-full bg-gradient-to-br from-neutral-100 to-neutral-200 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            src={photoUrl}
            alt="תמונת ארוחה"
            initial={{ scale: 1.05, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="h-full w-full object-cover"
          />
          {/* Meal type badge overlay */}
          <div className="absolute top-3 end-3 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 text-white text-xs font-semibold flex items-center gap-1">
            {mealEmoji}
            <span>{MEAL_TYPE_LABELS[mealType]}</span>
          </div>
        </div>
      )}
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            {userName && <p className="font-semibold text-lg text-neutral-900">{userName}</p>}
            <p className="text-sm text-neutral-500">{time}</p>
          </div>
          <div className="text-3xl">{mealEmoji}</div>
        </div>

        {/* Nutrition summary grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 p-3 text-center">
            <div className="text-lg font-bold text-orange-600">{totals.calories}</div>
            <div className="text-xs text-orange-500">kcal</div>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-3 text-center">
            <div className="text-lg font-bold text-blue-600">{totals.protein}g</div>
            <div className="text-xs text-blue-500">חלבון</div>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 p-3 text-center">
            <div className="text-lg font-bold text-amber-600">{totals.carbs}g</div>
            <div className="text-xs text-amber-500">פחמימות</div>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 p-3 text-center">
            <div className="text-lg font-bold text-purple-600">{totals.fat}g</div>
            <div className="text-xs text-purple-500">שומן</div>
          </div>
        </div>

        {/* Items list */}
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {items.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex justify-between items-center text-sm text-neutral-700 pb-2 border-b border-neutral-100 last:border-b-0"
            >
              <span>{item.food.name_he}</span>
              <span className="font-medium text-primary-600">{item.quantity}g</span>
            </motion.div>
          ))}
        </div>

        {/* Notes */}
        {notes && (
          <p className="text-sm text-neutral-600 italic border-s-2 border-primary-500 ps-3">
            "{notes}"
          </p>
        )}
      </div>
    </motion.div>
  );
}

export function Header({ title, userName, onLogout }: { title: string; userName: string; onLogout: () => void }) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-neutral-900">{title}</h1>
            <span className="text-xs font-medium text-neutral-400">by Aviv & Liav</span>
          </div>
          <p className="text-sm text-neutral-500">שלום, {userName}</p>
        </div>
        <motion.button
          onClick={onLogout}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-lg px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-100"
        >
          יציאה
        </motion.button>
      </div>
    </motion.header>
  );
}
