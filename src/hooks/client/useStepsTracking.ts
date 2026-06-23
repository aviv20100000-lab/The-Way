import { useCallback, useState } from "react";
import { compressImageToJpeg } from "@/lib/image-compression";
import { getCsrfToken } from "@/lib/csrf-client";

interface LeaderboardEntry {
  id: string;
  name: string;
  today: number;
  week: number;
}

export function useStepsTracking() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [foodLeaderboard, setFoodLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [uploadingSteps, setUploadingSteps] = useState(false);
  const [stepsSuccess, setStepsSuccess] = useState("");
  const [lbView, setLbView] = useState<"today" | "week">("today");
  const [compType, setCompType] = useState<"steps" | "food">("steps");
  const [todaySteps, setTodaySteps] = useState(0);

  const loadLeaderboard = useCallback(async () => {
    try {
      const [stepsRes, foodRes] = await Promise.all([
        fetch("/api/health/steps?type=leaderboard"),
        fetch("/api/health/leaderboard?type=food"),
      ]);
      const stepsData = await stepsRes.json();
      const foodData = await foodRes.json();
      setLeaderboard(stepsData);
      setFoodLeaderboard(foodData);
    } catch (e) {
      console.error("Error loading leaderboard:", e);
    }
  }, []);

  const uploadStepsScreenshot = useCallback(
    async (file: File) => {
      setUploadingSteps(true);
      setStepsSuccess("");
      try {
        const jpeg = await compressImageToJpeg(file);
        const fd = new FormData();
        fd.append("screenshot", jpeg);
        const headers: HeadersInit = {};
        const csrfToken = await getCsrfToken();
        if (csrfToken) headers["x-csrf-token"] = csrfToken;
        const res = await fetch("/api/health/steps", { method: "POST", body: fd, headers });
        const data = await res.json();
        if (res.ok) {
          setTodaySteps(data.steps);
          setStepsSuccess(`זוהו ${data.steps.toLocaleString()} צעדים!`);
          await loadLeaderboard();
        }
      } catch (e) {
        console.error("Error uploading steps:", e);
      } finally {
        setUploadingSteps(false);
      }
    },
    [loadLeaderboard]
  );

  return {
    leaderboard,
    foodLeaderboard,
    uploadingSteps,
    stepsSuccess,
    lbView,
    compType,
    todaySteps,
    setLbView,
    setCompType,
    loadLeaderboard,
    uploadStepsScreenshot,
  };
}
