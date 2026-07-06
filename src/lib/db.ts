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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (stmt: any) => getDb().execute(stmt),
  executeMultiple: (stmt: string) => getDb().executeMultiple(stmt),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  batch: (stmts: any, mode?: any) => getDb().batch(stmts, mode),
};

// Bump this whenever a migration is added below.
const SCHEMA_VERSION = 6;

// The schema setup below is idempotent but issues several remote round-trips.
// Cache it so it runs at most once per server process instead of on every
// request. Concurrent callers all await the same in-flight promise.
let initPromise: Promise<void> | null = null;

export async function initDb() {
  if (initPromise) return initPromise;
  initPromise = runInit().catch((e) => {
    // Reset on failure so a later request can retry the initialization.
    initPromise = null;
    throw e;
  });
  return initPromise;
}

async function runInit() {
  // On an initialized database this is the only remote round-trip needed.
  // A missing table means this is the first run after introducing versioning.
  try {
    const schemaMeta = await db.execute({
      sql: "SELECT version FROM schema_meta WHERE id = 1",
      args: [],
    });
    if (Number(schemaMeta.rows[0]?.version) === SCHEMA_VERSION) return;
  } catch {
    // schema_meta does not exist yet; the idempotent setup below creates it.
  }

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS tzameret_foods (
      code TEXT PRIMARY KEY,
      name_he TEXT NOT NULL,
      calories REAL,
      protein REAL,
      carbs REAL,
      fat REAL
    );

    CREATE TABLE IF NOT EXISTS tzameret_portions (
      food_code TEXT NOT NULL,
      unit_name_he TEXT NOT NULL,
      grams REAL NOT NULL
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
      unit TEXT NOT NULL DEFAULT 'serving'
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
      daily_protein_g INTEGER,
      daily_water_ml INTEGER NOT NULL DEFAULT 2000,
      daily_steps INTEGER,
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

    CREATE TABLE IF NOT EXISTS water_streak (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      current_streak INTEGER NOT NULL DEFAULT 0,
      last_completed_date TEXT,
      best_streak INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id),
      receiver_id TEXT REFERENCES users(id),
      content TEXT NOT NULL,
      image_url TEXT,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_read INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS chat_groups (
      id TEXT PRIMARY KEY,
      coach_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_group_members (
      group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY (group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS chat_message_reactions (
      message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      emoji TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (message_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      jti TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      event TEXT NOT NULL,
      user_id TEXT,
      ip TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coach_activity_state (
      coach_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      last_seen_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'
    );

    CREATE TABLE IF NOT EXISTS coach_activity_reads (
      coach_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_id TEXT NOT NULL,
      read_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (coach_id, activity_id)
    );

    CREATE TABLE IF NOT EXISTS menu_plans (
      id TEXT PRIMARY KEY,
      coach_id TEXT NOT NULL REFERENCES users(id),
      client_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL DEFAULT 'תפריט',
      daily_calories_target INTEGER,
      daily_protein_target INTEGER,
      is_template INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('draft', 'published')) DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menu_days (
      id TEXT PRIMARY KEY,
      menu_plan_id TEXT NOT NULL REFERENCES menu_plans(id) ON DELETE CASCADE,
      day_index INTEGER NOT NULL CHECK(day_index BETWEEN 0 AND 6),
      UNIQUE(menu_plan_id, day_index)
    );

    CREATE TABLE IF NOT EXISTS menu_meals (
      id TEXT PRIMARY KEY,
      menu_day_id TEXT NOT NULL REFERENCES menu_days(id) ON DELETE CASCADE,
      meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(menu_day_id, meal_type)
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      menu_meal_id TEXT NOT NULL REFERENCES menu_meals(id) ON DELETE CASCADE,
      tzameret_code TEXT REFERENCES tzameret_foods(code),
      name_he TEXT NOT NULL,
      grams REAL NOT NULL DEFAULT 100,
      calories REAL NOT NULL DEFAULT 0,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      checked INTEGER NOT NULL DEFAULT 0,
      checked_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_menu_plans_coach_client ON menu_plans(coach_id, client_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_menu_plans_client_status ON menu_plans(client_id, status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_menu_days_plan ON menu_days(menu_plan_id, day_index);
    CREATE INDEX IF NOT EXISTS idx_menu_meals_day ON menu_meals(menu_day_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_menu_items_meal ON menu_items(menu_meal_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver ON chat_messages(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_sent_at ON chat_messages(sent_at);
    CREATE INDEX IF NOT EXISTS idx_chat_group_members_group ON chat_group_members(group_id);
    CREATE INDEX IF NOT EXISTS idx_chat_group_members_user ON chat_group_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_message_reactions_message ON chat_message_reactions(message_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log(event);
    CREATE INDEX IF NOT EXISTS idx_tzameret_foods_name ON tzameret_foods(name_he);
    CREATE INDEX IF NOT EXISTS idx_tzameret_portions_food ON tzameret_portions(food_code);
    CREATE INDEX IF NOT EXISTS idx_users_coach_role ON users(coach_id, role);
    CREATE INDEX IF NOT EXISTS idx_ai_meal_logs_user_logged ON ai_meal_logs(user_id, logged_at);
    CREATE INDEX IF NOT EXISTS idx_meals_user_logged ON meals(user_id, logged_at);
    CREATE INDEX IF NOT EXISTS idx_meal_items_meal ON meal_items(meal_id);
    CREATE INDEX IF NOT EXISTS idx_coach_activity_state_seen ON coach_activity_state(last_seen_at);
    CREATE INDEX IF NOT EXISTS idx_coach_activity_reads_coach ON coach_activity_reads(coach_id);
    CREATE INDEX IF NOT EXISTS idx_weight_logs_user_logged ON weight_logs(user_id, logged_at);
    CREATE INDEX IF NOT EXISTS idx_steps_logs_user_logged ON steps_logs(user_id, logged_at);
    CREATE INDEX IF NOT EXISTS idx_water_logs_user_logged ON water_logs(user_id, logged_at);
  `);

  // Migration: add username column if it doesn't exist
  try {
    await db.execute({ sql: "ALTER TABLE users ADD COLUMN username TEXT", args: [] });
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.execute({ sql: "ALTER TABLE users ADD COLUMN avatar_url TEXT", args: [] });
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.execute({ sql: "ALTER TABLE users ADD COLUMN default_group_name TEXT", args: [] });
  } catch {
    // Column already exists — ignore
  }

  // Migration: add session_version for server-side session revocation
  try {
    await db.execute({ sql: "ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1", args: [] });
  } catch {
    // Column already exists — ignore
  }

  // Migrations: goals columns added after the original production table.
  try {
    await db.execute({ sql: "ALTER TABLE goals ADD COLUMN daily_protein_g INTEGER", args: [] });
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.execute({ sql: "ALTER TABLE goals ADD COLUMN daily_steps INTEGER", args: [] });
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.execute({ sql: "ALTER TABLE chat_messages ADD COLUMN image_url TEXT", args: [] });
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.execute({ sql: "ALTER TABLE chat_messages ADD COLUMN group_id TEXT", args: [] });
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.execute({ sql: "ALTER TABLE chat_groups ADD COLUMN image_url TEXT", args: [] });
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.execute({ sql: "ALTER TABLE chat_messages ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0", args: [] });
  } catch {
    // Column already exists — ignore
  }

  // Default-group membership: existing users stay in (DEFAULT 1);
  // newly created clients start outside the group (set at creation).
  try {
    await db.execute({ sql: "ALTER TABLE users ADD COLUMN in_default_group INTEGER NOT NULL DEFAULT 1", args: [] });
  } catch {
    // Column already exists — ignore
  }

  // Weigh-in reminder cadence, set per client by their coach.
  // NULL = no reminder. 1 = every Sunday, 2 = every other Sunday.
  try {
    await db.execute({ sql: "ALTER TABLE goals ADD COLUMN weigh_in_frequency_weeks INTEGER", args: [] });
  } catch {
    // Column already exists — ignore
  }

  await db.execute({
    sql: "CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON chat_messages(group_id)",
    args: [],
  });

  // Derive a plain username from the email address for existing users.
  await db.execute({
    sql: `
      UPDATE users
      SET username = lower(substr(trim(email), 1, instr(trim(email), '@') - 1))
      WHERE username IS NULL
         OR username = ''
         OR username = lower(trim(email))
         OR username = lower(trim(name));
    `,
    args: [],
  });

  await db.execute({
    sql: `INSERT INTO schema_meta (id, version)
          VALUES (1, ?)
          ON CONFLICT(id) DO UPDATE SET version = excluded.version`,
    args: [SCHEMA_VERSION],
  });
}

export default db;
