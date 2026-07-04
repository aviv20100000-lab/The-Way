"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface SuccessToastProps {
  message: string | null;
  onDismiss: () => void;
}

export default function SuccessToast({ message, onDismiss }: SuccessToastProps) {
  const prefersReducedMotion = useReducedMotion();
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message) return;
    try { navigator.vibrate?.(15); } catch {}
    const timeout = window.setTimeout(() => onDismissRef.current(), 2500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
      <AnimatePresence>
        {message && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            role="status"
            className="flex items-center gap-2 rounded-2xl border border-[#c3f400]/20 bg-[#c3f400]/5 px-4 py-3 shadow-xl backdrop-blur-xl"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c3f400]/15 text-[#c3f400]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="m5 12 4 4L19 6" />
              </svg>
            </span>
            <span className="text-sm font-semibold text-[#c3f400]">{message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
