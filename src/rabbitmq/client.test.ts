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
      text: async () => "Not authorised",
    });

    await expect(client.listQueues("/")).rejects.toThrow(
      "RabbitMQ API error: 401 Unauthorized — Not authorised",
    );
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
      json: async () => ({ message_count: 42 }),
    });

    const result = await client.purgeQueue("/", "orders");

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/queues/%2F/orders/contents",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(result).toEqual({ message_count: 42 });
  });

  it("purges an empty queue and returns zero", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message_count: 0 }),
    });

    const result = await client.purgeQueue("/", "empty-queue");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/queues/%2F/empty-queue/contents",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(result).toEqual({ message_count: 0 });
  });

  it("handles 204 No Content from purge endpoint", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });

    const result = await client.purgeQueue("/", "orders");

    expect(result).toEqual({ message_count: 0 });
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
      text: async () => "PRECONDITION_FAILED - inequivalent arg 'durable'",
    });

    await expect(
      client.createQueue("/", "existing-queue", {
        durable: true,
        auto_delete: false,
      }),
    ).rejects.toThrow(
      "RabbitMQ API error: 409 Conflict — PRECONDITION_FAILED - inequivalent arg 'durable'",
    );
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
      text: async () => '{"error":"Object Not Found","reason":"Not Found"}',
    });

    await expect(
      client.createBinding("/", "nonexistent", "orders", "order.#"),
    ).rejects.toThrow(
      'RabbitMQ API error: 404 Not Found — {"error":"Object Not Found","reason":"Not Found"}',
    );
  });

  it("throws on error when publishing a message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Internal Server Error",
    });

    await expect(
      client.publishMessage("/", "events", {
        routing_key: "order.created",
        payload: '{"orderId":"ORD-001"}',
        payload_encoding: "string",
        properties: {},
      }),
    ).rejects.toThrow(
      "RabbitMQ API error: 500 Internal Server Error — Internal Server Error",
    );
  });

  it("preserves HTTP status in error when response body is unreadable", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      text: async () => {
        throw new Error("connection reset");
      },
    });

    await expect(client.listQueues("/")).rejects.toThrow(
      "RabbitMQ API error: 502 Bad Gateway",
    );
  });

  it("throws when vhost is empty string", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await expect(client.listQueues("")).rejects.toThrow(
      "vhost must not be empty",
    );
  });

  it("creates an exchange with PUT method", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    await client.createExchange("/", "order-events", {
      type: "topic",
      durable: true,
      auto_delete: false,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/exchanges/%2F/order-events",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ type: "topic", durable: true, auto_delete: false }),
      }),
    );
  });

  it("deletes a queue with DELETE method", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    await client.deleteQueue("/", "order-events");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/queues/%2F/order-events",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("deletes an exchange with DELETE method", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    await client.deleteExchange("/", "order-events");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/exchanges/%2F/order-events",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("deletes a binding with properties key in URL", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    await client.deleteBinding("/", "events", "orders", "~");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/bindings/%2F/e/events/q/orders/~",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("fetches cluster overview", async () => {
    const overview = {
      cluster_name: "rabbit@localhost",
      rabbitmq_version: "3.13.2",
      erlang_version: "26.2.5",
      message_stats: { publish: 100, deliver: 90 },
      queue_totals: { messages: 10, messages_ready: 7, messages_unacknowledged: 3 },
      object_totals: { queues: 5, exchanges: 8, connections: 2, consumers: 3 },
      node: "rabbit@localhost",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => overview,
    });

    const result = await client.getOverview();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/overview",
      expect.any(Object),
    );
    expect(result).toEqual(overview);
  });

  it("checks health without throwing on 503", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        status: "failed",
        reason: "There are alarms in effect in the cluster",
      }),
    });

    const result = await client.checkHealth();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/health/checks/alarms",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Basic"),
        }),
      }),
    );
    expect(result).toEqual({
      status: "failed",
      reason: "There are alarms in effect in the cluster",
    });
  });

  it("checks health returns ok for healthy broker", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
    });

    const result = await client.checkHealth();

    expect(result).toEqual({ status: "ok" });
  });

  it("fetches detailed queue information", async () => {
    const queueDetail = {
      name: "order-events",
      vhost: "/",
      state: "running",
      messages_ready: 5,
      messages_unacknowledged: 2,
      consumers: 3,
      consumer_utilisation: 0.75,
      memory: 65536,
      message_stats: { publish: 200, deliver: 195 },
      policy: null,
      arguments: {},
      node: "rabbit@node-1",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => queueDetail,
    });

    const result = await client.getQueue("/", "order-events");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/queues/%2F/order-events",
      expect.any(Object),
    );
    expect(result).toEqual(queueDetail);
  });

  it("lists consumers for a vhost", async () => {
    const consumers = [
      {
        queue: { name: "orders" },
        consumer_tag: "ctag-1",
        channel_details: { connection_name: "app:5672" },
        ack_required: true,
        prefetch_count: 10,
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => consumers,
    });

    const result = await client.listConsumers("/");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/consumers/%2F",
      expect.any(Object),
    );
    expect(result).toEqual(consumers);
  });

  it("lists all connections", async () => {
    const connections = [
      {
        name: "172.17.0.3:43210 -> 172.17.0.2:5672",
        user: "guest",
        state: "running",
        channels: 1,
        connected_at: 1700000000000,
        client_properties: { connection_name: "my-app" },
        peer_host: "172.17.0.3",
        peer_port: 43210,
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => connections,
    });

    const result = await client.listConnections();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:15672/api/connections",
      expect.any(Object),
    );
    expect(result).toEqual(connections);
  });
});
