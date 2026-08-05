/**
 * The message the coach sends a new client.
 *
 * Kept in its own file because it is the only text that leaves the system for
 * someone who has never seen the app. If it is unclear they simply never log
 * in, and the coach only finds out when the client stops showing up.
 *
 * Written for WhatsApp: short lines, no markup, full https links so the client
 * gets something tappable rather than grey text.
 */

import type { Gender } from "@/lib/types";

export const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-way-app-two.vercel.app";

export function welcomeMessage({
  name,
  username,
  password,
  gender,
}: {
  name: string;
  username: string;
  password: string;
  gender?: Gender | null;
}) {
  const first = name.trim().split(/\s+/)[0] || name.trim();
  const isFemale = gender === "female";
  const open = isFemale ? "פתחי" : "פתח";
  const willOpen = isFemale ? "תפתחי" : "תפתח";
  const willTurnOn = isFemale ? "תדליקי" : "תדליק";

  return [
    `${first}, ברוך הבא ל-THE WAY.`,
    "",
    "הכניסה שלך:",
    APP_URL,
    `שם משתמש: ${username}`,
    `סיסמה: ${password}`,
    "",
    "כדאי להוסיף את האפליקציה למסך הבית. ככה היא נפתחת מהר,",
    "בלי סרגל הדפדפן, ואפשר לקבל התראות.",
    "",
    "באייפון:",
    `1. ${open} את הקישור למעלה בספארי`,
    "2. לחץ על סמל השיתוף למטה, ריבוע עם חץ כלפי מעלה",
    "3. בחר הוספה למסך הבית",
    "",
    "באנדרואיד:",
    `1. ${open} את הקישור למעלה בכרום`,
    "2. לחץ על שלוש הנקודות למעלה",
    "3. בחר הוספה למסך הבית",
    "",
    `אחרי שהוספת, ${willOpen} את THE WAY ממסך הבית ו${willTurnOn} התראות.`,
    "ככה תקבל הודעות מהמאמן ותזכורות בזמן.",
    "",
    "נתראה.",
  ].join("\n");
}
