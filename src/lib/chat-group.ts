import db from "@/lib/db";

export type ChatUserIdentity = {
  id: string;
  role: string;
  coach_id?: string | null;
};

export type PrivateChatContact = {
  id: string;
  name: string;
  role: string;
  username: string;
  avatar_url: string | null;
};

export function resolveCoachId(user: { id: string; role: string; coach_id?: string | null }): string | null {
  return user.role === "coach" ? user.id : (user.coach_id ?? null);
}

export async function getPrivateChatContacts(user: ChatUserIdentity): Promise<PrivateChatContact[]> {
  const coachId = resolveCoachId(user);
  if (!coachId) return [];

  if (user.role === "coach") {
    const result = await db.execute({
      sql: `SELECT u.id, u.name, u.role, u.username, u.avatar_url,
                   (SELECT MAX(m.sent_at) FROM chat_messages m
                    WHERE (m.sender_id = u.id AND m.receiver_id = ?)
                       OR (m.sender_id = ? AND m.receiver_id = u.id)) AS last_message_at
            FROM users u
            WHERE (u.id = ? OR u.coach_id = ?) AND u.id != ?
            ORDER BY last_message_at IS NULL, last_message_at DESC, u.role DESC, u.name ASC`,
      args: [user.id, user.id, coachId, coachId, user.id],
    });
    return (result.rows as unknown as (PrivateChatContact & { last_message_at: string | null })[])
      .map(({ id, name, role, username, avatar_url }) => ({ id, name, role, username, avatar_url }));
  }

  const selfResult = await db.execute({
    sql: "SELECT dm_coach_only, in_default_group FROM users WHERE id = ?",
    args: [user.id],
  });
  const dmCoachOnly = Number(selfResult.rows[0]?.dm_coach_only ?? 0) === 1;
  if (dmCoachOnly) {
    const coachResult = await db.execute({
      sql: "SELECT id, name, role, username, avatar_url FROM users WHERE id = ?",
      args: [coachId],
    });
    return coachResult.rows as unknown as PrivateChatContact[];
  }
  const inDefaultGroup = Number(selfResult.rows[0]?.in_default_group ?? 0) === 1;

  const result = await db.execute({
    sql: `SELECT DISTINCT u.id, u.name, u.role, u.username, u.avatar_url
          FROM users u
          WHERE u.id = ?
             OR (
               u.role = 'client'
               AND u.coach_id = ?
               AND u.id != ?
               AND (
                 EXISTS (
                   SELECT 1
                   FROM chat_group_members mine
                   JOIN chat_group_members peer ON peer.group_id = mine.group_id
                   WHERE mine.user_id = ? AND peer.user_id = u.id
                 )
                 OR (? = 1 AND u.in_default_group = 1 AND u.dm_coach_only = 0)
               )
             )
          ORDER BY u.role DESC, u.name ASC`,
    args: [coachId, coachId, user.id, user.id, inDefaultGroup ? 1 : 0],
  });
  return result.rows as unknown as PrivateChatContact[];
}

export async function canAccessPrivateChat(actor: ChatUserIdentity, peer: ChatUserIdentity): Promise<boolean> {
  const coachId = resolveCoachId(actor);
  if (!coachId) return false;
  if (peer.id === actor.id) return false;

  const peerCoachId = peer.role === "coach" ? peer.id : (peer.coach_id ?? null);
  if (peerCoachId !== coachId) return false;
  if (actor.role === "coach") return true;
  if (peer.role === "coach" && peer.id === coachId) return true;
  if (peer.role !== "client") return false;

  const selfResult = await db.execute({
    sql: "SELECT dm_coach_only, in_default_group FROM users WHERE id = ?",
    args: [actor.id],
  });
  if (Number(selfResult.rows[0]?.dm_coach_only ?? 0) === 1) return false;

  const sharedGroupResult = await db.execute({
    sql: `SELECT 1
          FROM chat_group_members mine
          JOIN chat_group_members peer ON peer.group_id = mine.group_id
          WHERE mine.user_id = ? AND peer.user_id = ?
          LIMIT 1`,
    args: [actor.id, peer.id],
  });
  if (sharedGroupResult.rows.length > 0) return true;

  const actorInDefaultGroup = Number(selfResult.rows[0]?.in_default_group ?? 0) === 1;
  if (!actorInDefaultGroup) return false;

  const peerFlagsResult = await db.execute({
    sql: "SELECT in_default_group, dm_coach_only FROM users WHERE id = ?",
    args: [peer.id],
  });
  const peerFlags = peerFlagsResult.rows[0] as unknown as { in_default_group?: number; dm_coach_only?: number } | undefined;
  return Number(peerFlags?.in_default_group ?? 0) === 1 && Number(peerFlags?.dm_coach_only ?? 0) === 0;
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
