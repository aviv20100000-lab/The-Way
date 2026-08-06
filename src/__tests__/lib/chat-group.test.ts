/** @jest-environment node */

import db from "@/lib/db";
import { canAccessPrivateChat, getPrivateChatContacts } from "@/lib/chat-group";

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
}));

const mockExecute = db.execute as jest.Mock;
const client = { id: "client-1", role: "client", coach_id: "coach-1" };

describe("private chat group boundaries", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists only the coach and clients who share a named group", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ dm_coach_only: 0 }] })
      .mockResolvedValueOnce({ rows: [
        { id: "coach-1", name: "אביב", role: "coach", username: "aviv", avatar_url: null },
        { id: "client-2", name: "שי", role: "client", username: "shay2", avatar_url: null },
      ] });

    const contacts = await getPrivateChatContacts(client);

    expect(contacts.map((contact) => contact.id)).toEqual(["coach-1", "client-2"]);
    expect(mockExecute.mock.calls[1][0].sql).toContain("JOIN chat_group_members peer");
    expect(mockExecute.mock.calls[1][0].args).toEqual(["coach-1", "coach-1", "client-1", "client-1", 0]);
  });

  it("keeps coach-only mode limited to the coach", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ dm_coach_only: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: "coach-1", name: "אביב", role: "coach", username: "aviv", avatar_url: null }] });

    const contacts = await getPrivateChatContacts(client);

    expect(contacts).toHaveLength(1);
    expect(contacts[0].id).toBe("coach-1");
  });

  it("denies a private chat between clients without a shared group", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ dm_coach_only: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(canAccessPrivateChat(client, {
      id: "client-2", role: "client", coach_id: "coach-1",
    })).resolves.toBe(false);
  });

  it("allows a private chat between clients with a shared group", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ dm_coach_only: 0 }] })
      .mockResolvedValueOnce({ rows: [{ 1: 1 }] });

    await expect(canAccessPrivateChat(client, {
      id: "client-2", role: "client", coach_id: "coach-1",
    })).resolves.toBe(true);
  });
});
