import { describe, it, expect, vi } from "vitest";
import { KafkaAdapter } from "./adapter.js";
import type { KafkaClient } from "../../kafka/client.js";
import { hasOverview, hasConsumers, hasConnections } from "../../broker/types.js";

function mockClient(
  overrides: Partial<Record<keyof KafkaClient, unknown>> = {},
): KafkaClient {
  return {
    listTopics: vi.fn().mockResolvedValue(["orders", "events"]),
    describeTopic: vi.fn().mockResolvedValue({
      name: "orders",
      partitions: [
        { partitionId: 0, leader: 1, replicas: [1], isr: [1] },
      ],
    }),
    createTopic: vi.fn().mockResolvedValue(true),
    deleteTopic: vi.fn().mockResolvedValue(undefined),
    purge: vi.fn().mockResolvedValue(undefined),
    peekMessages: vi.fn().mockResolvedValue([
      {
        key: "ORD-001",
        value: '{"orderId":"ORD-001"}',
        headers: { source: "test" },
        timestamp: "1700000000000",
        partition: 0,
        offset: "5",
        topic: "orders",
      },
    ]),
    publish: vi.fn().mockResolvedValue([
      { topicName: "orders", partition: 0, errorCode: 0 },
    ]),
    checkHealth: vi.fn().mockResolvedValue({
      status: "ok",
      brokersConnected: 3,
    }),
    getOverview: vi.fn().mockResolvedValue({
      cluster: {
        clusterId: "test-cluster",
        controller: 1,
        brokers: [{ nodeId: 1, host: "localhost", port: 9092 }],
      },
      topics: ["orders", "events"],
    }),
    listConsumerGroups: vi.fn().mockResolvedValue([
      { groupId: "order-processor", protocolType: "consumer", state: "Stable" },
    ]),
    describeConsumerGroup: vi.fn().mockResolvedValue({
      groupId: "order-processor",
      state: "Stable",
      protocol: "range",
      protocolType: "consumer",
      members: [],
    }),
    fetchTopicOffsets: vi.fn().mockResolvedValue([
      { partition: 0, offset: "42", high: "42", low: "0" },
    ]),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as KafkaClient;
}

describe("KafkaAdapter", () => {
  it("implements OverviewCapability and ConsumerCapability", () => {
    const adapter = new KafkaAdapter(mockClient());

    expect(hasOverview(adapter)).toBe(true);
    expect(hasConsumers(adapter)).toBe(true);
  });

  it("does not implement ConnectionCapability", () => {
    const adapter = new KafkaAdapter(mockClient());

    expect(hasConnections(adapter)).toBe(false);
  });

  it("exposes the underlying client via getClient", () => {
    const client = mockClient();
    const adapter = new KafkaAdapter(client);

    expect(adapter.getClient()).toBe(client);
  });

  describe("listQueues", () => {
    it("maps topics to BrokerQueueInfo with null message counts", async () => {
      const client = mockClient({
        listTopics: vi.fn().mockResolvedValue(["orders", "events"]),
        describeTopic: vi.fn()
          .mockResolvedValueOnce({
            name: "orders",
            partitions: [
              { partitionId: 0, leader: 1, replicas: [1], isr: [1] },
              { partitionId: 1, leader: 1, replicas: [1], isr: [1] },
            ],
          })
          .mockResolvedValueOnce({
            name: "events",
            partitions: [
              { partitionId: 0, leader: 1, replicas: [1], isr: [1] },
            ],
          }),
      });
      const adapter = new KafkaAdapter(client);

      const queues = await adapter.listQueues();

      expect(queues).toHaveLength(2);
      expect(queues[0].name).toBe("orders");
      expect(queues[0].messages_ready).toBeNull();
      expect(queues[0].messages_unacknowledged).toBeNull();
      expect(queues[0].state).toBe("active");
      expect(queues[0].metadata).toEqual({ partitions: 2 });
    });

    it("ignores scope parameter", async () => {
      const client = mockClient({
        listTopics: vi.fn().mockResolvedValue([]),
      });
      const adapter = new KafkaAdapter(client);

      await adapter.listQueues("some-scope");

      expect(client.listTopics).toHaveBeenCalledWith();
    });
  });

  describe("getQueue", () => {
    it("maps topic details to BrokerQueueInfo with partition metadata", async () => {
      const adapter = new KafkaAdapter(mockClient());

      const queue = await adapter.getQueue("orders");

      expect(queue.name).toBe("orders");
      expect(queue.messages_ready).toBeNull();
      expect(queue.messages_unacknowledged).toBeNull();
      expect(queue.metadata).toEqual({
        partitions: [
          { partitionId: 0, leader: 1, replicas: [1], isr: [1] },
        ],
      });
    });
  });

  describe("createQueue", () => {
    it("creates a topic with default partitions and replication", async () => {
      const client = mockClient();
      const adapter = new KafkaAdapter(client);

      const result = await adapter.createQueue({ name: "payments" });

      expect(client.createTopic).toHaveBeenCalledWith("payments", 1, 1);
      expect(result.name).toBe("payments");
      expect(result.created).toBe(true);
    });

    it("ignores durable and auto_delete parameters", async () => {
      const client = mockClient();
      const adapter = new KafkaAdapter(client);

      await adapter.createQueue({
        name: "payments",
        durable: false,
        auto_delete: true,
      });

      expect(client.createTopic).toHaveBeenCalledWith("payments", 1, 1);
    });
  });

  describe("deleteQueue", () => {
    it("deletes the topic", async () => {
      const client = mockClient();
      const adapter = new KafkaAdapter(client);

      await adapter.deleteQueue("stale-topic");

      expect(client.deleteTopic).toHaveBeenCalledWith("stale-topic");
    });
  });

  describe("purgeQueue", () => {
    it("purges the topic and returns zero removed count", async () => {
      const client = mockClient();
      const adapter = new KafkaAdapter(client);

      const result = await adapter.purgeQueue("orders");

      expect(client.purge).toHaveBeenCalledWith("orders");
      expect(result.messagesRemoved).toBe(0);
    });
  });

  describe("peekMessages", () => {
    it("maps peeked messages to BrokerMessage format", async () => {
      const adapter = new KafkaAdapter(mockClient());

      const messages = await adapter.peekMessages("orders", 5);

      expect(messages).toHaveLength(1);
      expect(messages[0].payload).toBe('{"orderId":"ORD-001"}');
      expect(messages[0].payload_encoding).toBe("string");
      expect(messages[0].properties.headers).toEqual({ source: "test" });
      expect(messages[0].properties.timestamp).toBe(1700000000000);
      expect(messages[0].metadata).toEqual({
        partition: 0,
        offset: "5",
        key: "ORD-001",
        topic: "orders",
      });
    });

    it("handles messages with null value", async () => {
      const client = mockClient({
        peekMessages: vi.fn().mockResolvedValue([
          {
            key: null,
            value: null,
            headers: {},
            timestamp: "0",
            partition: 0,
            offset: "0",
            topic: "tombstones",
          },
        ]),
      });
      const adapter = new KafkaAdapter(client);

      const messages = await adapter.peekMessages("tombstones", 1);

      expect(messages[0].payload).toBe("");
      expect(messages[0].properties.timestamp).toBe(0);
    });
  });

  describe("publishMessage", () => {
    it("maps destination to topic and routing_key to key", async () => {
      const client = mockClient();
      const adapter = new KafkaAdapter(client);

      const result = await adapter.publishMessage({
        destination: "orders",
        routing_key: "ORD-002",
        payload: '{"orderId":"ORD-002"}',
        properties: { source: "test" },
      });

      expect(client.publish).toHaveBeenCalledWith(
        "orders",
        "ORD-002",
        '{"orderId":"ORD-002"}',
        { source: "test" },
      );
      expect(result.published).toBe(true);
      expect(result.routed).toBe(true);
    });

    it("passes null key when routing_key is empty", async () => {
      const client = mockClient();
      const adapter = new KafkaAdapter(client);

      await adapter.publishMessage({
        destination: "events",
        routing_key: "",
        payload: "data",
      });

      expect(client.publish).toHaveBeenCalledWith(
        "events",
        null,
        "data",
        undefined,
      );
    });
  });

  describe("checkHealth", () => {
    it("delegates to client checkHealth", async () => {
      const adapter = new KafkaAdapter(mockClient());

      const result = await adapter.checkHealth();

      expect(result.status).toBe("ok");
    });

    it("passes through failure reason", async () => {
      const client = mockClient({
        checkHealth: vi.fn().mockResolvedValue({
          status: "failed",
          reason: "Connection refused",
        }),
      });
      const adapter = new KafkaAdapter(client);

      const result = await adapter.checkHealth();

      expect(result.status).toBe("failed");
      expect(result.reason).toBe("Connection refused");
    });
  });

  describe("getOverview", () => {
    it("delegates to client getOverview", async () => {
      const adapter = new KafkaAdapter(mockClient());

      const result = await adapter.getOverview();

      expect(result).toHaveProperty("cluster");
      expect(result).toHaveProperty("topics");
    });
  });

  describe("disconnect", () => {
    it("delegates to client disconnect", async () => {
      const client = mockClient();
      const adapter = new KafkaAdapter(client);

      await adapter.disconnect();

      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe("listConsumers", () => {
    it("returns consumer groups as generic records", async () => {
      const adapter = new KafkaAdapter(mockClient());

      const result = await adapter.listConsumers();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("groupId", "order-processor");
    });
  });
});
