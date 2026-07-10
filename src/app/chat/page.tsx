"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { getCsrfToken } from "@/lib/csrf-client";
import PageSkeleton from "@/components/PageSkeleton";
import { partitionChatContacts } from "@/lib/chat-contacts";

const ChatGroupCreator = dynamic(() => import("@/components/coach/ChatGroupCreator"), {
  loading: () => <div className="skeleton h-80 rounded-3xl" />,
});

const EditGroupMembers = dynamic(() => import("@/components/coach/EditGroupMembers"), {
  loading: () => <div className="skeleton h-80 rounded-3xl" />,
});

const AssistantChatReview = dynamic(() => import("@/components/coach/AssistantChatReview"), {
  loading: () => <div className="skeleton h-full min-h-80 rounded-3xl" />,
});

function Avatar({ username, name, avatarUrl, size = 44 }: { username?: string; name: string; avatarUrl?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = name.slice(0, 1);
  const imageSource = avatarUrl || (username ? `/avatars/${username}.jpg` : null);

  useEffect(() => setFailed(false), [imageSource]);

  if (imageSource && !failed) {
    return (
      <div className="rounded-full overflow-hidden shrink-0 border border-white/10" style={{ width: size, height: size }}>
        <Image
          src={imageSource}
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

function GroupPhoto({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);

  if (imageUrl && !failed) {
    return (
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[#c3f400]/20">
        <Image src={imageUrl} alt={name} width={44} height={44} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      </div>
    );
  }
  return <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#c3f400]/20 bg-[#c3f400]/10 text-xl">👥</div>;
}

interface User { id: string; name: string; role: "coach" | "client"; username: string; avatar_url?: string | null; }
interface Contact { id: string; name: string; role: "coach" | "client"; username: string; avatar_url?: string | null; }
interface NamedGroup { id: string; name: string; imageUrl?: string | null; }
interface Reaction { emoji: string; count: number; reactedByMe: boolean; }
interface Message { id: string; sender_id: string; sender_name: string; sender_username?: string; sender_avatar_url?: string | null; content: string; image_url?: string; sent_at: string; is_read: number; pinned?: number | boolean; reactions?: Reaction[]; }
type ChatMode =
  | { type: "group" }
  | { type: "namedGroup"; group: NamedGroup }
  | { type: "private"; contact: Contact }
  | { type: "assistant" }
  | { type: "assistantReview" };

const CHAT_CACHE_KEY = "way_chat_bootstrap";
const REACTION_EMOJIS = ["👍", "❤️", "🔥", "😂", "😢"] as const;

const ASSISTANT_SENDER_ID = "shopping-assistant";
type AssistantFeedbackAction = "liked" | "disliked" | "saved";
const ASSISTANT_DISPLAY_NAME = "העוזר";

type AssistantApiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function mapAssistantMessage(message: AssistantApiMessage, user: User): Message {
  const isUser = message.role === "user";
  return {
    id: message.id,
    sender_id: isUser ? user.id : ASSISTANT_SENDER_ID,
    sender_name: isUser ? user.name : ASSISTANT_DISPLAY_NAME,
    sender_username: isUser ? user.username : undefined,
    sender_avatar_url: isUser ? user.avatar_url : undefined,
    content: message.content,
    sent_at: message.created_at,
    is_read: 1,
  };
}

function getOptimisticReactions(current: Reaction[] | undefined, emoji: string): Reaction[] {
  const reactions = (current ?? []).map((reaction) => ({ ...reaction }));
  const ownReaction = reactions.find((reaction) => reaction.reactedByMe);

  if (ownReaction?.emoji === emoji) {
    ownReaction.count -= 1;
    ownReaction.reactedByMe = false;
    return reactions.filter((reaction) => reaction.count > 0);
  }

  if (ownReaction) {
    ownReaction.count -= 1;
    ownReaction.reactedByMe = false;
  }
  const selected = reactions.find((reaction) => reaction.emoji === emoji);
  if (selected) {
    selected.count += 1;
    selected.reactedByMe = true;
  } else {
    reactions.push({ emoji, count: 1, reactedByMe: true });
  }
  return reactions.filter((reaction) => reaction.count > 0);
}

function renderHighlightedContent(content: string, query: string) {
  if (!query) return content;
  const matchIndex = content.toLowerCase().indexOf(query.toLowerCase());
  if (matchIndex < 0) return content;
  const matchEnd = matchIndex + query.length;
  return (
    <>
      {content.slice(0, matchIndex)}
      <mark className="rounded bg-[#c3f400]/25 px-0.5 text-white">{content.slice(matchIndex, matchEnd)}</mark>
      {content.slice(matchEnd)}
    </>
  );
}

type ChatCache = {
  user: User | null;
  contacts: Contact[];
  namedGroups: NamedGroup[];
  unreadMap: Record<string, number>;
  groupUnread: number;
  messages: Message[];
  defaultGroupName: string | null;
  inDefaultGroup?: boolean;
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

function unreadMapEqual(a: Record<string, number>, b: Record<string, number>) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function contactsEqual(a: Contact[], b: Contact[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].id !== b[i].id ||
      a[i].name !== b[i].name ||
      a[i].role !== b[i].role ||
      a[i].username !== b[i].username ||
      a[i].avatar_url !== b[i].avatar_url
    ) {
      return false;
    }
  }
  return true;
}

function namedGroupsEqual(a: NamedGroup[], b: NamedGroup[]) {
  if (a.length !== b.length) return false;
  return a.every((group, index) => group.id === b[index].id && group.name === b[index].name && group.imageUrl === b[index].imageUrl);
}

function messageActivitySignature(messages: Message[]): string {
  return JSON.stringify(messages.map((message) => [
    message.id,
    Boolean(message.pinned),
    message.reactions ?? [],
  ]));
}

export default function ChatPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const cached = readChatCache();
  const [user, setUser] = useState<User | null>(cached?.user ?? null);
  const [contacts, setContacts] = useState<Contact[]>(cached?.contacts ?? []);
  const [namedGroups, setNamedGroups] = useState<NamedGroup[]>(cached?.namedGroups ?? []);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>(cached?.unreadMap ?? {});
  const [groupUnread, setGroupUnread] = useState(cached?.groupUnread ?? 0);
  const [mode, setMode] = useState<ChatMode>({ type: "group" });
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>(cached?.messages ?? []);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [assistantFeedback, setAssistantFeedback] = useState<Record<string, AssistantFeedbackAction>>({});
  const [loading, setLoading] = useState(cached?.user ? false : true);
  const [showContent, setShowContent] = useState(false);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [editingGroup, setEditingGroup] = useState<{ id: string; name: string; memberIds: string[] } | null>(null);
  const [editingGroupLoadingId, setEditingGroupLoadingId] = useState<string | null>(null);
  const [editingGroupError, setEditingGroupError] = useState("");
  const [defaultGroupName, setDefaultGroupName] = useState<string | null>(cached?.defaultGroupName ?? null);
  const [inDefaultGroup, setInDefaultGroup] = useState<boolean>(cached?.inDefaultGroup ?? true);
  const [renamingGroup, setRenamingGroup] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [renamingSaving, setRenamingSaving] = useState(false);
  const [renamingError, setRenamingError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMsgId = useRef<string | null>(null);
  const isAtBottom = useRef(true);
  const userRef = useRef<User | null>(cached?.user ?? null);
  const modeRef = useRef<ChatMode>({ type: "group" });
  const contactsRef = useRef<Contact[]>(cached?.contacts ?? []);
  const namedGroupsRef = useRef<NamedGroup[]>(cached?.namedGroups ?? []);
  const unreadMapRef = useRef<Record<string, number>>(cached?.unreadMap ?? {});
  const groupUnreadRef = useRef(cached?.groupUnread ?? 0);
  const messagesRef = useRef<Message[]>(cached?.messages ?? []);
  const defaultGroupNameRef = useRef<string | null>(cached?.defaultGroupName ?? null);
  const inDefaultGroupRef = useRef<boolean>(cached?.inDefaultGroup ?? true);
  const reactingMessageIds = useRef(new Set<string>());
  const initialMessageIds = useRef(new Set((cached?.messages ?? []).map((message) => message.id)));
  const animatedMessageIds = useRef(new Set<string>());
  const pendingOptimisticMessage = useRef<{ id: string; content: string; sentAt: number } | null>(null);

  const persistCache = useCallback((next?: Partial<ChatCache>) => {
    const payload: ChatCache = {
      user: next?.user ?? userRef.current,
      contacts: next?.contacts ?? contactsRef.current,
      namedGroups: next?.namedGroups ?? namedGroupsRef.current,
      unreadMap: next?.unreadMap ?? unreadMapRef.current,
      groupUnread: next?.groupUnread ?? groupUnreadRef.current,
      messages: next?.messages ?? messagesRef.current,
      defaultGroupName: next?.defaultGroupName ?? defaultGroupNameRef.current,
      inDefaultGroup: next?.inDefaultGroup ?? inDefaultGroupRef.current,
    };
    writeChatCache(payload);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const finalBehavior = prefersReducedMotion ? "auto" : behavior;
    bottomRef.current?.scrollIntoView({ behavior: finalBehavior, block: "end" });
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const keepInputVisible = () => {
      if (showChat && isAtBottom.current) setTimeout(() => scrollToBottom("auto"), 50);
    };
    window.visualViewport.addEventListener("resize", keepInputVisible);
    return () => window.visualViewport?.removeEventListener("resize", keepInputVisible);
  }, [scrollToBottom, showChat]);

  useEffect(() => {
    fetch("/api/chat/bootstrap").then(async (res) => {
      if (!res.ok) {
        if (res.status === 401) router.push("/login");
        return;
      }
      const data = await res.json();
      const me: User = data.user;
      const nextContacts: Contact[] = data.contacts ?? [];
      const nextNamedGroups: NamedGroup[] = data.namedGroups ?? [];
      const nextUnreadMap: Record<string, number> = data.unreadMap ?? {};
      const nextGroupUnread = data.groupUnread ?? 0;
      const nextDefaultGroupName: string | null = data.defaultGroupName ?? null;
      const nextInDefaultGroup: boolean = data.inDefaultGroup ?? true;
      const msgs: Message[] = data.messages ?? [];
      userRef.current = me;
      contactsRef.current = nextContacts;
      namedGroupsRef.current = nextNamedGroups;
      unreadMapRef.current = nextUnreadMap;
      groupUnreadRef.current = nextGroupUnread;
      defaultGroupNameRef.current = nextDefaultGroupName;
      setUser(me);
      setContacts(nextContacts);
      setNamedGroups(nextNamedGroups);
      setUnreadMap(nextUnreadMap);
      setGroupUnread(nextGroupUnread);
      setDefaultGroupName(nextDefaultGroupName);
      inDefaultGroupRef.current = nextInDefaultGroup;
      setInDefaultGroup(nextInDefaultGroup);
      // Client outside the default group: land on the DM with the coach instead
      if (!nextInDefaultGroup && modeRef.current.type === "group") {
        const coachContact = nextContacts.find((c) => c.role === "coach");
        if (coachContact) setMode({ type: "private", contact: coachContact });
      }
      const requestedContactId = new URLSearchParams(window.location.search).get("with");
      const requestedContact = requestedContactId ? nextContacts.find((contact) => contact.id === requestedContactId) : null;
      if (requestedContact) {
        setMode({ type: "private", contact: requestedContact });
        setShowChat(true);
      }
      lastMsgId.current = msgs[msgs.length - 1]?.id ?? null;
      msgs.forEach((message) => initialMessageIds.current.add(message.id));
      messagesRef.current = msgs;
      setMessages(msgs);
      persistCache({ user: me, contacts: nextContacts, namedGroups: nextNamedGroups, unreadMap: nextUnreadMap, groupUnread: nextGroupUnread, messages: msgs, defaultGroupName: nextDefaultGroupName, inDefaultGroup: nextInDefaultGroup });
      setLoading(false);
      setTimeout(() => scrollToBottom("auto"), 0);
    });
  }, [persistCache, router, scrollToBottom]);

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
    const nextNamedGroups: NamedGroup[] = data.namedGroups ?? [];
    const nextUnreadMap = data.unreadMap ?? {};
    const nextGroupUnread = data.groupUnread ?? 0;
    const nextDefaultGroupName: string | null = data.defaultGroupName ?? null;
    const nextInDefaultGroup: boolean = data.inDefaultGroup ?? true;
    if (inDefaultGroupRef.current !== nextInDefaultGroup) {
      inDefaultGroupRef.current = nextInDefaultGroup;
      setInDefaultGroup(nextInDefaultGroup);
      // Removed from the group while viewing it — move to the DM with the coach
      if (!nextInDefaultGroup && modeRef.current.type === "group") {
        const coachContact = (nextContacts as Contact[]).find((c) => c.role === "coach");
        if (coachContact) setMode({ type: "private", contact: coachContact });
      }
      persistCache({ inDefaultGroup: nextInDefaultGroup });
    }
    const contactsChanged = !contactsEqual(contactsRef.current, nextContacts);
    const namedGroupsChanged = !namedGroupsEqual(namedGroupsRef.current, nextNamedGroups);
    const unreadChanged = !unreadMapEqual(unreadMapRef.current, nextUnreadMap);
    const groupChanged = groupUnreadRef.current !== nextGroupUnread;
    const groupNameChanged = defaultGroupNameRef.current !== nextDefaultGroupName;
    if (!contactsChanged && !namedGroupsChanged && !unreadChanged && !groupChanged && !groupNameChanged) return;
    contactsRef.current = nextContacts;
    namedGroupsRef.current = nextNamedGroups;
    unreadMapRef.current = nextUnreadMap;
    groupUnreadRef.current = nextGroupUnread;
    defaultGroupNameRef.current = nextDefaultGroupName;
    if (contactsChanged) setContacts(nextContacts);
    if (namedGroupsChanged) setNamedGroups(nextNamedGroups);
    if (unreadChanged) setUnreadMap(nextUnreadMap);
    if (groupChanged) setGroupUnread(nextGroupUnread);
    if (groupNameChanged) setDefaultGroupName(nextDefaultGroupName);
    persistCache({ contacts: nextContacts, namedGroups: nextNamedGroups, unreadMap: nextUnreadMap, groupUnread: nextGroupUnread, defaultGroupName: nextDefaultGroupName });
  }, [persistCache]);

  const loadMessages = useCallback(async (opts?: { silent?: boolean; forMode?: ChatMode }) => {
    const target = opts?.forMode ?? modeRef.current;
    if (target.type === "assistantReview") return;
    if (target.type === "assistant") {
      const currentUser = userRef.current;
      if (!currentUser) return;
      const res = await fetch("/api/assistant/messages", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const msgs: Message[] = ((data.messages ?? []) as AssistantApiMessage[]).map((message) => mapAssistantMessage(message, currentUser));
      if (!opts?.silent) msgs.forEach((message) => initialMessageIds.current.add(message.id));
      const newLastId = msgs[msgs.length - 1]?.id ?? null;
      if (!opts?.silent || newLastId !== lastMsgId.current) {
        lastMsgId.current = newLastId;
        messagesRef.current = msgs;
        setMessages(msgs);
        if (isAtBottom.current) setTimeout(() => scrollToBottom("smooth"), 30);
      }
      return;
    }
    const params = new URLSearchParams();
    if (target.type === "private") {
      params.set("type", "private");
      params.set("with", target.contact.id);
    } else if (target.type === "namedGroup") {
      params.set("type", "namedGroup");
      params.set("groupId", target.group.id);
    } else {
      params.set("type", "group");
    }
    const res = await fetch(`/api/chat/messages?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    const msgs: Message[] = data.messages ?? [];
    if (!opts?.silent) msgs.forEach((message) => initialMessageIds.current.add(message.id));
    const pendingOptimistic = pendingOptimisticMessage.current;
    if (pendingOptimistic) {
      const confirmedMessage = [...msgs].reverse().find((message) =>
        message.sender_id === userRef.current?.id &&
        message.content === pendingOptimistic.content &&
        new Date(message.sent_at).getTime() >= pendingOptimistic.sentAt - 60000
      );
      if (confirmedMessage) {
        animatedMessageIds.current.add(confirmedMessage.id);
        pendingOptimisticMessage.current = null;
      }
    }
    const newLastId = msgs[msgs.length - 1]?.id ?? null;
    const activityChanged = messageActivitySignature(msgs) !== messageActivitySignature(messagesRef.current);
    if (!opts?.silent || newLastId !== lastMsgId.current || activityChanged) {
      lastMsgId.current = newLastId;
      messagesRef.current = msgs;
      setMessages(msgs);
      persistCache({ messages: msgs });
      if (isAtBottom.current) setTimeout(() => scrollToBottom("smooth"), 30);
    }
    if (target.type === "private") {
      const nextUnreadMap = { ...unreadMapRef.current, [target.contact.id]: 0 };
      unreadMapRef.current = nextUnreadMap;
      setUnreadMap(nextUnreadMap);
      persistCache({ unreadMap: nextUnreadMap });
    } else if (target.type === "group") {
      groupUnreadRef.current = 0;
      setGroupUnread(0);
      persistCache({ groupUnread: 0 });
    }
  }, [persistCache, scrollToBottom]);

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
      if (modeRef.current.type === "assistant") return;
      if (modeRef.current.type === "assistantReview") return;
      loadMessages({ silent: true });
    }, 5000);
    const contactsInterval = setInterval(() => {
      if (document.hidden || !userRef.current) return;
      loadContacts();
    }, 20000);
    return () => { clearInterval(msgInterval); clearInterval(contactsInterval); };
  }, [loadMessages, loadContacts]);

  const sendAssistantMessage = async (text: string) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      content: text,
      image_url: undefined,
      sent_at: new Date().toISOString(),
      is_read: 0,
    };
    messagesRef.current = [...messagesRef.current, optimistic];
    setMessages((prev) => [...prev, optimistic]);
    isAtBottom.current = true;
    setTimeout(() => scrollToBottom("smooth"), 30);
    setSending(true);
    setAssistantTyping(true);
    try {
      const csrf = await getCsrfToken();
      const response = await fetch("/api/assistant/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf ?? "" },
        body: JSON.stringify({ content: text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "assistant failed");
      const confirmed = ((data.messages ?? []) as AssistantApiMessage[]).map((message) => mapAssistantMessage(message, currentUser));
      const withoutOptimistic = messagesRef.current.filter((message) => message.id !== optimistic.id);
      messagesRef.current = [...withoutOptimistic, ...confirmed];
      setMessages(messagesRef.current);
      setTimeout(() => scrollToBottom("smooth"), 30);
    } catch {
      const errorMessage: Message = {
        id: `assistant-error-${Date.now()}`,
        sender_id: ASSISTANT_SENDER_ID,
        sender_name: ASSISTANT_DISPLAY_NAME,
        content: "לא הצלחתי לענות כרגע. נסה שוב עוד רגע.",
        sent_at: new Date().toISOString(),
        is_read: 1,
      };
      messagesRef.current = [...messagesRef.current, errorMessage];
      setMessages(messagesRef.current);
    } finally {
      setAssistantTyping(false);
      setSending(false);
    }
  };

  const sendAssistantFeedback = async (messageId: string, action: AssistantFeedbackAction) => {
    setAssistantFeedback((current) => ({ ...current, [messageId]: action }));
    try {
      const csrf = await getCsrfToken();
      await fetch("/api/assistant/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf ?? "" },
        body: JSON.stringify({ messageId, action }),
      });
    } catch {
      setAssistantFeedback((current) => {
        const next = { ...current };
        delete next[messageId];
        return next;
      });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    if (mode.type === "assistant") {
      await sendAssistantMessage(text);
      return;
    }
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      sender_id: user!.id,
      sender_name: user!.name,
      content: text,
      image_url: undefined,
      sent_at: new Date().toISOString(),
      is_read: 0,
    };
    pendingOptimisticMessage.current = { id: optimistic.id, content: text, sentAt: new Date(optimistic.sent_at).getTime() };
    messagesRef.current = [...messagesRef.current, optimistic];
    setMessages((prev) => [...prev, optimistic]);
    isAtBottom.current = true;
    setTimeout(() => scrollToBottom("smooth"), 30);
    setSending(true);
    try {
      const body: Record<string, string> = { content: text };
      if (mode.type === "private") body.receiver_id = mode.contact.id;
      if (mode.type === "namedGroup") body.group_id = mode.group.id;
      const csrf = await getCsrfToken();
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf ?? "" },
        body: JSON.stringify(body),
      });
      await loadMessages({ silent: true });
    } finally { setSending(false); }
  };

  const togglePin = async (messageId: string, nextPinned: boolean) => {
    const previous = messagesRef.current;
    const optimisticNext = previous.map((m) => {
      if (m.id === messageId) return { ...m, pinned: nextPinned };
      if (nextPinned && m.pinned) return { ...m, pinned: false };
      return m;
    });
    messagesRef.current = optimisticNext;
    setMessages(optimisticNext);
    try {
      const csrf = await getCsrfToken();
      const res = await fetch(`/api/chat/messages/${messageId}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf ?? "" },
        body: JSON.stringify({ pinned: nextPinned }),
      });
      if (!res.ok) throw new Error("pin failed");
    } catch {
      messagesRef.current = previous;
      setMessages(previous);
    }
  };

  const reactToMessage = async (messageId: string, emoji: string) => {
    if (reactingMessageIds.current.has(messageId)) return;
    try { navigator.vibrate?.(10); } catch {}
    reactingMessageIds.current.add(messageId);
    setReactionPickerMessageId(null);
    const previous = messagesRef.current;
    const optimisticNext = previous.map((message) => message.id === messageId
      ? { ...message, reactions: getOptimisticReactions(message.reactions, emoji) }
      : message);
    messagesRef.current = optimisticNext;
    setMessages(optimisticNext);
    persistCache({ messages: optimisticNext });

    try {
      const csrf = await getCsrfToken();
      const response = await fetch(`/api/chat/messages/${encodeURIComponent(messageId)}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf ?? "" },
        body: JSON.stringify({ emoji }),
      });
      const data = await response.json() as { reactions?: Reaction[] };
      if (!response.ok || !Array.isArray(data.reactions)) throw new Error("reaction failed");
      const confirmed = messagesRef.current.map((message) => message.id === messageId
        ? { ...message, reactions: data.reactions }
        : message);
      messagesRef.current = confirmed;
      setMessages(confirmed);
      persistCache({ messages: confirmed });
    } catch {
      messagesRef.current = previous;
      setMessages(previous);
      persistCache({ messages: previous });
    } finally {
      reactingMessageIds.current.delete(messageId);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchOpen(false);
  };
  const selectChat = (m: ChatMode) => {
    setMode(m);
    setShowChat(true);
    setMessages([]);
    setReactionPickerMessageId(null);
    clearSearch();
  };
  const backToList = () => {
    setShowChat(false);
    clearSearch();
  };
  const totalUnread = groupUnread + Object.values(unreadMap).reduce((a, b) => a + b, 0);
  const isAssistantMode = mode.type === "assistant";
  const isAssistantReviewMode = mode.type === "assistantReview";
  const canPin = user?.role === "coach" && mode.type !== "private" && !isAssistantMode && !isAssistantReviewMode;
  const pinnedMessage = messages.find((m) => m.pinned);

  if (!user) return <PageSkeleton variant="chat" />;

  const displayGroupName = defaultGroupName || "קבוצה";
  const chatTitle = mode.type === "group"
    ? displayGroupName
    : mode.type === "namedGroup"
      ? mode.group.name
      : mode.type === "assistant"
        ? `${ASSISTANT_DISPLAY_NAME} 🛒`
        : mode.type === "assistantReview"
          ? "שיחות הבוט עם מתאמנים"
          : mode.contact.name;
  const isGroupActive = mode.type === "group";

  const openRenameGroup = () => {
    setGroupNameInput(displayGroupName === "קבוצה" ? "" : displayGroupName);
    setRenamingError("");
    setRenamingGroup(true);
  };

  const saveGroupName = async () => {
    const trimmed = groupNameInput.trim();
    if (!trimmed || renamingSaving) return;
    setRenamingSaving(true);
    setRenamingError("");
    try {
      const csrf = await getCsrfToken();
      const res = await fetch("/api/coach/default-group-name", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf ?? "" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "לא הצלחנו לשמור את השם");
      defaultGroupNameRef.current = data.name;
      setDefaultGroupName(data.name);
      persistCache({ defaultGroupName: data.name });
      setRenamingGroup(false);
    } catch (error) {
      setRenamingError(error instanceof Error ? error.message : "שגיאה בשמירת השם");
    } finally {
      setRenamingSaving(false);
    }
  };

  const openEditGroupMembers = async (group: NamedGroup) => {
    if (editingGroupLoadingId) return;
    setEditingGroupLoadingId(group.id);
    setEditingGroupError("");
    try {
      const response = await fetch("/api/coach/chat-groups", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "לא הצלחנו לטעון את חברי הקבוצה");
      const freshGroup = Array.isArray(data.groups)
        ? data.groups.find((entry: { id?: string }) => entry.id === group.id)
        : null;
      if (!freshGroup) throw new Error("הקבוצה לא נמצאה");
      setEditingGroup({
        id: group.id,
        name: group.name,
        memberIds: Array.isArray(freshGroup.memberIds) ? freshGroup.memberIds : [],
      });
    } catch (error) {
      setEditingGroupError(error instanceof Error ? error.message : "לא הצלחנו לטעון את חברי הקבוצה");
    } finally {
      setEditingGroupLoadingId(null);
    }
  };

  // Clients outside the default group don't see it at all; coaches always do
  const showGroupRow = user.role === "coach" || inDefaultGroup;
  const { coach: coachContact, regular: regularContacts } = partitionChatContacts(user.role, contacts);

  const assistantReviewRow = user.role === "coach" && (
    <button
      type="button"
      data-testid="coach-assistant-chats"
      onClick={() => selectChat({ type: "assistantReview" })}
      className={`mx-3 my-2 flex w-[calc(100%_-_1.5rem)] items-center gap-3 rounded-2xl border p-4 text-right shadow-lg transition-all ${isAssistantReviewMode && showChat ? "border-[#c3f400] bg-[#c3f400]/15" : "border-[#c3f400]/35 bg-[#171919] hover:border-[#c3f400]/70"}`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#c3f400]/25 bg-[#c3f400]/10 text-2xl">🛒</div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className={`truncate text-base font-bold ${isAssistantReviewMode && showChat ? "text-[#c3f400]" : "text-white"}`}>שיחות הבוט עם מתאמנים</span>
          <span className="shrink-0 rounded-full bg-[#c3f400] px-2 py-0.5 text-[9px] font-black text-[#161e00]">בקרה</span>
        </div>
        <p className="text-xs font-medium text-[#c4c9ac]">צפייה בשאלות שהמתאמנים שאלו את העוזר</p>
      </div>
      <span className="text-lg text-[#c3f400]">›</span>
    </button>
  );

  const groupRow = showGroupRow && (
    <div
      key="group"
      role="button"
      tabIndex={0}
      onClick={() => selectChat({ type: "group" })}
      onKeyDown={(e) => { if (e.key === "Enter") selectChat({ type: "group" }); }}
      className={`mx-3 my-1 flex w-[calc(100%_-_1.5rem)] cursor-pointer items-center gap-3 rounded-2xl border border-[#232a23] bg-[#121716] px-4 py-3.5 text-right transition-colors md:mx-0 md:my-0 md:w-full md:rounded-none md:border-0 md:bg-transparent ${isGroupActive && showChat ? "bg-[#c3f400]/8 border-r-2 border-[#c3f400]" : "hover:bg-[#1e2020]"}`}
    >
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#c3f400]/30 to-[#6366f1]/30 border border-[#c3f400]/20 flex items-center justify-center text-xl shrink-0" style={{ width: 44, height: 44 }}>👥</div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm truncate ${isGroupActive && showChat ? "text-[#c3f400]" : "text-white"}`}>{displayGroupName}</div>
        <div className="text-xs text-[#8e9379] truncate">כולם</div>
      </div>
      {groupUnread > 0 && <span className="bg-[#c3f400] text-[#161e00] text-xs font-black rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">{groupUnread}</span>}
      {user.role === "coach" && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openRenameGroup(); }}
          aria-label="שנה שם קבוצה"
          className="shrink-0 rounded-full p-1.5 text-[#8e9379] hover:bg-white/5 hover:text-[#c3f400]"
        >
          ✏️
        </button>
      )}
    </div>
  );

  const namedGroupRows = namedGroups.map((group) => {
    const isActive = mode.type === "namedGroup" && mode.group.id === group.id && showChat;
    return (
      <div
        key={group.id}
        role="button"
        tabIndex={0}
        onClick={() => selectChat({ type: "namedGroup", group })}
        onKeyDown={(event) => { if (event.key === "Enter") selectChat({ type: "namedGroup", group }); }}
        className={`mx-3 my-1 flex w-[calc(100%_-_1.5rem)] items-center gap-3 rounded-2xl border border-[#232a23] bg-[#121716] px-4 py-3.5 text-right transition-colors md:mx-0 md:my-0 md:w-full md:rounded-none md:border-0 md:bg-transparent ${isActive ? "border-r-2 border-[#c3f400] bg-[#c3f400]/8" : "hover:bg-[#1e2020]"}`}
      >
        <GroupPhoto imageUrl={group.imageUrl} name={group.name} />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm font-semibold ${isActive ? "text-[#c3f400]" : "text-white"}`}>{group.name}</div>
          <div className="truncate text-xs text-[#8e9379]">קבוצה פרטית</div>
        </div>
        {user.role === "coach" && (
          <button type="button"
            onClick={(event) => { event.stopPropagation(); void openEditGroupMembers(group); }}
            disabled={editingGroupLoadingId === group.id}
            aria-label="ערוך חברי קבוצה"
            className="shrink-0 rounded-full p-1.5 text-[#8e9379] hover:bg-white/5 hover:text-[#c3f400] disabled:opacity-50">
            ✏️
          </button>
        )}
      </div>
    );
  });

  const coachRow = coachContact && (() => {
    const isActive = mode.type === "private" && mode.contact.id === coachContact.id && showChat;
    const unread = unreadMap[coachContact.id] ?? 0;
    return (
      <button
        type="button"
        data-testid="featured-coach-chat"
        onClick={() => selectChat({ type: "private", contact: coachContact })}
        className={`mx-3 my-2 flex w-[calc(100%_-_1.5rem)] items-center gap-3 rounded-2xl border p-4 text-right shadow-lg transition-all ${isActive ? "border-[#c3f400] bg-[#c3f400]/15" : "border-[#c3f400]/40 bg-gradient-to-l from-[#c3f400]/12 to-[#1e2020] hover:border-[#c3f400]/70"}`}
      >
        <div className="relative shrink-0">
          <Avatar username={coachContact.username} name={coachContact.name} avatarUrl={coachContact.avatar_url} size={52} />
          <span className="absolute -bottom-1 -end-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#171919] bg-[#c3f400] text-xs">⭐</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <span className={`truncate text-base font-bold ${isActive ? "text-[#c3f400]" : "text-white"}`}>{coachContact.name}</span>
            <span className="shrink-0 rounded-full bg-[#c3f400] px-2 py-0.5 text-[9px] font-black text-[#161e00]">המאמן שלך</span>
          </div>
          <p className="text-xs font-medium text-[#c4c9ac]">שיחה ישירה ואישית עם המאמן</p>
        </div>
        {unread > 0 ? (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#c3f400] px-1.5 text-xs font-black text-[#161e00]">{unread}</span>
        ) : (
          <span className="text-lg text-[#c3f400]">‹</span>
        )}
      </button>
    );
  })();

  const assistantRow = user.role === "client" && (
    <button
      type="button"
      data-testid="assistant-chat"
      onClick={() => selectChat({ type: "assistant" })}
      className={`mx-3 my-2 flex w-[calc(100%_-_1.5rem)] items-center gap-3 rounded-2xl border p-4 text-right shadow-lg transition-all ${isAssistantMode && showChat ? "border-[#c3f400] bg-[#c3f400]/15" : "border-[#c3f400]/35 bg-[#171919] hover:border-[#c3f400]/70"}`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#c3f400]/25 bg-[#c3f400]/10 text-2xl">🛒</div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className={`truncate text-base font-bold ${isAssistantMode && showChat ? "text-[#c3f400]" : "text-white"}`}>{ASSISTANT_DISPLAY_NAME}</span>
          <span className="shrink-0 rounded-full bg-[#c3f400] px-2 py-0.5 text-[9px] font-black text-[#161e00]">AI</span>
        </div>
        <p className="text-xs font-medium text-[#c4c9ac]">שאלות מהסופר, אוכל ותזונה</p>
      </div>
      <span className="text-lg text-[#c3f400]">›</span>
    </button>
  );

  const dmRows = regularContacts.map((c) => {
    const isActive = mode.type === "private" && mode.contact.id === c.id && showChat;
    return (
      <button
        key={c.id}
        onClick={() => selectChat({ type: "private", contact: c })}
        className={`mx-3 my-1 flex w-[calc(100%_-_1.5rem)] items-center gap-3 rounded-2xl border border-[#232a23] bg-[#121716] px-4 py-3.5 text-right transition-colors md:mx-0 md:my-0 md:w-full md:rounded-none md:border-0 md:bg-transparent ${isActive ? "bg-[#c3f400]/8 border-r-2 border-[#c3f400]" : "hover:bg-[#1e2020]"}`}
      >
        <Avatar username={c.username} name={c.name} avatarUrl={c.avatar_url} />
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm truncate ${isActive ? "text-[#c3f400]" : "text-white"}`}>{c.name}</div>
          <div className="text-xs text-[#8e9379] truncate">{c.role === "coach" ? "מאמן" : "מתאמן"}</div>
        </div>
        {(unreadMap[c.id] ?? 0) > 0 && <span className="bg-[#c3f400] text-[#161e00] text-xs font-black rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">{unreadMap[c.id]}</span>}
      </button>
    );
  });

  const normalizedSearchQuery = searchOpen ? searchQuery.trim().toLowerCase() : "";
  const visibleMessages = normalizedSearchQuery
    ? messages.filter((message) => message.content.toLowerCase().includes(normalizedSearchQuery))
    : messages;
  const searchActive = normalizedSearchQuery.length > 0;
  const shouldAnimateMessage = (messageId: string) => {
    if (initialMessageIds.current.has(messageId) || animatedMessageIds.current.has(messageId)) return false;
    animatedMessageIds.current.add(messageId);
    return true;
  };

  const chatWindow = (
    <>
      {pinnedMessage && (
        <div className="flex items-start gap-2 border-b border-[#c3f400]/20 bg-[#c3f400]/5 px-4 py-2.5">
          <span className="mt-0.5 text-sm">📌</span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[#c3f400]">{pinnedMessage.sender_name}</p>
            <p className="truncate text-xs text-[#c4c9ac]">{pinnedMessage.content}</p>
          </div>
          {canPin && (
            <button
              onClick={() => togglePin(pinnedMessage.id, false)}
              aria-label="בטל נעיצה"
              className="shrink-0 rounded-full px-2 py-1 text-[10px] text-[#8e9379] hover:bg-white/5 hover:text-white"
            >
              בטל נעיצה ✕
            </button>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ background: "#0c0f0f" }}>
        {!loading && showContent && searchActive && (
          <div className="pb-1 text-xs font-medium text-[#8e9379]">{visibleMessages.length} תוצאות</div>
        )}
        {loading || !showContent ? (
          <div className="flex justify-center pt-10">
            <div className="w-6 h-6 border-2 border-[#c3f400] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isAssistantMode && messages.length === 0 ? (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
            className="pt-10 text-center text-sm text-[#8e9379]"
          >
            היי! אני העוזר. שאל אותי על קניות בסופר, מוצרים ותזונה.
          </motion.div>
        ) : messages.length === 0 ? (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
            className="pt-10 text-center text-sm text-[#8e9379]"
          >
            אין הודעות עדיין. שלח את ההודעה הראשונה! 👋
          </motion.div>
        ) : visibleMessages.length === 0 ? (
          <div className="pt-10 text-center text-sm text-[#8e9379]">לא נמצאו הודעות</div>
        ) : visibleMessages.map((msg) => {
          const isMe = msg.sender_id === user.id;
          const isNewMessage = shouldAnimateMessage(msg.id);
          const animateEntrance = !prefersReducedMotion && isNewMessage;
          return (
            <motion.div
              key={msg.id}
              initial={animateEntrance ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: animateEntrance ? 0.25 : 0 }}
              className={`flex items-end gap-2 ${isMe ? "justify-start" : "justify-end"}`}
            >
              {isMe && (
                <Avatar username={user.username} name={user.name} avatarUrl={user.avatar_url} size={30} />
              )}
              <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? "items-start" : "items-end"}`}>
                {!isMe && <span className="text-xs text-[#8e9379] px-1">{msg.sender_name}</span>}
                <div className={`rounded-2xl px-4 py-2.5 text-sm break-words leading-relaxed ${
                  isMe
                    ? "bg-[#c3f400] text-[#161e00] font-medium rounded-bl-sm"
                    : "bg-[#1e2020] border border-[#444933] text-white rounded-br-sm"
                }`}>
                  {msg.image_url && (
                    <div className="mb-2 overflow-hidden rounded-xl">
                      <Image
                        src={msg.image_url}
                        alt="תמונת ארוחה"
                        width={240}
                        height={240}
                        className="h-auto max-w-[240px] rounded-xl object-cover"
                      />
                    </div>
                  )}
                  {renderHighlightedContent(msg.content, normalizedSearchQuery)}
                </div>
                {isAssistantMode && !isMe && !msg.id.startsWith("assistant-error") && (
                  <div className="flex flex-wrap justify-end gap-1 px-1 pt-1 text-[10px]">
                    {([
                      ["liked", "אהבתי"],
                      ["disliked", "לא מדויק"],
                      ["saved", "שמור"],
                    ] as const).map(([action, label]) => {
                      const active = assistantFeedback[msg.id] === action;
                      return (
                        <button
                          key={action}
                          type="button"
                          onClick={() => void sendAssistantFeedback(msg.id, action)}
                          className={`rounded-full border px-2.5 py-1 font-semibold transition ${
                            active
                              ? "border-[#c3f400]/70 bg-[#c3f400]/15 text-[#c3f400]"
                              : "border-[#444933] bg-[#151818] text-[#8e9379] hover:border-[#c3f400]/40 hover:text-[#c3f400]"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5 px-1 text-[10px] text-[#8e9379]">
                  <span className="flex items-center gap-1.5">
                    {new Date(msg.sent_at).toLocaleTimeString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Jerusalem",
                    })}
                    {canPin && !msg.pinned && !msg.id.startsWith("opt-") && (
                      <button
                        onClick={() => togglePin(msg.id, true)}
                        aria-label="נעץ הודעה"
                        title="נעץ הודעה"
                        className="text-[#8e9379] hover:text-[#c3f400]"
                      >
                        📌
                      </button>
                    )}
                  </span>
                  {!isAssistantMode && !msg.id.startsWith("opt-") && (msg.reactions ?? []).map((reaction) => (
                    <motion.button
                      key={reaction.emoji}
                      onClick={() => void reactToMessage(msg.id, reaction.emoji)}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.85 }}
                      className={`rounded-full border px-2 py-0.5 text-[11px] transition ${reaction.reactedByMe
                        ? "border-[#c3f400]/50 bg-[#c3f400]/10 text-[#c3f400]"
                        : "border-[#444933] bg-[#282a2b] text-[#c4c9ac] hover:border-[#c3f400]/30"}`}
                      aria-label={`תגובה ${reaction.emoji}, ${reaction.count}`}
                    >
                      {reaction.emoji} {reaction.count}
                    </motion.button>
                  ))}
                  {!isAssistantMode && !msg.id.startsWith("opt-") && (
                    <motion.button
                      onClick={() => setReactionPickerMessageId((current) => current === msg.id ? null : msg.id)}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.85 }}
                      className="flex h-5 min-w-5 items-center justify-center rounded-full border border-[#444933] bg-[#1e2020] px-1.5 text-xs text-[#8e9379] hover:border-[#c3f400]/40 hover:text-[#c3f400]"
                      aria-label="הוסף תגובה"
                    >
                      +
                    </motion.button>
                  )}
                  {reactionPickerMessageId === msg.id && (
                    <div className="flex items-center gap-1 rounded-full border border-[#444933] bg-[#1e2020] p-1 shadow-lg">
                      {REACTION_EMOJIS.map((emoji) => (
                        <motion.button
                          key={emoji}
                          onClick={() => void reactToMessage(msg.id, emoji)}
                          whileTap={prefersReducedMotion ? undefined : { scale: 0.85 }}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-base hover:bg-[#c3f400]/10"
                          aria-label={`הגב עם ${emoji}`}
                        >
                          {emoji}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {!isMe && (
                <Avatar username={msg.sender_username} name={msg.sender_name} avatarUrl={msg.sender_avatar_url} size={30} />
              )}
            </motion.div>
          );
        })}
        {assistantTyping && (
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-br-sm border border-[#444933] bg-[#1e2020] px-4 py-2.5 text-sm text-white">
              העוזר כותב...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-[#1e2020] p-3 pb-[max(12px,env(safe-area-inset-bottom))]" style={{ background: "#0c0f0f" }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={isAssistantMode ? "שאל את העוזר..." : "כתוב הודעה..."}
            rows={1}
            maxLength={isAssistantMode ? 500 : 1000}
            className="flex-1 rounded-2xl px-4 py-3 text-base md:text-sm resize-none outline-none placeholder-[#8e9379] text-white transition-all"
            style={{ minHeight: "44px", maxHeight: "120px", background: "#1e2020", border: "1px solid #444933" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#c3f400"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(195,244,0,0.1)"; setTimeout(() => scrollToBottom("auto"), 250); }}
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

  const activeChatWindow = isAssistantReviewMode
    ? (
      <div className="flex-1 overflow-hidden p-4" style={{ background: "#0c0f0f" }}>
        <AssistantChatReview clients={regularContacts.map((contact) => ({ id: contact.id, name: contact.name }))} fullHeight />
      </div>
    )
    : chatWindow;

  const isCoach = user?.role === "coach";
  const groupsHeaderRow = (isCoach || namedGroups.length > 0) && (
    <div className="flex items-center justify-between px-4 pt-4 pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8e9379]">הקבוצות שלי</span>
      {isCoach && (
        <button
          onClick={() => setShowGroupCreator(true)}
          className="rounded-full bg-[#c3f400]/10 px-2.5 py-1 text-[10px] font-bold text-[#c3f400] hover:bg-[#c3f400]/20"
        >
          + קבוצה חדשה
        </button>
      )}
    </div>
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
        <div className="min-w-0 flex-1">
          {showChat && searchOpen ? (
            <div>
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="חפש בשיחה..."
                  className="min-w-0 flex-1 rounded-xl border border-[#444933] bg-[#1e2020] px-3 py-2 text-base md:text-sm text-white outline-none placeholder:text-[#8e9379] focus:border-[#c3f400]/60"
                />
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="סגור חיפוש"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8e9379] hover:bg-white/5 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 text-[10px] text-[#8e9379]">החיפוש כולל רק את ההודעות האחרונות שנטענו בשיחה</p>
            </div>
          ) : (
            <>
              <h1 className="text-white font-bold text-lg leading-tight truncate">
                {showChat ? chatTitle : "צ׳אט"}
              </h1>
              {!showChat && totalUnread > 0 && (
                <span className="text-xs text-[#c3f400]">{totalUnread} הודעות שלא נקראו</span>
              )}
            </>
          )}
        </div>
        {showChat && !searchOpen && !isAssistantReviewMode && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="חפש בשיחה"
            title="חפש בשיחה"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#444933] bg-[#1e2020] text-[#c4c9ac] hover:border-[#c3f400]/40 hover:text-[#c3f400]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
            </svg>
          </button>
        )}
      </header>

      {/* MOBILE */}
      <div className="flex flex-1 overflow-hidden md:hidden">
        {!showChat ? (
          <div className="flex-1 overflow-y-auto" style={{ background: "#0c0f0f" }}>
            {coachRow && <div className="px-4 pt-4 pb-0 text-[10px] font-semibold uppercase tracking-widest text-[#c3f400]">המאמן שלך</div>}
            {coachRow}
            {assistantReviewRow && <div className="px-4 pt-4 pb-0 text-[10px] font-semibold uppercase tracking-widest text-[#c3f400]">בוט מתאמנים</div>}
            {assistantReviewRow}
            {assistantRow && <div className="px-4 pt-4 pb-0 text-[10px] font-semibold uppercase tracking-widest text-[#c3f400]">עוזר קניות</div>}
            {assistantRow}
            <div className="px-4 pt-4 pb-1 text-[10px] text-[#8e9379] uppercase tracking-widest font-semibold">שיחות</div>
            {groupRow}
            {groupsHeaderRow}
            {namedGroupRows}
            {regularContacts.length > 0 && <div className="px-4 pt-4 pb-1 text-[10px] text-[#8e9379] uppercase tracking-widest font-semibold">פרטי</div>}
            {dmRows}
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">{activeChatWindow}</div>
        )}
      </div>

      {/* DESKTOP */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <aside className="w-64 border-l border-[#1e2020] flex flex-col shrink-0 overflow-y-auto" style={{ background: "#0d1010" }}>
          {coachRow && <div className="px-4 pt-4 pb-0 text-[10px] font-semibold uppercase tracking-widest text-[#c3f400]">המאמן שלך</div>}
          {coachRow}
          {assistantReviewRow && <div className="px-4 pt-4 pb-0 text-[10px] font-semibold uppercase tracking-widest text-[#c3f400]">בוט מתאמנים</div>}
          {assistantReviewRow}
          {assistantRow && <div className="px-4 pt-4 pb-0 text-[10px] font-semibold uppercase tracking-widest text-[#c3f400]">עוזר קניות</div>}
          {assistantRow}
          <div className="px-4 pt-4 pb-1 text-[10px] text-[#8e9379] uppercase tracking-widest font-semibold">שיחות</div>
          {groupRow}
          {groupsHeaderRow}
          {namedGroupRows}
          {regularContacts.length > 0 && <div className="px-4 pt-4 pb-1 text-[10px] text-[#8e9379] uppercase tracking-widest font-semibold">פרטי</div>}
          {dmRows}
        </aside>
        <main className="flex-1 flex flex-col overflow-hidden">{activeChatWindow}</main>
      </div>

      {showGroupCreator && (
        <ChatGroupCreator
          clients={contacts.filter((c) => c.role === "client")}
          onClose={() => setShowGroupCreator(false)}
          onSaved={async () => {
            setShowGroupCreator(false);
            await loadContacts();
          }}
        />
      )}

      {editingGroup && (
        <EditGroupMembers
          groupId={editingGroup.id}
          groupName={editingGroup.name}
          clients={regularContacts.map((contact) => ({ id: contact.id, name: contact.name }))}
          currentMemberIds={editingGroup.memberIds}
          onClose={() => setEditingGroup(null)}
        />
      )}

      {editingGroupError && (
        <div className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-sm rounded-xl border border-red-400/30 bg-[#291719] p-3 text-center text-sm text-red-200 shadow-xl">
          {editingGroupError}
        </div>
      )}

      {renamingGroup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={() => setRenamingGroup(false)}>
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#171919]/95 p-6 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-bold">שם הקבוצה הכללית</h2>
            <input
              autoFocus
              value={groupNameInput}
              onChange={(e) => setGroupNameInput(e.target.value)}
              maxLength={40}
              placeholder="לדוגמה: המתאמנים שלי"
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/30 focus:border-[#c3f400]/60 focus:ring-4 focus:ring-[#c3f400]/10"
            />
            {renamingError && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{renamingError}</p>}
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setRenamingGroup(false)} className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white/70 hover:bg-white/5">ביטול</button>
              <button
                type="button"
                onClick={() => void saveGroupName()}
                disabled={renamingSaving || !groupNameInput.trim()}
                className="flex-1 rounded-xl bg-[#c3f400] px-5 py-3 font-bold text-[#161e00] transition hover:bg-[#d4ff26] disabled:opacity-50"
              >
                {renamingSaving ? "שומר..." : "שמור"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
