import { formatDayKey, getTodayDayKey } from "@/lib/daily-summary";

// A menu plan is authored per weekday (day_index 0=Sunday..6=Saturday) and reused
// every week. A client's "I ate this" mark, in contrast, belongs to a real date —
// otherwise last Sunday's checkmark shows up again this Sunday forever.
// These helpers map between the plan's weekday slots and the actual dates of the
// current (Sunday-start) week, in Jerusalem time.

export const MENU_SELECTION_STATUSES = ["planned", "other"] as const;
export type MenuSelectionStatus = (typeof MENU_SELECTION_STATUSES)[number];

function dateFromDayKey(dayKey: string): Date {
  // Noon UTC keeps the calendar date stable regardless of DST offset.
  return new Date(`${dayKey}T12:00:00Z`);
}

export function weekdayOfDayKey(dayKey: string): number {
  return dateFromDayKey(dayKey).getUTCDay();
}

// Maps day_index (0..6) -> date key, for the Sunday-start week containing `todayKey`.
export function getWeekDayKeys(todayKey = getTodayDayKey()): string[] {
  const today = dateFromDayKey(todayKey);
  const sunday = new Date(today);
  sunday.setUTCDate(today.getUTCDate() - today.getUTCDay());
  return Array.from({ length: 7 }, (_, dayIndex) => {
    const date = new Date(sunday);
    date.setUTCDate(sunday.getUTCDate() + dayIndex);
    return formatDayKey(date);
  });
}

export function dayKeyForWeekday(dayIndex: number, todayKey = getTodayDayKey()): string | null {
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return null;
  return getWeekDayKeys(todayKey)[dayIndex];
}

// Marking a meal is only meaningful for days that have already arrived.
export function isMarkableDayKey(dayKey: string, todayKey = getTodayDayKey()): boolean {
  const week = getWeekDayKeys(todayKey);
  return week.includes(dayKey) && dayKey <= todayKey;
}
