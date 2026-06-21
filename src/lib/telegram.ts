// Telegram alert helper for the health-check bot.
//
// Fully optional and fail-safe: if TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not
// configured, this is a silent no-op and NEVER throws — so it can never break a
// request that calls it. Setup instructions live in MONITORING.md.

export async function sendTelegramAlert(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn(
      "[telegram] skipped — TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set"
    );
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[telegram] send failed", res.status, detail);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[telegram] send error", e instanceof Error ? e.message : e);
    return false;
  }
}
