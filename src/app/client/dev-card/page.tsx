"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateMilestoneShareImage,
  milestoneBlobToDataUrl,
  type MilestoneShareImageInput,
} from "@/lib/milestoneShareImage";

interface CardCase {
  key: string;
  label: string;
  milestone: MilestoneShareImageInput;
  firstName?: string;
}

const BASE_CASES = [
  { id: "weight-5", value: 5, suffix: "ק״ג", message: "5 ק״ג פחות" },
  { id: "weight-25", value: 25, suffix: "ק״ג", message: "25 ק״ג פחות" },
  { id: "days-25", value: 25, suffix: "ימים", message: "תודה על 25 ימים" },
  { id: "days-100", value: 100, suffix: "ימים", message: "תודה על 100 ימים" },
  { id: "steps-100", value: 100, suffix: "אלף צעדים", message: "100 אלף צעדים!" },
  { id: "steps-300", value: 300, suffix: "אלף צעדים", message: "300 אלף צעדים!" },
] satisfies MilestoneShareImageInput[];

const CARD_CASES: CardCase[] = BASE_CASES.map((milestone) => ({
  key: `${milestone.id}-aviv`,
  label: `${milestone.id} · אביב`,
  milestone,
  firstName: "אביב",
}));

export default function MilestoneCardLabPage() {
  const [images, setImages] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setImages({});
    setError(null);
    setIsGenerating(true);

    const nextImages: Record<string, string> = {};
    try {
      for (const cardCase of CARD_CASES) {
        const blob = await generateMilestoneShareImage(cardCase.milestone, {
          firstName: cardCase.firstName,
        });
        if (generationRef.current !== generation) return;

        const dataUrl = await milestoneBlobToDataUrl(blob);
        if (generationRef.current !== generation) return;

        nextImages[cardCase.key] = dataUrl;
        setImages({ ...nextImages });
      }
    } catch {
      if (generationRef.current === generation) {
        setError("יצירת הכרטיסים נכשלה. נסו לרענן שוב.");
      }
    } finally {
      if (generationRef.current === generation) setIsGenerating(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      generationRef.current += 1;
    };
  }, [refresh]);

  return (
    <main dir="rtl" className="min-h-screen bg-[#0a0c09] px-6 py-10 text-white sm:px-10 lg:px-14">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-12 flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold text-[#c3f400]">THE WAY · מעבדת עיצוב</p>
            <h1 className="mt-2 text-3xl font-black">כרטיסי התקדמות</h1>
            <p className="mt-2 text-sm text-[#8e9379]">תצוגת אמת של מחולל ה־Canvas בכל המצבים.</p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isGenerating}
            className="rounded-xl bg-[#c3f400] px-6 py-3 text-sm font-bold text-[#161e00] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {isGenerating ? "מייצר..." : "רענן"}
          </button>
        </header>

        {error && (
          <p className="mb-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <section className="grid grid-cols-1 gap-10 sm:grid-cols-2 xl:grid-cols-3">
          {CARD_CASES.map((cardCase) => (
            <article key={cardCase.key} className="rounded-3xl border border-[#2e3030] bg-[#10140e] p-5">
              <h2 className="mb-4 text-sm font-bold text-[#c4c9ac]">{cardCase.label}</h2>
              {images[cardCase.key] ? (
                // Canvas previews are generated locally and cannot be optimized by next/image.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={images[cardCase.key]}
                  alt={`כרטיס ${cardCase.label}`}
                  className="aspect-[9/16] w-full rounded-xl border border-[#2e3030] object-cover"
                />
              ) : (
                <div className="aspect-[9/16] w-full animate-pulse rounded-xl border border-[#2e3030] bg-white/[0.05]" />
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
