import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { createExchange } from "./create-exchange.js";

describe("createExchange", () => {
  it("creates a topic exchange and returns its settings", async () => {
    const client = {
      createExchange: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMQClient;

    const result = await createExchange(client, {
      exchange: "order-events",
      type: "topic",
      durable: true,
      auto_delete: false,
      vhost: "/",
    });

    expect(result).toEqual({
      exchange: "order-events",
      type: "topic",
      durable: true,
      auto_delete: false,
      vhost: "/",
    });
    expect(client.createExchange).toHaveBeenCalledWith("/", "order-events", {
      type: "topic",
      durable: true,
      auto_delete: false,
    });
  });

  it("creates a fanout exchange with default settings", async () => {
    const client = {
      createExchange: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMQClient;

    const result = await createExchange(client, {
      exchange: "notifications",
      type: "fanout",
      durable: false,
      auto_delete: false,
      vhost: "/",
    });

    expect(result).toEqual({
      exchange: "notifications",
      type: "fanout",
      durable: false,
      auto_delete: false,
      vhost: "/",
    });
  });

  it("propagates errors from the RabbitMQ client", async () => {
    const client = {
      createExchange: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 409 Conflict")),
    } as unknown as RabbitMQClient;

    await expect(
      createExchange(client, {
        exchange: "order-events",
        type: "direct",
        durable: false,
        auto_delete: false,
        vhost: "/",
      }),
    ).rejects.toThrow("RabbitMQ API error: 409 Conflict");
  });
});
