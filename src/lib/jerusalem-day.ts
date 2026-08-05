export const JERUSALEM_TIME_ZONE = "Asia/Jerusalem";

export function formatDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JERUSALEM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getTodayDayKey(now = new Date()): string {
  return formatDayKey(now);
}
