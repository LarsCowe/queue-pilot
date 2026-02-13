import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface ListExchangesResult {
  exchanges: Array<{
    name: string;
    type: string;
    durable: boolean;
  }>;
}

export async function listExchanges(
  client: RabbitMQClient,
  vhost: string,
): Promise<ListExchangesResult> {
  const exchanges = await client.listExchanges(vhost);

  return {
    exchanges: exchanges.map((e) => ({
      name: e.name,
      type: e.type,
      durable: e.durable,
    })),
  };
}
