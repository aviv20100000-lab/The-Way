/**
 * @jest-environment node
 *
 * INTEGRATION test: consumeResetToken with a real in-memory libsql DB.
 *
 * Unlike reset-token-replay.test.ts (which mocks consumeResetToken itself),
 * this test exercises the actual persistence logic to confirm that:
 *   1. A valid token can be consumed once.
 *   2. A replayed token is rejected at the DB level (used_at is set).
 *   3. A token whose DB row has expired is rejected.
 *   4. A cryptographically expired JWT is rejected before hitting the DB.
 */

// JWT_SECRET is set in jest.setup.js so it's available before module imports.

// ── in-memory DB mock ─────────────────────────────────────────────────────────
// jest.mock is hoisted above all imports/lets (TDZ). The factory must be fully
// self-contained — create the client inside and expose it via the module shape.

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client");
  const memDb = createClient({ url: ":memory:" });

  return {
    __esModule: true,
    default: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: (stmt: any) => memDb.execute(stmt),
      executeMultiple: (sql: string) => memDb.executeMultiple(sql),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch: (stmts: any, mode?: any) => memDb.batch(stmts, mode),
    },
    initDb: () =>
      memDb.executeMultiple(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          jti TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used_at TEXT
        );
      `),
    // Exposed so tests can insert rows directly without going through the lib
    _memDb: memDb,
  };
});

// ── imports (resolved after mocks) ───────────────────────────────────────────

import { randomUUID } from "crypto";
import { SignJWT } from "jose";
import { initDb } from "@/lib/db";
import { generateResetToken, consumeResetToken } from "@/lib/password-reset";

// Access the real in-memory client that was created inside the mock factory
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const memDb = (jest.requireMock("@/lib/db") as any)._memDb;

const RESET_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// ── tests ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await initDb();
});

describe("consumeResetToken — real in-memory DB integration", () => {
  it("consumes a valid token exactly once (replay rejected at DB level)", async () => {
    const token = await generateResetToken("user-001", "a@example.com");

    const first = await consumeResetToken(token);
    expect(first).not.toBeNull();
    expect(first!.userId).toBe("user-001");

    // Replay — same token, DB row now has used_at set → must return null
    const second = await consumeResetToken(token);
    expect(second).toBeNull();
  });

  it("rejects a token whose DB row has expires_at in the past", async () => {
    const jti = randomUUID();
    const userId = "user-002";

    // JWT is cryptographically valid (expires far future) but DB row is expired
    const token = await new SignJWT({ userId, email: "b@example.com", jti })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(RESET_SECRET);

    await memDb.execute({
      sql: "INSERT INTO password_reset_tokens (jti, user_id, expires_at, used_at) VALUES (?, ?, datetime('now', '-1 minute'), NULL)",
      args: [jti, userId],
    });

    const result = await consumeResetToken(token);
    expect(result).toBeNull();
  });

  it("rejects a cryptographically expired JWT before hitting the DB", async () => {
    const jti = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const token = await new SignJWT({ userId: "user-003", email: "c@example.com", jti })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 120)
      .setExpirationTime(now - 60) // expired 60s ago
      .sign(RESET_SECRET);

    const result = await consumeResetToken(token);
    expect(result).toBeNull();
  });
});
