"use client";

import { useState } from "react";
import { withCsrf } from "@/lib/csrf-client";
import { compressImageToJpeg } from "@/lib/image-compression";

interface GroupClient {
  id: string;
  name: string;
}

interface ChatGroupCreatorProps {
  clients: GroupClient[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export default function ChatGroupCreator({ clients, onClose, onSaved }: ChatGroupCreatorProps) {
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoWarning, setPhotoWarning] = useState("");

  function toggleMember(clientId: string) {
    setMemberIds((current) => current.includes(clientId)
      ? current.filter((id) => id !== clientId)
      : [...current, clientId]);
  }

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/coach/chat-groups", {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name: trimmedName, memberIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "לא הצלחנו ליצור את הקבוצה");

      let uploadWarning = "";
      if (photo) {
        try {
          const compressed = await compressImageToJpeg(photo, 500, 0.82);
          const photoData = new FormData();
          photoData.append("photo", compressed);
          const photoResponse = await fetch(`/api/coach/chat-groups/${encodeURIComponent(data.id)}/photo`, {
            method: "POST",
            headers: await withCsrf(),
            body: photoData,
          });
          if (!photoResponse.ok) {
            const photoError = await photoResponse.json();
            uploadWarning = photoError.error || "הקבוצה נוצרה, אך התמונה לא עלתה";
          }
        } catch {
          uploadWarning = "הקבוצה נוצרה, אך התמונה לא עלתה";
        }
      }

      setPhotoWarning(uploadWarning);
      setSaved(true);
      await new Promise((resolve) => setTimeout(resolve, uploadWarning ? 1200 : 700));
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "אירעה שגיאה ביצירת הקבוצה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-group-creator-title"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#171919]/95 p-6 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {saved ? (
          <div className="py-10 text-center">
            <div className="text-4xl">✓</div>
            <p className="mt-3 font-bold text-[#c3f400]">הקבוצה נוצרה בהצלחה</p>
            {photoWarning && <p className="mt-2 text-sm text-amber-300">{photoWarning}</p>}
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#c3f400]">קבוצה חדשה</p>
                <h2 id="chat-group-creator-title" className="mt-2 text-2xl font-bold">מי בקבוצה?</h2>
              </div>
              <button type="button" onClick={onClose} className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="סגירה">×</button>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-white/60">שם הקבוצה</span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                placeholder="לדוגמה: קבוצת בוקר"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-[#c3f400]/60 focus:ring-4 focus:ring-[#c3f400]/10"
              />
            </label>

            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-white/70 hover:border-[#c3f400]/40">
              <span>{photo ? photo.name : "תמונת קבוצה (לא חובה)"}</span>
              <span>📷</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  setPhoto(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>

            <div className="mt-5 max-h-64 space-y-2 overflow-y-auto">
              {clients.length === 0 ? (
                <p className="rounded-xl bg-white/5 p-4 text-sm text-white/50">אין עדיין מתאמנים לבחירה</p>
              ) : clients.map((client) => (
                <label key={client.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10">
                  <input
                    type="checkbox"
                    checked={memberIds.includes(client.id)}
                    onChange={() => toggleMember(client.id)}
                    className="h-4 w-4 accent-[#c3f400]"
                  />
                  <span className="text-sm font-medium">{client.name}</span>
                </label>
              ))}
            </div>

            {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white/70 hover:bg-white/5">ביטול</button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !name.trim()}
                className="flex-1 rounded-xl bg-[#c3f400] px-5 py-3 font-bold text-[#161e00] transition hover:bg-[#d4ff26] disabled:opacity-50"
              >
                {saving ? "יוצר..." : "צור קבוצה"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
