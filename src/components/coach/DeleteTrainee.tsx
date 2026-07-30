"use client";

import { useState } from "react";
import { withCsrf } from "@/lib/csrf-client";

/**
 * Deleting a trainee.
 *
 * Sits at the bottom of the card in grey, because it is a neighbour of buttons
 * the coach presses every day.
 *
 * Three guards, each one there because the action cannot be undone:
 *   • closed by default, opens on a separate press.
 *   • shows exactly what will be deleted, in real numbers pulled from the
 *     database for this trainee — not a generic warning.
 *   • requires typing the trainee's name. The server checks it again.
 *
 * The coach who only wants to block access has the account switch, and the text
 * points there first.
 */

interface TraineeImpact {
  meals: number;
  weights: number;
  steps: number;
  water: number;
  messages: number;
  scans: number;
  assistantMessages: number;
  menus: number;
  photos: number;
}

interface DeleteTraineeProps {
  traineeId: string;
  traineeName: string;
  active: boolean;
  onDeleted: () => void;
  onActiveChanged: (active: boolean) => void;
}

export default function DeleteTrainee({
  traineeId,
  traineeName,
  active,
  onDeleted,
  onActiveChanged,
}: DeleteTraineeProps) {
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<TraineeImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const matches = typed.trim() === traineeName.trim();

  async function openPanel() {
    setOpen(true);
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/users/clients/${traineeId}`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setImpact(data.impact);
    } catch {
      setError("לא הצלחנו לטעון מה בדיוק יימחק. אל תמחק לפני שזה נטען.");
    } finally {
      setLoading(false);
    }
  }

  function closePanel() {
    setOpen(false);
    setTyped("");
    setError("");
  }

  async function toggleActive() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/users/clients/${traineeId}`, {
        method: "PATCH",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ active: !active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "השינוי נכשל");
        return;
      }
      onActiveChanged(!active);
      closePanel();
    } catch {
      setError("השינוי נכשל");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/users/clients/${traineeId}`, {
        method: "DELETE",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ confirmName: typed.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "המחיקה נכשלה");
        return;
      }
      onDeleted();
    } catch {
      setError("המחיקה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => void openPanel()}
        aria-label={`מחיקת ${traineeName}`}
        className="w-full rounded-xl border border-[#444933] bg-transparent py-2.5 text-sm font-semibold text-[#8e9379] transition-all hover:border-red-400/40 hover:text-red-200"
      >
        מחיקת מתאמן
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-400/30 bg-red-400/[0.06] p-5">
      <p className="mb-1 text-base font-bold text-red-200">למחוק את {traineeName}?</p>
      <p className="mb-3 text-sm leading-relaxed text-[#c4c9ac]">זה בלתי הפיך. יימחקו:</p>

      {loading && <p className="mb-3 text-sm text-[#8e9379]">בודק מה יימחק…</p>}

      {impact && (
        <ul className="mb-3 space-y-1 text-sm text-[#c4c9ac]">
          <li>· {impact.meals} ארוחות שנרשמו</li>
          <li>· {impact.weights} שקילות, וכל גרף ההתקדמות</li>
          <li>· {impact.steps} דיווחי צעדים ו-{impact.water} דיווחי מים</li>
          <li>· {impact.scans} סריקות מזון ו-{impact.assistantMessages} הודעות לעוזר האישי</li>
          <li>· {impact.menus} תפריטים שבנית לו</li>
          <li>· {impact.photos} תמונות מהאחסון</li>
          <li className="font-semibold text-red-200">
            · {impact.messages} הודעות צ׳אט — כולל ההודעות שלו בתוך קבוצות, כך
            שבשיחות הקבוצתיות ייווצרו חורים בהיסטוריה שכל החברים יראו
          </li>
        </ul>
      )}

      <div className="mb-4 rounded-xl border border-[#444933] bg-[#1b1d1d] p-3">
        <p className="mb-2 text-sm leading-relaxed text-[#c4c9ac]">
          אם אתה רק רוצה שהוא לא יוכל להיכנס, אל תמחק. כבה לו את החשבון — הוא
          נחסם מיד בכניסה, ושום נתון לא נמחק. אפשר להחזיר בכל רגע.
        </p>
        <button
          type="button"
          onClick={() => void toggleActive()}
          disabled={busy}
          className="w-full rounded-xl border border-[#c3f400]/30 bg-[#c3f400]/10 py-2.5 text-sm font-bold text-[#c3f400] transition-all hover:bg-[#c3f400]/15 disabled:opacity-40"
        >
          {active ? "כבה את החשבון במקום למחוק" : "הפעל מחדש את החשבון"}
        </button>
      </div>

      <label className="mb-2 block text-xs font-semibold text-[#8e9379]">
        להמשך, הקלד את השם: {traineeName}
      </label>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        aria-label={`הקלד ${traineeName} כדי לאשר מחיקה`}
        className="mb-4 w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white transition-all focus:border-transparent focus:ring-2 focus:ring-red-400"
      />

      {error && (
        <p className="mb-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy || loading || !matches}
          className="flex-1 rounded-xl bg-red-500/90 py-3 font-extrabold text-white transition-all hover:bg-red-500 disabled:opacity-40"
        >
          {busy ? "מוחק…" : "מחק לצמיתות"}
        </button>
        <button
          type="button"
          onClick={closePanel}
          disabled={busy}
          className="rounded-xl bg-[#282a2b] px-5 text-sm font-semibold text-[#8e9379] transition-all hover:bg-[#333535]"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
