import db from "@/lib/db";

export function defaultGroupReadKey(coachId: string): string {
  return `default:${coachId}`;
}

export function namedGroupReadKey(groupId: string): string {
  return `named:${groupId}`;
}

export async function markGroupRead(userId: string, channelKey: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO chat_group_reads (user_id, channel_key, last_read_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(user_id, channel_key)
          DO UPDATE SET last_read_at = MAX(chat_group_reads.last_read_at, excluded.last_read_at)`,
    args: [userId, channelKey],
  });
}
