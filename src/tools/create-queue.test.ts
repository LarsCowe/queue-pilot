import { describe, it, expect, vi } from "vitest";
import type { BrokerAdapter } from "../broker/types.js";
import { createQueue } from "./create-queue.js";

describe("createQueue", () => {
  it("creates a new queue and returns its settings", async () => {
    const adapter = {
      createQueue: vi.fn().mockResolvedValue({ name: "order-events", created: true }),
    } as unknown as BrokerAdapter;

    const result = await createQueue(adapter, {
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
    expect(adapter.createQueue).toHaveBeenCalledWith({
      name: "order-events",
      durable: false,
      auto_delete: false,
      scope: "/",
    });
  });

  it("reflects durable setting when creating a persistent queue", async () => {
    const adapter = {
      createQueue: vi.fn().mockResolvedValue({ name: "payment-notifications", created: true }),
    } as unknown as BrokerAdapter;

    const result = await createQueue(adapter, {
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
    expect(adapter.createQueue).toHaveBeenCalledWith({
      name: "payment-notifications",
      durable: true,
      auto_delete: false,
      scope: "/",
    });
  });

  it("throws when broker returns a 409 conflict", async () => {
    const adapter = {
      createQueue: vi
        .fn()
        .mockRejectedValue(
          new Error("RabbitMQ API error: 409 Conflict"),
        ),
    } as unknown as BrokerAdapter;

    await expect(
      createQueue(adapter, {
        queue: "order-events",
        durable: true,
        auto_delete: false,
        vhost: "/",
      }),
    ).rejects.toThrow("RabbitMQ API error: 409 Conflict");
  });
});
