import Anthropic from "@anthropic-ai/sdk";
import { sendTelegramAlert } from "./telegram";
import { checkPersistentRateLimit } from "./ratelimit";

// Anthropic returns a 400 invalid_request_error with this phrase when the
// account has run out of prepaid credit — the one case worth paging Aviv
// for immediately, since it silently breaks meal scanning AND the shopping
// assistant at the same time, and looks like a generic bug to the trainee.
function isLowBalanceError(error: unknown): boolean {
  if (!(error instanceof Anthropic.APIError)) return false;
  if (error.status !== 400) return false;
  const message = JSON.stringify(error.error ?? "").toLowerCase();
  return message.includes("credit balance");
}

// Fire-and-forget: never throws, never blocks the caller's own error handling.
// Debounced to once per 6 hours so a burst of failed requests doesn't spam Telegram.
export async function alertIfLowBalance(error: unknown): Promise<void> {
  if (!isLowBalanceError(error)) return;
  try {
    const { allowed } = await checkPersistentRateLimit("low_balance_alert", "lowBalanceAlert");
    if (!allowed) return;
    await sendTelegramAlert(
      "🚨 <b>נגמרה היתרה ב-Anthropic!</b>\n\nסריקת ארוחות והעוזר בצ'אט הפסיקו לעבוד.\nטען יתרה: https://console.anthropic.com/settings/billing"
    );
  } catch {
    // Alerting is best-effort — never let it mask the original error.
  }
}
