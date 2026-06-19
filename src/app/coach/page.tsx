"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MealHistory from "@/components/MealHistory";

type CoachTab = "clients" | "food" | "quotes" | "leaderboard";

interface Client {
  id: string;
  name: string;
  email: string;
}

interface Quote {
  id: string;
  text: string;
  author: string | null;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  today: number;
  week: number;
}

interface Goals {
  target_weight_kg: number | null;
  daily_calories: number | null;
  daily_water_ml: number;
}

interface ClientSummary {
  weights: { weight_kg: number; logged_at: string }[];
  steps_today: number;
  water_today: number;
  meals: { id: string; total_calories: number; logged_at: string; items: { name: string; calories: number; estimated_weight_g: number }[] }[];
  goals: { target_weight_kg: number | null; daily_calories: number | null; daily_water_ml: number };
}

export default function CoachPage() {
  const router = useRouter();
  const [tab, setTab] = useState<CoachTab>("clients");
  const [coachName, setCoachName] = useState("מאמן");

  // Clients
  const [clients, setClients] = useState<Client[]>([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", password: "" });
  const [addError, setAddError] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientGoals, setClientGoals] = useState<Goals>({ target_weight_kg: null, daily_calories: null, daily_water_ml: 2000 });
  const [savingGoals, setSavingGoals] = useState(false);
  const [dataClient, setDataClient] = useState<Client | null>(null);
  const [clientData, setClientData] = useState<ClientSummary | null>(null);

  // Quotes
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [newQuote, setNewQuote] = useState({ text: "", author: "" });
  const [addingQuote, setAddingQuote] = useState(false);

  // Food logs
  interface FoodLog { id: string; client_name: string; photo_url: string; total_calories: number; logged_at: string; items: { name: string; calories: number; estimated_weight_g: number }[]; }
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [foodLoading, setFoodLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbView, setLbView] = useState<"today" | "week">("today");

  // Push notifications
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [sendingPush, setSendingPush] = useState(false);
  const [pushResult, setPushResult] = useState("");

  // Notifications for the coach himself
  const [notifStatus, setNotifStatus] = useState<"unknown" | "granted" | "denied">("unknown");
  const [isPwa, setIsPwa] = useState(false);

  const loadClients = useCallback(async () => {
    const res = await fetch("/api/clients");
    if (res.status === 401 || res.status === 403) { router.push("/login"); return; }
    setClients(await res.json());
  }, [router]);

  const loadQuotes = useCallback(async () => {
    const res = await fetch("/api/quotes");
    setQuotes(await res.json());
  }, []);

  const loadFoodLogs = useCallback(async () => {
    setFoodLoading(true);
    const res = await fetch("/api/food-logs");
    setFoodLogs(await res.json());
    setFoodLoading(false);
  }, []);

  const loadLeaderboard = useCallback(async () => {
    const res = await fetch("/api/steps?type=leaderboard");
    setLeaderboard(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (d.name) setCoachName(d.name); });
    loadClients();
    setIsPwa(window.matchMedia("(display-mode: standalone)").matches);
    if ("Notification" in window) {
      const perm = Notification.permission as string;
      setNotifStatus(perm === "granted" ? "granted" : perm === "denied" ? "denied" : "unknown");
    }
  }, [loadClients]);

  async function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    const permission = await Notification.requestPermission();
    setNotifStatus(permission as "granted" | "denied");
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });
  }

  useEffect(() => {
    if (tab === "quotes") loadQuotes();
    if (tab === "food") loadFoodLogs();
    if (tab === "leaderboard") loadLeaderboard();
  }, [tab, loadQuotes, loadFoodLogs, loadLeaderboard]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function addClient() {
    setAddError("");
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newClient),
    });
    const data = await res.json();
    if (!res.ok) { setAddError(data.error); return; }
    setShowAddClient(false);
    setNewClient({ name: "", email: "", password: "" });
    loadClients();
  }

  async function openClientGoals(client: Client) {
    setSelectedClient(client);
    const res = await fetch(`/api/goals?userId=${client.id}`);
    const data = await res.json();
    setClientGoals({
      target_weight_kg: data.target_weight_kg,
      daily_calories: data.daily_calories,
      daily_water_ml: data.daily_water_ml ?? 2000,
    });
  }

  async function openClientData(client: Client) {
    setDataClient(client);
    setClientData(null);
    const res = await fetch(`/api/client-summary?userId=${client.id}`);
    if (res.ok) setClientData(await res.json());
  }

  async function saveGoals() {
    if (!selectedClient) return;
    setSavingGoals(true);
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedClient.id, ...clientGoals }),
    });
    setSavingGoals(false);
    setSelectedClient(null);
  }

  async function addQuote() {
    if (!newQuote.text.trim()) return;
    setAddingQuote(true);
    await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newQuote),
    });
    setNewQuote({ text: "", author: "" });
    setAddingQuote(false);
    loadQuotes();
  }

  async function sendPush() {
    if (!pushTitle.trim() || !pushBody.trim()) return;
    setSendingPush(true);
    setPushResult("");
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: pushTitle, body: pushBody }),
    });
    const data = await res.json();
    setPushResult(`נשלח ל-${data.sent} מתאמנים ✓`);
    setPushTitle("");
    setPushBody("");
    setSendingPush(false);
  }

  async function deleteQuote(id: string) {
    await fetch("/api/quotes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setQuotes((q) => q.filter((x) => x.id !== id));
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24" dir="rtl">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">THE WAY — מאמן</h1>
              <span className="text-xs font-medium text-gray-400">by Aviv & Liav</span>
            </div>
            <p className="text-xs text-gray-400">היי {coachName} 👋</p>
          </div>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">יציאה</button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4">

        {tab === "clients" && (
          <div className="space-y-4">
            {/* Notifications for the coach */}
            {notifStatus === "granted" ? (
              <div className="flex items-center gap-3 rounded-2xl bg-green-50 p-4 border border-green-100">
                <span className="text-2xl">✅</span>
                <p className="font-semibold text-green-700">התראות דלוקות — מעולה!</p>
              </div>
            ) : !isPwa ? (
              <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 text-right">
                <p className="font-semibold text-amber-800 mb-2">📲 רוצה לקבל התראות?</p>
                <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
                  <li>לחץ על כפתור השיתוף <strong>□↑</strong> בתחתית Safari</li>
                  <li>בחר <strong>&quot;הוסף למסך הבית&quot;</strong></li>
                  <li>פתח מהמסך הבית ולחץ על כפתור ההתראות</li>
                </ol>
              </div>
            ) : (
              <button onClick={enableNotifications}
                className="flex w-full items-center gap-3 rounded-2xl bg-indigo-600 p-4 text-right shadow-sm">
                <span className="text-2xl">🔔</span>
                <div>
                  <p className="font-semibold text-white text-lg">הפעל התראות</p>
                  <p className="text-xs text-indigo-200">כדי לקבל עדכונים מהאפליקציה</p>
                </div>
              </button>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">המתאמנים שלך</h2>
              <button onClick={() => setShowAddClient(true)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                + הוסף
              </button>
            </div>

            {showAddClient && (
              <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-bold">הוספת מתאמן</h3>
                {addError && <p className="text-sm text-red-500">{addError}</p>}
                <input placeholder="שם" value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3" />
                <input placeholder="אימייל" value={newClient.email} dir="ltr"
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3" />
                <input placeholder="סיסמה" type="password" value={newClient.password} dir="ltr"
                  onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3" />
                <div className="flex gap-2">
                  <button onClick={() => setShowAddClient(false)}
                    className="flex-1 rounded-xl border py-2 text-gray-500">ביטול</button>
                  <button onClick={addClient}
                    className="flex-1 rounded-xl bg-indigo-600 py-2 text-white font-medium">הוסף</button>
                </div>
              </div>
            )}

            {clients.length === 0 && !showAddClient && (
              <p className="text-center text-gray-400 py-8">עוד אין מתאמנים — לחץ על הוסף כדי להתחיל</p>
            )}

            {clients.map((c) => (
              <div key={c.id} className="rounded-2xl bg-white p-4 shadow-sm flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{c.name}</p>
                  <p className="text-sm text-gray-400 truncate" dir="ltr">{c.email}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => openClientData(c)}
                    className="rounded-xl bg-indigo-100 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200">
                    📊 נתונים
                  </button>
                  <button onClick={() => openClientGoals(c)}
                    className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200">
                    🎯 יעדים
                  </button>
                </div>
              </div>
            ))}

            {selectedClient && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={() => setSelectedClient(null)}>
                <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
                  <h3 className="font-bold text-lg">יעדים של {selectedClient.name}</h3>

                  <label className="block">
                    <span className="text-sm text-gray-500">יעד משקל (ק"ג)</span>
                    <input type="number" step="0.5"
                      value={clientGoals.target_weight_kg ?? ""}
                      onChange={(e) => setClientGoals({ ...clientGoals, target_weight_kg: e.target.value ? parseFloat(e.target.value) : null })}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
                      placeholder="לדוגמה: 75" />
                  </label>

                  <label className="block">
                    <span className="text-sm text-gray-500">יעד קלוריות יומי</span>
                    <input type="number"
                      value={clientGoals.daily_calories ?? ""}
                      onChange={(e) => setClientGoals({ ...clientGoals, daily_calories: e.target.value ? parseInt(e.target.value) : null })}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
                      placeholder="לדוגמה: 1800" />
                  </label>

                  <label className="block">
                    <span className="text-sm text-gray-500">יעד מים יומי (מ"ל)</span>
                    <input type="number"
                      value={clientGoals.daily_water_ml}
                      onChange={(e) => setClientGoals({ ...clientGoals, daily_water_ml: parseInt(e.target.value) || 2000 })}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3" />
                  </label>

                  <div className="flex gap-2">
                    <button onClick={() => setSelectedClient(null)}
                      className="flex-1 rounded-xl border py-3 text-gray-500">ביטול</button>
                    <button onClick={saveGoals} disabled={savingGoals}
                      className="flex-1 rounded-xl bg-green-600 py-3 text-white font-semibold disabled:opacity-50">
                      {savingGoals ? "שומר..." : "שמור יעדים"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {dataClient && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setDataClient(null)}>
                <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-t-3xl bg-gray-50 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between sticky top-0 bg-gray-50 pb-1">
                    <h3 className="font-bold text-lg">📊 {dataClient.name}</h3>
                    <button onClick={() => setDataClient(null)} className="text-gray-400 text-2xl leading-none">×</button>
                  </div>

                  {!clientData ? (
                    <p className="text-center text-gray-400 py-8">טוען נתונים...</p>
                  ) : (
                    <>
                      {/* Weight */}
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-sm font-medium text-gray-500 mb-2">⚖️ משקל</p>
                        {clientData.weights.length === 0 ? (
                          <p className="text-sm text-gray-400">עוד לא נשקל</p>
                        ) : (
                          <>
                            <div className="flex items-end gap-2 mb-3">
                              <span className="text-3xl font-bold text-gray-800">{clientData.weights[0].weight_kg}</span>
                              <span className="text-gray-400 mb-1">ק"ג</span>
                              {clientData.weights.length > 1 && (() => {
                                const diff = clientData.weights[0].weight_kg - clientData.weights[1].weight_kg;
                                return (
                                  <span className={`mb-1 text-sm font-medium ${diff < 0 ? "text-green-500" : diff > 0 ? "text-red-400" : "text-gray-400"}`}>
                                    {diff < 0 ? "▼" : diff > 0 ? "▲" : ""}{Math.abs(diff).toFixed(1)}
                                  </span>
                                );
                              })()}
                              {clientData.goals.target_weight_kg && (
                                <span className="mr-auto text-sm text-green-600 mb-1">יעד: {clientData.goals.target_weight_kg}</span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {clientData.weights.map((w, i) => (
                                <div key={i} className="flex justify-between text-sm border-b border-gray-50 py-1">
                                  <span className="text-gray-400">{new Date(w.logged_at).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" })}</span>
                                  <span className="font-medium text-gray-700">{w.weight_kg} ק"ג</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Steps + Water today */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white p-4 shadow-sm text-center">
                          <p className="text-xs text-gray-400 mb-1">👟 צעדים היום</p>
                          <p className="text-2xl font-bold text-indigo-600">{clientData.steps_today.toLocaleString()}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4 shadow-sm text-center">
                          <p className="text-xs text-gray-400 mb-1">💧 מים היום</p>
                          <p className="text-2xl font-bold text-blue-500">{(clientData.water_today / 1000).toFixed(1)}<span className="text-sm">L</span></p>
                          <p className="text-xs text-gray-300">יעד {(clientData.goals.daily_water_ml / 1000).toFixed(1)}L</p>
                        </div>
                      </div>

                      {/* Meals — day / week / month */}
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-sm font-medium text-gray-500 mb-3">🍽️ תזונה</p>
                        <MealHistory meals={clientData.meals} title="" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "food" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">אוכל — 7 ימים אחרונים</h2>
              <button onClick={loadFoodLogs} className="text-sm text-indigo-600">🔄 רענן</button>
            </div>

            {foodLoading && <p className="text-center text-gray-400 py-8">טוען...</p>}
            {!foodLoading && foodLogs.length === 0 && (
              <p className="text-center text-gray-400 py-8">אין ארוחות מצולמות עדיין</p>
            )}

            {foodLogs.map((log) => {
              const date = new Date(log.logged_at);
              const dateStr = date.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
              const timeStr = date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
              const isExpanded = expandedLog === log.id;

              return (
                <div key={log.id} className="rounded-2xl bg-white shadow-sm overflow-hidden">
                  <button className="w-full text-right p-4" onClick={() => setExpandedLog(isExpanded ? null : log.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl overflow-hidden">
                          {log.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={log.photo_url} alt="ארוחה" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
                          ) : "🍽️"}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{log.client_name}</p>
                          <p className="text-xs text-gray-400">{dateStr} • {timeStr}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-indigo-600">{log.total_calories}</p>
                        <p className="text-xs text-gray-400">קלוריות</p>
                      </div>
                    </div>

                    {isExpanded && log.items.length > 0 && (
                      <div className="mt-3 border-t pt-3 space-y-1">
                        {log.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-700">{item.name} ({item.estimated_weight_g}g)</span>
                            <span className="text-gray-500">{item.calories} קל׳</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === "quotes" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">ציטוטים מוטיבציוניים</h2>

            {/* Send push notification */}
            <div className="rounded-2xl bg-indigo-50 p-5 border border-indigo-100 space-y-3">
              <p className="font-semibold text-indigo-800">📣 שלח הודעה לכולם</p>
              <input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)}
                placeholder="כותרת ההודעה"
                className="w-full rounded-xl border border-indigo-200 px-4 py-3 bg-white" />
              <input value={pushBody} onChange={(e) => setPushBody(e.target.value)}
                placeholder="תוכן ההודעה"
                className="w-full rounded-xl border border-indigo-200 px-4 py-3 bg-white" />
              <button onClick={sendPush} disabled={sendingPush || !pushTitle.trim() || !pushBody.trim()}
                className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50">
                {sendingPush ? "שולח..." : "📱 שלח עכשיו"}
              </button>
              {pushResult && <p className="text-center text-sm text-green-600 font-medium">{pushResult}</p>}
            </div>


            <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
              <textarea
                value={newQuote.text}
                onChange={(e) => setNewQuote({ ...newQuote, text: e.target.value })}
                placeholder="כתוב משפט מוטיבציוני..."
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 resize-none"
              />
              <input
                value={newQuote.author}
                onChange={(e) => setNewQuote({ ...newQuote, author: e.target.value })}
                placeholder="מאת (אופציונלי)"
                className="w-full rounded-xl border border-gray-200 px-4 py-3"
              />
              <button onClick={addQuote} disabled={addingQuote || !newQuote.text.trim()}
                className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50">
                {addingQuote ? "מוסיף..." : "➕ הוסף ציטוט"}
              </button>
            </div>

            {quotes.length === 0 && <p className="text-center text-gray-400 py-4">עוד לא הוספת ציטוטים</p>}
            {quotes.map((q) => (
              <div key={q.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-gray-800 leading-relaxed">"{q.text}"</p>
                {q.author && <p className="text-sm text-gray-400 mt-1">— {q.author}</p>}
                <button onClick={() => deleteQuote(q.id)}
                  className="mt-2 text-xs text-red-400 hover:text-red-600">🗑️ מחק</button>
              </div>
            ))}
          </div>
        )}

        {tab === "leaderboard" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">דירוג צעדים 🏆</h2>

            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="flex border-b">
                <button onClick={() => setLbView("today")}
                  className={`flex-1 py-3 text-sm font-medium ${lbView === "today" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-400"}`}>
                  יומי
                </button>
                <button onClick={() => setLbView("week")}
                  className={`flex-1 py-3 text-sm font-medium ${lbView === "week" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-400"}`}>
                  שבועי
                </button>
              </div>
              <div className="p-4 space-y-2">
                {leaderboard.length === 0 && <p className="text-center text-gray-400 py-4">עוד אף אחד לא העלה צעדים היום</p>}
                {leaderboard
                  .slice()
                  .sort((a, b) => (lbView === "today" ? b.today - a.today : b.week - a.week))
                  .map((entry, i) => (
                    <div key={entry.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                      <span className="text-lg font-bold w-6 text-center">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </span>
                      <span className="flex-1 font-medium text-gray-800">{entry.name}</span>
                      <span className="font-bold text-indigo-600">
                        {(lbView === "today" ? entry.today : entry.week).toLocaleString()} 👟
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <button onClick={loadLeaderboard}
              className="w-full rounded-xl border border-gray-200 py-3 text-sm text-gray-500 hover:bg-gray-50">
              🔄 עדכן
            </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white">
        <div className="mx-auto flex max-w-lg">
          {([
            { id: "clients", icon: "👥", label: "מתאמנים" },
            { id: "food", icon: "🍽️", label: "אוכל" },
            { id: "quotes", icon: "💬", label: "ציטוטים" },
            { id: "leaderboard", icon: "🏆", label: "תחרות" },
          ] as { id: CoachTab; icon: string; label: string }[]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center py-3 text-xs transition ${tab === t.id ? "text-indigo-600" : "text-gray-400"}`}>
              <span className="text-2xl">{t.icon}</span>
              <span className="mt-0.5">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
