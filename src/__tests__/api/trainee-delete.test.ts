/**
 * @jest-environment node
 *
 * The guards around deleting a trainee. Every one of these exists because the
 * action is irreversible and the UI cannot be the thing that enforces it.
 */

import { NextRequest } from "next/server";

const execute = jest.fn();
const batch = jest.fn().mockResolvedValue([]);
const getSessionUser = jest.fn();

jest.mock("@/lib/auth", () => ({ getSessionUser: (...a: unknown[]) => getSessionUser(...a) }));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: (...a: unknown[]) => execute(...a),
    batch: (...a: unknown[]) => batch(...a),
  },
  initDb: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@vercel/blob", () => ({ del: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/audit-log", () => ({ logAuditEvent: jest.fn().mockResolvedValue(undefined) }));

import { DELETE, PATCH } from "@/app/api/users/clients/[id]/route";

const COACH = { id: "coach-1", role: "coach", name: "מאמן", email: "c@x", coach_id: null };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(body: unknown) {
  return new NextRequest("http://localhost/api/users/clients/t1", {
    method: "DELETE",
    body: JSON.stringify(body),
  });
}

/** users lookup returns `row`; every later query returns empty counts. */
function withUserRow(row: Record<string, unknown> | null) {
  execute.mockReset();
  execute.mockImplementation((stmt: { sql: string }) => {
    if (stmt.sql.includes("FROM users WHERE id = ?")) {
      return Promise.resolve({ rows: row ? [row] : [] });
    }
    return Promise.resolve({ rows: [{}] });
  });
}

const TRAINEE = { id: "t1", name: "דני כהן", role: "client", coach_id: "coach-1", active: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  batch.mockResolvedValue([]);
  getSessionUser.mockResolvedValue(COACH);
});

describe("DELETE /api/users/clients/[id]", () => {
  it("rejects anyone who is not a coach", async () => {
    getSessionUser.mockResolvedValue({ ...COACH, role: "client" });
    withUserRow(TRAINEE);
    const res = await DELETE(req({ confirmName: "דני כהן" }), params("t1"));
    expect(res.status).toBe(403);
    expect(batch).not.toHaveBeenCalled();
  });

  it("refuses to delete a coach, so the dashboard cannot delete itself", async () => {
    withUserRow({ ...TRAINEE, role: "coach" });
    const res = await DELETE(req({ confirmName: "דני כהן" }), params("t1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("רק מתאמנים");
    expect(batch).not.toHaveBeenCalled();
  });

  it("hides another coach's trainee behind a 404 rather than a 403", async () => {
    withUserRow({ ...TRAINEE, coach_id: "coach-2" });
    const res = await DELETE(req({ confirmName: "דני כהן" }), params("t1"));
    expect(res.status).toBe(404);
    expect(batch).not.toHaveBeenCalled();
  });

  it("re-checks the typed name on the server, not just in the browser", async () => {
    withUserRow(TRAINEE);
    const res = await DELETE(req({ confirmName: "דני" }), params("t1"));
    expect(res.status).toBe(400);
    expect(batch).not.toHaveBeenCalled();
  });

  it("accepts the exact name and deletes the user last of all", async () => {
    withUserRow(TRAINEE);
    const res = await DELETE(req({ confirmName: "  דני כהן  " }), params("t1"));
    expect(res.status).toBe(200);

    const statements = batch.mock.calls[0][0] as { sql: string }[];
    const sqls = statements.map((s) => s.sql);
    // The user row goes last: every child must already be gone, or the whole
    // transaction rolls back instead of half-deleting an account.
    expect(sqls[sqls.length - 1]).toContain("DELETE FROM users");
    expect(sqls.filter((s) => s.includes("DELETE FROM users"))).toHaveLength(1);
    // Written as one transaction, not as loose statements.
    expect(batch.mock.calls[0][1]).toBe("write");
  });

  it("deletes every table that does not cascade in the live schema", async () => {
    withUserRow(TRAINEE);
    await DELETE(req({ confirmName: "דני כהן" }), params("t1"));
    const sqls = (batch.mock.calls[0][0] as { sql: string }[]).map((s) => s.sql).join("\n");

    // Verified against production 2026-07-30: these FKs are NO ACTION, so a
    // missing line here means the delete fails outright on a real trainee.
    for (const table of [
      "ai_meal_logs",
      "assistant_messages",
      "chat_group_members",
      "chat_message_reactions",
      "chat_messages",
      "goals",
      "meals",
      "menu_plans",
      "password_reset_tokens",
      "push_subscriptions",
      "steps_logs",
      "water_logs",
      "water_streak",
      "weight_logs",
    ]) {
      expect(sqls).toContain(`DELETE FROM ${table}`);
    }
  });

  it("reports that nothing was deleted when the transaction fails", async () => {
    withUserRow(TRAINEE);
    batch.mockRejectedValue(new Error("FOREIGN KEY constraint failed"));
    const res = await DELETE(req({ confirmName: "דני כהן" }), params("t1"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("שום דבר לא נמחק");
  });
});

describe("PATCH /api/users/clients/[id]", () => {
  function patch(body: unknown) {
    return new NextRequest("http://localhost/api/users/clients/t1", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  it("switches the account off without touching any data table", async () => {
    withUserRow(TRAINEE);
    const res = await PATCH(patch({ active: false }), params("t1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, active: false });

    const writes = execute.mock.calls.map((c) => c[0].sql).filter((s: string) => /DELETE|INSERT/.test(s));
    expect(writes).toHaveLength(0);
    expect(execute.mock.calls.some((c) => c[0].sql.includes("UPDATE users SET active"))).toBe(true);
  });

  it("will not switch off a trainee belonging to a different coach", async () => {
    withUserRow({ ...TRAINEE, coach_id: "coach-2" });
    const res = await PATCH(patch({ active: false }), params("t1"));
    expect(res.status).toBe(404);
  });

  it("rejects a body that does not say what to set", async () => {
    withUserRow(TRAINEE);
    const res = await PATCH(patch({}), params("t1"));
    expect(res.status).toBe(400);
  });
});
