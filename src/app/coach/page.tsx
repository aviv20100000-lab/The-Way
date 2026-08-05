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
import ClientListCard, { DEFAULT_GROUP_ID, type CoachClient, type CoachGroupOption } from "@/components/coach/ClientListCard";
import DeleteTrainee from "@/components/coach/DeleteTrainee";
import { welcomeMessage } from "@/lib/welcome-message";
import SuccessToast from "@/components/SuccessToast";
import ConnectSetup from "@/components/ConnectSetup";
import { withCsrf } from "@/lib/csrf-client";
import { currentPushEndpoint, subscribeCurrentDeviceToPush } from "@/lib/push-client";
import type { Gender } from "@/lib/types";

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
  weigh_in_weekday: number | null;
}

interface ClientSummary {
  weights: { weight_kg: number; logged_at: string }[];
  steps_today: number;
  water_today: number;
  meals: { id: string; total_calories: number; logged_at: string; items: { name: string; calories: number; estimated_weight_g: number }[] }[];
  goals: { target_weight_kg: number | null; daily_calories: number | null; daily_protein_g: number | null; daily_water_ml: number; daily_steps: number | null };
}

const EMPTY_GOALS: Goals = { target_weight_kg: null, daily_calories: null, daily_protein_g: null, daily_water_ml: 2000, daily_steps: null, weigh_in_frequency_weeks: null, weigh_in_weekday: null };

interface QuickSendVariant {
  title: string;
  body: string;
}

interface QuickSendTemplate {
  emoji: string;
  label: string;
  plural: QuickSendVariant;
  masc: QuickSendVariant;
  fem: QuickSendVariant;
}

