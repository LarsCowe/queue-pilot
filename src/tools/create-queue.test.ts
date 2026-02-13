import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { createQueue } from "./create-queue.js";

describe("createQueue", () => {
  it("creates a new queue and returns its settings", async () => {
    const client = {
      createQueue: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMQClient;

    const result = await createQueue(client, {
      queue: "order-events",
      durable: false,
      auto_delete: false,
      vhost: "/",
    });

    expect(result).toEqual({
      queue: "order-events",
      durable: false,
      auto_delete: false,
      vhost: "/",
    });
    expect(client.createQueue).toHaveBeenCalledWith("/", "order-events", {
      durable: false,
      auto_delete: false,
    });
  });

  it("reflects durable setting when creating a persistent queue", async () => {
    const client = {
      createQueue: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMQClient;

    const result = await createQueue(client, {
      queue: "payment-notifications",
      durable: true,
      auto_delete: false,
      vhost: "/",
    });

    expect(result).toEqual({
      queue: "payment-notifications",
      durable: true,
      auto_delete: false,
      vhost: "/",
    });
    expect(client.createQueue).toHaveBeenCalledWith(
      "/",
      "payment-notifications",
      { durable: true, auto_delete: false },
    );
  });

  it("throws when RabbitMQ returns a 409 conflict", async () => {
    const client = {
      createQueue: vi
        .fn()
        .mockRejectedValue(
          new Error("RabbitMQ API error: 409 Conflict"),
        ),
    } as unknown as RabbitMQClient;

    await expect(
      createQueue(client, {
        queue: "order-events",
        durable: true,
        auto_delete: false,
        vhost: "/",
      }),
    ).rejects.toThrow("RabbitMQ API error: 409 Conflict");
  });
});
