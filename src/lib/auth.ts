import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import db, { initDb } from "./db";
import type { User } from "./types";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || (() => { throw new Error("JWT_SECRET is required in .env.local"); })()
);
const COOKIE_NAME = "the-way-session";

function normalizeLoginValue(value: string) {
  return value.trim().toLowerCase();
}

let dbReady = false;
async function ensureDb() {
  if (!dbReady) { await initDb(); dbReady = true; }
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createToken(user: User, version = 1) {
  return new SignJWT({ sub: user.id, role: user.role, name: user.name, ver: version })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, SECRET);
  return payload.sub as string;
}

export async function setSession(user: User) {
  await ensureDb();
  const vRow = await db.execute({ sql: "SELECT session_version FROM users WHERE id = ?", args: [user.id] });
  const version = (vRow.rows[0]?.session_version as number | null) ?? 1;
  const token = await createToken(user, version);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<User | null> {
  await ensureDb();
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const userId = payload.sub as string;
    // ver defaults to 1 for old tokens that pre-date session revocation
    const tokenVer = (payload.ver as number | null) ?? 1;
    const res = await db.execute({ sql: "SELECT id, name, email, role, coach_id, username, session_version FROM users WHERE id = ?", args: [userId] });
    const row = res.rows[0];
    if (!row) return null;
    const dbVer = (row.session_version as number | null) ?? 1;
    if (tokenVer !== dbVer) return null; // session revoked (e.g. after password reset)
    return { id: row.id as string, name: row.name as string, email: row.email as string, role: row.role as "coach" | "client", coach_id: row.coach_id as string | null, username: row.username as string };
  } catch {
    return null;
  }
}

export async function getUserByEmail(email: string) {
  await ensureDb();
  const normalized = normalizeLoginValue(email);
  const res = await db.execute({ sql: "SELECT * FROM users WHERE lower(trim(email)) = ?", args: [normalized] });
  const row = res.rows[0];
  if (!row) return undefined;
  return { id: row.id as string, name: row.name as string, email: row.email as string, role: row.role as "coach" | "client", coach_id: row.coach_id as string | null, password_hash: row.password_hash as string };
}

export async function getUserByUsername(username: string) {
  await ensureDb();
  const normalized = normalizeLoginValue(username);
  const res = await db.execute({
    sql: `
      SELECT *
      FROM users
      WHERE lower(trim(username)) = ?
         OR lower(trim(name)) = ?
         OR lower(substr(trim(email), 1, instr(trim(email), '@') - 1)) = ?
      LIMIT 1
    `,
    args: [normalized, normalized, normalized],
  });
  const row = res.rows[0];
  if (!row) return undefined;
  return { id: row.id as string, name: row.name as string, email: row.email as string, role: row.role as "coach" | "client", coach_id: row.coach_id as string | null, password_hash: row.password_hash as string };
}

export async function createUser(data: { name: string; email: string; password: string; role: "coach" | "client"; coachId?: string }) {
  await ensureDb();
  const id = uuid();
  const passwordHash = await bcrypt.hash(data.password, 10);
  const normalizedEmail = normalizeLoginValue(data.email);
  const username = normalizedEmail.split("@")[0];
  // New clients start OUTSIDE the default chat group — the coach adds them explicitly.
  const inDefaultGroup = data.role === "coach" ? 1 : 0;
  await db.execute({ sql: "INSERT INTO users (id, name, email, username, password_hash, role, coach_id, in_default_group) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", args: [id, data.name, normalizedEmail, username, passwordHash, data.role, data.coachId ?? null, inDefaultGroup] });
  return { id, name: data.name, email: normalizedEmail, role: data.role, coach_id: data.coachId ?? null };
}

export async function getClientsByCoach(coachId: string): Promise<(User & { has_goals: boolean; in_default_group: boolean })[]> {
  await ensureDb();
  const res = await db.execute({
    sql: `SELECT u.id, u.name, u.email, u.role, u.coach_id, u.in_default_group,
            CASE WHEN g.user_id IS NOT NULL AND (
              g.target_weight_kg IS NOT NULL OR g.daily_calories IS NOT NULL OR
              g.daily_protein_g IS NOT NULL OR g.daily_water_ml IS NOT NULL OR
              g.daily_steps IS NOT NULL
            ) THEN 1 ELSE 0 END AS has_goals
          FROM users u
          LEFT JOIN goals g ON g.user_id = u.id
          WHERE u.coach_id = ?
          ORDER BY u.name`,
    args: [coachId],
  });
  return res.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    role: r.role as "coach" | "client",
    coach_id: r.coach_id as string | null,
    has_goals: Boolean(r.has_goals),
    in_default_group: Boolean(r.in_default_group),
  }));
}
