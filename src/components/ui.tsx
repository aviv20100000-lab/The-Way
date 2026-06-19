import { motion } from "framer-motion";
import type { Food, NutritionTotals } from "@/lib/types";
import { calcItemNutrition, MEAL_TYPE_LABELS } from "@/lib/types";
import type { MealType } from "@/lib/types";

const nutrientColors = {
  calories: { bg: "bg-orange-50", text: "text-orange-600", label: "text-orange-500" },
  protein: { bg: "bg-blue-50", text: "text-blue-600", label: "text-blue-500" },
  carbs: { bg: "bg-amber-50", text: "text-amber-600", label: "text-amber-500" },
  fat: { bg: "bg-purple-50", text: "text-purple-600", label: "text-purple-500" },
};

export function NutritionBadge({ totals }: { totals: NutritionTotals }) {
  const nutrients = [
    { label: "קלוריות", value: totals.calories, color: nutrientColors.calories },
    { label: "חלבון", value: `${totals.protein}g`, color: nutrientColors.protein },
    { label: "פחמימות", value: `${totals.carbs}g`, color: nutrientColors.carbs },
    { label: "שומן", value: `${totals.fat}g`, color: nutrientColors.fat },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {nutrients.map((nutrient, i) => (
        <motion.div
          key={nutrient.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className={`rounded-lg ${nutrient.color.bg} p-2.5 text-center`}
        >
          <div className={`font-bold text-sm ${nutrient.color.text}`}>{nutrient.value}</div>
          <div className={`text-xs ${nutrient.color.label}`}>{nutrient.label}</div>
        </motion.div>
      ))}
    </div>
  );
}

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 100, damping: 15 }}
      className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.03] hover:shadow-floating transition-shadow duration-300"
    >
      {photoUrl && (
        <div className="relative aspect-video w-full bg-neutral-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            src={photoUrl}
            alt="תמונת ארוחה"
            initial={{ scale: 1.05, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            {userName && <p className="font-semibold text-neutral-900">{userName}</p>}
            <p className="text-sm text-primary-600 font-medium">{MEAL_TYPE_LABELS[mealType]}</p>
          </div>
          <span className="text-xs text-neutral-500">{time}</span>
        </div>

        {notes && <p className="mb-4 text-sm text-neutral-600 italic">{notes}</p>}

        <ul className="mb-4 space-y-2 text-sm text-neutral-700">
          {items.map((item, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex justify-between"
            >
              <span>{item.food.name_he}</span>
              <span className="text-neutral-500">{item.quantity} גרם</span>
            </motion.li>
          ))}
        </ul>

        <NutritionBadge totals={totals} />
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
        <div>
          <h1 className="text-lg font-bold text-neutral-900">{title}</h1>
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
