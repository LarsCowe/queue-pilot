import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { purgeQueue } from "./purge-queue.js";

describe("purgeQueue", () => {
  it("returns purged message count for a queue", async () => {
    const client = {
      purgeQueue: vi.fn().mockResolvedValue({ message_count: 42 }),
    } as unknown as RabbitMQClient;

    const result = await purgeQueue(client, "/", "orders");

    expect(result).toEqual({ queue: "orders", messages_purged: 42 });
    expect(client.purgeQueue).toHaveBeenCalledWith("/", "orders");
  });

  it("returns zero when queue is already empty", async () => {
    const client = {
      purgeQueue: vi.fn().mockResolvedValue({ message_count: 0 }),
    } as unknown as RabbitMQClient;

    const result = await purgeQueue(client, "/", "notifications");

    expect(result.messages_purged).toBe(0);
  });

  it("propagates client errors", async () => {
    const client = {
      purgeQueue: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 404 Not Found")),
    } as unknown as RabbitMQClient;

    await expect(purgeQueue(client, "/", "nonexistent")).rejects.toThrow(
      "RabbitMQ API error: 404 Not Found",
    );
  });
});
