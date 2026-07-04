import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";

const SOURCES = {
  foods: {
    id: "c3cb0630-0650-46c1-a068-82d575c094b2",
    url: "https://e.data.gov.il/dataset/d4f9c425-d657-4852-bd58-0cceb96a5f6d/resource/c3cb0630-0650-46c1-a068-82d575c094b2/download/moh_mitzrachim.csv",
  },
  units: {
    id: "98fb46fe-e8de-4067-94d2-b0a8ea4269da",
    url: "https://e.data.gov.il/dataset/d4f9c425-d657-4852-bd58-0cceb96a5f6d/resource/98fb46fe-e8de-4067-94d2-b0a8ea4269da/download/moh_yehidot_mida.csv",
  },
  portions: {
    id: "755d28c0-75f7-40e1-9c8c-ecdd106f9b2d",
    url: "https://e.data.gov.il/dataset/d4f9c425-d657-4852-bd58-0cceb96a5f6d/resource/755d28c0-75f7-40e1-9c8c-ecdd106f9b2d/download/moh_yehidot_mida_lemitzrachim.csv",
  },
} as const;

type CsvRecord = Record<string, string>;
type SourceRecord = Record<string, unknown>;
type DbValue = string | number | null;
type Statement = { sql: string; args: DbValue[] };

interface LoadedSource {
  encoding: "utf-8" | "windows-1255" | "datastore-json";
  headers: string[];
  records: SourceRecord[];
}

