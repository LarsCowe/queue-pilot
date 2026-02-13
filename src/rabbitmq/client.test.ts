import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RabbitMQClient } from "./client.js";
import type { RabbitMQConfig } from "./types.js";

const config: RabbitMQConfig = {
  url: "http://localhost:15672",
  username: "guest",
  password: "guest",
};

describe("RabbitMQClient", () => {
  let client: RabbitMQClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    client = new RabbitMQClient(config);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists queues for the default vhost", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          name: "orders",
          messages_ready: 5,
          messages_unacknowledged: 2,
          state: "running",
          vhost: "/",
        },
        {
          name: "notifications",
          messages_ready: 0,
          messages_unacknowledged: 0,
          state: "running",
          vhost: "/",
        },
      ],
    });

    const queues = await client.listQueues("/");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/queues/%2F",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Basic"),
        }),
      }),
    );
    expect(queues).toHaveLength(2);
    expect(queues[0].name).toBe("orders");
    expect(queues[0].messages_ready).toBe(5);
  });

  it("peeks messages from a queue using ack_requeue_true", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          payload: '{"orderId":"ORD-001"}',
          payload_encoding: "string",
          properties: {
            type: "order.created",
            message_id: "msg-123",
            correlation_id: "corr-456",
            headers: {},
          },
          exchange: "events",
          routing_key: "order.created",
          message_count: 4,
          redelivered: false,
        },
      ],
    });

    const messages = await client.peekMessages("/", "orders", 5);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/queues/%2F/orders/get",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          count: 5,
          ackmode: "ack_requeue_true",
          encoding: "auto",
        }),
      }),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].payload).toBe('{"orderId":"ORD-001"}');
    expect(messages[0].properties.type).toBe("order.created");
  });

  it("lists exchanges for a vhost", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          name: "events",
          type: "topic",
          durable: true,
          vhost: "/",
        },
      ],
    });

    const exchanges = await client.listExchanges("/");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/exchanges/%2F",
      expect.any(Object),
    );
    expect(exchanges).toHaveLength(1);
    expect(exchanges[0].name).toBe("events");
    expect(exchanges[0].type).toBe("topic");
  });

  it("lists bindings for a vhost", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          source: "events",
          destination: "orders",
          destination_type: "queue",
          routing_key: "order.#",
          vhost: "/",
        },
      ],
    });

    const bindings = await client.listBindings("/");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/bindings/%2F",
      expect.any(Object),
    );
    expect(bindings).toHaveLength(1);
    expect(bindings[0].source).toBe("events");
    expect(bindings[0].destination).toBe("orders");
  });

  it("handles authentication errors gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    await expect(client.listQueues("/")).rejects.toThrow("401");
  });

  it("encodes vhost correctly (/ becomes %2F)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await client.listQueues("/");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("%2F"),
      expect.any(Object),
    );
  });

  it("encodes custom vhost names", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await client.listQueues("my-vhost");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/queues/my-vhost",
      expect.any(Object),
    );
  });

  it("handles network errors", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(client.listQueues("/")).rejects.toThrow("ECONNREFUSED");
  });

  it("purges a queue and returns the message count", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages_purged: 42 }),
    });

    const result = await client.purgeQueue("/", "orders");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/queues/%2F/orders/contents",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(result).toEqual({ messages_purged: 42 });
  });

  it("creates a queue with options", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    await client.createQueue("/", "new-queue", {
      durable: false,
      auto_delete: true,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/queues/%2F/new-queue",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ durable: false, auto_delete: true }),
      }),
    );
  });

  it("throws on error from void endpoint", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: "Conflict",
    });

    await expect(
      client.createQueue("/", "existing-queue", {
        durable: true,
        auto_delete: false,
      }),
    ).rejects.toThrow("409");
  });

  it("creates a binding between an exchange and a queue", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
    });

    await client.createBinding("/", "events", "orders", "order.#");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/bindings/%2F/e/events/q/orders",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ routing_key: "order.#" }),
      }),
    );
  });

  it("publishes a message to an exchange", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routed: true }),
    });

    const result = await client.publishMessage("/", "events", {
      routing_key: "order.created",
      payload: '{"orderId":"ORD-001"}',
      payload_encoding: "string",
      properties: {
        content_type: "application/json",
        type: "order.created",
      },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/exchanges/%2F/events/publish",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          routing_key: "order.created",
          payload: '{"orderId":"ORD-001"}',
          payload_encoding: "string",
          properties: {
            content_type: "application/json",
            type: "order.created",
          },
        }),
      }),
    );
    expect(result).toEqual({ routed: true });
  });

  it("encodes exchange name in publish URL", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routed: true }),
    });

    await client.publishMessage("/", "amq.default", {
      routing_key: "my-queue",
      payload: "{}",
      payload_encoding: "string",
      properties: {},
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/exchanges/%2F/amq.default/publish",
      expect.any(Object),
    );
  });

  it("encodes special characters in queue names", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    await client.createQueue("/", "events/dead-letter#1", {
      durable: true,
      auto_delete: false,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/queues/%2F/events%2Fdead-letter%231",
      expect.any(Object),
    );
  });

  it("throws on error when creating a binding", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(
      client.createBinding("/", "nonexistent", "orders", "order.#"),
    ).rejects.toThrow("404");
  });

  it("throws on error when publishing a message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(
      client.publishMessage("/", "events", {
        routing_key: "order.created",
        payload: '{"orderId":"ORD-001"}',
        payload_encoding: "string",
        properties: {},
      }),
    ).rejects.toThrow("500");
  });
});
