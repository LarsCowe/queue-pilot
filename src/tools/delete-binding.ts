import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface DeleteBindingParams {
  exchange: string;
  queue: string;
  properties_key: string;
  vhost: string;
}

export interface DeleteBindingResult {
  exchange: string;
  queue: string;
  properties_key: string;
  vhost: string;
  deleted: true;
}

export async function deleteBinding(
  client: RabbitMQClient,
  params: DeleteBindingParams,
): Promise<DeleteBindingResult> {
  await client.deleteBinding(
    params.vhost,
    params.exchange,
    params.queue,
    params.properties_key,
  );

  return {
    exchange: params.exchange,
    queue: params.queue,
    properties_key: params.properties_key,
    vhost: params.vhost,
    deleted: true,
  };
}
