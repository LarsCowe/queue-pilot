import { describe, it, expect, vi } from "vitest";
import type { BrokerAdapter } from "../broker/types.js";
import { deleteQueue } from "./delete-queue.js";

describe("deleteQueue", () => {
  it("deletes a queue and confirms deletion", async () => {
    const adapter = {
      deleteQueue: vi.fn().mockResolvedValue(undefined),
    } as unknown as BrokerAdapter;

    const result = await deleteQueue(adapter, {
      queue: "order-events",
      vhost: "/",
    });

    expect(result).toEqual({
      queue: "order-events",
      vhost: "/",
      deleted: true,
    });
    expect(adapter.deleteQueue).toHaveBeenCalledWith("order-events", "/");
  });

  it("deletes a queue in a custom vhost", async () => {
    const adapter = {
      deleteQueue: vi.fn().mockResolvedValue(undefined),
    } as unknown as BrokerAdapter;

    const result = await deleteQueue(adapter, {
      queue: "payment-notifications",
      vhost: "production",
    });

    expect(result).toEqual({
      queue: "payment-notifications",
      vhost: "production",
      deleted: true,
    });
    expect(adapter.deleteQueue).toHaveBeenCalledWith(
      "payment-notifications",
      "production",
    );
  });

  it("propagates errors from the broker adapter", async () => {
    const adapter = {
      deleteQueue: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 404 Not Found")),
    } as unknown as BrokerAdapter;

    await expect(
      deleteQueue(adapter, { queue: "nonexistent", vhost: "/" }),
    ).rejects.toThrow("RabbitMQ API error: 404 Not Found");
  });
});
