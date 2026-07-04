import db from "@/lib/db";
import webpush from "web-push";

type PushSubscriptionRow = {
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
    sql: `SELECT ps.endpoint, ps.p256dh, ps.auth
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
      await db.execute({
        sql: "DELETE FROM push_subscriptions WHERE endpoint = ?",
        args: [sub.endpoint],
      });
    }
  }
}
