/**
 * Dump recent trainee <-> shopping-assistant conversations for manual review.
 *
 * Usage:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/review-assistant-chats.ts [--days 7] [--user <name or email>]
 */
import db, { initDb } from "../src/lib/db";

function parseArgs() {
  const args = process.argv.slice(2);
  let days = 7;
  let user: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days") days = Number(args[++i]) || 7;
    if (args[i] === "--user") user = args[++i];
  }
  return { days, user };
}

async function main() {
  const { days, user } = parseArgs();
  await initDb();

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);

  const userFilter = user
    ? `AND (u.name LIKE ? OR u.email LIKE ?)`
    : "";
  const args = user ? [since, `%${user}%`, `%${user}%`] : [since];

  const result = await db.execute({
    sql: `
      SELECT am.user_id, u.name AS user_name, am.role, am.content, am.created_at
      FROM assistant_messages am
      JOIN users u ON u.id = am.user_id
      WHERE am.created_at >= ? ${userFilter}
      ORDER BY am.user_id, am.created_at ASC
    `,
    args,
  });

  const rows = result.rows as unknown as {
    user_id: string;
    user_name: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }[];

  if (rows.length === 0) {
    console.log(`אין הודעות עם העוזר ב-${days} הימים האחרונים${user ? ` עבור "${user}"` : ""}.`);
    return;
  }

  let currentUser: string | null = null;
  for (const row of rows) {
    if (row.user_name !== currentUser) {
      currentUser = row.user_name;
      console.log(`\n${"=".repeat(50)}`);
      console.log(`מתאמן: ${row.user_name}`);
      console.log("=".repeat(50));
    }
    const speaker = row.role === "user" ? "👤" : "🛒";
    console.log(`\n[${row.created_at}] ${speaker} ${row.content}`);
  }

  const byUser = new Map<string, number>();
  for (const row of rows) byUser.set(row.user_name, (byUser.get(row.user_name) ?? 0) + 1);
  console.log(`\n${"=".repeat(50)}`);
  console.log(`סיכום: ${rows.length} הודעות, ${byUser.size} מתאמנים, ${days} ימים אחרונים`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
