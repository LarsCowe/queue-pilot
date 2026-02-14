import type { BrokerAdapter } from "../broker/types.js";

export interface PurgeQueueResult {
  queue: string;
  messages_purged: number;
}

export async function purgeQueue(
  adapter: BrokerAdapter,
  scope: string,
  queue: string,
): Promise<PurgeQueueResult> {
  const result = await adapter.purgeQueue(queue, scope);

  return {
    queue,
    messages_purged: result.messagesRemoved,
  };
}
