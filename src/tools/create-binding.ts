import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface CreateBindingParams {
  exchange: string;
  queue: string;
  routing_key: string;
  vhost: string;
}

export interface CreateBindingResult {
  exchange: string;
  queue: string;
  routing_key: string;
  vhost: string;
}

export async function createBinding(
  client: RabbitMQClient,
  params: CreateBindingParams,
): Promise<CreateBindingResult> {
  await client.createBinding(
    params.vhost,
    params.exchange,
    params.queue,
    params.routing_key,
  );

  return {
    exchange: params.exchange,
    queue: params.queue,
    routing_key: params.routing_key,
    vhost: params.vhost,
  };
}
