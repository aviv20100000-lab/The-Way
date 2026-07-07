"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import MealHistory from "@/components/MealHistory";
import CoachDailySummary from "@/components/coach/CoachDailySummary";
import CoachActivityNotifications from "@/components/coach/CoachActivityNotifications";
import CoachInsightsPanel from "@/components/coach/CoachInsightsPanel";
import CoachMealsPanel, { type CoachMealLog } from "@/components/coach/CoachMealsPanel";
import ClientListCard, { type CoachClient } from "@/components/coach/ClientListCard";
import AssistantChatReview from "@/components/coach/AssistantChatReview";
import SuccessToast from "@/components/SuccessToast";
import { withCsrf } from "@/lib/csrf-client";

const AddClientForm = dynamic(() => import("@/components/coach/AddClientForm"), {
  loading: () => <div className="skeleton h-48 rounded-3xl" />,
});

const ClientGoalsWizard = dynamic(() => import("@/components/coach/ClientGoalsWizard"), {
  loading: () => <div className="skeleton h-80 rounded-3xl" />,
});

const MenuBuilder = dynamic(() => import("@/components/coach/MenuBuilder"), {
  loading: () => <div className="fixed inset-0 z-[70] bg-black/70 p-4"><div className="skeleton mx-auto h-full max-w-3xl rounded-3xl" /></div>,
});

type CoachTab = "clients" | "menus" | "food" | "quotes" | "insights";

interface Quote {
  id: string;
  text: string;
  author: string | null;
}

interface Goals {
  target_weight_kg: number | null;
  daily_calories: number | null;
  daily_protein_g: number | null;
  daily_water_ml: number;
  daily_steps: number | null;
  weigh_in_frequency_weeks: number | null;
}

interface ClientSummary {
  weights: { weight_kg: number; logged_at: string }[];
  steps_today: number;
  water_today: number;
  meals: { id: string; total_calories: number; logged_at: string; items: { name: string; calories: number; estimated_weight_g: number }[] }[];
  goals: { target_weight_kg: number | null; daily_calories: number | null; daily_protein_g: number | null; daily_water_ml: number; daily_steps: number | null };
}

interface CoachGroupOption {
  id: string;
  name: string;
}

const EMPTY_GOALS: Goals = { target_weight_kg: null, daily_calories: null, daily_protein_g: null, daily_water_ml: 2000, daily_steps: null, weigh_in_frequency_weeks: null };

