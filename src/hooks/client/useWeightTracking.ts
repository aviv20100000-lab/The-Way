import { useCallback, useState } from "react";

interface WeightLog {
  id: string;
  weight_kg: number;
  photo_url: string | null;
  logged_at: string;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

export function useWeightTracking() {
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightTarget, setWeightTarget] = useState<number | null>(null);
  const [newWeight, setNewWeight] = useState("");
  const [weightPhoto, setWeightPhoto] = useState<File | null>(null);
  const [savingWeight, setSavingWeight] = useState(false);

  const loadWeight = useCallback(async () => {
    try {
      const res = await fetch("/api/users/weight");
      const data = await res.json();
      setWeightLogs(data.logs ?? []);
      setWeightTarget(data.target ?? null);
    } catch (e) {
      console.error("Error loading weight:", e);
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
      const csrfToken = getCookie("csrf-token");
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
    setNewWeight,
    setWeightPhoto,
    loadWeight,
    saveWeight,
  };
}
