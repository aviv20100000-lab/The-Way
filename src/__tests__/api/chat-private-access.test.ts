/** @jest-environment node */

import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { canAccessPrivateChat } from "@/lib/chat-group";
import { sendSecurityAlert } from "@/lib/security-alerts";

jest.mock("@/lib/auth", () => ({ getSessionUser: jest.fn() }));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/chat-group", () => ({
  canAccessPrivateChat: jest.fn(),
  canAccessDefaultGroup: jest.fn(),
  getDefaultGroupMemberIds: jest.fn(),
  isGroupMember: jest.fn(),
  resolveCoachId: jest.fn(() => "coach-1"),
}));
jest.mock("@/lib/security-alerts", () => ({ sendSecurityAlert: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/chat-push", () => ({ pushToUsers: jest.fn(), setupVapid: jest.fn() }));
jest.mock("@/lib/chat-reactions", () => ({ attachChatReactions: jest.fn() }));
jest.mock("@/lib/chat-reads", () => ({
  defaultGroupReadKey: jest.fn(), markGroupRead: jest.fn(), namedGroupReadKey: jest.fn(),
}));

const mockSession = getSessionUser as jest.MockedFunction<typeof getSessionUser>;
const mockExecute = db.execute as jest.Mock;
const mockCanAccess = canAccessPrivateChat as jest.MockedFunction<typeof canAccessPrivateChat>;
const mockAlert = sendSecurityAlert as jest.MockedFunction<typeof sendSecurityAlert>;

describe("private chat API boundaries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ id: "client-1", role: "client", name: "אחד", email: "one@example.com", coach_id: "coach-1" });
    mockCanAccess.mockResolvedValue(false);
    mockExecute.mockResolvedValue({ rows: [{ id: "client-2", role: "client", coach_id: "coach-1" }] });
  });

  it("returns 403 when reading a DM from a client in another group", async () => {
    const { GET } = await import("@/app/api/chat/messages/route");
    const response = await GET(new NextRequest("http://localhost/api/chat/messages?type=private&with=client-2"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("אין הרשאה");
    expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ event: "chat_cross_group_read_attempt" }));
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when sending a DM to a client in another group", async () => {
    const { POST } = await import("@/app/api/chat/messages/route");
    const response = await POST(new NextRequest("http://localhost/api/chat/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ receiver_id: "client-2", content: "שלום" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("אין הרשאה");
    expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ event: "chat_cross_group_write_attempt" }));
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});
