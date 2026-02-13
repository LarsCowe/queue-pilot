import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface ListQueuesResult {
  queues: Array<{
    name: string;
    messages_ready: number;
    messages_unacknowledged: number;
    state: string;
  }>;
}

export async function listQueues(
  client: RabbitMQClient,
  vhost: string,
): Promise<ListQueuesResult> {
  const queues = await client.listQueues(vhost);

  return {
    queues: queues.map((q) => ({
      name: q.name,
      messages_ready: q.messages_ready ?? 0,
      messages_unacknowledged: q.messages_unacknowledged ?? 0,
      state: q.state,
    })),
  };
}
