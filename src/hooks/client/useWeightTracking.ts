import { useCallback, useState } from "react";
import { getCsrfToken } from "@/lib/csrf-client";

interface WeightLog {
  id: string;
  weight_kg: number;
  photo_url: string | null;
  logged_at: string;
}

const CACHE_KEY = "way_weight_data";

type WeightCache = {
  logs: WeightLog[];
  target: number | null;
};

function readCache(): WeightCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as WeightCache) : null;
  } catch {
    return null;
  }
}

function writeCache(data: WeightCache) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

export function useWeightTracking() {
  const cached = readCache();
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>(cached?.logs ?? []);
  const [weightTarget, setWeightTarget] = useState<number | null>(cached?.target ?? null);
  const [newWeight, setNewWeight] = useState("");
  const [weightPhoto, setWeightPhoto] = useState<File | null>(null);
  const [savingWeight, setSavingWeight] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadWeight = useCallback(async () => {
    try {
      const res = await fetch("/api/users/weight");
      const data = await res.json();
      setWeightLogs(data.logs ?? []);
      setWeightTarget(data.target ?? null);
      writeCache({ logs: data.logs ?? [], target: data.target ?? null });
    } catch (e) {
      console.error("Error loading weight:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveWeight = useCallback(async () => {
    const w = parseFloat(newWeight);
    if (!w || w < 20) return;
    setSavingWeight(true);
    try {
      const fd = new FormData();
      fd.append("weight", String(w));
      if (weightPhoto) fd.append("photo", weightPhoto);

      const headers: HeadersInit = {};
      const csrfToken = await getCsrfToken();
      if (csrfToken) {
        headers["x-csrf-token"] = csrfToken;
      }

      const res = await fetch("/api/users/weight", {
        method: "POST",
        body: fd,
        headers,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "שגיאה בשמירת משקל");
      }

      setNewWeight("");
      setWeightPhoto(null);
      await loadWeight();
    } catch (e) {
      console.error("Error saving weight:", e);
    } finally {
      setSavingWeight(false);
    }
  }, [newWeight, weightPhoto, loadWeight]);

  return {
    weightLogs,
    weightTarget,
    newWeight,
    weightPhoto,
    savingWeight,
    isLoaded,
    setNewWeight,
    setWeightPhoto,
    loadWeight,
    saveWeight,
  };
}
