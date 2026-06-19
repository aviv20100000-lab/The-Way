import type { Food, NutritionTotals } from "@/lib/types";
import { calcItemNutrition, MEAL_TYPE_LABELS } from "@/lib/types";
import type { MealType } from "@/lib/types";

export function NutritionBadge({ totals }: { totals: NutritionTotals }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center text-xs">
      <div className="rounded-lg bg-orange-50 p-2">
        <div className="font-bold text-orange-600">{totals.calories}</div>
        <div className="text-orange-400">קלוריות</div>
      </div>
      <div className="rounded-lg bg-blue-50 p-2">
        <div className="font-bold text-blue-600">{totals.protein}g</div>
        <div className="text-blue-400">חלבון</div>
      </div>
      <div className="rounded-lg bg-amber-50 p-2">
        <div className="font-bold text-amber-600">{totals.carbs}g</div>
        <div className="text-amber-400">פחמימות</div>
      </div>
      <div className="rounded-lg bg-purple-50 p-2">
        <div className="font-bold text-purple-600">{totals.fat}g</div>
        <div className="text-purple-400">שומן</div>
      </div>
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
    <div className="overflow-hidden rounded-2xl bg-white shadow-md">
      {photoUrl && (
        <div className="relative aspect-video w-full bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="תמונת ארוחה" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            {userName && <p className="font-semibold text-gray-900">{userName}</p>}
            <p className="text-sm text-brand-600">{MEAL_TYPE_LABELS[mealType]}</p>
          </div>
          <span className="text-xs text-gray-400">{time}</span>
        </div>

        {notes && <p className="mb-3 text-sm text-gray-500">{notes}</p>}

        <ul className="mb-3 space-y-1 text-sm text-gray-700">
          {items.map((item, i) => (
            <li key={i} className="flex justify-between">
              <span>{item.food.name_he}</span>
              <span className="text-gray-400">{item.quantity} גרם</span>
            </li>
          ))}
        </ul>

        <NutritionBadge totals={totals} />
      </div>
    </div>
  );
}

export function Header({ title, userName, onLogout }: { title: string; userName: string; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">שלום, {userName}</p>
        </div>
        <button
          onClick={onLogout}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
        >
          יציאה
        </button>
      </div>
    </header>
  );
}
