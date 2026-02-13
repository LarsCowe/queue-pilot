import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface DeleteExchangeParams {
  exchange: string;
  vhost: string;
}

export interface DeleteExchangeResult {
  exchange: string;
  vhost: string;
  deleted: true;
}

export async function deleteExchange(
  client: RabbitMQClient,
  params: DeleteExchangeParams,
): Promise<DeleteExchangeResult> {
  await client.deleteExchange(params.vhost, params.exchange);

  return {
    exchange: params.exchange,
    vhost: params.vhost,
    deleted: true,
  };
}
