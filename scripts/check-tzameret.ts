// Read-only sanity check: is the scan wired to the Tzameret tables in Turso?
// Run: npx tsx scripts/check-tzameret.ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(fileName: string) {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
  if (!process.env.TURSO_URL) throw new Error("TURSO_URL not found in .env.local");

  const [{ default: db }, { matchTzameret }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/tzameret"),
  ]);

  const counts = await db.execute(
    "SELECT (SELECT COUNT(*) FROM tzameret_foods) AS foods, (SELECT COUNT(*) FROM tzameret_portions) AS portions"
  );
  console.log(`DB: ${process.env.TURSO_URL}`);
  console.log(`tzameret_foods: ${counts.rows[0].foods} | tzameret_portions: ${counts.rows[0].portions}\n`);

  const samples = [
    "אורז לבן מבושל",
    "פסטה מבושלת",
    "תפוח אדמה אפוי",
    "חזה עוף",
    "קוטג' 5%",
    "חזה עוף בגריל",
    "ביצה קשה",
    "חומוס",
    "פיצה",
    "שניצל עוף מטוגן",
    "סלט ירקות",
  ];
  for (const name of samples) {
    const match = await matchTzameret(name);
    if (match) {
      console.log(`✅ "${name}" → "${match.name_he}" (${match.calories} קל' | ${match.protein} חלבון ל-100 גרם)`);
    } else {
      console.log(`❌ "${name}" → אין התאמה (ייפול חזרה ל-AI)`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
