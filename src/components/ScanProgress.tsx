"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const STAGES = [
  "מעלה את התמונה",
  "מזהה מה יש בצלחת",
  "מצליב מול מאגר משרד הבריאות",
] as const;

export default function ScanProgress() {
  const prefersReducedMotion = useReducedMotion();
  const [activeStage, setActiveStage] = useState(0);
  const [longWait, setLongWait] = useState(false);

  useEffect(() => {
    const stageTwoTimeout = window.setTimeout(() => setActiveStage(1), 2500);
    const stageThreeTimeout = window.setTimeout(() => setActiveStage(2), 9000);
    const longWaitTimeout = window.setTimeout(() => setLongWait(true), 15000);

    return () => {
      window.clearTimeout(stageTwoTimeout);
      window.clearTimeout(stageThreeTimeout);
      window.clearTimeout(longWaitTimeout);
    };
  }, []);

  return (
    <div className="w-full space-y-2.5 text-right" dir="rtl" aria-live="polite">
      {STAGES.map((label, index) => {
        const done = index < activeStage;
        const active = index === activeStage;

        return (
          <div key={label} className="flex items-start gap-2.5">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
              done
                ? "border-[#c3f400]/30 bg-[#c3f400]/10 text-[#c3f400]"
                : active
                  ? "border-[#c3f400]/30 bg-[#c3f400]/10"
                  : "border-[#444933]"
            }`}>
              {done ? (
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="m5 12 4 4L19 6" />
                </svg>
              ) : active ? (
                <motion.span
                  className="h-2 w-2 rounded-full bg-[#c3f400]"
                  animate={prefersReducedMotion ? undefined : { opacity: [0.45, 1, 0.45], scale: [0.85, 1, 0.85] }}
                  transition={prefersReducedMotion ? undefined : { duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : (
                <span className="h-2 w-2 rounded-full border border-[#8e9379]" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className={`text-xs leading-5 ${
                done ? "text-[#c4c9ac]" : active ? "font-bold text-white" : "text-[#8e9379]"
              }`}>
                {label}
              </p>
              {active && index === 2 && (
                <p className="text-[11px] leading-4 text-[#8e9379]">
                  {longWait ? "עוד רגע…" : "מוודא שהנתונים מדויקים"}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
