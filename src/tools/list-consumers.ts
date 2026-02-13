import type { RabbitMQClient } from "../rabbitmq/client.js";

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
  client: RabbitMQClient,
  vhost: string,
): Promise<ListConsumersResult> {
  const consumers = await client.listConsumers(vhost);

  return {
    consumers: consumers.map((c) => ({
      queue: c.queue.name,
      consumer_tag: c.consumer_tag,
      connection_name: c.channel_details.connection_name,
      ack_required: c.ack_required,
      prefetch_count: c.prefetch_count,
    })),
  };
}
