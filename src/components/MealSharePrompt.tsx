"use client";

interface MealSharePromptProps {
  visible: boolean;
  sharing: boolean;
  shared: boolean;
  error: string;
  onShare: () => void;
  onDismiss: () => void;
}

export default function MealSharePrompt({
  visible,
  sharing,
  shared,
  error,
  onShare,
  onDismiss,
}: MealSharePromptProps) {
  if (!visible) return null;

  if (shared) {
    return (
      <div className="rounded-2xl border border-[#c3f400]/30 bg-[#c3f400]/10 px-4 py-3 text-center text-sm font-semibold text-[#c3f400]">
        שותף לקבוצה
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#444933] bg-[#171a16] px-4 py-4 text-right">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">שתף לקבוצה? 📸</p>
          <p className="mt-1 text-xs text-[#8e9379]">רק אם תלחץ שיתוף, התמונה והכיתוב יופיעו בצ׳אט הקבוצתי.</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-full border border-[#444933] px-3 py-1 text-xs font-semibold text-[#8e9379] hover:border-[#c3f400] hover:text-[#c3f400]"
        >
          דלג
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onShare}
          disabled={sharing}
          className="rounded-full bg-[#c3f400] px-4 py-2 text-sm font-bold text-[#161e00] disabled:opacity-50"
        >
          {sharing ? "משתף..." : "שתף לקבוצה"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
