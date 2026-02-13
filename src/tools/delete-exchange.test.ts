import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { deleteExchange } from "./delete-exchange.js";

describe("deleteExchange", () => {
  it("deletes an exchange and confirms deletion", async () => {
    const client = {
      deleteExchange: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMQClient;

    const result = await deleteExchange(client, {
      exchange: "order-events",
      vhost: "/",
    });

    expect(result).toEqual({
      exchange: "order-events",
      vhost: "/",
      deleted: true,
    });
    expect(client.deleteExchange).toHaveBeenCalledWith("/", "order-events");
  });

  it("deletes an exchange in a custom vhost", async () => {
    const client = {
      deleteExchange: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMQClient;

    const result = await deleteExchange(client, {
      exchange: "payment-notifications",
      vhost: "staging",
    });

    expect(result).toEqual({
      exchange: "payment-notifications",
      vhost: "staging",
      deleted: true,
    });
    expect(client.deleteExchange).toHaveBeenCalledWith(
      "staging",
      "payment-notifications",
    );
  });

  it("propagates errors from the RabbitMQ client", async () => {
    const client = {
      deleteExchange: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 404 Not Found")),
    } as unknown as RabbitMQClient;

    await expect(
      deleteExchange(client, { exchange: "nonexistent", vhost: "/" }),
    ).rejects.toThrow("RabbitMQ API error: 404 Not Found");
  });
});
