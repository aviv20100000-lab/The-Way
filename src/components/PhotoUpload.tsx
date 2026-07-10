'use client';

import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import ScanProgress from '@/components/ScanProgress';

interface PhotoUploadProps {
  onFile: (file: File) => void;
  isLoading?: boolean;
  error?: string;
  captureLabel?: string;
}

export function PhotoUpload({ onFile, isLoading = false, error, captureLabel = "צלם ארוחה" }: PhotoUploadProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      onFile(file);
    }
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-4 py-8"
      >
        <style>{`
          @keyframes scanSpin { to { transform: rotate(360deg); } }
          .scan-spinner { animation: scanSpin 1.1s linear infinite; }
        `}</style>
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="scan-spinner absolute inset-0 w-full h-full" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="28" stroke="url(#scanGrad)" strokeWidth="3"
              strokeLinecap="round" strokeDasharray="88 176" />
            <defs>
              <linearGradient id="scanGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop stopColor="#c3f400" />
                <stop offset="1" stopColor="#c3f400" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c3f400"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
        <ScanProgress />
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <motion.button
        onClick={() => cameraInputRef.current?.click()}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.02, boxShadow: "0 0 36px rgba(195,244,0,0.28)" }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full rounded-2xl py-5 flex flex-col items-center gap-2.5 font-bold text-[#161e00] transition-all"
        style={{
          background: "linear-gradient(145deg, #c3f400 0%, #a8d600 100%)",
          boxShadow: "0 8px 24px rgba(195,244,0,0.18), inset 0 1px 0 rgba(255,255,255,0.28)",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        <span className="text-base">{captureLabel}</span>
      </motion.button>

      <motion.button
        onClick={() => galleryInputRef.current?.click()}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="w-full rounded-xl py-3 text-sm font-semibold transition-all"
        style={{
          background: "rgba(195,244,0,0.06)",
          border: "1px solid rgba(195,244,0,0.18)",
          color: "#c3f400",
        }}
      >
        בחר מגלריה
      </motion.button>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        className="hidden"
      />

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-xs text-red-400 pt-1"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
