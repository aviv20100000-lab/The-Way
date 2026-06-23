"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCsrfToken } from "@/lib/csrf-client";

interface User {
  id: string;
  name: string;
  role: "coach" | "client";
}

interface Contact {
  id: string;
  name: string;
  role: "coach" | "client";
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  sent_at: string;
  is_read: number;
}

type ChatMode = { type: "group" } | { type: "private"; contact: Contact };

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [groupUnread, setGroupUnread] = useState(0);
  const [mode, setMode] = useState<ChatMode | null>(null); // null = showing list on mobile
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auth check
  useEffect(() => {
    fetch("/api/auth/me").then(async (res) => {
      if (!res.ok) { router.push("/login"); return; }
      setUser(await res.json());
    });
  }, [router]);

  // Load contacts
  const loadContacts = useCallback(async () => {
    const res = await fetch("/api/chat/contacts");
    if (!res.ok) return;
    const data = await res.json();
    setContacts(data.contacts ?? []);
    setUnreadMap(data.unreadMap ?? {});
    setGroupUnread(data.groupUnread ?? 0);
  }, []);

  useEffect(() => {
    if (user) loadContacts();
  }, [user, loadContacts]);

  // Load messages for current mode
  const loadMessages = useCallback(async () => {
    if (!mode) return;
    const params = new URLSearchParams();
    if (mode.type === "private") {
      params.set("type", "private");
      params.set("with", mode.contact.id);
    } else {
      params.set("type", "group");
    }

    const res = await fetch(`/api/chat/messages?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages ?? []);
    setLoading(false);

    if (mode.type === "private") {
      setUnreadMap((prev) => ({ ...prev, [mode.contact.id]: 0 }));
    } else {
      setGroupUnread(0);
    }
  }, [mode]);

  useEffect(() => {
    if (!mode) return;
    setLoading(true);
    setMessages([]);
    if (user) loadMessages();
  }, [mode, user, loadMessages]);

  // Polling
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (mode) loadMessages();
      loadContacts();
    }, 4000);
    return () => clearInterval(interval);
  }, [user, mode, loadMessages, loadContacts]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending || !mode) return;
    setSending(true);
    try {
      const body: Record<string, string> = { content: input.trim() };
      if (mode.type === "private") body.receiver_id = mode.contact.id;

      const csrf = await getCsrfToken();
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf ?? "" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setInput("");
        await loadMessages();
      }
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openChat = (newMode: ChatMode) => {
    setMode(newMode);
    setInput("");
  };

  const backToList = () => {
    setMode(null);
    setMessages([]);
  };

  const totalUnread = groupUnread + Object.values(unreadMap).reduce((a, b) => a + b, 0);

  const chatTitle = !mode ? "צ׳אט" : mode.type === "group" ? "צ׳אט קבוצתי" : `${mode.contact.name}`;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Sidebar content (shared between mobile list view and desktop) ───────────
  const SidebarContent = () => (
    <>
      <div className="px-4 pt-4 pb-2 text-xs text-gray-500 uppercase tracking-wider font-semibold">שיחות</div>

      <button
        onClick={() => openChat({ type: "group" })}
        className={`flex items-center gap-3 px-4 py-3.5 text-right transition-colors w-full ${
          mode?.type === "group" ? "bg-purple-900/40 text-purple-300" : "text-gray-300 active:bg-gray-800"
        }`}
      >
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl shrink-0">
          👥
        </div>
        <div className="flex-1 min-w-0 text-right">
          <div className="font-semibold text-base truncate">קבוצה</div>
          <div className="text-xs text-gray-500 truncate">כולם</div>
        </div>
        {groupUnread > 0 && (
          <span className="bg-purple-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1 shrink-0">
            {groupUnread}
          </span>
        )}
      </button>

      {contacts.length > 0 && (
        <div className="px-4 pt-4 pb-2 text-xs text-gray-500 uppercase tracking-wider font-semibold">פרטי</div>
      )}

      {contacts.map((c) => (
        <button
          key={c.id}
          onClick={() => openChat({ type: "private", contact: c })}
          className={`flex items-center gap-3 px-4 py-3.5 text-right transition-colors w-full ${
            mode?.type === "private" && mode.contact.id === c.id
              ? "bg-purple-900/40 text-purple-300"
              : "text-gray-300 active:bg-gray-800"
          }`}
        >
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-lg font-bold shrink-0">
            {c.name[0]}
          </div>
          <div className="flex-1 min-w-0 text-right">
            <div className="font-semibold text-base truncate">{c.name}</div>
            <div className="text-xs text-gray-500 truncate">{c.role === "coach" ? "קואץ׳" : "לקוח"}</div>
          </div>
          {(unreadMap[c.id] ?? 0) > 0 && (
            <span className="bg-purple-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1 shrink-0">
              {unreadMap[c.id]}
            </span>
          )}
        </button>
      ))}
    </>
  );

  // ─── Chat window content ──────────────────────────────────────────────────────
  const ChatWindow = () => (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center pt-10">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-600 pt-10 text-sm">
            אין הודעות עדיין. שלח את ההודעה הראשונה! 👋
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[75%] flex flex-col gap-1 ${isMe ? "items-start" : "items-end"}`}>
                  {!isMe && (
                    <span className="text-xs text-gray-500 px-1">{msg.sender_name}</span>
                  )}
                  <div className={`rounded-2xl px-4 py-2.5 text-sm break-words leading-relaxed ${
                    isMe
                      ? "bg-purple-600 text-white rounded-tr-sm"
                      : "bg-gray-800 text-gray-100 rounded-tl-sm"
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-xs text-gray-600 px-1">
                    {new Date(msg.sent_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-gray-900 border-t border-gray-800 p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="כתוב הודעה..."
            rows={1}
            maxLength={1000}
            className="flex-1 bg-gray-800 text-white rounded-2xl px-4 py-3 text-base resize-none outline-none focus:ring-1 focus:ring-purple-500 placeholder-gray-500"
            style={{ minHeight: "44px", maxHeight: "120px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="bg-purple-600 active:bg-purple-700 disabled:opacity-40 text-white rounded-2xl w-11 h-11 flex items-center justify-center shrink-0 transition-colors"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-screen bg-gray-950 flex flex-col" dir="rtl">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 flex items-center gap-3 shrink-0"
        style={{ paddingTop: `calc(12px + env(safe-area-inset-top))`, paddingBottom: "12px" }}>
        <button
          onClick={mode ? backToList : () => router.back()}
          className="text-gray-400 active:text-white transition-colors p-1 -ml-1"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg leading-tight truncate">{chatTitle}</h1>
          {!mode && totalUnread > 0 && (
            <span className="text-xs text-purple-400">{totalUnread} הודעות שלא נקראו</span>
          )}
        </div>
      </header>

      {/* ── MOBILE: show list OR chat (not both) ───────────────────────────── */}
      <div className="flex flex-1 overflow-hidden md:hidden">
        {!mode ? (
          <div className="flex-1 overflow-y-auto bg-gray-900">
            <SidebarContent />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ChatWindow />
          </div>
        )}
      </div>

      {/* ── DESKTOP: sidebar + chat side by side ───────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <aside className="w-64 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 overflow-y-auto">
          <SidebarContent />
        </aside>
        <main className="flex-1 flex flex-col overflow-hidden">
          {mode ? (
            <ChatWindow />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
              בחר שיחה מהרשימה
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
