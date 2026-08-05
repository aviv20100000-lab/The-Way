export interface ChatContactLike {
  id: string;
  role: "coach" | "client";
}

export interface NamedChatContactLike extends ChatContactLike {
  name: string;
  username?: string | null;
}

export function partitionChatContacts<T extends ChatContactLike>(userRole: "coach" | "client", contacts: T[]) {
  const coach = userRole === "client" ? contacts.find((contact) => contact.role === "coach") ?? null : null;
  return {
    coach,
    regular: coach ? contacts.filter((contact) => contact.id !== coach.id) : contacts,
  };
}

export function getDuplicateContactNames(contacts: NamedChatContactLike[]): Set<string> {
  const counts = contacts.reduce<Record<string, number>>((result, contact) => {
    result[contact.name] = (result[contact.name] ?? 0) + 1;
    return result;
  }, {});
  return new Set(Object.entries(counts).filter(([, count]) => count > 1).map(([name]) => name));
}

export function getContactAccessibleName(contact: NamedChatContactLike, isDuplicate: boolean): string {
  if (!isDuplicate) return contact.name;
  return `${contact.name} ${contact.username ? `@${contact.username}` : `מזהה ${contact.id.slice(0, 6)}`}`;
}
