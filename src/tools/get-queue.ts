import type { BrokerAdapter } from "../broker/types.js";

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
  adapter: BrokerAdapter,
  scope: string,
  queue: string,
): Promise<GetQueueResult> {
  const detail = await adapter.getQueue(queue, scope);

  return {
    name: detail.name,
    vhost: detail.metadata.vhost as string,
    state: detail.state,
    messages_ready: detail.messages_ready ?? 0,
    messages_unacknowledged: detail.messages_unacknowledged ?? 0,
    consumers: detail.metadata.consumers as number,
    consumer_utilisation: detail.metadata.consumer_utilisation as number | null,
    memory: detail.metadata.memory as number,
    message_stats: detail.metadata.message_stats as { publish: number; deliver: number } | null,
    policy: detail.metadata.policy as string | null,
    arguments: detail.metadata.arguments as Record<string, unknown>,
    node: detail.metadata.node as string,
  };
}