// Three phrasings per template: "plural" for broadcast to all trainees, "masc"/"fem"
// for a single trainee selected in the audience dropdown — picked at click time.
const QUICK_SEND_TEMPLATES: QuickSendTemplate[] = [
  {
    emoji: "🌅",
    label: "בוקר טוב",
    plural: { title: "בוקר טוב! ☀️", body: "מתחילים את היום עם אנרגיה ומוטיבציה! אתם מדהימים 💪" },
    masc: { title: "בוקר טוב! ☀️", body: "תתחיל את היום עם אנרגיה ומוטיבציה! אתה מדהים 💪" },
    fem: { title: "בוקר טוב! ☀️", body: "תתחילי את היום עם אנרגיה ומוטיבציה! את מדהימה 💪" },
  },
  {
    emoji: "🌞",
    label: "צהריים טובים",
    plural: { title: "צהריים טובים! 🌞", body: "איך היום מתקדם? זכרו לאכול טוב ולשתות מים 💧" },
    masc: { title: "צהריים טובים! 🌞", body: "איך היום מתקדם? זכור לאכול טוב ולשתות מים 💧" },
    fem: { title: "צהריים טובים! 🌞", body: "איך היום מתקדם? זכרי לאכול טוב ולשתות מים 💧" },
  },
  {
    emoji: "🌙",
    label: "לילה טוב",
    plural: { title: "לילה טוב! 🌙", body: "סיימתם יום נהדר – עכשיו זמן לנוח ולהתחדש. כל הכבוד! ⭐" },
    masc: { title: "לילה טוב! 🌙", body: "סיימת יום נהדר – עכשיו זמן לנוח ולהתחדש. כל הכבוד! ⭐" },
    fem: { title: "לילה טוב! 🌙", body: "סיימת יום נהדר – עכשיו זמן לנוח ולהתחדש. כל הכבוד! ⭐" },
  },
  {
    emoji: "🏋️",
    label: "אל תוותרו",
    plural: { title: "אל תוותרו! 💪", body: "כל צעד קטן מקרב אתכם למטרה. אתם חזקים יותר ממה שאתם חושבים!" },
    masc: { title: "אל תוותר! 💪", body: "כל צעד קטן מקרב אותך למטרה. אתה חזק יותר ממה שאתה חושב!" },
    fem: { title: "אל תוותרי! 💪", body: "כל צעד קטן מקרב אותך למטרה. את חזקה יותר ממה שאת חושבת!" },
  },
  {
    emoji: "🎯",
    label: "יאללה!",
    plural: { title: "יאללה! 🎯", body: "היום הוא הזדמנות חדשה. תנו את המקסימום ותגיעו לתוצאות שאתם חולמים עליהם!" },
    masc: { title: "יאללה! 🎯", body: "היום הוא הזדמנות חדשה. תן את המקסימום ותגיע לתוצאות שאתה חולם עליהן!" },
    fem: { title: "יאללה! 🎯", body: "היום הוא הזדמנות חדשה. תני את המקסימום ותגיעי לתוצאות שאת חולמת עליהן!" },
  },
  {
    emoji: "✨",
    label: "כל הכבוד",
    plural: { title: "כל הכבוד! ✨", body: "אנחנו גאים בכם על ההתמדה והמאמץ. המשיכו כך! 🙌" },
    masc: { title: "כל הכבוד! ✨", body: "אנחנו גאים בך על ההתמדה והמאמץ. תמשיך כך! 🙌" },
    fem: { title: "כל הכבוד! ✨", body: "אנחנו גאים בך על ההתמדה והמאמץ. תמשיכי כך! 🙌" },
  },
  {
    emoji: "🌿",
    label: "סוף שבוע",
    plural: { title: "סוף שבוע נהדר! 🌿", body: "תנצלו את הזמן להתאוששות ולאנרגיה לשבוע הבא. מגיע לכם! 🏆" },
    masc: { title: "סוף שבוע נהדר! 🌿", body: "תנצל את הזמן להתאוששות ולאנרגיה לשבוע הבא. מגיע לך! 🏆" },
    fem: { title: "סוף שבוע נהדר! 🌿", body: "תנצלי את הזמן להתאוששות ולאנרגיה לשבוע הבא. מגיע לך! 🏆" },
  },
  {
    emoji: "✡️",
    label: "שבת שלום",
    plural: { title: "שבת שלום! ✡️", body: "שבת מנוחה ומחייה לכם ולמשפחותיכם. שבוע טוב יבוא! 🕯️" },
    masc: { title: "שבת שלום! ✡️", body: "שבת מנוחה ומחייה לך ולמשפחתך. שבוע טוב יבוא! 🕯️" },
    fem: { title: "שבת שלום! ✡️", body: "שבת מנוחה ומחייה לך ולמשפחתך. שבוע טוב יבוא! 🕯️" },
  },
  {
    emoji: "💧",
    label: "מים",
    plural: { title: "שתו מים! 💧", body: "רגע, עצרתם לשתות מים היום? הגוף שלכם צריך את זה – שתו עכשיו! 🫗" },
    masc: { title: "שתה מים! 💧", body: "רגע, עצרת לשתות מים היום? הגוף שלך צריך את זה – שתה עכשיו! 🫗" },
    fem: { title: "שתי מים! 💧", body: "רגע, עצרת לשתות מים היום? הגוף שלך צריך את זה – שתי עכשיו! 🫗" },
  },
];

