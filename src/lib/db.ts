import { createClient } from "@libsql/client";
import { mkdirSync } from "fs";
import { join } from "path";

type DbClient = ReturnType<typeof createClient>;

let _db: DbClient | null = null;

function getDb(): DbClient {
  if (!_db) {
    if (process.env.TURSO_URL) {
      _db = createClient({
        url: process.env.TURSO_URL,
        authToken: process.env.TURSO_TOKEN,
      });
    } else {
      const dataDir = join(process.cwd(), "data");
      mkdirSync(dataDir, { recursive: true });
      _db = createClient({ url: `file:${join(dataDir, "nutrition.db")}` });
    }
  }
  return _db;
}

const db = {
  execute: (...args: Parameters<DbClient["execute"]>) => getDb().execute(...args),
  executeMultiple: (...args: Parameters<DbClient["executeMultiple"]>) => getDb().executeMultiple(...args),
  batch: (...args: Parameters<DbClient["batch"]>) => getDb().batch(...args),
};

export async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('coach', 'client')),
      coach_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS foods (
      id TEXT PRIMARY KEY,
      name_he TEXT NOT NULL,
      name_en TEXT,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      serving_size TEXT NOT NULL DEFAULT '100g'
    );

    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      photo_url TEXT,
      meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
      notes TEXT,
      logged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meal_items (
      id TEXT PRIMARY KEY,
      meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
      food_id TEXT NOT NULL REFERENCES foods(id),
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'מנה'
    );

    CREATE TABLE IF NOT EXISTS weight_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      weight_kg REAL NOT NULL,
      photo_url TEXT,
      logged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goals (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      target_weight_kg REAL,
      daily_calories INTEGER,
      daily_water_ml INTEGER NOT NULL DEFAULT 2000,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS steps_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      steps INTEGER NOT NULL,
      screenshot_url TEXT,
      logged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS water_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      amount_ml INTEGER NOT NULL DEFAULT 250,
      logged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      author TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_meal_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      photo_url TEXT NOT NULL,
      ai_response TEXT NOT NULL,
      total_calories INTEGER,
      logged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export default db;
