import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface GetQueueResult {
  name: string;
  vhost: string;
  state: string;
  messages_ready: number;
  messages_unacknowledged: number;
  consumers: number;
  consumer_utilisation: number | null;
  memory: number;
  message_stats: {
    publish: number;
    deliver: number;
  } | null;
  policy: string | null;
  arguments: Record<string, unknown>;
  node: string;
}

export async function getQueue(
  client: RabbitMQClient,
  vhost: string,
  queue: string,
): Promise<GetQueueResult> {
  const detail = await client.getQueue(vhost, queue);

  return {
    name: detail.name,
    vhost: detail.vhost,
    state: detail.state,
    messages_ready: detail.messages_ready ?? 0,
    messages_unacknowledged: detail.messages_unacknowledged ?? 0,
    consumers: detail.consumers,
    consumer_utilisation: detail.consumer_utilisation,
    memory: detail.memory,
    message_stats: detail.message_stats,
    policy: detail.policy,
    arguments: detail.arguments,
    node: detail.node,
  };
}
