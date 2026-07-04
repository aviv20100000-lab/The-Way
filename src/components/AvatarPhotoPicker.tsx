"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { withCsrf } from "@/lib/csrf-client";
import { compressImageToJpeg } from "@/lib/image-compression";

interface AvatarPhotoPickerProps {
  name: string;
  currentUrl?: string | null;
  targetUserId?: string;
  onUploaded?: (url: string) => void;
  compact?: boolean;
}

export default function AvatarPhotoPicker({ name, currentUrl, targetUserId, onUploaded, compact = false }: AvatarPhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(currentUrl ?? null);
  const [imageFailed, setImageFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setUrl(currentUrl ?? null);
    setImageFailed(false);
  }, [currentUrl]);

  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const compressed = await compressImageToJpeg(file, 500, 0.82);
      const formData = new FormData();
      formData.append("photo", compressed);
      if (targetUserId) formData.append("userId", targetUserId);
      const response = await fetch("/api/auth/avatar", {
        method: "POST",
        headers: await withCsrf(),
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "לא הצלחנו להעלות את התמונה");
      setUrl(data.url);
      setImageFailed(false);
      onUploaded?.(data.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "שגיאה בהעלאת התמונה");
    } finally {
      setUploading(false);
    }
  }

  const sizeClass = compact ? "h-11 w-11" : "h-20 w-20";
  return (
    <div className={compact ? "relative shrink-0" : "flex flex-col items-center gap-2"}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`relative ${sizeClass} overflow-hidden rounded-full border border-[#c3f400]/30 bg-[#282a2b] text-white shadow-[0_0_16px_rgba(195,244,0,0.08)] disabled:opacity-60`}
        aria-label={`שנה תמונת פרופיל של ${name}`}
        title="שנה תמונת פרופיל"
      >
        {url && !imageFailed ? (
          <Image src={url} alt={name} fill sizes={compact ? "44px" : "80px"} className="object-cover" onError={() => setImageFailed(true)} />
        ) : (
          <span className={compact ? "text-base font-bold" : "text-2xl font-bold"}>{name.slice(0, 1)}</span>
        )}
        <span className="absolute bottom-0 left-0 right-0 bg-black/65 py-0.5 text-[10px]">{uploading ? "…" : "📷"}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      {!compact && <span className="text-xs font-semibold text-[#c3f400]">שנה תמונת פרופיל</span>}
      {error && <p className={`${compact ? "absolute right-0 top-full z-10 mt-1 w-48 rounded-lg bg-[#2a1717] p-2 shadow-lg" : "text-center"} text-xs text-red-400`}>{error}</p>}
    </div>
  );
}