export default function CoachPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [tab, setTab] = useState<CoachTab>("clients");
  const [coachName, setCoachName] = useState("מאמן");

  // Clients
  const [clients, setClients] = useState<CoachClient[]>([]);
  const [clientGroupFilter, setClientGroupFilter] = useState<"all" | "in" | "out">("all");
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", password: "", groupIds: [] as string[] });
  const [addError, setAddError] = useState("");
  const [addWarning, setAddWarning] = useState("");
  const [groupOptions, setGroupOptions] = useState<CoachGroupOption[]>([{ id: "default", name: "קבוצה ראשית" }]);
  const [selectedClient, setSelectedClient] = useState<CoachClient | null>(null);
  const [clientGoals, setClientGoals] = useState<Goals>(EMPTY_GOALS);
  const [savingGoals, setSavingGoals] = useState(false);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalsError, setGoalsError] = useState("");
  const [wizardClient, setWizardClient] = useState<CoachClient | null>(null);
  const [menuClient, setMenuClient] = useState<CoachClient | null>(null);
  const [dataClient, setDataClient] = useState<CoachClient | null>(null);
  const [clientData, setClientData] = useState<ClientSummary | null>(null);
  const [clientDataError, setClientDataError] = useState("");
  const goalsRequestRef = useRef(0);
  const dataRequestRef = useRef(0);

  // Quotes
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [newQuote, setNewQuote] = useState({ text: "", author: "" });
  const [addingQuote, setAddingQuote] = useState(false);
  const [pendingQuoteDelete, setPendingQuoteDelete] = useState<{ quote: Quote; index: number } | null>(null);
  const pendingQuoteDeleteRef = useRef<{ quote: Quote; index: number } | null>(null);
  const quoteDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Food logs
  const [foodLogs, setFoodLogs] = useState<CoachMealLog[]>([]);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodError, setFoodError] = useState("");

  // Push notifications
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushUserId, setPushUserId] = useState("");
  const [sendingPush, setSendingPush] = useState(false);
  const [pushResult, setPushResult] = useState("");
  const [testingPush, setTestingPush] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);

  const loadClients = useCallback(async () => {
    try {
      const res = await fetch("/api/users/clients");
      if (res.status === 401 || res.status === 403) { router.push("/login"); return; }
      const data = await res.json();
      setClients(data || []);
    } catch (e) {
      console.error("Error loading clients:", e);
      setClients([]);
    }
  }, [router]);

  const loadGroupOptions = useCallback(async () => {
    try {
      const [contactsResponse, groupsResponse] = await Promise.all([
        fetch("/api/chat/contacts"),
        fetch("/api/coach/chat-groups"),
      ]);
      const contactsData = contactsResponse.ok ? await contactsResponse.json() : {};
      const groupsData = groupsResponse.ok ? await groupsResponse.json() : { groups: [] };
      const defaultName = contactsData.defaultGroupName || "קבוצה ראשית";
      const namedGroups = Array.isArray(groupsData.groups)
        ? groupsData.groups.map((group: { id: string; name: string }) => ({ id: group.id, name: group.name }))
        : [];
      setGroupOptions([{ id: "default", name: defaultName }, ...namedGroups]);
    } catch (error) {
      console.error("Error loading coach groups:", error);
      setGroupOptions([{ id: "default", name: "קבוצה ראשית" }]);
    }
  }, []);

  const toggleGroupMembership = useCallback(async (client: CoachClient) => {
    const nextInGroup = !client.in_default_group;
    // Optimistic update; revert on failure
    setClients((current) => current.map((item) => item.id === client.id ? { ...item, in_default_group: nextInGroup } : item));
    try {
      const res = await fetch("/api/coach/group-membership", {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ clientId: client.id, inGroup: nextInGroup }),
      });
      if (!res.ok) throw new Error("toggle failed");
    } catch (e) {
      console.error("Error toggling group membership:", e);
      setClients((current) => current.map((item) => item.id === client.id ? { ...item, in_default_group: client.in_default_group } : item));
    }
  }, []);

  const loadQuotes = useCallback(async () => {
    try {
      const res = await fetch("/api/motivation/quotes?action=list");
      const data = await res.json();
      setQuotes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error loading quotes:", e);
      setQuotes([]);
    }
  }, []);

  const loadFoodLogs = useCallback(async () => {
    setFoodLoading(true);
    setFoodError("");
    try {
      const res = await fetch("/api/coach/meals");
      if (!res.ok) throw new Error(`Meals request failed: ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid meals response");
      setFoodLogs(data);
    } catch (e) {
      console.error("Error loading food logs:", e);
      setFoodLogs([]);
      setFoodError("לא הצלחנו לטעון את הארוחות. אפשר לנסות שוב.");
    } finally {
      setFoodLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.name) setCoachName(d.name); })
      .catch(() => {});
    loadClients();
    loadGroupOptions();
  }, [loadClients, loadGroupOptions]);

  useEffect(() => {
    if (tab === "quotes") loadQuotes();
    if (tab === "food") loadFoodLogs();
  }, [tab, loadQuotes, loadFoodLogs]);

  // Prefetch the chat route bundle for instant navigation
  useEffect(() => {
    router.prefetch("/chat");
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", headers: await withCsrf() });
    // Wipe ALL cached data (home/chat/water/weight/user) so the next login
    // never briefly shows a different account's stale numbers.
    sessionStorage.clear();
    window.location.href = "/login";
  }

  async function addClient() {
    setAddError("");
    setAddWarning("");
    const selectedGroupIds = [...newClient.groupIds];
    const res = await fetch("/api/users/clients", {
      method: "POST",
      headers: await withCsrf({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name: newClient.name, email: newClient.email, password: newClient.password }),
    });
    const data = await res.json();
    if (!res.ok) { setAddError(data.error); return; }
    setShowAddClient(false);
    setNewClient({ name: "", email: "", password: "", groupIds: [] });
    setSuccessMessage("המתאמן נוסף");
    void loadClients();

    void Promise.allSettled(selectedGroupIds.map(async (groupId) => {
      const endpoint = groupId === "default"
        ? "/api/coach/group-membership"
        : `/api/coach/chat-groups/${encodeURIComponent(groupId)}/members`;
      const body = groupId === "default"
        ? { clientId: data.id, inGroup: true }
        : { clientId: data.id };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`group assignment failed: ${groupId}`);
    })).then((results) => {
      const failures = results.filter((result) => result.status === "rejected").length;
      if (failures > 0) {
        console.error(`Failed to assign new client to ${failures} group(s)`);
        setAddWarning("המתאמן נוצר, אך חלק מהקבוצות לא עודכנו. אפשר לתקן זאת במסך הצ׳אט.");
      }
      void loadClients();
    });
  }

  async function openClientGoals(client: CoachClient) {
    const requestId = ++goalsRequestRef.current;
    setSelectedClient(client);
    setClientGoals(EMPTY_GOALS);
    setGoalsError("");
    setGoalsLoading(true);
    try {
      const res = await fetch(`/api/users/goals?userId=${client.id}`);
      if (!res.ok) throw new Error(`Goals request failed: ${res.status}`);
      const data = await res.json();
      if (requestId !== goalsRequestRef.current) return;
      setClientGoals({
        target_weight_kg: data.target_weight_kg ?? null,
        daily_calories: data.daily_calories ?? null,
        daily_protein_g: data.daily_protein_g ?? null,
        daily_water_ml: data.daily_water_ml ?? 2000,
        daily_steps: data.daily_steps ?? null,
        weigh_in_frequency_weeks: data.weigh_in_frequency_weeks ?? null,
      });
    } catch {
      if (requestId === goalsRequestRef.current) setGoalsError("לא הצלחנו לטעון את היעדים של המתאמן.");
    } finally {
      if (requestId === goalsRequestRef.current) setGoalsLoading(false);
    }
  }

  async function openClientData(client: CoachClient) {
    const requestId = ++dataRequestRef.current;
    setDataClient(client);
    setClientData(null);
    setClientDataError("");
    try {
      const res = await fetch(`/api/client-summary?userId=${client.id}`);
      if (!res.ok) throw new Error(`Summary request failed: ${res.status}`);
      const data = await res.json();
      if (requestId === dataRequestRef.current) setClientData(data);
    } catch {
      if (requestId === dataRequestRef.current) setClientDataError("לא הצלחנו לטעון את נתוני המתאמן.");
    }
  }

  async function saveGoals() {
    if (!selectedClient) return;
    setSavingGoals(true);
    const res = await fetch("/api/users/goals", {
      method: "POST",
      headers: await withCsrf({ "Content-Type": "application/json" }),
      body: JSON.stringify({ userId: selectedClient.id, ...clientGoals }),
    });
    setSavingGoals(false);
    if (!res.ok) {
      setGoalsError("שמירת היעדים נכשלה. הנתונים לא שונו.");
      return;
    }
    setSuccessMessage("היעדים נשמרו");
    setSelectedClient(null);
    loadClients();
  }

  async function addQuote() {
    if (!newQuote.text.trim()) return;
    setAddingQuote(true);
    await fetch("/api/motivation/quotes", {
      method: "POST",
      headers: await withCsrf({ "Content-Type": "application/json" }),
      body: JSON.stringify(newQuote),
    });
    setNewQuote({ text: "", author: "" });
    setAddingQuote(false);
    loadQuotes();
  }

  async function testPush() {
    setTestingPush(true);
    setPushResult("");
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: await withCsrf(),
      });
      const data = await res.json();
      setPushResult(data.ok ? `✅ ${data.message}` : `❌ ${data.error ?? data.message}`);
    } finally {
      setTestingPush(false);
    }
  }

  async function sendPush() {
    if (!pushTitle.trim() || !pushBody.trim()) return;
    setSendingPush(true);
    setPushResult("");
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title: pushTitle, body: pushBody, ...(pushUserId ? { userId: pushUserId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Push request failed");
      setPushResult(`נשלח ל-${data.sent} ${pushUserId ? "מתאמן" : "מתאמנים"} ✓`);
      setPushTitle("");
      setPushBody("");
    } catch {
      setPushResult("❌ השליחה נכשלה. אפשר לנסות שוב.");
    } finally {
      setSendingPush(false);
    }
  }

  function restoreQuote(pending: { quote: Quote; index: number }) {
    setQuotes((current) => {
      if (current.some((quote) => quote.id === pending.quote.id)) return current;
      const restored = [...current];
      restored.splice(Math.min(pending.index, restored.length), 0, pending.quote);
      return restored;
    });
  }

  async function commitQuoteDelete(pending: { quote: Quote; index: number }) {
    try {
      const res = await fetch("/api/motivation/quotes", {
        method: "DELETE",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ quoteId: pending.quote.id }),
      });
      if (!res.ok) throw new Error("quote delete failed");
    } catch (e) {
      console.error("Error deleting quote:", e);
      restoreQuote(pending);
    }
  }

  function deleteQuote(id: string) {
    const quoteIndex = quotes.findIndex((quote) => quote.id === id);
    if (quoteIndex < 0) return;

    if (quoteDeleteTimerRef.current) clearTimeout(quoteDeleteTimerRef.current);
    const previousPending = pendingQuoteDeleteRef.current;
    if (previousPending) void commitQuoteDelete(previousPending);

    const pending = { quote: quotes[quoteIndex], index: quoteIndex };
    setQuotes((current) => current.filter((quote) => quote.id !== id));
    pendingQuoteDeleteRef.current = pending;
    setPendingQuoteDelete(pending);
    quoteDeleteTimerRef.current = setTimeout(() => {
      void commitQuoteDelete(pending);
      if (pendingQuoteDeleteRef.current === pending) {
        pendingQuoteDeleteRef.current = null;
        setPendingQuoteDelete(null);
      }
      quoteDeleteTimerRef.current = null;
    }, 5000);
  }

  function undoQuoteDelete() {
    const pending = pendingQuoteDeleteRef.current;
    if (!pending) return;
    if (quoteDeleteTimerRef.current) clearTimeout(quoteDeleteTimerRef.current);
    quoteDeleteTimerRef.current = null;
    pendingQuoteDeleteRef.current = null;
    setPendingQuoteDelete(null);
    restoreQuote(pending);
  }

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (refreshing) return;
    touchStartY.current = event.touches[0].clientY;
    setPullDistance(0);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (refreshing || touchStartY.current === 0) return;
    const distance = event.touches[0].clientY - touchStartY.current;
    if (distance > 0 && window.scrollY <= 0) setPullDistance(distance);
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 80) {
      try { navigator.vibrate?.(15); } catch {}
      setRefreshing(true);
      try {
        if (tab === "clients") await loadClients();
        if (tab === "food") await loadFoodLogs();
        if (tab === "quotes") await loadQuotes();
      } finally {
        setRefreshing(false);
      }
    }
    touchStartY.current = 0;
    setPullDistance(0);
  };

  const visibleClients = useMemo(() => {
    return [...clients]
      .sort((a, b) => Number(b.in_default_group) - Number(a.in_default_group) || a.name.localeCompare(b.name, "he"))
      .filter((client) => clientGroupFilter === "all" || (clientGroupFilter === "in" ? client.in_default_group : !client.in_default_group));
  }, [clients, clientGroupFilter]);

  const clientsInGroup = clients.filter((client) => client.in_default_group).length;
  const clientsOutOfGroup = clients.length - clientsInGroup;

  return (
    <div
      className="min-h-screen pb-24 text-white"
      dir="rtl"
      style={{ background: "#0c0f0f" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <motion.div
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center"
          style={{ height: pullDistance }}
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
        >
          <motion.div
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c3f400]/25 bg-[#1a1c1c] text-2xl font-bold text-[#c3f400] shadow-lg"
            animate={{ rotate: prefersReducedMotion ? 0 : refreshing ? 360 : (pullDistance / 80) * 360 }}
            transition={{ duration: refreshing && !prefersReducedMotion ? 1 : 0, repeat: refreshing && !prefersReducedMotion ? Infinity : 0 }}
            aria-label={refreshing ? "מרענן" : "משוך לרענון"}
          >
            {refreshing ? "↻" : "↓"}
          </motion.div>
        </motion.div>
      )}
      <header className="sticky top-0 z-20 border-b border-[#1e2020] bg-[#0c0f0f]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">THE WAY — מאמן</h1>
              <span className="text-xs font-normal text-[#8e9379]">by Aviv & Liav</span>
            </div>
            <p className="text-xs text-[#c4c9ac] font-normal">היי {coachName} 👋</p>
          </div>
          <div className="flex items-center gap-2">
            <CoachActivityNotifications
              onOpenClient={(clientId) => {
                const client = clients.find((item) => item.id === clientId);
                if (client) void openClientData(client);
              }}
            />
            <button onClick={logout} className="min-h-11 rounded-lg bg-[#282a2b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#333535] transition-all duration-200">יציאה</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 pt-5">
        <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >

        {tab === "clients" && (
          <div className="space-y-6">
            <CoachDailySummary />

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">המתאמנים שלך</h2>
              <button onClick={() => { setAddWarning(""); void loadGroupOptions(); setShowAddClient(true); }}
                className="rounded-lg bg-[#c3f400] px-5 py-2.5 text-sm font-semibold text-[#161e00] hover:bg-[#d4ff26] transition-all duration-300">
                + הוסף
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#444933] bg-[#171919] p-1.5" aria-label="סינון מתאמנים לפי קבוצה">
              {([
                { id: "all", label: "כולם", count: clients.length },
                { id: "in", label: "בקבוצה", count: clientsInGroup },
                { id: "out", label: "מחוץ לקבוצה", count: clientsOutOfGroup },
              ] as const).map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setClientGroupFilter(filter.id)}
                  className={`rounded-xl px-2 py-2.5 text-xs font-bold transition-colors ${clientGroupFilter === filter.id ? "bg-[#c3f400] text-[#161e00]" : "text-[#c4c9ac] hover:bg-[#282a2b]"}`}
                >
                  {filter.label} <span className="opacity-70">({filter.count})</span>
                </button>
              ))}
            </div>

            {clientGroupFilter === "all" && clientsOutOfGroup > 0 && (
              <p className="-mt-3 text-xs text-[#8e9379]">המתאמנים שבקבוצה מוצגים ראשונים; מי שמחוץ לקבוצה מופיע בתחתית.</p>
            )}

            <AssistantChatReview clients={clients} />

            {showAddClient && (
              <AddClientForm
                value={newClient}
                groups={groupOptions}
                error={addError}
                onChange={setNewClient}
                onCancel={() => setShowAddClient(false)}
                onSubmit={() => void addClient()}
              />
            )}

            {addWarning && (
              <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">{addWarning}</p>
            )}

            {clients.length === 0 && !showAddClient && (
              <p className="text-center text-[#8e9379] py-10 text-sm">עוד אין מתאמנים — לחץ על הוסף כדי להתחיל</p>
            )}

            {visibleClients.length === 0 && clients.length > 0 && (
              <p className="py-8 text-center text-sm text-[#8e9379]">אין מתאמנים בסינון הזה</p>
            )}

            {visibleClients.map((client) => (
              <div key={client.id} className="space-y-2">
                <ClientListCard
                  client={client}
                  onOpenData={(selected) => void openClientData(selected)}
                  onOpenGoals={(selected) => void openClientGoals(selected)}
                  onOpenWizard={setWizardClient}
                  onAvatarUploaded={(clientId, url) => setClients((current) => current.map((item) => item.id === clientId ? { ...item, avatar_url: url } : item))}
                  onToggleGroup={(selected) => void toggleGroupMembership(selected)}
                />
                <button type="button" onClick={() => { setMenuClient(client); setTab("menus"); }}
                  className="w-full rounded-xl border border-[#c3f400]/25 bg-[#c3f400]/10 py-2.5 text-sm font-bold text-[#c3f400] transition hover:bg-[#c3f400]/15">
                  🍽️ בניית תפריט
                </button>
              </div>
            ))}

            {wizardClient && (
              <ClientGoalsWizard
                client={wizardClient}
                onClose={() => setWizardClient(null)}
                onSaved={async () => {
                  setWizardClient(null);
                  await loadClients();
                }}
              />
            )}

            {selectedClient && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={() => setSelectedClient(null)}>
                <div className="w-full max-w-lg rounded-t-lg glass-card p-6 shadow-xl space-y-5" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold text-white">🎯 יעדים של {selectedClient.name}</h3>

                  {goalsLoading && <p className="text-sm text-[#8e9379]">טוען את היעדים...</p>}
                  {goalsError && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{goalsError}</p>}

                  <label className="block">
                    <span className="text-xs font-semibold text-[#c4c9ac] uppercase tracking-wide">יעד משקל (ק"ג)</span>
                    <input type="number" step="0.5"
                      value={clientGoals.target_weight_kg ?? ""}
                      onChange={(e) => setClientGoals({ ...clientGoals, target_weight_kg: e.target.value ? parseFloat(e.target.value) : null })}
                      className="mt-2 w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[#c3f400] transition-all"
                      placeholder="לדוגמה: 75" />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[#c4c9ac] uppercase tracking-wide">יעד קלוריות יומי</span>
                    <input type="number"
                      value={clientGoals.daily_calories ?? ""}
                      onChange={(e) => setClientGoals({ ...clientGoals, daily_calories: e.target.value ? parseInt(e.target.value) : null })}
                      className="mt-2 w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[#c3f400] transition-all"
                      placeholder="לדוגמה: 1800" />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[#c4c9ac] uppercase tracking-wide">יעד חלבון יומי (גרם)</span>
                    <input type="number"
                      value={clientGoals.daily_protein_g ?? ""}
                      onChange={(e) => setClientGoals({ ...clientGoals, daily_protein_g: e.target.value ? parseInt(e.target.value) : null })}
                      className="mt-2 w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[#c3f400] transition-all"
                      placeholder="לדוגמה: 120" />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[#c4c9ac] uppercase tracking-wide">יעד מים יומי (מ"ל)</span>
                    <input type="number"
                      value={clientGoals.daily_water_ml}
                      onChange={(e) => setClientGoals({ ...clientGoals, daily_water_ml: parseInt(e.target.value) || 2000 })}
                      className="mt-2 w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[#c3f400] transition-all" />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[#c4c9ac] uppercase tracking-wide">יעד צעדים יומי</span>
                    <input type="number"
                      value={clientGoals.daily_steps ?? ""}
                      onChange={(e) => setClientGoals({ ...clientGoals, daily_steps: e.target.value ? parseInt(e.target.value) : null })}
                      className="mt-2 w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[#c3f400] transition-all"
                      placeholder="לדוגמה: 10000" />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[#c4c9ac] uppercase tracking-wide">תזכורת שקילה (כל יום ראשון, 8:00)</span>
                    <select
                      value={clientGoals.weigh_in_frequency_weeks ?? 0}
                      onChange={(e) => setClientGoals({ ...clientGoals, weigh_in_frequency_weeks: parseInt(e.target.value) || null })}
                      className="mt-2 w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[#c3f400] transition-all"
                    >
                      <option value={0}>ללא תזכורת</option>
                      <option value={1}>כל שבוע</option>
                      <option value={2}>כל שבועיים</option>
                    </select>
                  </label>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setSelectedClient(null)}
                      className="flex-1 rounded-lg border border-[#444933] py-3 text-white font-semibold hover:bg-[#1e2020] transition-all">ביטול</button>
                    <button onClick={saveGoals} disabled={savingGoals || goalsLoading || Boolean(goalsError)}
                      className="flex-1 rounded-lg bg-[#c3f400] py-3 text-[#161e00] font-semibold hover:bg-[#d4ff26] disabled:opacity-50 transition-all">
                      {savingGoals ? "שומר..." : "שמור יעדים"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {dataClient && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setDataClient(null)}>
                <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-t-lg glass-card p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="sticky top-0 flex items-center justify-between bg-[#1e2020] pb-1">
                    <h3 className="font-semibold text-lg text-white">📊 {dataClient.name}</h3>
                    <button onClick={() => setDataClient(null)} className="text-[#8e9379] text-2xl leading-none">×</button>
                  </div>

                  {clientDataError ? (
                    <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-center">
                      <p className="text-sm text-red-200">{clientDataError}</p>
                      <button type="button" onClick={() => void openClientData(dataClient)} className="mt-3 text-sm font-semibold text-[#c3f400]">נסה שוב</button>
                    </div>
                  ) : !clientData ? (
                    <p className="text-center text-[#8e9379] py-8 font-normal">טוען נתונים...</p>
                  ) : (
                    <>
                      {/* Weight */}
                      <div className="rounded-2xl bg-[#1e2020] p-4 ">
                        <p className="text-sm font-semibold text-[#c4c9ac] mb-2">⚖️ משקל</p>
                        {clientData.weights.length === 0 ? (
                          <p className="text-sm text-[#8e9379] font-normal">עוד לא נשקל</p>
                        ) : (
                          <>
                            <div className="flex items-end gap-2 mb-3">
                              <span className="text-3xl font-bold text-white">{clientData.weights[0].weight_kg}</span>
                              <span className="text-[#8e9379] mb-1 font-normal">ק"ג</span>
                              {clientData.weights.length > 1 && (() => {
                                const diff = clientData.weights[0].weight_kg - clientData.weights[1].weight_kg;
                                return (
                                  <span className={`mb-1 text-sm font-medium ${diff < 0 ? "text-green-700" : diff > 0 ? "text-red-300" : "text-[#8e9379]"}`}>
                                    {diff < 0 ? "▼" : diff > 0 ? "▲" : ""}{Math.abs(diff).toFixed(1)}
                                  </span>
                                );
                              })()}
                              {clientData.goals.target_weight_kg && (
                                <span className="ms-auto text-sm text-green-700 mb-1">יעד: {clientData.goals.target_weight_kg}</span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {clientData.weights.map((w, i) => (
                                <div key={i} className="flex justify-between text-sm border-b border-[#444933] py-1">
                                  <span className="text-[#8e9379]">{new Date(w.logged_at).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit", timeZone: "Asia/Jerusalem" })}</span>
                                  <span className="font-medium text-[#c4c9ac]">{w.weight_kg} ק"ג</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Steps + Water today */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl glass-card p-4  text-center">
                          <p className="text-xs text-[#8e9379] mb-1">👟 צעדים היום</p>
                          <p className="text-2xl font-bold text-[#c3f400]">{clientData.steps_today.toLocaleString()}</p>
                        </div>
                        <div className="rounded-2xl glass-card p-4  text-center">
                          <p className="text-xs text-[#8e9379] mb-1">💧 מים היום</p>
                          <p className="text-2xl font-bold text-[#c3f400]">{(clientData.water_today / 1000).toFixed(1)}<span className="text-sm">L</span></p>
                          <p className="text-xs text-[#8e9379]">יעד {(clientData.goals.daily_water_ml / 1000).toFixed(1)}L</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl glass-card p-4 text-center">
                          <p className="text-xs text-[#8e9379] mb-1">קלוריות היום</p>
                          <p className="text-2xl font-bold text-[#c3f400]">
                            {clientData.meals
                              .filter((meal) => new Date(meal.logged_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }) === new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }))
                              .reduce((sum, meal) => sum + (Number(meal.total_calories) || 0), 0)
                              .toLocaleString()}
                          </p>
                          <p className="text-xs text-[#8e9379]">יעד {clientData.goals.daily_calories?.toLocaleString() ?? "לא הוגדר"}</p>
                        </div>
                        <div className="rounded-2xl glass-card p-4 text-center">
                          <p className="text-xs text-[#8e9379] mb-1">יעד צעדים</p>
                          <p className="text-2xl font-bold text-white">{clientData.goals.daily_steps?.toLocaleString() ?? "—"}</p>
                          <p className="text-xs text-[#8e9379]">בפועל {clientData.steps_today.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Meals — day / week / month */}
                      <div className="rounded-2xl glass-card p-4 ">
                        <p className="text-sm font-medium text-[#8e9379] mb-3">🍽️ תזונה</p>
                        <MealHistory meals={clientData.meals} title="" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "menus" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">בניית תפריטים</h2>
              <p className="mt-1 text-xs text-[#8e9379]">בחר מתאמן ועבוד על התפריט במסך מלא ונוח.</p>
            </div>

            <div className="rounded-2xl border border-[#444933] bg-[#171919] p-3">
              <label className="mb-2 block text-xs font-semibold text-[#8e9379]">מתאמן</label>
              <select
                value={menuClient?.id ?? ""}
                onChange={(event) => {
                  const selected = clients.find((client) => client.id === event.target.value) ?? null;
                  setMenuClient(selected);
                }}
                className="w-full rounded-xl border border-[#444933] bg-[#1e2020] px-3 py-3 text-white"
              >
                <option value="">בחר מתאמן</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </div>

            {menuClient ? (
              <MenuBuilder key={menuClient.id} client={menuClient} embedded />
            ) : (
              <div className="rounded-2xl border border-dashed border-[#444933] bg-[#121512] p-8 text-center">
                <p className="text-sm text-[#8e9379]">בחר מתאמן כדי לפתוח את בונה התפריט.</p>
              </div>
            )}
          </div>
        )}

        {tab === "food" && (
          <CoachMealsPanel
            clients={clients}
            meals={foodLogs}
            loading={foodLoading}
            error={foodError}
            onRetry={() => void loadFoodLogs()}
          />
        )}

        {tab === "quotes" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">ציטוטים מוטיבציוניים</h2>

            <div className="rounded-2xl glass-card p-4  space-y-3">
              <p className="font-semibold text-base text-white">📣 שלח הודעה</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { emoji: "🌅", label: "בוקר טוב", title: "בוקר טוב! ☀️", body: "מתחילים את היום עם אנרגיה ומוטיבציה! אתם מדהימים 💪" },
                  { emoji: "🌞", label: "צהריים טובים", title: "צהריים טובים! 🌞", body: "איך היום מתקדם? זכרו לאכול טוב ולשתות מים 💧" },
                  { emoji: "🌙", label: "לילה טוב", title: "לילה טוב! 🌙", body: "סיימתם יום נהדר – עכשיו זמן לנוח ולהתחדש. כל הכבוד! ⭐" },
                  { emoji: "🏋️", label: "אל תוותרו", title: "אל תוותרו! 💪", body: "כל צעד קטן מקרב אתכם למטרה. אתם חזקים יותר ממה שאתם חושבים!" },
                  { emoji: "🎯", label: "יאללה!", title: "יאללה! 🎯", body: "היום הוא הזדמנות חדשה. תנו את המקסימום ותגיעו לתוצאות שאתם חולמים עליהם!" },
                  { emoji: "✨", label: "כל הכבוד", title: "כל הכבוד! ✨", body: "אנחנו גאים בכם על ההתמדה והמאמץ. המשיכו כך! 🙌" },
                  { emoji: "🌿", label: "סוף שבוע", title: "סוף שבוע נהדר! 🌿", body: "תנצלו את הזמן להתאוששות ולאנרגיה לשבוע הבא. מגיע לכם! 🏆" },
                  { emoji: "✡️", label: "שבת שלום", title: "שבת שלום! ✡️", body: "שבת מנוחה ומחייה לכם ולמשפחותיכם. שבוע טוב יבוא! 🕯️" },
                  { emoji: "💧", label: "מים", title: "שתו מים! 💧", body: "רגע, עצרתם לשתות מים היום? הגוף שלכם צריך את זה – שתו עכשיו! 🫗" },
                ].map((t) => (
                  <button
                    key={t.label}
                    onClick={() => { setPushTitle(t.title); setPushBody(t.body); }}
                    className="rounded-lg bg-[#282a2b] px-3 py-2 text-xs font-semibold text-[#c4c9ac] hover:bg-[#333535] transition-colors"
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
              <select
                value={pushUserId}
                onChange={(event) => setPushUserId(event.target.value)}
                className="w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white"
                aria-label="קהל לשליחת ההודעה"
              >
                <option value="">כל המתאמנים</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
              <input
                type="text"
                value={pushTitle || ""}
                onChange={(e) => setPushTitle(e.target.value)}
                placeholder="כותרת"
                className="w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white"
              />
              <input
                type="text"
                value={pushBody || ""}
                onChange={(e) => setPushBody(e.target.value)}
                placeholder="תוכן"
                className="w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void sendPush()}
                  disabled={sendingPush || !(pushTitle?.trim()) || !(pushBody?.trim())}
                  className="flex-1 rounded-lg bg-[#c3f400] py-3 font-semibold text-[#161e00] hover:bg-[#d4ff26] disabled:opacity-50"
                >
                  {sendingPush ? "שולח..." : pushUserId ? "שלח למתאמן" : "שלח לכולם"}
                </button>
                <button
                  onClick={testPush}
                  disabled={testingPush}
                  title="שלח התראת בדיקה לעצמך"
                  className="rounded-lg bg-[#282a2b] px-4 py-3 text-sm font-semibold text-[#c4c9ac] disabled:opacity-50"
                >
                  {testingPush ? "..." : "🔔 בדיקה"}
                </button>
              </div>
              {pushResult && <p className="text-center text-sm font-medium" style={{color: pushResult.startsWith("✅") ? "green" : "red"}}>{pushResult}</p>}
            </div>

            <div className="rounded-2xl glass-card p-4  space-y-3">
              <textarea
                value={newQuote?.text || ""}
                onChange={(e) => setNewQuote({ ...newQuote, text: e.target.value })}
                placeholder="ציטוט..."
                rows={3}
                className="w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white resize-none"
              />
              <input
                type="text"
                value={newQuote?.author || ""}
                onChange={(e) => setNewQuote({ ...newQuote, author: e.target.value })}
                placeholder="מחבר"
                className="w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white"
              />
              <button
                onClick={() => { try { addQuote(); } catch(e) { console.log(e); } }}
                disabled={addingQuote || !(newQuote?.text?.trim())}
                className="w-full rounded-lg bg-[#c3f400] py-3 font-semibold text-[#161e00] hover:bg-[#d4ff26] disabled:opacity-50"
              >
                {addingQuote ? "מוסיף..." : "הוסף"}
              </button>
            </div>

            {quotes && quotes.length === 0 && <p className="text-center text-[#8e9379] py-4">אין ציטוטים עדיין</p>}
            {quotes && quotes.map((q) => (
              <div key={q?.id} className="rounded-2xl glass-card p-4 ">
                <p className="text-white">"{q?.text}"</p>
                {q?.author && <p className="text-sm text-[#8e9379] mt-2">— {q?.author}</p>}
                <button
                  onClick={() => { try { deleteQuote(q?.id); } catch(e) { console.log(e); } }}
                  className="mt-3 text-xs text-red-300 font-normal"
                >
                  מחק
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "insights" && (
          <CoachInsightsPanel
            onViewClient={(clientId) => {
              const client = clients.find((item) => item.id === clientId);
              if (client) void openClientData(client);
            }}
            onEditGoals={(clientId) => {
              const client = clients.find((item) => item.id === clientId);
              if (client) void openClientGoals(client);
            }}
          />
        )}
        </motion.div>
        </AnimatePresence>
      </main>

      <SuccessToast message={successMessage} onDismiss={() => setSuccessMessage(null)} />

      <AnimatePresence>
        {pendingQuoteDelete && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
            className="fixed inset-x-0 bottom-20 z-[65] flex justify-center px-4 pb-[env(safe-area-inset-bottom)]"
          >
            <div className="glass-card flex w-full max-w-sm items-center justify-between rounded-2xl border border-[#444933] px-4 py-3 shadow-xl">
              <span className="text-sm text-[#c4c9ac]">הציטוט נמחק</span>
              <button onClick={undoQuoteDelete} className="text-sm font-semibold text-[#c3f400] hover:underline">
                ↶ בטל
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-[#1e2020] bg-[#0c0f0f]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg">
          {([
            { id: "clients", icon: "👥", label: "מתאמנים" },
            { id: "menus", icon: "📋", label: "תפריטים" },
            { id: "food", icon: "🍽️", label: "אוכל" },
            { id: "quotes", icon: "💬", label: "ציטוטים" },
            { id: "insights", icon: "📈", label: "תובנות" },
          ] as { id: CoachTab; icon: string; label: string }[]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center py-3 text-xs transition ${tab === t.id ? "text-[#c3f400]" : "text-[#8e9379]"}`}>
              <span className="text-2xl">{t.icon}</span>
              <span className="mt-0.5">{t.label}</span>
            </button>
          ))}
          <button onClick={() => router.push("/chat")}
            className="flex flex-1 flex-col items-center py-3 text-xs text-[#8e9379] transition">
            <span className="text-2xl">💬</span>
            <span className="mt-0.5">צ׳אט</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
