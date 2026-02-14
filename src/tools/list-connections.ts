import type { ConnectionCapability } from "../broker/types.js";

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
  adapter: ConnectionCapability,
): Promise<ListConnectionsResult> {
  const connections = await adapter.listConnections();

  return {
    connections: connections.map((c) => ({
      name: c.name as string,
      user: c.user as string,
      state: c.state as string,
      channels: c.channels as number,
      connected_at: c.connected_at as number,
      connection_name: (c.client_properties as { connection_name?: string })?.connection_name,
      peer_host: c.peer_host as string,
      peer_port: c.peer_port as number,
    })),
  };
}
