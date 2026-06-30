"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhotoUpload } from "@/components/PhotoUpload";

interface AiItem {
  name: string;
  estimated_weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence?: number;
  needsManualEntry?: boolean;
}

interface FoodSuggestion {
  id: string;
  name_he: string;
  name_en: string | null;
  calories: number;
}
interface AiResult {
  items: AiItem[];
  total_calories: number;
  notes: string;
  photo_url: string;
}

interface MealScannerProps {
  analyzing: boolean;
  aiResult: AiResult | null;
  foodError: string;
  mealSaved: "idle" | "saving" | "saved" | "error";
  estimatingIndex: number | null;
  analyzeFood: (file: File) => void;
  logMeal: (items: { name: string; calories: number; estimated_weight_g: number }[], total: number) => void;
  resetAiResult: () => void;
  updateItemName: (index: number, name: string) => void;
  updateItemCalories: (index: number, calories: number) => void;
  updateItemGrams: (index: number, grams: number) => void;
  estimateItemNutrition: (index: number) => void;
  deleteItem: (index: number) => void;
  addItem: () => void;
}

/* Count-up number animation (rAF, ease-out cubic) */
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const end = value;
    const duration = 1100;
    const t0 = performance.now();
    cancelAnimationFrame(rafRef.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + (end - start) * ease));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else prev.current = end;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);
  return <span className={className}>{display.toLocaleString()}</span>;
}