export default function CoachPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [tab, setTab] = useState<CoachTab>("clients");
  const [coachName, setCoachName] = useState("מאמן");

  // Clients
  const [clients, setClients] = useState<CoachClient[]>([]);
  const [clientGroupFilter, setClientGroupFilter] = useState<"all" | "in" | "out">("all");
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", username: "", password: "", groupIds: [] as string[], gender: null as Gender | null });
  /**
   * The credentials that were actually saved, kept so the coach can send them.
   * The password is hashed the moment it reaches the server, so this is the
   * only window in which it can be handed over.
   */
  const [justCreated, setJustCreated] = useState<{ name: string; username: string; password: string; gender: Gender | null } | null>(null);
  const [welcomeCopied, setWelcomeCopied] = useState(false);
  const [addError, setAddError] = useState("");
  const [addWarning, setAddWarning] = useState("");
  const [groupOptions, setGroupOptions] = useState<CoachGroupOption[]>([{ id: DEFAULT_GROUP_ID, name: "קבוצה ראשית" }]);
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
  const [coachNotifStatus, setCoachNotifStatus] = useState<"unknown" | "granted" | "denied">("unknown");
  const [coachIsPwa, setCoachIsPwa] = useState(false);
  const [coachPushReady, setCoachPushReady] = useState(false);

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
      setGroupOptions([{ id: DEFAULT_GROUP_ID, name: defaultName }, ...namedGroups]);
    } catch (error) {
      console.error("Error loading coach groups:", error);
      setGroupOptions([{ id: DEFAULT_GROUP_ID, name: "קבוצה ראשית" }]);
    }
  }, []);

  /**
   * Puts a trainee in a group, or takes them out.
   *
   * The main group is a flag on the user row; every named group is a row in
   * chat_group_members. Two different endpoints, one control on the card.
   *
   * This decides the steps competition as well as the chat — a trainee left in
   * the main group competes against everyone in it, whatever else they belong to.
   */
  const toggleGroupMembership = useCallback(async (client: CoachClient, groupId: string, join: boolean) => {
    const apply = (item: CoachClient) => {
      if (groupId === DEFAULT_GROUP_ID) return { ...item, in_default_group: join };
      const group_ids = join
        ? [...new Set([...item.group_ids, groupId])]
        : item.group_ids.filter((id) => id !== groupId);
      return { ...item, group_ids };
    };
    // Optimistic; the original object is kept so a failure can put it back.
    setClients((current) => current.map((item) => item.id === client.id ? apply(item) : item));

    try {
      const isDefault = groupId === DEFAULT_GROUP_ID;
      const res = await fetch(
        isDefault
          ? "/api/coach/group-membership"
          : `/api/coach/chat-groups/${encodeURIComponent(groupId)}/members`,
        {
          // The named-group endpoint uses the verb to say join or leave; the
          // main-group endpoint is POST either way and carries a flag.
          method: isDefault || join ? "POST" : "DELETE",
          headers: await withCsrf({ "Content-Type": "application/json" }),
          body: JSON.stringify(isDefault ? { clientId: client.id, inGroup: join } : { clientId: client.id }),
        }
      );
      if (!res.ok) throw new Error("toggle failed");
    } catch (e) {
      console.error("Error toggling group membership:", e);
      setClients((current) => current.map((item) => item.id === client.id ? client : item));
      setSuccessMessage("שיוך הקבוצה נכשל");
    }
  }, []);

  /** Sets which grammatical gender Hebrew text should address this trainee with. */
  const setClientGender = useCallback(async (client: CoachClient, gender: Gender) => {
    const previous = client.gender;
    // Optimistic; reverted on failure.
    setClients((current) => current.map((item) => item.id === client.id ? { ...item, gender } : item));
    try {
      const res = await fetch(`/api/users/clients/${client.id}`, {
        method: "PATCH",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ gender }),
      });
      if (!res.ok) throw new Error("gender update failed");
    } catch (e) {
      console.error("Error setting client gender:", e);
      setClients((current) => current.map((item) => item.id === client.id ? { ...item, gender: previous } : item));
      setSuccessMessage("עדכון המין נכשל");
    }
  }, []);

  /**
   * A nudge to photograph the meal, to one trainee, right now. The whole point is
   * that it takes one press from the client list — a reminder the coach has to
   * compose is a reminder the coach does not send.
   */
  const sendMealReminder = useCallback(async (client: CoachClient) => {
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          userId: client.id,
          title: "אל תשכח לצלם 📸",
          body: client.gender === "female"
            ? "צלמי את הארוחה ושלחי, לפני שאת מתחילה לאכול."
            : "צלם את הארוחה ושלח, לפני שאתה מתחיל לאכול.",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "send failed");
      // sent === 0 means the trainee never allowed notifications on any device.
      setSuccessMessage(
        data.sent > 0
          ? `נשלחה תזכורת ל${client.name}`
          : `ל${client.name} אין התראות פעילות — הוא צריך לאשר אותן באפליקציה`
      );
    } catch (e) {
      console.error("Error sending meal reminder:", e);
      setSuccessMessage("שליחת התזכורת נכשלה");
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
    setCoachIsPwa(window.matchMedia("(display-mode: standalone)").matches);
    if (!("Notification" in window)) {
      setCoachPushReady(true);
      return;
    }
    if (Notification.permission === "denied") {
      setCoachNotifStatus("denied");
      setCoachPushReady(true);
      return;
    }
    if (Notification.permission !== "granted") {
      setCoachPushReady(true);
      return;
    }

    subscribeCurrentDeviceToPush({ requestPermission: false })
      .then(() => setCoachNotifStatus("granted"))
      .catch((error) => console.error("Error syncing coach notifications:", error))
      .finally(() => setCoachPushReady(true));
  }, []);

  useEffect(() => {
    if (tab === "quotes") loadQuotes();
    if (tab === "food") loadFoodLogs();
  }, [tab, loadQuotes, loadFoodLogs]);

  // Prefetch the chat route bundle for instant navigation
  useEffect(() => {
    router.prefetch("/chat");
  }, [router]);

  async function logout() {
    // Sending the endpoint releases only this account's notifications on this
    // device — a trainee account signed in on the same phone keeps its own.
    const endpoint = await currentPushEndpoint();
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: await withCsrf({ "Content-Type": "application/json" }),
      body: JSON.stringify({ endpoint }),
    });
    // Wipe ALL cached data (home/chat/water/weight/user) so the next login
    // never briefly shows a different account's stale numbers.
    sessionStorage.clear();
    window.location.href = "/login";
  }

  async function addClient() {
    setAddError("");
    setAddWarning("");
    if (!newClient.gender) { setAddError("יש לבחור מין למתאמן"); return; }
    const selectedGroupIds = [...newClient.groupIds];
    const res = await fetch("/api/users/clients", {
      method: "POST",
      headers: await withCsrf({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name: newClient.name, username: newClient.username, password: newClient.password, gender: newClient.gender }),
    });
    const data = await res.json();
    if (!res.ok) { setAddError(data.error); return; }
    setShowAddClient(false);
    setJustCreated({
      name: newClient.name,
      username: String(data.username ?? newClient.username).trim().toLowerCase(),
      password: newClient.password,
      gender: newClient.gender,
    });
    setWelcomeCopied(false);
    setNewClient({ name: "", username: "", password: "", groupIds: [], gender: null });
    setSuccessMessage("המתאמן נוסף");
    void loadClients();

    void Promise.allSettled(selectedGroupIds.map(async (groupId) => {
      const endpoint = groupId === DEFAULT_GROUP_ID
        ? "/api/coach/group-membership"
        : `/api/coach/chat-groups/${encodeURIComponent(groupId)}/members`;
      const body = groupId === DEFAULT_GROUP_ID
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
        weigh_in_weekday: data.weigh_in_weekday ?? null,
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

  async function enableCoachNotifications() {
    try {
      await subscribeCurrentDeviceToPush();
      setCoachNotifStatus("granted");
    } catch (error) {
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setCoachNotifStatus("denied");
      }
      throw error;
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

  // "In a group" means any group, not just the main one: a trainee moved into a
  // named group and out of the main one is still grouped — and still competing.
  const isGrouped = (client: CoachClient) => client.in_default_group || client.group_ids.length > 0;

  const visibleClients = useMemo(() => {
    return [...clients]
      .sort((a, b) => Number(isGrouped(b)) - Number(isGrouped(a)) || a.name.localeCompare(b.name, "he"))
      .filter((client) => clientGroupFilter === "all" || (clientGroupFilter === "in" ? isGrouped(client) : !isGrouped(client)));
  }, [clients, clientGroupFilter]);

  const clientsInGroup = clients.filter(isGrouped).length;
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

            {/*
              Credentials for the client who was just created, with a ready to
              send message. The password is hashed on the server, so once this
              card is dismissed it cannot be recovered — only replaced.
            */}
            {justCreated && (
              <div className="space-y-3 rounded-2xl border border-[#c3f400]/30 bg-[#c3f400]/5 p-4">
                <div>
                  <p className="text-base font-semibold text-white">{justCreated.name} נוסף</p>
                  <p className="mt-1 text-xs text-[#c4c9ac]">
                    אלה הפרטים המדויקים לכניסה. תשלח לו אותם עכשיו, אחרי שתסגור לא תוכל לראות את הסיסמה שוב.
                  </p>
                </div>

                <div className="space-y-1 rounded-xl bg-[#1a1c1c]/70 px-4 py-3 text-sm" dir="ltr">
                  <p className="text-white">{justCreated.username}</p>
                  <p className="text-white">{justCreated.password}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(welcomeMessage(justCreated))
                        .then(() => setWelcomeCopied(true))
                        .catch(() => setWelcomeCopied(false));
                    }}
                    className="flex-1 rounded-xl bg-[#c3f400] px-4 py-2.5 text-sm font-bold text-[#0c0f0f] transition hover:brightness-95"
                  >
                    {welcomeCopied ? "הועתק" : "העתק הודעה לוואטסאפ"}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(welcomeMessage(justCreated))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 rounded-xl border border-[#444933] px-4 py-2.5 text-center text-sm font-semibold text-[#c4c9ac] transition hover:border-[#c3f400]/40"
                  >
                    פתח בוואטסאפ
                  </a>
                  <button
                    type="button"
                    onClick={() => setJustCreated(null)}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#8e9379]"
                  >
                    סיימתי
                  </button>
                </div>
              </div>
            )}

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
                  groups={groupOptions}
                  onToggleGroup={(selected, groupId, join) => void toggleGroupMembership(selected, groupId, join)}
                  onSendMealReminder={(selected) => void sendMealReminder(selected)}
                  onSetGender={(selected, gender) => void setClientGender(selected, gender)}
                />
                <button type="button" onClick={() => { setMenuClient(client); setTab("menus"); }}
                  className="w-full rounded-xl border border-[#c3f400]/25 bg-[#c3f400]/10 py-2.5 text-sm font-bold text-[#c3f400] transition hover:bg-[#c3f400]/15">
                  🍽️ בניית תפריט
                </button>
                <DeleteTrainee
                  traineeId={client.id}
                  traineeName={client.name}
                  active={client.active}
                  onDeleted={() => setClients((current) => current.filter((item) => item.id !== client.id))}
                  onActiveChanged={(active) => setClients((current) => current.map((item) => item.id === client.id ? { ...item, active } : item))}
                />
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

                  <label className="block">
                    <span className="text-xs font-semibold text-[#c4c9ac] uppercase tracking-wide">יום השקילה הראשונה</span>
                    <select
                      value={clientGoals.weigh_in_weekday ?? ""}
                      onChange={(e) => setClientGoals({ ...clientGoals, weigh_in_weekday: e.target.value === "" ? null : Number(e.target.value) })}
                      className="mt-2 w-full rounded-lg border border-[#444933] bg-[#282a2b] px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[#c3f400] transition-all"
                    >
                      <option value="">בחר יום שקילה</option>
                      <option value={0}>ראשון</option>
                      <option value={1}>שני</option>
                      <option value={2}>שלישי</option>
                      <option value={3}>רביעי</option>
                      <option value={4}>חמישי</option>
                      <option value={5}>שישי</option>
                      <option value={6}>שבת</option>
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
                {QUICK_SEND_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => {
                      const selectedClient = pushUserId ? clients.find((c) => c.id === pushUserId) : null;
                      const variant = !pushUserId
                        ? t.plural
                        : selectedClient?.gender === "female"
                        ? t.fem
                        : t.masc;
                      setPushTitle(variant.title);
                      setPushBody(variant.body);
                    }}
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
      {coachPushReady && (
        <ConnectSetup
          audience="coach"
          notifStatus={coachNotifStatus}
          isPwa={coachIsPwa}
          enableNotifications={enableCoachNotifications}
        />
      )}

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
