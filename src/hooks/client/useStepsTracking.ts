import { useCallback, useState } from "react";

interface LeaderboardEntry {
  id: string;
  name: string;
  today: number;
  week: number;
}

export function useStepsTracking() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [uploadingSteps, setUploadingSteps] = useState(false);
  const [stepsSuccess, setStepsSuccess] = useState("");
  const [lbView, setLbView] = useState<"today" | "week">("today");
  const [todaySteps, setTodaySteps] = useState(0);

  const compressToJpeg = useCallback((file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height / width) * MAX);
            width = MAX;
          } else {
            width = Math.round((width / height) * MAX);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], "screenshot.jpg", { type: "image/jpeg" }) : file),
          "image/jpeg",
          0.82
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/health/steps?type=leaderboard");
      const data = await res.json();
      setLeaderboard(data);
    } catch (e) {
      console.error("Error loading leaderboard:", e);
    }
  }, []);

  const uploadStepsScreenshot = useCallback(
    async (file: File) => {
      setUploadingSteps(true);
      setStepsSuccess("");
      try {
        const jpeg = await compressToJpeg(file);
        const fd = new FormData();
        fd.append("screenshot", jpeg);
        const res = await fetch("/api/health/steps", { method: "POST", body: fd });
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
    [compressToJpeg, loadLeaderboard]
  );

  return {
    leaderboard,
    uploadingSteps,
    stepsSuccess,
    lbView,
    todaySteps,
    setLbView,
    loadLeaderboard,
    uploadStepsScreenshot,
  };
}
