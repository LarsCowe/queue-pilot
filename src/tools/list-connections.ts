import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface ListConnectionsResult {
  connections: Array<{
    name: string;
    user: string;
    state: string;
    channels: number;
    connected_at: number;
    connection_name: string | undefined;
    peer_host: string;
    peer_port: number;
  }>;
}

export async function listConnections(
  client: RabbitMQClient,
): Promise<ListConnectionsResult> {
  const connections = await client.listConnections();

  return {
    connections: connections.map((c) => ({
      name: c.name,
      user: c.user,
      state: c.state,
      channels: c.channels,
      connected_at: c.connected_at,
      connection_name: c.client_properties.connection_name,
      peer_host: c.peer_host,
      peer_port: c.peer_port,
    })),
  };
}
