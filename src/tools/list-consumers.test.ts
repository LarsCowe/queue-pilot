import { describe, it, expect, vi } from "vitest";
import type { ConsumerCapability } from "../broker/types.js";
import { listConsumers } from "./list-consumers.js";

describe("listConsumers", () => {
  it("returns consumers with flattened details", async () => {
    const adapter: ConsumerCapability = {
      listConsumers: vi.fn().mockResolvedValue([
        {
          queue: { name: "order-events" },
          consumer_tag: "ctag-order-handler-1",
          channel_details: { connection_name: "order-service:172.17.0.3:5672" },
          ack_required: true,
          prefetch_count: 10,
        },
        {
          queue: { name: "notifications" },
          consumer_tag: "ctag-notifier-1",
          channel_details: { connection_name: "notifier:172.17.0.4:5672" },
          ack_required: false,
          prefetch_count: 0,
        },
      ]),
    };

    const result = await listConsumers(adapter, "/");

    expect(result.consumers).toHaveLength(2);
    expect(result.consumers[0]).toEqual({
      queue: "order-events",
      consumer_tag: "ctag-order-handler-1",
      connection_name: "order-service:172.17.0.3:5672",
      ack_required: true,
      prefetch_count: 10,
    });
    expect(result.consumers[1]).toEqual({
      queue: "notifications",
      consumer_tag: "ctag-notifier-1",
      connection_name: "notifier:172.17.0.4:5672",
      ack_required: false,
      prefetch_count: 0,
    });
    expect(adapter.listConsumers).toHaveBeenCalledWith("/");
  });

  it("returns empty list when no consumers exist", async () => {
    const adapter: ConsumerCapability = {
      listConsumers: vi.fn().mockResolvedValue([]),
    };

    const result = await listConsumers(adapter, "/");

    expect(result.consumers).toEqual([]);
  });

  it("propagates errors from the adapter", async () => {
    const adapter: ConsumerCapability = {
      listConsumers: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 401 Unauthorized")),
    };

    await expect(listConsumers(adapter, "/")).rejects.toThrow(
      "RabbitMQ API error: 401 Unauthorized",
    );
  });
});
