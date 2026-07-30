import db from "@/lib/db";
import webpush from "web-push";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function setupVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!.replace(/^ן»¿/, ""),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export async function pushToUsers(userIds: string[], payload: string) {
  if (userIds.length === 0) return;

  const placeholders = userIds.map(() => "?").join(",");
  const rows = (await db.execute({
    sql: `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
          FROM push_subscriptions ps
          WHERE ps.user_id IN (${placeholders})`,
    args: userIds,
  })).rows as unknown as PushSubscriptionRow[];

  for (const sub of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
    } catch {
      // By id, not by endpoint: the same device may hold another account's
      // subscription, and that row is not ours to delete.
      await db.execute({
        sql: "DELETE FROM push_subscriptions WHERE id = ?",
        args: [sub.id],
      });
    }
  }
}
