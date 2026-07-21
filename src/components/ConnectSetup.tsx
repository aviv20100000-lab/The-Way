"use client";

import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";

const SETUP_SKIPPED_KEY = "the-way:setup-skipped";

type NotificationStatus = "unknown" | "granted" | "denied";

interface ConnectSetupProps {
  notifStatus: NotificationStatus;
  isPwa: boolean;
  enableNotifications: () => Promise<void>;
}

export default function ConnectSetup({ notifStatus, isPwa, enableNotifications }: ConnectSetupProps) {
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>(notifStatus);
  const [enablingNotifications, setEnablingNotifications] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [opened, setOpened] = useState(false);
  const [success, setSuccess] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const permission = typeof Notification !== "undefined" ? Notification.permission : notifStatus;
    const derivedStatus: NotificationStatus = permission === "granted"
      ? "granted"
      : permission === "denied"
        ? "denied"
        : notifStatus;
    setNotificationStatus(derivedStatus);

    let skippedForSession = false;
    try {
      skippedForSession = sessionStorage.getItem(SETUP_SKIPPED_KEY) === "1";
    } catch {}
    setSkipped(skippedForSession);
    if (!skippedForSession && derivedStatus !== "granted") setOpened(true);
  }, [notifStatus]);

  useEffect(() => {
    if (!opened || skipped || closed || notificationStatus !== "granted") return;
    setSuccess(true);
    const timeout = window.setTimeout(() => setClosed(true), 1100);
    return () => window.clearTimeout(timeout);
  }, [closed, notificationStatus, opened, skipped]);

  const handleEnableNotifications = async () => {
    setEnablingNotifications(true);
    try {
      await enableNotifications();
      if (typeof Notification !== "undefined") {
        const permission = Notification.permission;
        setNotificationStatus(permission === "granted" ? "granted" : permission === "denied" ? "denied" : "unknown");
      }
    } finally {
      setEnablingNotifications(false);
    }
  };

  const handleSkip = () => {
    try {
      sessionStorage.setItem(SETUP_SKIPPED_KEY, "1");
    } catch {}
    setSkipped(true);
    setClosed(true);
  };

  if (skipped || closed || !opened) return null;

  const showSuccess = success || notificationStatus === "granted";

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/80 px-4 py-6 backdrop-blur-sm" dir="rtl">
      <div className="mx-auto flex min-h-full max-w-md items-center justify-center">
        <div className="glass-card w-full overflow-hidden rounded-3xl border border-[#444933] p-6 shadow-2xl sm:p-7">
          {showSuccess ? (
            <div className="py-6 text-center" aria-live="polite">
              <div className="mb-7 flex justify-center py-4">
                <div style={{ transform: "scale(1.7)" }}>
                  <BrandLogo />
                </div>
              </div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#c3f400]/30 bg-[#c3f400]/10 text-[#c3f400]">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="m5 12 4 4L19 6" />
                </svg>
              </div>
              <h2 className="mt-4 text-2xl font-bold text-white">ההתראות פעילות</h2>
              <p className="mt-2 text-sm text-[#c4c9ac]">העדכונים החשובים יגיעו אליך בזמן אמת.</p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <div className="mb-7 flex justify-center py-4">
                  <div style={{ transform: "scale(1.7)" }}>
                    <BrandLogo />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white">הפעלת התראות</h2>
                <p className="mt-2 whitespace-nowrap text-sm text-[#c4c9ac]">כדי שתקבל את מה שחשוב — בזמן אמת.</p>
              </div>

              <div className="mt-6 space-y-3 px-1">
                <div className="flex items-center gap-3 text-sm text-[#c4c9ac]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c3f400]" aria-hidden="true" />
                  <span>הודעות מהמאמן ומהקבוצה</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-[#c4c9ac]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c3f400]" aria-hidden="true" />
                  <span>תזכורות שתייה חכמות</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-[#c4c9ac]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c3f400]" aria-hidden="true" />
                  <span>עדכונים והישגים אישיים</span>
                </div>
              </div>

              {!isPwa && (
                <div className="mt-6 space-y-2.5">
                  <div className="flex items-start gap-3 rounded-xl bg-[#1a1c1c]/75 px-3 py-2.5 text-xs leading-5 text-[#c4c9ac]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c3f400]/10 text-[11px] font-bold text-[#c3f400]">1</span>
                    <p>פתח ב־Safari ולחץ על <strong className="text-white">סמל השיתוף</strong> (ריבוע עם חץ כלפי מעלה) בשורת הכלים.</p>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-[#1a1c1c]/75 px-3 py-2.5 text-xs leading-5 text-[#c4c9ac]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c3f400]/10 text-[11px] font-bold text-[#c3f400]">2</span>
                    <p>בחר באפשרות <strong className="text-white">„הוספה למסך הבית”</strong>.</p>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-[#1a1c1c]/75 px-3 py-2.5 text-xs leading-5 text-[#c4c9ac]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c3f400]/10 text-[11px] font-bold text-[#c3f400]">3</span>
                    <p>פתח את <strong className="text-white">THE WAY</strong> ממסך הבית ולחץ על „הפעל התראות”.</p>
                  </div>
                </div>
              )}

              {isPwa && notificationStatus === "denied" && (
                <p className="mt-6 rounded-xl border border-[#444933] bg-[#1a1c1c]/60 px-4 py-3 text-center text-xs leading-5 text-[#8e9379]">
                  יש לאפשר מחדש התראות עבור THE WAY בהגדרות ה־iPhone.
                </p>
              )}

              {isPwa && notificationStatus !== "denied" && (
                <button
                  onClick={handleEnableNotifications}
                  disabled={enablingNotifications}
                  className="lime-glow mt-6 w-full rounded-xl bg-[#c3f400] py-3 text-sm font-bold text-[#161e00] transition-opacity disabled:opacity-50"
                >
                  {enablingNotifications ? "מפעיל..." : "הפעל התראות"}
                </button>
              )}

              <button onClick={handleSkip} className="mt-3 w-full py-2 text-xs font-semibold text-[#8e9379]">
                דלג בינתיים
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
