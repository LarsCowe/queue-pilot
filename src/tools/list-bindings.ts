import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface ListBindingsResult {
  bindings: Array<{
    source: string;
    destination: string;
    destination_type: string;
    routing_key: string;
    properties_key: string;
  }>;
}

export async function listBindings(
  client: RabbitMQClient,
  vhost: string,
): Promise<ListBindingsResult> {
  const bindings = await client.listBindings(vhost);

  return {
    bindings: bindings.map((b) => ({
      source: b.source,
      destination: b.destination,
      destination_type: b.destination_type,
      routing_key: b.routing_key,
      properties_key: b.properties_key,
    })),
  };
}
