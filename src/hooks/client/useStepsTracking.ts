import { useCallback, useRef, useState } from "react";
import { compressImageToJpeg } from "@/lib/image-compression";
import { getCsrfToken } from "@/lib/csrf-client";

interface LeaderboardEntry {
  id: string;
  name: string;
  today: number;
  week: number;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  hasCompetition: boolean;
  groupName: string | null;
}

export function useStepsTracking() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [hasCompetition, setHasCompetition] = useState(true);
  const [competitionGroupName, setCompetitionGroupName] = useState<string | null>(null);
  const [uploadingSteps, setUploadingSteps] = useState(false);
  const [stepsSuccess, setStepsSuccess] = useState("");
  const [stepsError, setStepsError] = useState("");
  const [lbView, setLbView] = useState<"today" | "week">("today");
  const [todaySteps, setTodaySteps] = useState(0);
  const [lbLoaded, setLbLoaded] = useState(false);
  const loadedRef = useRef(false);

  const loadLeaderboard = useCallback(async (force = false) => {
    if (loadedRef.current && !force) return;
    loadedRef.current = true;
    try {
      const stepsRes = await fetch("/api/health/steps?type=leaderboard");
      const stepsData = await stepsRes.json();
      if (Array.isArray(stepsData)) {
        setLeaderboard(stepsData);
        setHasCompetition(stepsData.length > 0);
        setCompetitionGroupName(null);
      } else {
        const data = stepsData as LeaderboardResponse;
        setLeaderboard(Array.isArray(data.entries) ? data.entries : []);
        setHasCompetition(data.hasCompetition !== false);
        setCompetitionGroupName(data.groupName ?? null);
      }
    } catch (e) {
      console.error("Error loading leaderboard:", e);
      loadedRef.current = false;
    } finally {
      setLbLoaded(true);
    }
  }, []);

  const uploadStepsScreenshot = useCallback(
    async (file: File) => {
      setUploadingSteps(true);
      setStepsSuccess("");
      setStepsError("");
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
          await loadLeaderboard(true);
        } else {
          setStepsError(data.error || "שגיאה בעדכון הצעדים");
        }
      } catch (e) {
        console.error("Error uploading steps:", e);
        setStepsError("שגיאה בעדכון הצעדים");
      } finally {
        setUploadingSteps(false);
      }
    },
    [loadLeaderboard]
  );

  return {
    leaderboard,
    hasCompetition,
    competitionGroupName,
    uploadingSteps,
    stepsSuccess,
    stepsError,
    lbView,
    todaySteps,
    lbLoaded,
    setLbView,
    loadLeaderboard,
    uploadStepsScreenshot,
  };
}
