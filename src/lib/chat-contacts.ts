export interface ChatContactLike {
  id: string;
  role: "coach" | "client";
}

export function partitionChatContacts<T extends ChatContactLike>(userRole: "coach" | "client", contacts: T[]) {
  const coach = userRole === "client" ? contacts.find((contact) => contact.role === "coach") ?? null : null;
  return {
    coach,
    regular: coach ? contacts.filter((contact) => contact.id !== coach.id) : contacts,
  };
}
