import { partitionChatContacts } from "@/lib/chat-contacts";

const contacts = [
  { id: "coach-1", role: "coach" as const, name: "אביב" },
  { id: "client-2", role: "client" as const, name: "נועה" },
];

describe("partitionChatContacts", () => {
  it("extracts the coach as a featured contact for clients", () => {
    const result = partitionChatContacts("client", contacts);
    expect(result.coach?.id).toBe("coach-1");
    expect(result.regular.map((contact) => contact.id)).toEqual(["client-2"]);
  });

  it("keeps all contacts regular for a coach", () => {
    const result = partitionChatContacts("coach", contacts);
    expect(result.coach).toBeNull();
    expect(result.regular).toEqual(contacts);
  });
});
