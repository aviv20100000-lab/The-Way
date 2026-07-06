"use client";

import { useCallback, useEffect, useState } from "react";
import { withCsrf } from "@/lib/csrf-client";

interface ActivityItem {
  id: string;
  client_id: string;
  client_name: string;
  kind: "meal" | "quick_meal" | "weight" | "steps";
  title: string;
  detail: string;
  logged_at: string;
  unread: boolean;
}

const ICONS: Record<ActivityItem["kind"], string> = {
  meal: "🍽️",
  quick_meal: "🥣",
  weight: "⚖️",
  steps: "👟",
};

function timeLabel(value: string) {
  const date = new Date(value);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const day = date.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  if (day === today) {
    return `היום, ${date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })}`;
  }
  return date.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
}

export default function CoachActivityNotifications({ onOpenClient }: { onOpenClient: (clientId: string) => void }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    try {
      const response = await fetch("/api/coach/activity", { cache: "no-store" });
      if (!response.ok) throw new Error(`Activity request failed: ${response.status}`);
      const data = await response.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(Number(data.unread_count) || 0);
      setError("");
    } catch {
      setError("לא הצלחנו לטעון את העדכונים");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActivity();
    const timer = window.setInterval(() => void loadActivity(), 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadActivity();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadActivity]);

  async function togglePanel() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen || unreadCount === 0) return;

    const displayedUnreadIds = items.filter((item) => item.unread).map((item) => item.id);
    if (displayedUnreadIds.length === 0) return;
    setUnreadCount((current) => Math.max(0, current - displayedUnreadIds.length));
    setItems((current) => current.map((item) => displayedUnreadIds.includes(item.id) ? { ...item, unread: false } : item));
    try {
      const response = await fetch("/api/coach/activity", {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ activityIds: displayedUnreadIds }),
      });
      if (!response.ok) throw new Error("Mark activity read failed");
      await loadActivity();
    } catch {
      // The next refresh restores the unread count if marking as read failed.
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void togglePanel()}
        className="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-[#282a2b] text-lg text-white transition-colors hover:bg-[#333535]"
        aria-label={unreadCount ? `${unreadCount} עדכונים חדשים` : "עדכוני מתאמנים"}
        aria-expanded={open}
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c3f400] px-1 text-[10px] font-black text-[#161e00]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-[calc(100%+0.65rem)] z-50 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#444933] bg-[#171919] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#444933] px-4 py-3">
            <div>
              <p className="font-bold text-white">עדכוני מתאמנים</p>
              <p className="text-[11px] text-[#8e9379]">ארוחות, משקל וצעדים</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-xl text-[#8e9379] hover:bg-[#282a2b]" aria-label="סגור">×</button>
          </div>

          <div className="max-h-[65vh] overflow-y-auto p-2">
            {loading && <p className="py-8 text-center text-sm text-[#8e9379]">טוען עדכונים...</p>}
            {!loading && error && (
              <div className="py-6 text-center">
                <p className="text-sm text-red-300">{error}</p>
                <button type="button" onClick={() => void loadActivity()} className="mt-2 text-xs font-bold text-[#c3f400]">נסה שוב</button>
              </div>
            )}
            {!loading && !error && items.length === 0 && (
              <p className="py-8 text-center text-sm text-[#8e9379]">אין עדיין עדכונים חדשים</p>
            )}
            {!loading && !error && items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setOpen(false); onOpenClient(item.client_id); }}
                className={`mb-1 flex w-full items-start gap-3 rounded-xl p-3 text-right transition-colors hover:bg-[#282a2b] ${item.unread ? "bg-[#c3f400]/8" : ""}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#282a2b] text-lg">{ICONS[item.kind]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-white">{item.client_name}</span>
                    {item.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#c3f400]" />}
                  </span>
                  <span className="block text-xs text-[#c4c9ac]">{item.title} · {item.detail}</span>
                  <span className="mt-1 block text-[10px] text-[#8e9379]">{timeLabel(item.logged_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