interface ImportedFood {
  code: string;
  name_he: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

interface ImportedPortion {
  food_code: string;
  unit_name_he: string;
  grams: number;
}

function loadEnvFile(fileName: string) {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
}

function parseCsv(text: string): CsvRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const headers = (rows.shift() ?? []).map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function hebrewScore(value: string) {
  let score = 0;
  for (const character of value.slice(0, 20_000)) {
    const code = character.charCodeAt(0);
    if (code >= 0x0590 && code <= 0x05ff) score += 1;
    if (code === 0xfffd) score -= 20;
  }
  return score;
}

function decodeCsv(bytes: ArrayBuffer) {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const windows1255 = new TextDecoder("windows-1255").decode(bytes);
  return hebrewScore(utf8) >= hebrewScore(windows1255)
    ? { text: utf8.replace(/^\uFEFF/, ""), encoding: "utf-8" as const }
    : { text: windows1255.replace(/^\uFEFF/, ""), encoding: "windows-1255" as const };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

async function loadFromDatastore(resourceId: string): Promise<LoadedSource> {
  const records: SourceRecord[] = [];
  let headers: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const endpoint = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&limit=1000&offset=${offset}`;
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`DataStore download failed (${response.status})`);
    const payload = asObject(await response.json());
    const result = asObject(payload?.result);
    const page = Array.isArray(result?.records) ? result.records.map(asObject).filter((record): record is SourceRecord => record !== null) : [];
    if (!headers.length && Array.isArray(result?.fields)) {
      headers = result.fields.map(asObject).map((field) => String(field?.id ?? "")).filter(Boolean);
    }
    records.push(...page);
    const total = Number(result?.total) || records.length;
    if (records.length >= total || page.length === 0) break;
  }
  return { encoding: "datastore-json", headers, records };
}

async function loadSource(source: { id: string; url: string }): Promise<LoadedSource> {
  const response = await fetch(source.url);
  const contentType = response.headers.get("content-type") ?? "";
  const bytes = await response.arrayBuffer();
  const prefix = new TextDecoder("utf-8").decode(bytes.slice(0, 200)).toLowerCase();
  if (!response.ok || contentType.includes("text/html") || prefix.includes("<!doctype html")) {
    console.warn(`CSV endpoint unavailable; using official DataStore API for ${source.id}`);
    return loadFromDatastore(source.id);
  }
  const decoded = decodeCsv(bytes);
  const parsed = parseCsv(decoded.text);
  return {
    encoding: decoded.encoding,
    headers: parsed[0] ? Object.keys(parsed[0]) : [],
    records: parsed,
  };
}

function text(record: SourceRecord, key: string) {
  return String(record[key] ?? "").trim();
}

function numberOrNull(record: SourceRecord, key: string) {
  const raw = text(record, key).replace(/,/g, "");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function assertHebrew(records: SourceRecord[], key: string) {
  const samples = records.map((record) => text(record, key)).filter(Boolean).slice(0, 25);
  if (!samples.some((sample) => /[\u0590-\u05ff]/.test(sample)) || samples.some((sample) => sample.includes("�"))) {
    throw new Error(`Hebrew decoding validation failed for ${key}`);
  }
}

async function runBatches(statements: Statement[], client: ReturnType<typeof createClient>) {
  for (let index = 0; index < statements.length; index += 500) {
    await client.batch(statements.slice(index, index + 500), "write");
  }
}

async function currentCount(client: ReturnType<typeof createClient>, table: string) {
  try {
    const result = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
    return Number(result.rows[0]?.count) || 0;
  } catch {
    return 0;
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const targetUrl = process.env.TURSO_URL;
  if (!targetUrl) throw new Error("TURSO_URL is required; refusing to guess the target database");

  console.log(`Target database: ${targetUrl}`);
  console.log("Downloading and inspecting official Tzameret sources...");
  const [foodsSource, unitsSource, portionsSource] = await Promise.all([
    loadSource(SOURCES.foods),
    loadSource(SOURCES.units),
    loadSource(SOURCES.portions),
  ]);

  assertHebrew(foodsSource.records, "shmmitzrach");
  assertHebrew(unitsSource.records, "shmmida");

  console.log(`Foods headers (${foodsSource.encoding}): ${foodsSource.headers.join(", ")}`);
  console.log(`Units headers (${unitsSource.encoding}): ${unitsSource.headers.join(", ")}`);
  console.log(`Portions headers (${portionsSource.encoding}): ${portionsSource.headers.join(", ")}`);

  const foods: ImportedFood[] = foodsSource.records.map((record) => ({
    code: text(record, "Code"),
    name_he: text(record, "shmmitzrach"),
    calories: numberOrNull(record, "food_energy"),
    protein: numberOrNull(record, "protein"),
    carbs: numberOrNull(record, "carbohydrates"),
    fat: numberOrNull(record, "total_fat"),
  })).filter((food) => food.code && food.name_he);

  const units = new Map(unitsSource.records.map((record) => [text(record, "smlmida"), text(record, "shmmida")]));
  const portions: ImportedPortion[] = portionsSource.records.map((record) => ({
    food_code: text(record, "mmitzrach"),
    unit_name_he: units.get(text(record, "mida")) ?? "",
    grams: numberOrNull(record, "mishkal") ?? 0,
  })).filter((portion) => portion.food_code && portion.unit_name_he && portion.grams > 0);

  const client = createClient({ url: targetUrl, authToken: process.env.TURSO_TOKEN });
  const [existingFoods, existingPortions] = await Promise.all([
    currentCount(client, "tzameret_foods"),
    currentCount(client, "tzameret_portions"),
  ]);

  console.log(`Source rows ready: ${foods.length} foods, ${units.size} units, ${portions.length} positive portions`);
  console.log(`Current target rows: ${existingFoods} foods, ${existingPortions} portions`);
  console.log("Hebrew preview:", foods.slice(0, 5).map((food) => food.name_he).join(" | "));

  if (!process.argv.includes("--yes")) {
    console.log("Dry run only. Re-run with --yes to replace the target Tzameret tables.");
    client.close();
    return;
  }

  await client.execute(`CREATE TABLE IF NOT EXISTS tzameret_foods (
    code TEXT PRIMARY KEY, name_he TEXT NOT NULL, calories REAL, protein REAL, carbs REAL, fat REAL
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS tzameret_portions (
    food_code TEXT NOT NULL, unit_name_he TEXT NOT NULL, grams REAL NOT NULL
  )`);
  await client.execute("CREATE INDEX IF NOT EXISTS idx_tzameret_foods_name ON tzameret_foods(name_he)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_tzameret_portions_food ON tzameret_portions(food_code)");
  await client.execute("DELETE FROM tzameret_portions");
  await client.execute("DELETE FROM tzameret_foods");

  await runBatches(foods.map((food) => ({
    sql: "INSERT OR REPLACE INTO tzameret_foods (code, name_he, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?, ?)",
    args: [food.code, food.name_he, food.calories, food.protein, food.carbs, food.fat],
  })), client);
  await runBatches(portions.map((portion) => ({
    sql: "INSERT INTO tzameret_portions (food_code, unit_name_he, grams) VALUES (?, ?, ?)",
    args: [portion.food_code, portion.unit_name_he, portion.grams],
  })), client);

  const finalFoods = await currentCount(client, "tzameret_foods");
  const finalPortions = await currentCount(client, "tzameret_portions");
  const samples = await client.execute("SELECT code, name_he, calories, protein, carbs, fat FROM tzameret_foods ORDER BY code LIMIT 5");
  console.log(`Import complete: ${finalFoods} foods, ${finalPortions} portions`);
  console.table(samples.rows);
  client.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
