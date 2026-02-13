import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { listConsumers } from "./list-consumers.js";

describe("listConsumers", () => {
  it("returns consumers with flattened details", async () => {
    const client = {
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
    } as unknown as RabbitMQClient;

    const result = await listConsumers(client, "/");

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
    expect(client.listConsumers).toHaveBeenCalledWith("/");
  });

  it("returns empty list when no consumers exist", async () => {
    const client = {
      listConsumers: vi.fn().mockResolvedValue([]),
    } as unknown as RabbitMQClient;

    const result = await listConsumers(client, "/");

    expect(result.consumers).toEqual([]);
  });

  it("propagates errors from the RabbitMQ client", async () => {
    const client = {
      listConsumers: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 401 Unauthorized")),
    } as unknown as RabbitMQClient;

    await expect(listConsumers(client, "/")).rejects.toThrow(
      "RabbitMQ API error: 401 Unauthorized",
    );
  });
});
