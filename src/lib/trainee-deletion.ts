import { del } from "@vercel/blob";
import db from "./db";

/**
 * Deleting a trainee, and counting what that costs.
 *
 * Turso runs with `PRAGMA foreign_keys = 1`, and only 7 of the 25 references to
 * users(id) in the live database are ON DELETE CASCADE. The other 18 are
 * NO ACTION, so a bare `DELETE FROM users` does NOT leave orphan rows — it fails
 * outright with "FOREIGN KEY constraint failed" the moment the trainee has a
 * single meal, weight or chat message. Verified against production on a throwaway
 * user, 2026-07-30.
 *
 * So every child row is deleted explicitly here, children before parents, inside
 * one transaction. Do not trust the CASCADE declarations in db.ts: several tables
 * (assistant_messages is the known one) were created before the cascade was added
 * to the CREATE TABLE statement, and `CREATE TABLE IF NOT EXISTS` never rewrote
 * them. What is listed below is what the live schema actually does.
 */

/** Rows that really do cascade in the live schema, so they are NOT deleted here:
 *    assistant_feedback   (user_id, and message_id off assistant_messages)
 *    assistant_preferences
 *    scan_corrections
 *    coach_requests       (client_id)
 *    meal_items           (off meals)
 *    chat_message_reactions (message_id, off chat_messages)
 *    chat_group_members   (group_id, off chat_groups — not user_id)
 *    menu_days → menu_meals → menu_meal_options → menu_items, menu_meal_selections
 *                         (all off menu_plans)
 */

/** What a trainee has in the database, in numbers a coach can actually read. */
export interface TraineeImpact {
  meals: number;
  weights: number;
  steps: number;
  water: number;
  messages: number;
  scans: number;
  assistantMessages: number;
  menus: number;
  photos: number;
}

export async function getTraineeImpact(userId: string): Promise<TraineeImpact> {
  const res = await db.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM meals            WHERE user_id = ?)                    AS meals,
            (SELECT COUNT(*) FROM weight_logs      WHERE user_id = ?)                    AS weights,
            (SELECT COUNT(*) FROM steps_logs       WHERE user_id = ?)                    AS steps,
            (SELECT COUNT(*) FROM water_logs       WHERE user_id = ?)                    AS water,
            (SELECT COUNT(*) FROM chat_messages    WHERE sender_id = ? OR receiver_id = ?) AS messages,
            (SELECT COUNT(*) FROM ai_meal_logs     WHERE user_id = ?)                    AS scans,
            (SELECT COUNT(*) FROM assistant_messages WHERE user_id = ?)                  AS assistant_messages,
            (SELECT COUNT(*) FROM menu_plans       WHERE client_id = ?)                  AS menus`,
    args: Array(9).fill(userId),
  });
  const row = res.rows[0];
  const photos = (await collectPhotoUrls(userId)).length;

  return {
    meals: Number(row?.meals ?? 0),
    weights: Number(row?.weights ?? 0),
    steps: Number(row?.steps ?? 0),
    water: Number(row?.water ?? 0),
    messages: Number(row?.messages ?? 0),
    scans: Number(row?.scans ?? 0),
    assistantMessages: Number(row?.assistant_messages ?? 0),
    menus: Number(row?.menus ?? 0),
    photos,
  };
}

/**
 * Every image this trainee owns, across all the tables that hold one. Collected
 * BEFORE the rows are deleted, because afterwards there is nothing left to ask.
 */
async function collectPhotoUrls(userId: string): Promise<string[]> {
  const res = await db.execute({
    sql: `SELECT photo_url AS url FROM meals        WHERE user_id = ? AND photo_url IS NOT NULL AND photo_url <> ''
          UNION SELECT photo_url      FROM weight_logs  WHERE user_id = ? AND photo_url IS NOT NULL AND photo_url <> ''
          UNION SELECT screenshot_url FROM steps_logs   WHERE user_id = ? AND screenshot_url IS NOT NULL AND screenshot_url <> ''
          UNION SELECT photo_url      FROM ai_meal_logs WHERE user_id = ? AND photo_url IS NOT NULL AND photo_url <> ''
          UNION SELECT image_url      FROM chat_messages WHERE sender_id = ? AND image_url IS NOT NULL AND image_url <> ''
          UNION SELECT avatar_url     FROM users        WHERE id = ?      AND avatar_url IS NOT NULL AND avatar_url <> ''`,
    args: Array(6).fill(userId),
  });
  return res.rows.map((r) => String(r.url));
}

/**
 * Deletes the trainee and everything that belongs to them, in one transaction.
 *
 * The order is the FK order: reactions and messages before the user, meals before
 * the user (meal_items ride along on the cascade), menu plans before the user (the
 * whole day/meal/option/item tree rides along).
 *
 * Chat is the destructive part the coach has to accept: chat_messages.sender_id is
 * NOT NULL with no cascade, so the trainee's messages inside group conversations
 * are deleted too, and other members will see gaps in the history. There is no
 * variant of this that keeps them.
 */
export async function deleteTraineeCascade(userId: string): Promise<void> {
  const photoUrls = await collectPhotoUrls(userId);

  await db.batch(
    [
      // Reactions this trainee left on OTHER people's messages. Reactions on their
      // own messages cascade when those messages go.
      { sql: "DELETE FROM chat_message_reactions WHERE user_id = ?", args: [userId] },
      { sql: "DELETE FROM chat_messages WHERE sender_id = ? OR receiver_id = ?", args: [userId, userId] },
      { sql: "DELETE FROM chat_group_members WHERE user_id = ?", args: [userId] },
      // assistant_feedback cascades off these.
      { sql: "DELETE FROM assistant_messages WHERE user_id = ?", args: [userId] },
      // meal_items cascade off meals.
      { sql: "DELETE FROM meals WHERE user_id = ?", args: [userId] },
      // The entire menu tree cascades off menu_plans.
      { sql: "DELETE FROM menu_plans WHERE client_id = ?", args: [userId] },
      { sql: "DELETE FROM ai_meal_logs WHERE user_id = ?", args: [userId] },
      { sql: "DELETE FROM goals WHERE user_id = ?", args: [userId] },
      { sql: "DELETE FROM password_reset_tokens WHERE user_id = ?", args: [userId] },
      { sql: "DELETE FROM push_subscriptions WHERE user_id = ?", args: [userId] },
      { sql: "DELETE FROM steps_logs WHERE user_id = ?", args: [userId] },
      { sql: "DELETE FROM water_logs WHERE user_id = ?", args: [userId] },
      { sql: "DELETE FROM water_streak WHERE user_id = ?", args: [userId] },
      { sql: "DELETE FROM weight_logs WHERE user_id = ?", args: [userId] },
      // Last. If any reference was missed, this is the statement that fails, and
      // the transaction rolls the whole thing back rather than half-deleting a user.
      { sql: "DELETE FROM users WHERE id = ?", args: [userId] },
    ],
    "write"
  );

  // Only after the rows are certainly gone. Blob failures must not fail the
  // request — the account is already deleted, and a leftover image is a storage
  // cost, not a correctness problem.
  await deletePhotos(photoUrls);
}

async function deletePhotos(urls: string[]): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || urls.length === 0) return;
  try {
    await del(urls, { token });
  } catch (error) {
    console.error("[trainee-deletion] failed to delete blobs", error);
  }
}
