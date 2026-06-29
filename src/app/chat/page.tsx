"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getCsrfToken } from "@/lib/csrf-client";
import PageSkeleton from "@/components/PageSkeleton";

function Avatar({ username, name, size = 44 }: { username?: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = name.slice(0, 1);
  if (username && !failed) {
    return (
      <div className="rounded-full overflow-hidden shrink-0 border border-white/10" style={{ width: size, height: size }}>
        <Image
          src={`/avatars/${username}.jpg`}
          alt={name}
          width={size}
          height={size}
          className="object-cover w-full h-full"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  return (
    <div
      className="rounded-full shrink-0 bg-[#282a2b] border border-[#444933] flex items-center justify-center text-white font-bold"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

interface User { id: string; name: string; role: "coach" | "client"; username: string; }
interface Contact { id: string; name: string; role: "coach" | "client"; username: string; }
interface Message { id: string; sender_id: string; sender_name: string; sender_username?: string; content: string; sent_at: string; is_read: number; }
type ChatMode = { type: "group" } | { type: "private"; contact: Contact };

const CHAT_CACHE_KEY = "way_chat_bootstrap";

type ChatCache = {
  user: User | null;
  contacts: Contact[];
  unreadMap: Record<string, number>;
  groupUnread: number;
  messages: Message[];
};

function readChatCache(): ChatCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CHAT_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ChatCache) : null;
  } catch {
    return null;
  }
}

function writeChatCache(data: ChatCache) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

export default function ChatPage() {
  const router = useRouter();
  const cached = readChatCache();
  const [user, setUser] = useState<User | null>(cached?.user ?? null);
  const [contacts, setContacts] = useState<Contact[]>(cached?.contacts ?? []);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>(cached?.unreadMap ?? {});
  const [groupUnread, setGroupUnread] = useState(cached?.groupUnread ?? 0);
  const [mode, setMode] = useState<ChatMode>({ type: "group" });
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>(cached?.messages ?? []);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(cached?.user ? false : true);
  const [showContent, setShowContent] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMsgId = useRef<string | null>(null);
  const isAtBottom = useRef(true);
  const userRef = useRef<User | null>(cached?.user ?? null);
  const modeRef = useRef<ChatMode>({ type: "group" });
  const contactsRef = useRef<Contact[]>(cached?.contacts ?? []);
  const unreadMapRef = useRef<Record<string, number>>(cached?.unreadMap ?? {});
  const groupUnreadRef = useRef(cached?.groupUnread ?? 0);
  const messagesRef = useRef<Message[]>(cached?.messages ?? []);

  const persistCache = useCallback((next?: Partial<ChatCache>) => {
    const payload: ChatCache = {
      user: next?.user ?? userRef.current,
      contacts: next?.contacts ?? contactsRef.current,
      unreadMap: next?.unreadMap ?? unreadMapRef.current,
      groupUnread: next?.groupUnread ?? groupUnreadRef.current,
      messages: next?.messages ?? messagesRef.current,
    };
    writeChatCache(payload);
  }, []);

  useEffect(() => {
    fetch("/api/chat/bootstrap").then(async (res) => {
      if (!res.ok) {
        if (res.status === 401) router.push("/login");
        return;
      }
      const data = await res.json();
      const me: User = data.user;
      const nextContacts: Contact[] = data.contacts ?? [];
      const nextUnreadMap: Record<string, number> = data.unreadMap ?? {};
      const nextGroupUnread = data.groupUnread ?? 0;
      const msgs: Message[] = data.messages ?? [];
      userRef.current = me;
      contactsRef.current = nextContacts;
      unreadMapRef.current = nextUnreadMap;
      groupUnreadRef.current = nextGroupUnread;
      setUser(me);
      setContacts(nextContacts);
      setUnreadMap(nextUnreadMap);
      setGroupUnread(nextGroupUnread);
      lastMsgId.current = msgs[msgs.length - 1]?.id ?? null;
      messagesRef.current = msgs;
      setMessages(msgs);
      persistCache({ user: me, contacts: nextContacts, unreadMap: nextUnreadMap, groupUnread: nextGroupUnread, messages: msgs });
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 0);
    });
  }, [persistCache, router]);

  useEffect(() => {
    if (loading) {
      setShowContent(false);
      return;
    }
    const timeout = setTimeout(() => setShowContent(true), 120);
    return () => clearTimeout(timeout);
  }, [loading, mode, showChat]);

  const loadContacts = useCallback(async () => {
    const res = await fetch("/api/chat/contacts");
    if (!res.ok) return;
    const data = await res.json();
    const nextContacts = data.contacts ?? [];
    const nextUnreadMap = data.unreadMap ?? {};
    const nextGroupUnread = data.groupUnread ?? 0;
    contactsRef.current = nextContacts;
    unreadMapRef.current = nextUnreadMap;
    groupUnreadRef.current = nextGroupUnread;
    setContacts(nextContacts);
    setUnreadMap(nextUnreadMap);
    setGroupUnread(nextGroupUnread);
    persistCache({ contacts: nextContacts, unreadMap: nextUnreadMap, groupUnread: nextGroupUnread });
  }, [persistCache]);

  const loadMessages = useCallback(async (opts?: { silent?: boolean; forMode?: ChatMode }) => {
    const target = opts?.forMode ?? modeRef.current;
    const params = new URLSearchParams();
    if (target.type === "private") { params.set("type", "private"); params.set("with", target.contact.id); }
    else params.set("type", "group");
    const res = await fetch(`/api/chat/messages?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    const msgs: Message[] = data.messages ?? [];
    const newLastId = msgs[msgs.length - 1]?.id ?? null;
    if (!opts?.silent || newLastId !== lastMsgId.current) {
      lastMsgId.current = newLastId;
      messagesRef.current = msgs;
      setMessages(msgs);
      persistCache({ messages: msgs });
      if (isAtBottom.current) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    }
    if (target.type === "private") {
      const nextUnreadMap = { ...unreadMapRef.current, [target.contact.id]: 0 };
      unreadMapRef.current = nextUnreadMap;
      setUnreadMap(nextUnreadMap);
      persistCache({ unreadMap: nextUnreadMap });
    } else {
      groupUnreadRef.current = 0;
      setGroupUnread(0);
      persistCache({ groupUnread: 0 });
    }
  }, [persistCache]);

  // Reload messages when switching chats (not on initial mount — handled above)
  const initialMount = useRef(true);
  useEffect(() => {
    if (initialMount.current) { initialMount.current = false; return; }
    modeRef.current = mode;
    if (!userRef.current) return;
    setLoading(true);
    lastMsgId.current = null;
    setMessages([]);
    loadMessages({ forMode: mode }).then(() => setLoading(false));
  }, [mode, loadMessages]);

  // Separate intervals: messages every 5s, contacts (unread) every 20s
  useEffect(() => {
    const msgInterval = setInterval(() => {
      if (document.hidden || !userRef.current) return;
      loadMessages({ silent: true });
    }, 5000);
    const contactsInterval = setInterval(() => {
      if (document.hidden || !userRef.current) return;
      loadContacts();
    }, 20000);
    return () => { clearInterval(msgInterval); clearInterval(contactsInterval); };
  }, [loadMessages, loadContacts]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      sender_id: user!.id,
      sender_name: user!.name,
      content: text,
      sent_at: new Date().toISOString(),
      is_read: 0,
    };
    messagesRef.current = [...messagesRef.current, optimistic];
    setMessages((prev) => [...prev, optimistic]);
    isAtBottom.current = true;
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    setSending(true);
    try {
      const body: Record<string, string> = { content: text };
      if (mode.type === "private") body.receiver_id = mode.contact.id;
      const csrf = await getCsrfToken();
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf ?? "" },
        body: JSON.stringify(body),
      });
      await loadMessages({ silent: true });
    } finally { setSending(false); }
  };

  const selectChat = (m: ChatMode) => { setMode(m); setShowChat(true); setMessages([]); };
  const backToList = () => setShowChat(false);
  const totalUnread = groupUnread + Object.values(unreadMap).reduce((a, b) => a + b, 0);

  if (!user) return <PageSkeleton variant="chat" />;

  const chatTitle = mode.type === "group" ? "צ׳אט קבוצתי" : mode.contact.name;
  const isGroupActive = mode.type === "group";

  const groupRow = (
    <button
      key="group"
      onClick={() => selectChat({ type: "group" })}
      className={`flex items-center gap-3 px-4 py-3.5 w-full text-right transition-colors ${isGroupActive && showChat ? "bg-[#c3f400]/8 border-r-2 border-[#c3f400]" : "hover:bg-[#1e2020]"}`}
    >
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#c3f400]/30 to-[#6366f1]/30 border border-[#c3f400]/20 flex items-center justify-center text-xl shrink-0" style={{ width: 44, height: 44 }}>👥</div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm truncate ${isGroupActive && showChat ? "text-[#c3f400]" : "text-white"}`}>קבוצה</div>
        <div className="text-xs text-[#8e9379] truncate">כולם</div>
      </div>
      {groupUnread > 0 && <span className="bg-[#c3f400] text-[#161e00] text-xs font-black rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">{groupUnread}</span>}
    </button>
  );

  const dmRows = contacts.map((c) => {
    const isActive = mode.type === "private" && mode.contact.id === c.id && showChat;
    return (
      <button
        key={c.id}
        onClick={() => selectChat({ type: "private", contact: c })}
        className={`flex items-center gap-3 px-4 py-3.5 w-full text-right transition-colors ${isActive ? "bg-[#c3f400]/8 border-r-2 border-[#c3f400]" : "hover:bg-[#1e2020]"}`}
      >
        <Avatar username={c.username} name={c.name} />
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm truncate ${isActive ? "text-[#c3f400]" : "text-white"}`}>{c.name}</div>
          <div className="text-xs text-[#8e9379] truncate">{c.role === "coach" ? "קואץ׳" : "לקוח"}</div>
        </div>
        {(unreadMap[c.id] ?? 0) > 0 && <span className="bg-[#c3f400] text-[#161e00] text-xs font-black rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">{unreadMap[c.id]}</span>}
      </button>
    );
  });

  const chatWindow = (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ background: "#0c0f0f" }}>
        {loading || !showContent ? (
          <div className="flex justify-center pt-10">
            <div className="w-6 h-6 border-2 border-[#c3f400] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-[#8e9379] pt-10 text-sm">אין הודעות עדיין. שלח את ההודעה הראשונה! 👋</div>
        ) : messages.map((msg) => {
          const isMe = msg.sender_id === user.id;
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "justify-start" : "justify-end"}`}>
              {isMe && (
                <Avatar username={user.username} name={user.name} size={30} />
              )}
              <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? "items-start" : "items-end"}`}>
                {!isMe && <span className="text-xs text-[#8e9379] px-1">{msg.sender_name}</span>}
                <div className={`rounded-2xl px-4 py-2.5 text-sm break-words leading-relaxed ${
                  isMe
                    ? "bg-[#c3f400] text-[#161e00] font-medium rounded-bl-sm"
                    : "bg-[#1e2020] border border-[#444933] text-white rounded-br-sm"
                }`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-[#8e9379] px-1">
                  {new Date(msg.sent_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {!isMe && (
                <Avatar username={msg.sender_username} name={msg.sender_name} size={30} />
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-[#1e2020] p-3 pb-[max(12px,env(safe-area-inset-bottom))]" style={{ background: "#0c0f0f" }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="כתוב הודעה..."
            rows={1}
            maxLength={1000}
            className="flex-1 rounded-2xl px-4 py-3 text-sm resize-none outline-none placeholder-[#8e9379] text-white transition-all"
            style={{ minHeight: "44px", maxHeight: "120px", background: "#1e2020", border: "1px solid #444933" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#c3f400"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(195,244,0,0.1)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#444933"; e.currentTarget.style.boxShadow = "none"; }}
            onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="bg-[#c3f400] disabled:opacity-40 text-[#161e00] rounded-full w-11 h-11 flex items-center justify-center shrink-0 hover:brightness-110 transition-all shadow-[0_0_20px_-5px_rgba(195,244,0,0.4)]"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-[#161e00] border-t-transparent rounded-full animate-spin" />
              : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-[100dvh] flex flex-col" dir="rtl" style={{ background: "#0c0f0f" }}>
      {/* Header */}
      <header className="border-b border-[#1e2020] px-4 py-3 flex items-center gap-3 shrink-0 pt-[max(12px,env(safe-area-inset-top))]" style={{ background: "#0c0f0f" }}>
        <button
          onClick={showChat ? backToList : () => router.back()}
          className="text-[#8e9379] hover:text-white p-1 -ml-1 shrink-0 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg leading-tight truncate">
            {showChat ? chatTitle : "צ׳אט"}
          </h1>
          {!showChat && totalUnread > 0 && (
            <span className="text-xs text-[#c3f400]">{totalUnread} הודעות שלא נקראו</span>
          )}
        </div>
      </header>

      {/* MOBILE */}
      <div className="flex flex-1 overflow-hidden md:hidden">
        {!showChat ? (
          <div className="flex-1 overflow-y-auto" style={{ background: "#0c0f0f" }}>
            <div className="px-4 pt-4 pb-1 text-[10px] text-[#8e9379] uppercase tracking-widest font-semibold">שיחות</div>
            {groupRow}
            {contacts.length > 0 && <div className="px-4 pt-4 pb-1 text-[10px] text-[#8e9379] uppercase tracking-widest font-semibold">פרטי</div>}
            {dmRows}
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">{chatWindow}</div>
        )}
      </div>

      {/* DESKTOP */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <aside className="w-64 border-l border-[#1e2020] flex flex-col shrink-0 overflow-y-auto" style={{ background: "#0d1010" }}>
          <div className="px-4 pt-4 pb-1 text-[10px] text-[#8e9379] uppercase tracking-widest font-semibold">שיחות</div>
          {groupRow}
          {contacts.length > 0 && <div className="px-4 pt-4 pb-1 text-[10px] text-[#8e9379] uppercase tracking-widest font-semibold">פרטי</div>}
          {dmRows}
        </aside>
        <main className="flex-1 flex flex-col overflow-hidden">{chatWindow}</main>
      </div>
    </div>
  );
}
