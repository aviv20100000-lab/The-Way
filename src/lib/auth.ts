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

export async function createToken(user: User) {
  return new SignJWT({ sub: user.id, role: user.role, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("365d")
    .sign(SECRET);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, SECRET);
  return payload.sub as string;
}

export async function setSession(user: User) {
  const token = await createToken(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
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
    const userId = await verifyToken(token);
    const res = await db.execute({ sql: "SELECT id, name, email, role, coach_id FROM users WHERE id = ?", args: [userId] });
    const row = res.rows[0];
    if (!row) return null;
    return { id: row.id as string, name: row.name as string, email: row.email as string, role: row.role as "coach" | "client", coach_id: row.coach_id as string | null };
  } catch {
    return null;
  }
}

export async function getUserByEmail(email: string) {
  await ensureDb();
  const res = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
  const row = res.rows[0];
  if (!row) return undefined;
  return { id: row.id as string, name: row.name as string, email: row.email as string, role: row.role as "coach" | "client", coach_id: row.coach_id as string | null, password_hash: row.password_hash as string };
}

export async function createUser(data: { name: string; email: string; password: string; role: "coach" | "client"; coachId?: string }) {
  await ensureDb();
  const id = uuid();
  const passwordHash = await bcrypt.hash(data.password, 10);
  await db.execute({ sql: "INSERT INTO users (id, name, email, password_hash, role, coach_id) VALUES (?, ?, ?, ?, ?, ?)", args: [id, data.name, data.email, passwordHash, data.role, data.coachId ?? null] });
  return { id, name: data.name, email: data.email, role: data.role, coach_id: data.coachId ?? null };
}

export async function getClientsByCoach(coachId: string): Promise<User[]> {
  await ensureDb();
  const res = await db.execute({ sql: "SELECT id, name, email, role, coach_id FROM users WHERE coach_id = ? ORDER BY name", args: [coachId] });
  return res.rows.map((r) => ({ id: r.id as string, name: r.name as string, email: r.email as string, role: r.role as "coach" | "client", coach_id: r.coach_id as string | null }));
}
