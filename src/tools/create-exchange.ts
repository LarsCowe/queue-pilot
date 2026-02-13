import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface CreateExchangeParams {
  exchange: string;
  type: string;
  durable: boolean;
  auto_delete: boolean;
  vhost: string;
}

export interface CreateExchangeResult {
  exchange: string;
  type: string;
  durable: boolean;
  auto_delete: boolean;
  vhost: string;
}

export async function createExchange(
  client: RabbitMQClient,
  params: CreateExchangeParams,
): Promise<CreateExchangeResult> {
  await client.createExchange(params.vhost, params.exchange, {
    type: params.type,
    durable: params.durable,
    auto_delete: params.auto_delete,
  });

  return {
    exchange: params.exchange,
    type: params.type,
    durable: params.durable,
    auto_delete: params.auto_delete,
    vhost: params.vhost,
  };
}
