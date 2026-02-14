import { describe, it, expect, vi } from "vitest";
import { RabbitMQAdapter } from "./adapter.js";
import { RabbitMQClient } from "../../rabbitmq/client.js";
import { hasOverview, hasConsumers, hasConnections } from "../../broker/types.js";
import type { QueueMessage, QueueDetail } from "../../rabbitmq/types.js";

function mockClient(overrides: Partial<Record<keyof RabbitMQClient, unknown>> = {}): RabbitMQClient {
  return {
    listQueues: vi.fn().mockResolvedValue([]),
    getQueue: vi.fn().mockResolvedValue({
      name: "orders",
      vhost: "/",
      state: "running",
      messages_ready: 5,
      messages_unacknowledged: 2,
      consumers: 1,
      consumer_utilisation: null,
      memory: 1024,
      message_stats: null,
      policy: null,
      arguments: {},
      node: "rabbit@localhost",
    }),
    createQueue: vi.fn().mockResolvedValue(undefined),
    deleteQueue: vi.fn().mockResolvedValue(undefined),
    purgeQueue: vi.fn().mockResolvedValue({ message_count: 3 }),
    peekMessages: vi.fn().mockResolvedValue([]),
    publishMessage: vi.fn().mockResolvedValue({ routed: true }),
    checkHealth: vi.fn().mockResolvedValue({ status: "ok" }),
    getOverview: vi.fn().mockResolvedValue({ cluster_name: "test" }),
    listConsumers: vi.fn().mockResolvedValue([]),
    listConnections: vi.fn().mockResolvedValue([]),
    listExchanges: vi.fn().mockResolvedValue([]),
    listBindings: vi.fn().mockResolvedValue([]),
    createBinding: vi.fn().mockResolvedValue(undefined),
    createExchange: vi.fn().mockResolvedValue(undefined),
    deleteExchange: vi.fn().mockResolvedValue(undefined),
    deleteBinding: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as RabbitMQClient;
}

describe("RabbitMQAdapter", () => {
  it("implements all three capability interfaces", () => {
    const adapter = new RabbitMQAdapter(mockClient());
    expect(hasOverview(adapter)).toBe(true);
    expect(hasConsumers(adapter)).toBe(true);
    expect(hasConnections(adapter)).toBe(true);
  });

  it("exposes the underlying client via getClient", () => {
    const client = mockClient();
    const adapter = new RabbitMQAdapter(client);
    expect(adapter.getClient()).toBe(client);
  });

  describe("listQueues", () => {
    it("delegates to client.listQueues with scope as vhost", async () => {
      const client = mockClient({
        listQueues: vi.fn().mockResolvedValue([
          { name: "orders", messages_ready: 5, messages_unacknowledged: 1, state: "running", vhost: "/" },
        ]),
      });
      const adapter = new RabbitMQAdapter(client);

      const result = await adapter.listQueues("/");

      expect(client.listQueues).toHaveBeenCalledWith("/");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("orders");
      expect(result[0].messages_ready).toBe(5);
      expect(result[0].metadata).toEqual({ vhost: "/" });
    });

    it("defaults scope to / when omitted", async () => {
      const client = mockClient();
      const adapter = new RabbitMQAdapter(client);

      await adapter.listQueues();

      expect(client.listQueues).toHaveBeenCalledWith("/");
    });
  });

  describe("getQueue", () => {
    it("delegates to client.getQueue and maps metadata", async () => {
      const detail: QueueDetail = {
        name: "orders",
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
      const client = mockClient({ getQueue: vi.fn().mockResolvedValue(detail) });
      const adapter = new RabbitMQAdapter(client);

      const result = await adapter.getQueue("orders", "/");

      expect(client.getQueue).toHaveBeenCalledWith("/", "orders");
      expect(result.name).toBe("orders");
      expect(result.metadata).toEqual({
        vhost: "/",
        consumers: 3,
        consumer_utilisation: 0.75,
        memory: 65536,
        message_stats: { publish: 200, deliver: 195 },
        policy: null,
        arguments: {},
        node: "rabbit@node-1",
      });
    });
  });

  describe("createQueue", () => {
    it("delegates to client.createQueue with correct args", async () => {
      const client = mockClient();
      const adapter = new RabbitMQAdapter(client);

      const result = await adapter.createQueue({
        name: "new-queue",
        durable: true,
        auto_delete: false,
        scope: "/",
      });

      expect(client.createQueue).toHaveBeenCalledWith("/", "new-queue", {
        durable: true,
        auto_delete: false,
      });
      expect(result.name).toBe("new-queue");
      expect(result.created).toBe(true);
    });

    it("defaults durable and auto_delete to false", async () => {
      const client = mockClient();
      const adapter = new RabbitMQAdapter(client);

      await adapter.createQueue({ name: "simple-queue" });

      expect(client.createQueue).toHaveBeenCalledWith("/", "simple-queue", {
        durable: false,
        auto_delete: false,
      });
    });
  });

  describe("deleteQueue", () => {
    it("delegates to client.deleteQueue", async () => {
      const client = mockClient();
      const adapter = new RabbitMQAdapter(client);

      await adapter.deleteQueue("old-queue", "/");

      expect(client.deleteQueue).toHaveBeenCalledWith("/", "old-queue");
    });
  });

  describe("purgeQueue", () => {
    it("delegates to client.purgeQueue and maps result", async () => {
      const client = mockClient({
        purgeQueue: vi.fn().mockResolvedValue({ message_count: 7 }),
      });
      const adapter = new RabbitMQAdapter(client);

      const result = await adapter.purgeQueue("orders", "/");

      expect(client.purgeQueue).toHaveBeenCalledWith("/", "orders");
      expect(result.messagesRemoved).toBe(7);
    });
  });

  describe("peekMessages", () => {
    it("delegates to client.peekMessages and maps to BrokerMessage", async () => {
      const messages: QueueMessage[] = [
        {
          payload: '{"orderId":"ORD-001"}',
          payload_encoding: "string",
          properties: { type: "order.created", content_type: "application/json" },
          exchange: "events",
          routing_key: "order.created",
          message_count: 1,
          redelivered: false,
        },
      ];
      const client = mockClient({ peekMessages: vi.fn().mockResolvedValue(messages) });
      const adapter = new RabbitMQAdapter(client);

      const result = await adapter.peekMessages("orders", 5, "/");

      expect(client.peekMessages).toHaveBeenCalledWith("/", "orders", 5);
      expect(result).toHaveLength(1);
      expect(result[0].payload).toBe('{"orderId":"ORD-001"}');
      expect(result[0].properties.type).toBe("order.created");
      expect(result[0].metadata).toEqual({
        exchange: "events",
        routing_key: "order.created",
        message_count: 1,
        redelivered: false,
      });
    });
  });

  describe("publishMessage", () => {
    it("delegates to client.publishMessage and maps result", async () => {
      const client = mockClient({
        publishMessage: vi.fn().mockResolvedValue({ routed: true }),
      });
      const adapter = new RabbitMQAdapter(client);

      const result = await adapter.publishMessage({
        destination: "events",
        routing_key: "order.created",
        payload: '{"orderId":"ORD-001"}',
        properties: { content_type: "application/json", type: "order.created" },
        scope: "/",
      });

      expect(client.publishMessage).toHaveBeenCalledWith("/", "events", {
        routing_key: "order.created",
        payload: '{"orderId":"ORD-001"}',
        payload_encoding: "string",
        properties: { content_type: "application/json", type: "order.created" },
      });
      expect(result.published).toBe(true);
      expect(result.routed).toBe(true);
    });
  });

  describe("checkHealth", () => {
    it("delegates to client.checkHealth", async () => {
      const client = mockClient({
        checkHealth: vi.fn().mockResolvedValue({ status: "ok" }),
      });
      const adapter = new RabbitMQAdapter(client);

      const result = await adapter.checkHealth();

      expect(result.status).toBe("ok");
    });

    it("passes through reason when unhealthy", async () => {
      const client = mockClient({
        checkHealth: vi.fn().mockResolvedValue({ status: "failed", reason: "disk alarm" }),
      });
      const adapter = new RabbitMQAdapter(client);

      const result = await adapter.checkHealth();

      expect(result.status).toBe("failed");
      expect(result.reason).toBe("disk alarm");
    });
  });

  describe("getOverview", () => {
    it("delegates to client.getOverview", async () => {
      const overview = { cluster_name: "rabbit@localhost", rabbitmq_version: "3.13.2" };
      const client = mockClient({
        getOverview: vi.fn().mockResolvedValue(overview),
      });
      const adapter = new RabbitMQAdapter(client);

      const result = await adapter.getOverview();

      expect(result).toEqual(overview);
    });
  });

  describe("listConsumers", () => {
    it("delegates to client.listConsumers with scope as vhost", async () => {
      const consumers = [{ queue: { name: "orders" }, consumer_tag: "ctag-1" }];
      const client = mockClient({
        listConsumers: vi.fn().mockResolvedValue(consumers),
      });
      const adapter = new RabbitMQAdapter(client);

      const result = await adapter.listConsumers("/");

      expect(client.listConsumers).toHaveBeenCalledWith("/");
      expect(result).toEqual(consumers);
    });
  });

  describe("listConnections", () => {
    it("delegates to client.listConnections", async () => {
      const connections = [{ name: "conn-1", user: "guest" }];
      const client = mockClient({
        listConnections: vi.fn().mockResolvedValue(connections),
      });
      const adapter = new RabbitMQAdapter(client);

      const result = await adapter.listConnections();

      expect(result).toEqual(connections);
    });
  });
});
