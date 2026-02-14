import { describe, it, expect, vi } from "vitest";
import type { ConnectionCapability } from "../broker/types.js";
import { listConnections } from "./list-connections.js";

describe("listConnections", () => {
  it("returns connections with flattened details", async () => {
    const adapter: ConnectionCapability = {
      listConnections: vi.fn().mockResolvedValue([
        {
          name: "172.17.0.3:43210 -> 172.17.0.2:5672",
          user: "order-service",
          state: "running",
          channels: 2,
          connected_at: 1700000000000,
          client_properties: { connection_name: "order-service" },
          peer_host: "172.17.0.3",
          peer_port: 43210,
        },
      ]),
    };

    const result = await listConnections(adapter);

    expect(result.connections).toHaveLength(1);
    expect(result.connections[0]).toEqual({
      name: "172.17.0.3:43210 -> 172.17.0.2:5672",
      user: "order-service",
      state: "running",
      channels: 2,
      connected_at: 1700000000000,
      connection_name: "order-service",
      peer_host: "172.17.0.3",
      peer_port: 43210,
    });
    expect(adapter.listConnections).toHaveBeenCalledOnce();
  });

  it("handles missing connection_name in client properties", async () => {
    const adapter: ConnectionCapability = {
      listConnections: vi.fn().mockResolvedValue([
        {
          name: "172.17.0.5:50000 -> 172.17.0.2:5672",
          user: "guest",
          state: "running",
          channels: 1,
          connected_at: 1700000000000,
          client_properties: {},
          peer_host: "172.17.0.5",
          peer_port: 50000,
        },
      ]),
    };

    const result = await listConnections(adapter);

    expect(result.connections[0].connection_name).toBeUndefined();
  });

  it("returns empty list when no connections exist", async () => {
    const adapter: ConnectionCapability = {
      listConnections: vi.fn().mockResolvedValue([]),
    };

    const result = await listConnections(adapter);

    expect(result.connections).toEqual([]);
  });

  it("propagates errors from the adapter", async () => {
    const adapter: ConnectionCapability = {
      listConnections: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 401 Unauthorized")),
    };

    await expect(listConnections(adapter)).rejects.toThrow(
      "RabbitMQ API error: 401 Unauthorized",
    );
  });
});
