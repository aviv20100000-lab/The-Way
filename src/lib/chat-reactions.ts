import db from "@/lib/db";

export interface ChatReactionAggregate {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

type MessageWithId = { id: string } & Record<string, unknown>;

export async function attachChatReactions<T extends MessageWithId>(
  messages: T[],
  userId: string
): Promise<Array<T & { reactions: ChatReactionAggregate[] }>> {
  if (messages.length === 0) return [];

  const messageIds = messages.map((message) => message.id);
  const placeholders = messageIds.map(() => "?").join(",");
  const result = await db.execute({
    sql: `SELECT message_id, emoji, user_id
          FROM chat_message_reactions
          WHERE message_id IN (${placeholders})
          ORDER BY created_at ASC`,
    args: messageIds,
  });

  const byMessage = new Map<string, Map<string, ChatReactionAggregate>>();
  for (const row of result.rows) {
    const messageId = String(row.message_id);
    const emoji = String(row.emoji);
    const emojiMap = byMessage.get(messageId) ?? new Map<string, ChatReactionAggregate>();
    const aggregate = emojiMap.get(emoji) ?? { emoji, count: 0, reactedByMe: false };
    aggregate.count += 1;
    if (String(row.user_id) === userId) aggregate.reactedByMe = true;
    emojiMap.set(emoji, aggregate);
    byMessage.set(messageId, emojiMap);
  }

  return messages.map((message) => ({
    ...message,
    reactions: Array.from(byMessage.get(message.id)?.values() ?? []),
  }));
}
