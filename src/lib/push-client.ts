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
