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

// Membership in the coach's default (all-hands) group. Coaches always belong;
// clients belong only when their in_default_group flag is on.
export async function isInDefaultGroup(user: { id: string; role: string }): Promise<boolean> {
  if (user.role === "coach") return true;
  const result = await db.execute({
    sql: "SELECT 1 FROM users WHERE id = ? AND in_default_group = 1 LIMIT 1",
    args: [user.id],
  });
  return result.rows.length > 0;
}

// Everyone who should receive a push for the coach's default (all-hands) group:
// the coach, plus clients who are actually in the group and not restricted to
// coach-only visibility. Both push call sites must use this — sending to every
// client of the coach notifies people who get a 403 when they open the message.
export async function getDefaultGroupMemberIds(coachId: string): Promise<string[]> {
  const result = await db.execute({
    sql: `SELECT id FROM users
          WHERE id = ?
             OR (coach_id = ? AND role = 'client' AND in_default_group = 1 AND dm_coach_only = 0)`,
    args: [coachId, coachId],
  });
  return (result.rows as unknown as { id: string }[]).map((row) => String(row.id));
}

// Can this user read/write the coach's default group feed?
// dm_coach_only clients see only their coach, so they must be kept out of the feed
// in both directions — otherwise their message shows up for every other client.
export async function canAccessDefaultGroup(user: { id: string; role: string }): Promise<boolean> {
  if (user.role === "coach") return true;
  const result = await db.execute({
    sql: "SELECT 1 FROM users WHERE id = ? AND in_default_group = 1 AND dm_coach_only = 0 LIMIT 1",
    args: [user.id],
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
