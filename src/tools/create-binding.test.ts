import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { createBinding } from "./create-binding.js";

describe("createBinding", () => {
  it("creates a binding and returns the binding details", async () => {
    const client = {
      createBinding: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMQClient;

    const result = await createBinding(client, {
      exchange: "events",
      queue: "orders",
      routing_key: "order.#",
      vhost: "/",
    });

    expect(result).toEqual({
      exchange: "events",
      queue: "orders",
      routing_key: "order.#",
      vhost: "/",
    });
    expect(client.createBinding).toHaveBeenCalledWith(
      "/",
      "events",
      "orders",
      "order.#",
    );
  });

  it("accepts an empty routing key", async () => {
    const client = {
      createBinding: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMQClient;

    const result = await createBinding(client, {
      exchange: "notifications",
      queue: "email-sender",
      routing_key: "",
      vhost: "/",
    });

    expect(result).toEqual({
      exchange: "notifications",
      queue: "email-sender",
      routing_key: "",
      vhost: "/",
    });
    expect(client.createBinding).toHaveBeenCalledWith(
      "/",
      "notifications",
      "email-sender",
      "",
    );
  });

  it("propagates errors from the RabbitMQ client", async () => {
    const client = {
      createBinding: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 404 Not Found")),
    } as unknown as RabbitMQClient;

    await expect(
      createBinding(client, {
        exchange: "nonexistent",
        queue: "orders",
        routing_key: "order.created",
        vhost: "/",
      }),
    ).rejects.toThrow("RabbitMQ API error: 404 Not Found");
  });
});
