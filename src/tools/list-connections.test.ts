import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { listConnections } from "./list-connections.js";

describe("listConnections", () => {
  it("returns connections with flattened details", async () => {
    const client = {
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
    } as unknown as RabbitMQClient;

    const result = await listConnections(client);

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
    expect(client.listConnections).toHaveBeenCalledOnce();
  });

  it("handles missing connection_name in client properties", async () => {
    const client = {
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
    } as unknown as RabbitMQClient;

    const result = await listConnections(client);

    expect(result.connections[0].connection_name).toBeUndefined();
  });

  it("returns empty list when no connections exist", async () => {
    const client = {
      listConnections: vi.fn().mockResolvedValue([]),
    } as unknown as RabbitMQClient;

    const result = await listConnections(client);

    expect(result.connections).toEqual([]);
  });

  it("propagates errors from the RabbitMQ client", async () => {
    const client = {
      listConnections: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 401 Unauthorized")),
    } as unknown as RabbitMQClient;

    await expect(listConnections(client)).rejects.toThrow(
      "RabbitMQ API error: 401 Unauthorized",
    );
  });
});
