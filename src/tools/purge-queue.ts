import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface PurgeQueueResult {
  queue: string;
  messages_purged: number;
}

export async function purgeQueue(
  client: RabbitMQClient,
  vhost: string,
  queue: string,
): Promise<PurgeQueueResult> {
  const response = await client.purgeQueue(vhost, queue);

  return {
    queue,
    messages_purged: response.message_count,
  };
}
