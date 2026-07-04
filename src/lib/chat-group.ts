import db from "@/lib/db";

export function resolveCoachId(user: { id: string; role: string; coach_id?: string | null }): string | null {
  return user.role === "coach" ? user.id : (user.coach_id ?? null);
}

export async function isGroupOwner(groupId: string, coachUserId: string): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT 1 FROM chat_groups WHERE id = ? AND coach_id = ? LIMIT 1",
    args: [groupId, coachUserId],
  });
  return result.rows.length > 0;
}

export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT 1
          FROM chat_groups g
          WHERE g.id = ?
            AND (
              g.coach_id = ?
              OR EXISTS (
                SELECT 1 FROM chat_group_members gm
                WHERE gm.group_id = g.id AND gm.user_id = ?
              )
            )
          LIMIT 1`,
    args: [groupId, userId, userId],
  });
  return result.rows.length > 0;
}
