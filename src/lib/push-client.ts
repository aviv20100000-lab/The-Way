import { withCsrf } from "@/lib/csrf-client";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index++) bytes[index] = rawData.charCodeAt(index);
  return bytes.buffer;
}

export async function subscribeCurrentDeviceToPush(options: { requestPermission?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("התראות אינן נתמכות במכשיר הזה");
  }

  let permission = Notification.permission;
  if (permission === "default" && options.requestPermission !== false) {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    throw new Error(permission === "denied" ? "ההתראות חסומות בהגדרות המכשיר" : "נדרש אישור להתראות");
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error("מפתח ההתראות אינו מוגדר");

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(vapidKey),
  });

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: await withCsrf({ "Content-Type": "application/json" }),
    body: JSON.stringify(subscription),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.error === "string" ? data.error : "רישום ההתראות נכשל");
  }
}

/**
 * The push endpoint of THIS device, as the browser knows it.
 *
 * Sent on logout so the server can release only this account's subscription on
 * this device, leaving other accounts on the same phone — and this account's
 * other devices — untouched.
 *
 * Uses getRegistration() rather than serviceWorker.ready on purpose: `ready`
 * never settles when no service worker is registered, which would hang logout.
 * Every failure here is swallowed — logging out must never depend on it.
 */
export async function currentPushEndpoint(): Promise<string | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return subscription?.endpoint ?? null;
  } catch {
    return null;
  }
}
