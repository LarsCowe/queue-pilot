import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { deleteQueue } from "./delete-queue.js";

describe("deleteQueue", () => {
  it("deletes a queue and confirms deletion", async () => {
    const client = {
      deleteQueue: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMQClient;

    const result = await deleteQueue(client, {
      queue: "order-events",
      vhost: "/",
    });

    expect(result).toEqual({
      queue: "order-events",
      vhost: "/",
      deleted: true,
    });
    expect(client.deleteQueue).toHaveBeenCalledWith("/", "order-events");
  });

  it("deletes a queue in a custom vhost", async () => {
    const client = {
      deleteQueue: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMQClient;

    const result = await deleteQueue(client, {
      queue: "payment-notifications",
      vhost: "production",
    });

    expect(result).toEqual({
      queue: "payment-notifications",
      vhost: "production",
      deleted: true,
    });
    expect(client.deleteQueue).toHaveBeenCalledWith(
      "production",
      "payment-notifications",
    );
  });

  it("propagates errors from the RabbitMQ client", async () => {
    const client = {
      deleteQueue: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 404 Not Found")),
    } as unknown as RabbitMQClient;

    await expect(
      deleteQueue(client, { queue: "nonexistent", vhost: "/" }),
    ).rejects.toThrow("RabbitMQ API error: 404 Not Found");
  });
});
