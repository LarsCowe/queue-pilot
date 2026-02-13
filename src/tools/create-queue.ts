import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface CreateQueueParams {
  queue: string;
  durable: boolean;
  auto_delete: boolean;
  vhost: string;
}

export interface CreateQueueResult {
  queue: string;
  durable: boolean;
  auto_delete: boolean;
  vhost: string;
}

export async function createQueue(
  client: RabbitMQClient,
  params: CreateQueueParams,
): Promise<CreateQueueResult> {
  await client.createQueue(params.vhost, params.queue, {
    durable: params.durable,
    auto_delete: params.auto_delete,
  });

  return {
    queue: params.queue,
    durable: params.durable,
    auto_delete: params.auto_delete,
    vhost: params.vhost,
  };
}
