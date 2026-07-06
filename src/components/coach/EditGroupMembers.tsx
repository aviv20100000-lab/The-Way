"use client";

import { useState } from "react";
import { withCsrf } from "@/lib/csrf-client";

interface EditGroupMembersProps {
  groupId: string;
  groupName: string;
  clients: { id: string; name: string }[];
  currentMemberIds: string[];
  onClose: () => void;
}

export default function EditGroupMembers({ groupId, groupName, clients, currentMemberIds, onClose }: EditGroupMembersProps) {
  const [memberIds, setMemberIds] = useState(currentMemberIds);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function toggleMember(clientId: string) {
    if (pendingIds.includes(clientId)) return;
    const wasMember = memberIds.includes(clientId);
    setMemberIds((current) => wasMember
      ? current.filter((id) => id !== clientId)
      : current.includes(clientId) ? current : [...current, clientId]);
    setPendingIds((current) => [...current, clientId]);
    setError("");
    try {
      const response = await fetch(`/api/coach/chat-groups/${encodeURIComponent(groupId)}/members`, {
        method: wasMember ? "DELETE" : "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ clientId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "עדכון חברי הקבוצה נכשל");
      }
    } catch (caught) {
      setMemberIds((current) => wasMember
        ? current.includes(clientId) ? current : [...current, clientId]
        : current.filter((id) => id !== clientId));
      setError(caught instanceof Error ? caught.message : "עדכון חברי הקבוצה נכשל");
    } finally {
      setPendingIds((current) => current.filter((id) => id !== clientId));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div dir="rtl" role="dialog" aria-modal="true" aria-labelledby="edit-group-members-title"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#171919]/95 p-6 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#c3f400]">עריכת חברים</p>
            <h2 id="edit-group-members-title" className="mt-2 text-2xl font-bold">{groupName}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="סגירה">×</button>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {clients.length === 0 ? (
            <p className="rounded-xl bg-white/5 p-4 text-sm text-white/50">אין עדיין מתאמנים לבחירה</p>
          ) : clients.map((client) => {
            const checked = memberIds.includes(client.id);
            return (
              <label key={client.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${checked ? "border-[#c3f400]/30 bg-[#c3f400]/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                <input type="checkbox" checked={checked} disabled={pendingIds.includes(client.id)}
                  onChange={() => void toggleMember(client.id)} className="h-4 w-4 accent-[#c3f400]" />
                <span className="flex-1 text-sm font-medium">{client.name}</span>
                {pendingIds.includes(client.id) && <span className="text-xs text-white/40">שומר...</span>}
              </label>
            );
          })}
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <button type="button" onClick={onClose} className="mt-6 w-full rounded-xl bg-[#c3f400] px-5 py-3 font-bold text-[#161e00] transition hover:bg-[#d4ff26]">סיום</button>
      </div>
    </div>
  );
}
