import { describe, it, expect, vi } from "vitest";
import type { BrokerAdapter } from "../broker/types.js";
import { purgeQueue } from "./purge-queue.js";

describe("purgeQueue", () => {
  it("returns purged message count for a queue", async () => {
    const adapter = {
      purgeQueue: vi.fn().mockResolvedValue({ messagesRemoved: 42 }),
    } as unknown as BrokerAdapter;

    const result = await purgeQueue(adapter, "/", "orders");

    expect(result).toEqual({ queue: "orders", messages_purged: 42 });
    expect(adapter.purgeQueue).toHaveBeenCalledWith("orders", "/");
  });

  it("returns zero when queue is already empty", async () => {
    const adapter = {
      purgeQueue: vi.fn().mockResolvedValue({ messagesRemoved: 0 }),
    } as unknown as BrokerAdapter;

    const result = await purgeQueue(adapter, "/", "notifications");

    expect(result.messages_purged).toBe(0);
  });

  it("propagates client errors", async () => {
    const adapter = {
      purgeQueue: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 404 Not Found")),
    } as unknown as BrokerAdapter;

    await expect(purgeQueue(adapter, "/", "nonexistent")).rejects.toThrow(
      "RabbitMQ API error: 404 Not Found",
    );
  });
});
