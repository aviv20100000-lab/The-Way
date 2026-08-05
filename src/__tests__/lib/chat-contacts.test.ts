import { getContactAccessibleName, getDuplicateContactNames, partitionChatContacts } from "@/lib/chat-contacts";

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

describe("duplicate contact names", () => {
  it("adds a username to the accessible name only when names collide", () => {
    const duplicates = getDuplicateContactNames([
      { id: "1", role: "client", name: "שי", username: "shay1" },
      { id: "2", role: "client", name: "שי", username: "shay2" },
      { id: "3", role: "client", name: "נועה", username: "noa" },
    ]);

    expect(duplicates.has("שי")).toBe(true);
    expect(getContactAccessibleName({ id: "2", role: "client", name: "שי", username: "shay2" }, true)).toBe("שי @shay2");
    expect(getContactAccessibleName({ id: "3", role: "client", name: "נועה", username: "noa" }, false)).toBe("נועה");
  });
});
