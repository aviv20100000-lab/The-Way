import { useCallback, useState } from "react";

interface WeightLog {
  id: string;
  weight_kg: number;
  photo_url: string | null;
  logged_at: string;
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
      await fetch("/api/users/weight", { method: "POST", body: fd });
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
