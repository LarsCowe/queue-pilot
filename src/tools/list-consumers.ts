import type { ConsumerCapability } from "../broker/types.js";

export interface ListConsumersResult {
  consumers: Array<{
    queue: string;
    consumer_tag: string;
    connection_name: string;
    ack_required: boolean;
    prefetch_count: number;
  }>;
}

export async function listConsumers(
  adapter: ConsumerCapability,
  scope: string,
): Promise<ListConsumersResult> {
  const consumers = await adapter.listConsumers(scope);

  return {
    consumers: consumers.map((c) => ({
      queue: (c.queue as { name: string }).name,
      consumer_tag: c.consumer_tag as string,
      connection_name: (c.channel_details as { connection_name: string }).connection_name,
      ack_required: c.ack_required as boolean,
      prefetch_count: c.prefetch_count as number,
    })),
  };
}
