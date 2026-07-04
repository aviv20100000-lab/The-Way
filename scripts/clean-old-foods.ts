// Removes the old inaccurate seeded foods from the `foods` table.
// KEEPS: shawarma entries (user-curated), tz-* rows (materialized Tzameret picks),
// and any row referenced by meal_items (so meal history keeps rendering).
// Dry run: npx tsx scripts/clean-old-foods.ts
// Delete:  npx tsx scripts/clean-old-foods.ts --yes
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";

function loadEnvFile(fileName: string) {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

const KEEP_WHERE = `
  name_he LIKE '%שווארמה%'
  OR name_he LIKE '%שוארמה%'
  OR id LIKE 'tz-%'
  OR id IN (SELECT food_id FROM meal_items)
`;

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
  const url = process.env.TURSO_URL;
  if (!url) throw new Error("TURSO_URL not found in .env.local");
  const client = createClient({ url, authToken: process.env.TURSO_TOKEN });

  console.log(`Target database: ${url}\n`);

  const keep = await client.execute(`SELECT id, name_he FROM foods WHERE ${KEEP_WHERE} ORDER BY name_he`);
  const drop = await client.execute(`SELECT COUNT(*) AS c FROM foods WHERE NOT (${KEEP_WHERE})`);
  const dropSample = await client.execute(`SELECT name_he FROM foods WHERE NOT (${KEEP_WHERE}) ORDER BY name_he LIMIT 10`);

  console.log(`KEEPING ${keep.rows.length} rows:`);
  for (const row of keep.rows) console.log(`  ✓ ${row.name_he}${String(row.id).startsWith("tz-") ? " (צמרת)" : ""}`);
  console.log(`\nDELETING ${drop.rows[0].c} rows. Sample:`);
  for (const row of dropSample.rows) console.log(`  ✗ ${row.name_he}`);

  if (!process.argv.includes("--yes")) {
    console.log("\nDry run only. Re-run with --yes to delete.");
    client.close();
    return;
  }

  const result = await client.execute(`DELETE FROM foods WHERE NOT (${KEEP_WHERE})`);
  const left = await client.execute("SELECT COUNT(*) AS c FROM foods");
  console.log(`\nDeleted ${result.rowsAffected} rows. foods table now has ${left.rows[0].c} rows.`);
  client.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
