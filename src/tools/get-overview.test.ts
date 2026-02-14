import { describe, it, expect, vi } from "vitest";
import type { OverviewCapability } from "../broker/types.js";
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
    const adapter: OverviewCapability = {
      getOverview: vi.fn().mockResolvedValue(sampleOverview),
    };

    const result = await getOverview(adapter);

    expect(result).toEqual(sampleOverview);
    expect(adapter.getOverview).toHaveBeenCalledOnce();
  });

  it("propagates errors from the adapter", async () => {
    const adapter: OverviewCapability = {
      getOverview: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 401 Unauthorized")),
    };

    await expect(getOverview(adapter)).rejects.toThrow(
      "RabbitMQ API error: 401 Unauthorized",
    );
  });
});
