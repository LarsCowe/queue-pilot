import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { getOverview } from "./get-overview.js";

const sampleOverview = {
  cluster_name: "rabbit@localhost",
  rabbitmq_version: "3.13.2",
  erlang_version: "26.2.5",
  message_stats: { publish: 1500, deliver: 1200 },
  queue_totals: { messages: 42, messages_ready: 30, messages_unacknowledged: 12 },
  object_totals: { queues: 5, exchanges: 8, connections: 3, consumers: 4 },
  node: "rabbit@localhost",
};

describe("getOverview", () => {
  it("returns cluster overview information", async () => {
    const client = {
      getOverview: vi.fn().mockResolvedValue(sampleOverview),
    } as unknown as RabbitMQClient;

    const result = await getOverview(client);

    expect(result).toEqual(sampleOverview);
    expect(client.getOverview).toHaveBeenCalledOnce();
  });

  it("propagates errors from the RabbitMQ client", async () => {
    const client = {
      getOverview: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 401 Unauthorized")),
    } as unknown as RabbitMQClient;

    await expect(getOverview(client)).rejects.toThrow(
      "RabbitMQ API error: 401 Unauthorized",
    );
  });
});
