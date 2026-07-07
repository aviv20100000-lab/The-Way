"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AssistantReviewClient = {
  id: string;
  name: string;
};

type Conversation = {
  client_id: string;
  client_name: string;
  message_count: number;
  last_message_at: string | null;
  last_message: string | null;
};

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function formatTime(value: string | null) {
  if (!value) return "אין שיחה";
  return new Date(value.replace(" ", "T")).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

export default function AssistantChatReview({ clients, fullHeight = false }: { clients: AssistantReviewClient[]; fullHeight?: boolean }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState("");

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/coach/assistant-chats", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "לא הצלחנו לטעון את שיחות העוזר");
      const rows: Conversation[] = data.conversations ?? [];
      setConversations(rows);
      setSelectedClientId((current) => current || rows.find((row) => Number(row.message_count) > 0)?.client_id || clients[0]?.id || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לטעון את שיחות העוזר");
    } finally {
      setLoading(false);
    }
  }, [clients]);

  const loadMessages = useCallback(async (clientId: string) => {
    if (!clientId) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    try {
      const response = await fetch(`/api/coach/assistant-chats?clientId=${encodeURIComponent(clientId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "לא הצלחנו לטעון את השיחה");
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => { void loadMessages(selectedClientId); }, [selectedClientId, loadMessages]);

  const selectedConversation = useMemo(
    () => conversations.find((entry) => entry.client_id === selectedClientId),
    [conversations, selectedClientId]
  );

  return (
    <section className={`rounded-2xl border border-[#334022] bg-[#121512] p-4 ${fullHeight ? "flex h-full min-h-0 flex-col" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">שיחות מתאמנים עם העוזר</h2>
          <p className="text-xs text-[#8e9379]">למאמן בלבד: צפייה ובקרה על מה שהמתאמנים שאלו.</p>
        </div>
        <button type="button" onClick={() => void loadConversations()} className="rounded-xl border border-[#444933] px-3 py-2 text-xs font-bold text-[#c3f400]">
          רענן
        </button>
      </div>

      {error && <p className="mb-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}

      <select
        value={selectedClientId}
        onChange={(event) => setSelectedClientId(event.target.value)}
        className="mb-3 w-full rounded-xl border border-[#444933] bg-[#1e2020] px-3 py-2 text-sm text-white"
      >
        {clients.length === 0 && <option value="">אין מתאמנים</option>}
        {clients.map((client) => {
          const conversation = conversations.find((entry) => entry.client_id === client.id);
          const count = Number(conversation?.message_count ?? 0);
          return <option key={client.id} value={client.id}>{client.name} {count > 0 ? `(${count})` : "(אין שיחה)"}</option>;
        })}
      </select>

      {loading || messagesLoading ? (
        <div className="skeleton h-36 rounded-2xl" />
      ) : !selectedClientId ? (
        <p className="rounded-2xl bg-[#1e2020] p-4 text-center text-sm text-[#8e9379]">בחר מתאמן כדי לראות שיחה.</p>
      ) : messages.length === 0 ? (
        <p className="rounded-2xl bg-[#1e2020] p-4 text-center text-sm text-[#8e9379]">אין עדיין הודעות עם העוזר למתאמן הזה.</p>
      ) : (
        <div className={`${fullHeight ? "min-h-0 flex-1" : "max-h-80"} space-y-2 overflow-y-auto rounded-2xl border border-[#282b22] bg-[#0c0f0f] p-3`}>
          <p className="pb-1 text-xs text-[#8e9379]">עדכון אחרון: {formatTime(selectedConversation?.last_message_at ?? null)}</p>
          {messages.map((message) => (
            <div key={message.id} className={`rounded-2xl px-3 py-2 text-sm ${message.role === "assistant" ? "bg-[#1e2020] text-white" : "bg-[#c3f400] text-[#161e00]"}`}>
              <div className="mb-1 flex justify-between gap-3 text-[10px] opacity-70">
                <span>{message.role === "assistant" ? "העוזר" : "המתאמן"}</span>
                <span>{formatTime(message.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
