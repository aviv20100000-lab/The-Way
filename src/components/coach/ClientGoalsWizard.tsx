"use client";

import { useState } from "react";
import { withCsrf } from "@/lib/csrf-client";

export interface ClientGoalsWizardClient {
  id: string;
  name: string;
}

interface WizardAnswers {
  target_weight_kg: number | null;
  daily_calories: number | null;
  daily_protein_g: number | null;
  daily_water_liters: number | null;
  daily_steps: number | null;
  weigh_in_frequency_weeks: number | null;
  weigh_in_weekday: number | null;
}

interface ClientGoalsWizardProps {
  client: ClientGoalsWizardClient;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const STEPS: {
  key: keyof WizardAnswers;
  question: string;
  hint: string;
  step?: string;
  inputType?: "number" | "select";
}[] = [
  { key: "target_weight_kg", question: "מהו משקל היעד?", hint: "ק״ג, למשל 75", step: "0.5" },
  { key: "daily_calories", question: "מהו יעד הקלוריות היומי?", hint: "למשל 1,800" },
  { key: "daily_protein_g", question: "מהו יעד החלבון היומי?", hint: "גרם, למשל 120" },
  { key: "daily_water_liters", question: "מהו יעד השתייה היומי?", hint: "ליטר, למשל 2.5", step: "0.1" },
  { key: "daily_steps", question: "מהו יעד הצעדים היומי?", hint: "למשל 10,000" },
];

const WEIGH_IN_STEPS: typeof STEPS = [
  { key: "weigh_in_frequency_weeks", question: "כל כמה זמן מתבצעת שקילה?", hint: "", inputType: "select" },
  { key: "weigh_in_weekday", question: "באיזה יום תהיה השקילה הראשונה?", hint: "", inputType: "select" },
];

const ALL_STEPS = [...STEPS, ...WEIGH_IN_STEPS];

export default function ClientGoalsWizard({ client, onClose, onSaved }: ClientGoalsWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>({
    target_weight_kg: null,
    daily_calories: null,
    daily_protein_g: null,
    daily_water_liters: null,
    daily_steps: null,
    weigh_in_frequency_weeks: null,
    weigh_in_weekday: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const current = ALL_STEPS[stepIndex];
  const isLast = stepIndex === ALL_STEPS.length - 1;

  function setValue(raw: string) {
    const parsed = raw === "" ? null : Number(raw);
    setAnswers((previous) => ({
      ...previous,
      [current.key]: parsed !== null && Number.isFinite(parsed) ? parsed : null,
    }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/users/goals", {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          userId: client.id,
          target_weight_kg: answers.target_weight_kg,
          daily_calories: answers.daily_calories,
          daily_protein_g: answers.daily_protein_g,
          daily_water_ml: answers.daily_water_liters === null
            ? null
            : Math.round(answers.daily_water_liters * 1000),
          daily_steps: answers.daily_steps,
          weigh_in_frequency_weeks: answers.weigh_in_frequency_weeks,
          weigh_in_weekday: answers.weigh_in_weekday,
        }),
      });
      if (!response.ok) throw new Error("לא הצלחנו לשמור את היעדים. אפשר לנסות שוב.");
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "אירעה שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="goals-wizard-title"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#171919]/95 p-6 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#c3f400]">יעדים עבור {client.name}</p>
            <h2 id="goals-wizard-title" className="mt-2 text-2xl font-bold">{current.question}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="סגירה">✕</button>
        </div>

        {current.inputType === "select" ? (
          <select
            autoFocus
            value={answers[current.key] ?? ""}
            onChange={(event) => setValue(event.target.value)}
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-5 text-center text-xl font-bold text-[#c3f400] outline-none transition focus:border-[#c3f400]/60 focus:ring-4 focus:ring-[#c3f400]/10"
          >
            <option value="">בחר תשובה</option>
            {current.key === "weigh_in_frequency_weeks" ? (
              <>
                <option value={1}>פעם בשבוע</option>
                <option value={2}>פעם בשבועיים</option>
              </>
            ) : (
              <>
                <option value={0}>ראשון</option>
                <option value={1}>שני</option>
                <option value={2}>שלישי</option>
                <option value={3}>רביעי</option>
                <option value={4}>חמישי</option>
                <option value={5}>שישי</option>
                <option value={6}>שבת</option>
              </>
            )}
          </select>
        ) : (
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          min="0"
          step={current.step ?? "1"}
          value={answers[current.key] ?? ""}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            if (isLast) {
              void save();
            } else {
              setStepIndex((index) => index + 1);
            }
          }}
          placeholder={current.hint}
          className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-5 text-center text-3xl font-bold text-[#c3f400] outline-none transition focus:border-[#c3f400]/60 focus:ring-4 focus:ring-[#c3f400]/10"
        />
        )}

        {error && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

        <div className="my-6 flex justify-center gap-2" aria-label={`שלב ${stepIndex + 1} מתוך ${STEPS.length}`}>
          {ALL_STEPS.map((item, index) => (
            <span key={item.key} className={`h-2 rounded-full transition-all ${index === stepIndex ? "w-7 bg-[#c3f400]" : "w-2 bg-white/20"}`} />
          ))}
        </div>
        <p className="-mt-4 mb-5 text-center text-xs text-white/40">{stepIndex + 1}/{ALL_STEPS.length}</p>

        <div className="flex gap-3">
          {stepIndex > 0 && (
            <button type="button" onClick={() => setStepIndex((index) => index - 1)} className="rounded-xl border border-white/15 px-4 py-3 font-semibold text-white/80 hover:bg-white/5">חזרה</button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => isLast ? void save() : setStepIndex((index) => index + 1)}
            className="flex-1 rounded-xl bg-[#c3f400] px-5 py-3 font-bold text-[#161e00] transition hover:bg-[#d4ff26] disabled:opacity-50"
          >
            {saving ? "שומר..." : isLast ? "שמור יעדים" : "הבא"}
          </button>
          {!isLast && (
            <button type="button" onClick={() => setStepIndex((index) => index + 1)} className="rounded-xl px-4 py-3 font-semibold text-white/50 hover:bg-white/5 hover:text-white">דלג</button>
          )}
        </div>
      </div>
    </div>
  );
}