export default function MealScanner(props: MealScannerProps) {
  const {
    analyzing, aiResult, foodError, mealSaved, estimatingIndex,
    analyzeFood, logMeal, resetAiResult,
    updateItemName, updateItemCalories, updateItemGrams,
    estimateItemNutrition, deleteItem, addItem,
  } = props;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, FoodSuggestion[]>>({});
  const [eggCounts, setEggCounts] = useState<Partial<Record<number, number>>>({});
  const [meatTypes, setMeatTypes] = useState<Partial<Record<number, string>>>({});
  const [dishTypes, setDishTypes] = useState<Partial<Record<number, string>>>({});
  const [saladDressing, setSaladDressing] = useState<Partial<Record<number, string>>>({});
  const [foodCategory, setFoodCategory] = useState<Partial<Record<number, string>>>({});

  const isOmelet = (name: string) =>
    /חביתה|ביצה מקושקשת|ביצת עין|ביצים מקושקשות/i.test(name);

  const isSalad = (name: string) =>
    /סלט/i.test(name);

  const isMeatDish = (name: string) =>
    /עוף|הודו|טלה|בקר|כבש|עגל|שווארמה|קבב|נקניקי|בשר|מנגל|גריל|כבד|לב|פרגית/i.test(name) &&
    !/^(אורז|פסטה|קוסקוס|פיתה|לחם|תפוח|סלט|מרק)/i.test(name.trim());

  const needsMeatClarification = (name: string) =>
    /שווארמה|קבב|נקניקי|בשר|מנגל|גריל|כבד|לב|פרגית/i.test(name) &&
    !/עוף|הודו|טלה|בקר|כבש|עגל/i.test(name) &&
    !/^(אורז|פסטה|קוסקוס|פיתה|לחם|בורגר|תפוח|סלט|מרק)/i.test(name.trim());

  const DISH_TYPES = [
    { label: "שווארמה", emoji: "🌯" },
    { label: "קבב",     emoji: "🍢" },
    { label: "צלוי",    emoji: "🔥" },
    { label: "מבושל",   emoji: "🍲" },
    { label: "מטוגן",   emoji: "🍳" },
    { label: "טחון",    emoji: "🥩" },
  ];

  const handleDishType = useCallback((index: number, dish: string, currentName: string) => {
    setDishTypes(prev => ({ ...prev, [index]: dish }));
    // Extract meat type if present, build clean name
    const meatMatch = currentName.match(/עוף|הודו|טלה|בקר|כבש|עגל|מיקס/i);
    const newName = meatMatch ? `${dish} ${meatMatch[0]}` : dish;
    updateItemName(index, newName);
    setTimeout(() => estimateItemNutrition(index), 200);
  }, [updateItemName, estimateItemNutrition]);

  const handleEggCount = useCallback((index: number, count: number) => {
    setEggCounts(prev => ({ ...prev, [index]: count }));
    updateItemGrams(index, count * 55);
    updateItemCalories(index, count * 80);
  }, [updateItemGrams, updateItemCalories]);

  const handleMeatType = useCallback((index: number, meat: string, currentName: string) => {
    setMeatTypes(prev => ({ ...prev, [index]: meat }));
    // Extract the dish keyword (שווארמה / קבב / בשר etc.) and build a clean name
    const dishMatch = currentName.match(/שווארמה|קבב|נקניקי|מנגל|גריל|כבד|לב|פרגית|בשר/i);
    const dish = dishMatch ? dishMatch[0] : "בשר";
    updateItemName(index, `${dish} ${meat}`);
  }, [updateItemName]);

  const handleSaladDressing = useCallback((index: number, choice: string, currentCals: number) => {
    setSaladDressing(prev => ({ ...prev, [index]: choice }));
    const extra = choice === "שמן זית" ? 90 : choice === "רוטב" ? 80 : choice === "שניהם" ? 160 : 0;
    updateItemCalories(index, Math.max(currentCals, 1) + extra);
  }, [updateItemCalories]);

  const FOOD_CATEGORIES = [
    { label: "דג",      emoji: "🐟" },
    { label: "עוף",     emoji: "🍗" },
    { label: "בשר",     emoji: "🥩" },
    { label: "ביצה",    emoji: "🥚" },
    { label: "ירק",     emoji: "🥦" },
    { label: "חלבי",    emoji: "🧀" },
    { label: "פחמימה",  emoji: "🍚" },
    { label: "אחר",     emoji: "❓" },
  ];

  const handleFoodCategory = useCallback((index: number, label: string) => {
    setFoodCategory(prev => ({ ...prev, [index]: label }));
    updateItemName(index, label);
    setTimeout(() => estimateItemNutrition(index), 200);
  }, [updateItemName, estimateItemNutrition]);
  const blurTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const fetchSuggestions = useCallback(async (index: number, query: string) => {
    if (query.length < 2) { setSuggestions(s => ({ ...s, [index]: [] })); return; }
    try {
      const res = await fetch(`/api/foods?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSuggestions(s => ({ ...s, [index]: Array.isArray(data) ? data.slice(0, 5) : [] }));
    } catch { setSuggestions(s => ({ ...s, [index]: [] })); }
  }, []);

  const applySuggestion = useCallback((index: number, food: FoodSuggestion, currentGrams: number) => {
    clearTimeout(blurTimers.current[index]); // cancel pending blur-close
    updateItemName(index, food.name_he || food.name_en || "");
    const cals = food.calories > 0 ? Math.max(1, Math.round((food.calories / 100) * currentGrams)) : 1;
    updateItemCalories(index, cals);
    setSuggestions(s => ({ ...s, [index]: [] }));
  }, [updateItemName, updateItemCalories]);
  // The camera never auto-starts. "armed" flips to true only when the user
  // explicitly taps to open it, so entering the home tab shows a calm CTA.
  const [armed, setArmed] = useState(false);
  // "starting" = requesting access ; "live" = streaming ; "fallback" = no camera
  const [camera, setCamera] = useState<"starting" | "live" | "fallback">("starting");

  const phase: "live" | "scanning" | "result" =
    aiResult ? "result" : (analyzing || capturedUrl) ? "scanning" : "live";

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Start / stop the camera — only once the user has armed it.
  useEffect(() => {
    let cancelled = false;
    if (phase !== "live" || !armed) {
      stopStream();
      return;
    }
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setCamera("fallback");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCamera("live");
      } catch {
        if (!cancelled) setCamera("fallback");
      }
    };
    start();
    return () => { cancelled = true; stopStream(); };
  }, [phase, armed, stopStream]);

  const handleArm = useCallback(() => {
    try { navigator.vibrate?.(10); } catch {}
    setCamera("starting");
    setArmed(true);
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    try { navigator.vibrate?.(15); } catch {}
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedUrl(canvas.toDataURL("image/jpeg", 0.9));
    stopStream();
    canvas.toBlob((blob) => {
      if (blob) analyzeFood(new File([blob], "meal.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }, [analyzeFood, stopStream]);

  const handleFallbackFile = useCallback((file: File) => {
    try { navigator.vibrate?.(15); } catch {}
    setCapturedUrl(URL.createObjectURL(file));
    analyzeFood(file);
  }, [analyzeFood]);

  const handleRetake = useCallback(() => {
    setCapturedUrl(null);
    setArmed(false);
    setCamera("starting");
    setEggCounts({});
    setMeatTypes({});
    setDishTypes({});
    setSaladDressing({});
    setFoodCategory({});
    resetAiResult();
  }, [resetAiResult]);

  // Macro totals (real data already returned by the API)
  const macros = (aiResult?.items ?? []).reduce(
    (a, it) => ({
      p: a.p + (it.protein_g || 0),
      c: a.c + (it.carbs_g || 0),
      f: a.f + (it.fat_g || 0),
    }),
    { p: 0, c: 0, f: 0 }
  );
  const macroMax = Math.max(macros.p, macros.c, macros.f, 1);
  const total = (aiResult?.items ?? []).reduce((s, it) => s + (it.calories || 0), 0);

  return (
    <div
      className="relative rounded-3xl overflow-hidden"
      style={{
        background: "linear-gradient(165deg, #141812 0%, #0e110d 100%)",
        border: "1px solid rgba(195,244,0,0.14)",
        boxShadow: "0 24px 64px -28px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <style>{`
        @keyframes scanSweep { 0%{top:0%;opacity:0} 5%{opacity:1} 90%{opacity:1} 100%{top:100%;opacity:0} }
        @keyframes hudPulse { 0%,100%{opacity:.45} 50%{opacity:1} }
        @keyframes gridDrift { from{background-position:0 0} to{background-position:26px 26px} }
        .ms-scanline{position:absolute;left:0;right:0;height:2px;top:0;
          background:linear-gradient(90deg,transparent,#c3f400,transparent);
          box-shadow:0 0 14px 2px rgba(195,244,0,.55);animation:scanSweep 2s linear infinite}
        .ms-grid{background-image:linear-gradient(rgba(195,244,0,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(195,244,0,.06) 1px,transparent 1px);
          background-size:26px 26px;animation:gridDrift 6s linear infinite}
        .ms-corner{position:absolute;width:26px;height:26px;border-color:#c3f400;opacity:.9}
      `}</style>

      {/* ===== HEADER ===== */}
      {phase !== "result" && (
        <div className="px-5 pt-5 pb-1 flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-white">סורק הארוחות</p>
            <p className="text-xs text-[#8e9379] mt-0.5">כוון, צלם, וה-AI יחשב הכל</p>
          </div>
          <div className="flex items-center gap-1.5" style={{ animation: "hudPulse 2s ease-in-out infinite" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#c3f400", boxShadow: "0 0 8px #c3f400" }} />
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#c3f400]">
              {phase === "scanning" ? "מנתח" : "מוכן"}
            </span>
          </div>
        </div>
      )}

      {/* ===== VIEWFINDER / PHOTO STAGE ===== */}
      {phase !== "result" && (
        <div className="px-5 pt-3">
          <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "4 / 3" }}>
            {/* live video — only mounted once the user arms the camera */}
            {phase === "live" && armed && (
              <video ref={videoRef} playsInline muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ display: camera === "live" ? "block" : "none" }} />
            )}
            {/* captured frame while scanning */}
            {phase === "scanning" && capturedUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={capturedUrl} alt="ארוחה" className="absolute inset-0 w-full h-full object-cover" />
            )}

            {/* Idle poster — calm CTA, camera NOT running */}
            {phase === "live" && !armed && camera !== "fallback" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                <div className="ms-grid pointer-events-none absolute inset-0 opacity-25" />
                <div className="ms-corner top-3 left-3" style={{ borderTop: "2px solid", borderLeft: "2px solid", borderTopLeftRadius: 8, opacity: 0.5 }} />
                <div className="ms-corner top-3 right-3" style={{ borderTop: "2px solid", borderRight: "2px solid", borderTopRightRadius: 8, opacity: 0.5 }} />
                <div className="ms-corner bottom-3 left-3" style={{ borderBottom: "2px solid", borderLeft: "2px solid", borderBottomLeftRadius: 8, opacity: 0.5 }} />
                <div className="ms-corner bottom-3 right-3" style={{ borderBottom: "2px solid", borderRight: "2px solid", borderBottomRightRadius: 8, opacity: 0.5 }} />
                <span className="relative text-4xl">🍽️</span>
                <p className="relative text-sm font-semibold text-white">מוכן לסרוק את הארוחה</p>
                <p className="relative text-xs text-[#8e9379]">לחץ על הכפתור כשתרצה</p>
              </div>
            )}

            {/* HUD overlay */}
            {(camera === "live" || phase === "scanning") && (
              <>
                <div className="ms-grid pointer-events-none absolute inset-0 opacity-60" />
                <div className="ms-corner top-3 left-3" style={{ borderTop: "2px solid", borderLeft: "2px solid", borderTopLeftRadius: 8 }} />
                <div className="ms-corner top-3 right-3" style={{ borderTop: "2px solid", borderRight: "2px solid", borderTopRightRadius: 8 }} />
                <div className="ms-corner bottom-3 left-3" style={{ borderBottom: "2px solid", borderLeft: "2px solid", borderBottomLeftRadius: 8 }} />
                <div className="ms-corner bottom-3 right-3" style={{ borderBottom: "2px solid", borderRight: "2px solid", borderBottomRightRadius: 8 }} />
                <div className="ms-scanline" style={{ top: 0 }} />
                {phase === "scanning" && (
                  <div className="absolute inset-x-0 bottom-0 p-3 text-center"
                    style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.7), transparent)" }}>
                    <span className="text-xs font-bold tracking-widest text-[#c3f400]">מנתח את הארוחה…</span>
                  </div>
                )}
              </>
            )}

            {/* fallback notice inside stage */}
            {phase === "live" && camera === "fallback" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                <span className="text-3xl">🍽️</span>
                <p className="text-sm font-semibold text-white">בחר תמונה של הארוחה</p>
                <p className="text-xs text-[#8e9379]">המצלמה החיה זמינה במכשיר נייד</p>
              </div>
            )}
            {phase === "live" && armed && camera === "starting" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-[#8e9379]">מפעיל מצלמה…</span>
              </div>
            )}
          </div>

          {/* controls */}
          <div className="py-5">
            {/* idle — primary CTA opens the camera on demand */}
            {phase === "live" && !armed && camera !== "fallback" && (
              <div className="space-y-3">
                <motion.button
                  onClick={handleArm}
                  whileHover={{ scale: 1.02, boxShadow: "0 0 36px rgba(195,244,0,0.28)" }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full rounded-2xl py-4 flex items-center justify-center gap-2.5 font-bold text-[#161e00] transition-all"
                  style={{ background: "linear-gradient(145deg, #c3f400 0%, #a8d600 100%)", boxShadow: "0 8px 24px rgba(195,244,0,0.18), inset 0 1px 0 rgba(255,255,255,0.28)" }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span className="text-base">פתח מצלמה</span>
                </motion.button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all"
                  style={{ background: "rgba(195,244,0,0.06)", border: "1px solid rgba(195,244,0,0.18)", color: "#c3f400" }}
                >
                  בחר מהגלריה
                </button>
              </div>
            )}
            {/* live — shutter */}
            {phase === "live" && armed && camera === "live" && (
              <div className="flex justify-center">
                <motion.button
                  onClick={handleCapture}
                  whileTap={{ scale: 0.9 }}
                  aria-label="צלם ארוחה"
                  className="relative rounded-full flex items-center justify-center"
                  style={{ width: 72, height: 72, background: "rgba(195,244,0,0.08)", border: "2px solid rgba(195,244,0,0.4)" }}
                >
                  <span className="rounded-full" style={{ width: 52, height: 52, background: "linear-gradient(145deg,#c3f400,#a8d600)", boxShadow: "0 0 28px rgba(195,244,0,0.55)" }} />
                </motion.button>
              </div>
            )}
            {/* no camera available — file buttons */}
            {phase === "live" && camera === "fallback" && (
              <PhotoUpload onFile={handleFallbackFile} error={foodError} />
            )}
            {phase === "scanning" && (
              <p className="text-center text-xs text-[#8e9379]">רק כמה שניות…</p>
            )}
          </div>

          {/* hidden gallery input for the idle "בחר מהגלריה" shortcut */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFallbackFile(f); }}
          />
        </div>
      )}

      {/* ===== RESULT ===== */}
      <AnimatePresence>
        {phase === "result" && aiResult && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-5 space-y-5"
          >
            {capturedUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: "4 / 3" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capturedUrl} alt="ארוחה" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(14,17,13,0.85), transparent 55%)" }} />
                <div className="absolute bottom-0 inset-x-0 p-4 flex items-end justify-between">
                  <div>
                    <AnimatedNumber value={total} className="text-5xl font-black text-[#c3f400] leading-none" />
                    <span className="text-sm text-[#c4c9ac] mr-1">קלוריות</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Macro breakdown */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "חלבון", val: macros.p, color: "#c3f400" },
                { label: "פחמימה", val: macros.c, color: "#38bdf8" },
                { label: "שומן", val: macros.f, color: "#a78bfa" },
              ].map((m, idx) => (
                <div key={m.label} className="glass-card rounded-xl p-3 text-center">
                  <p className="text-lg font-black leading-none" style={{ color: m.color }}>
                    {Math.round(m.val)}<span className="text-[10px] font-normal text-[#8e9379]"> ג'</span>
                  </p>
                  <p className="text-[10px] text-[#8e9379] mt-1 mb-2">{m.label}</p>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <motion.div className="h-full rounded-full"
                      style={{ background: m.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(m.val / macroMax) * 100}%` }}
                      transition={{ delay: 0.3 + idx * 0.08, duration: 0.8, ease: "easeOut" }} />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-[#8e9379] text-center">
              זיהה לא נכון? תקן את השם — הקלוריות יתעדכנו אוטומטית 🔄
            </p>

            {/* Items */}
            <div className="space-y-3">
              {aiResult.items.map((item, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="rounded-xl bg-[#1b1f17] border border-[#33391f] px-4 py-3 space-y-3"
                >
                  {/* Meat type question */}
                  {isMeatDish(item.name) && meatTypes[i] === undefined && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[#c4c9ac] font-semibold">איזה בשר?</span>
                      {["עוף", "הודו", "עגל", "טלה", "בקר", "מיקס"].map((meat) => (
                        <button key={meat} onClick={() => handleMeatType(i, meat, item.name)}
                          className="h-8 px-3 rounded-lg border border-[#444933] bg-[#11140e] text-sm font-bold text-[#c4c9ac] hover:border-[#c3f400] hover:text-[#c3f400] transition-colors">
                          {meat}
                        </button>
                      ))}
                    </div>
                  )}
                  {meatTypes[i] !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#c3f400] font-semibold">✓ {meatTypes[i]}</span>
                      <button onClick={() => setMeatTypes(prev => { const n = { ...prev }; delete n[i]; return n; })}
                        className="text-[10px] text-[#8e9379] underline hover:text-[#c3f400]">שנה</button>
                    </div>
                  )}
                  {/* Dish type question — for all meat items */}
                  {isMeatDish(item.name) && dishTypes[i] === undefined && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[#c4c9ac] font-semibold">אופן הכנה?</span>
                      {DISH_TYPES.map(({ label, emoji }) => (
                        <button key={label} onClick={() => handleDishType(i, label, item.name)}
                          className="h-8 px-3 rounded-lg border border-[#444933] bg-[#11140e] text-sm font-bold text-[#c4c9ac] hover:border-[#c3f400] hover:text-[#c3f400] transition-colors flex items-center gap-1">
                          <span>{emoji}</span><span>{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {isMeatDish(item.name) && dishTypes[i] !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#c3f400] font-semibold">✓ {dishTypes[i]}</span>
                      <button onClick={() => setDishTypes(prev => { const n = { ...prev }; delete n[i]; return n; })}
                        className="text-[10px] text-[#8e9379] underline hover:text-[#c3f400]">שנה</button>
                    </div>
                  )}
                  {/* Salad dressing question */}
                  {isSalad(item.name) && saladDressing[i] === undefined && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[#c4c9ac] font-semibold">יש שמן/רוטב?</span>
                      {["שמן זית", "רוטב", "שניהם", "בלי"].map((choice) => (
                        <button key={choice} onClick={() => handleSaladDressing(i, choice, item.calories)}
                          className="h-8 px-3 rounded-lg border border-[#444933] bg-[#11140e] text-sm font-bold text-[#c4c9ac] hover:border-[#c3f400] hover:text-[#c3f400] transition-colors">
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}
                  {isSalad(item.name) && saladDressing[i] !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#c3f400] font-semibold">✓ {saladDressing[i]}</span>
                      <button onClick={() => setSaladDressing(prev => { const n = { ...prev }; delete n[i]; return n; })}
                        className="text-[10px] text-[#8e9379] underline hover:text-[#c3f400]">שנה</button>
                    </div>
                  )}
                  {/* Egg count question */}
                  {isOmelet(item.name) && eggCounts[i] === undefined && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[#c4c9ac] font-semibold">מכמה ביצים?</span>
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          key={n}
                          onClick={() => handleEggCount(i, n)}
                          className="h-8 w-8 rounded-lg border border-[#444933] bg-[#11140e] text-sm font-bold text-[#c4c9ac] hover:border-[#c3f400] hover:text-[#c3f400] transition-colors"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                  {isOmelet(item.name) && eggCounts[i] !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#8e9379]">
                        חביתה {eggCounts[i]} ביצ{eggCounts[i] === 1 ? "ה" : "ים"}
                      </span>
                      <button
                        onClick={() => setEggCounts(prev => { const n = { ...prev }; delete n[i]; return n; })}
                        className="text-[10px] text-[#8e9379] underline hover:text-[#c3f400]"
                      >
                        שנה
                      </button>
                    </div>
                  )}
                  {/* Food category picker for low-confidence items */}
                  {item.needsManualEntry && foodCategory[i] === undefined && (
                    <div className="rounded-2xl p-3 space-y-2.5"
                      style={{ background: "rgba(195,244,0,0.04)", border: "1px solid rgba(195,244,0,0.15)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black tracking-widest uppercase text-[#c3f400]">לא זוהה</span>
                        <div className="flex-1 h-px" style={{ background: "rgba(195,244,0,0.15)" }} />
                        <span className="text-[10px] text-[#8e9379]">בחר קטגוריה</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {FOOD_CATEGORIES.map(({ label, emoji }) => (
                          <button
                            key={label}
                            onClick={() => handleFoodCategory(i, label)}
                            className="flex flex-col items-center gap-1.5 rounded-xl py-3 transition-all active:scale-95"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(195,244,0,0.12)" }}
                            onMouseEnter={e => (e.currentTarget.style.border = "1px solid rgba(195,244,0,0.5)")}
                            onMouseLeave={e => (e.currentTarget.style.border = "1px solid rgba(195,244,0,0.12)")}
                          >
                            <span className="text-2xl leading-none">{emoji}</span>
                            <span className="text-[10px] font-bold text-[#c4c9ac]">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.needsManualEntry && foodCategory[i] !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#c3f400] font-semibold">
                        {FOOD_CATEGORIES.find(c => c.label === foodCategory[i])?.emoji} {foodCategory[i]} — מחשב קלוריות...
                      </span>
                      <button
                        onClick={() => setFoodCategory(prev => { const n = { ...prev }; delete n[i]; return n; })}
                        className="text-[10px] text-[#8e9379] underline hover:text-[#c3f400]"
                      >
                        שנה
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text" value={item.name}
                        onChange={(e) => {
                          updateItemName(i, e.target.value);
                          fetchSuggestions(i, e.target.value);
                        }}
                        onBlur={() => { blurTimers.current[i] = setTimeout(() => setSuggestions(s => ({ ...s, [i]: [] })), 150); }}
                        placeholder="שם המאכל"
                        className="w-full rounded-lg border border-[#444933] bg-[#11140e] px-3 py-2 font-medium text-white focus:ring-2 focus:ring-[#c3f400]/30 focus:border-[#c3f400] transition-all"
                      />
                      {(suggestions[i]?.length > 0) && (
                        <div className="absolute top-full right-0 left-0 z-20 mt-1 rounded-lg border border-[#444933] bg-[#1b1f17] shadow-xl overflow-hidden">
                          {suggestions[i].map((food) => (
                            <button
                              key={food.id}
                              onMouseDown={() => applySuggestion(i, food, item.estimated_weight_g)}
                              className="flex w-full items-center justify-between px-3 py-2.5 text-right text-sm hover:bg-[#c3f400]/10 transition-colors"
                            >
                              <span className="text-white">{food.name_he || food.name_en}</span>
                              <span className="text-[#8e9379] text-xs mr-2">{food.calories} קל׳/100ג׳</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => estimateItemNutrition(i)}
                      disabled={estimatingIndex === i || !item.name.trim()}
                      title="זהה קלוריות עם AI" aria-label="זהה קלוריות עם AI"
                      className="h-9 w-9 shrink-0 rounded-lg bg-[#c3f400]/10 border border-[#c3f400]/30 text-lg text-[#c3f400] hover:bg-[#c3f400]/20 disabled:opacity-40 transition-colors">
                      {estimatingIndex === i ? "⏳" : "🤖"}
                    </button>
                    <button onClick={() => deleteItem(i)}
                      title="מחק פריט" aria-label="מחק פריט"
                      className="h-9 w-9 shrink-0 rounded-lg bg-red-500/10 border border-red-500/20 text-lg text-red-400 hover:bg-red-500/20 transition-colors">
                      🗑️
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {/* dark gram stepper */}
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateItemGrams(i, Math.max(5, item.estimated_weight_g - 10))}
                        aria-label="הפחת 10 גרם"
                        className="h-9 w-9 rounded-lg bg-[#11140e] border border-[#444933] text-lg font-bold text-[#c4c9ac] hover:border-[#c3f400] transition-colors">−</button>
                      <input type="number" value={item.estimated_weight_g} min={5}
                        onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 5) updateItemGrams(i, v); }}
                        className="h-9 w-16 rounded-lg border border-[#444933] bg-[#11140e] text-center font-semibold text-white focus:ring-2 focus:ring-[#c3f400]/30 transition-all" />
                      <button onClick={() => updateItemGrams(i, item.estimated_weight_g + 10)}
                        aria-label="הוסף 10 גרם"
                        className="h-9 w-9 rounded-lg bg-[#11140e] border border-[#444933] text-lg font-bold text-[#c4c9ac] hover:border-[#c3f400] transition-colors">+</button>
                      <span className="text-xs text-[#8e9379]">גרם</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input type="number" value={item.calories} min={0}
                        onChange={(e) => updateItemCalories(i, parseInt(e.target.value, 10) || 0)}
                        className="h-9 w-20 rounded-lg border border-[#444933] bg-[#11140e] text-center font-bold text-[#c3f400] focus:ring-2 focus:ring-[#c3f400]/30 transition-all" />
                      <span className="text-sm font-semibold text-[#c3f400]">קל'</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <button onClick={addItem}
              className="w-full rounded-xl border border-dashed border-[#444933] py-2.5 text-sm font-semibold text-[#c4c9ac] hover:border-[#c3f400] hover:text-[#c3f400] transition-all">
              ➕ הוסף פריט
            </button>

            {mealSaved === "saved" ? (
              <div className="rounded-full bg-[#c3f400]/10 border border-[#c3f400]/30 py-3 text-center font-semibold text-[#c3f400]">✅ נשמר!</div>
            ) : (
              <motion.button
                onClick={() => logMeal(aiResult.items.map((it) => ({ name: it.name, calories: it.calories, estimated_weight_g: it.estimated_weight_g })), total)}
                disabled={mealSaved === "saving" || aiResult.items.length === 0}
                whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
                className="w-full rounded-full bg-[#c3f400] py-3 font-bold text-[#161e00] disabled:opacity-50 transition-all">
                {mealSaved === "saving" ? "שומר..." : "✅ שמור ארוחה"}
              </motion.button>
            )}
            {mealSaved === "error" && <p className="text-center text-sm text-red-400">שמירה נכשלה, נסה שוב</p>}

            <button onClick={handleRetake}
              className="w-full rounded-full glass-card border border-[#444933] py-3 font-semibold text-[#c4c9ac] hover:border-[#c3f400] transition-colors">
              צלם עוד
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
