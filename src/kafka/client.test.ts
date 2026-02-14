import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAdmin = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  listTopics: vi.fn().mockResolvedValue(["orders", "events"]),
  fetchTopicMetadata: vi.fn().mockResolvedValue({
    topics: [
      {
        name: "orders",
        partitions: [
          { partitionId: 0, leader: 1, replicas: [1], isr: [1] },
        ],
      },
    ],
  }),
  createTopics: vi.fn().mockResolvedValue(true),
  deleteTopics: vi.fn().mockResolvedValue(undefined),
  deleteTopicRecords: vi.fn().mockResolvedValue(undefined),
  fetchTopicOffsets: vi.fn().mockResolvedValue([
    { partition: 0, offset: "42", high: "42", low: "0" },
  ]),
  describeCluster: vi.fn().mockResolvedValue({
    brokers: [{ nodeId: 1, host: "localhost", port: 9092 }],
    controller: 1,
    clusterId: "test-cluster-id",
  }),
  listGroups: vi.fn().mockResolvedValue({
    groups: [
      { groupId: "order-processor", protocolType: "consumer", state: "Stable" },
    ],
  }),
  describeGroups: vi.fn().mockResolvedValue({
    groups: [
      {
        groupId: "order-processor",
        state: "Stable",
        protocol: "range",
        protocolType: "consumer",
        members: [
          {
            memberId: "member-1",
            clientId: "client-1",
            clientHost: "/127.0.0.1",
            memberAssignment: Buffer.from([
              0, 0, 0, 0, 0, 1, 0, 6,
              0x6f, 0x72, 0x64, 0x65, 0x72, 0x73,
              0, 0, 0, 1, 0, 0, 0, 0,
            ]),
          },
        ],
      },
    ],
  }),
  deleteGroups: vi.fn().mockResolvedValue([]),
};

const mockProducer = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue([{ topicName: "orders", partition: 0, errorCode: 0 }]),
};

const mockConsumer = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue(undefined),
  run: vi.fn().mockImplementation(async ({ eachMessage }: { eachMessage: (payload: Record<string, unknown>) => Promise<void> }) => {
    await eachMessage({
      topic: "orders",
      partition: 0,
      message: {
        key: Buffer.from("ORD-001"),
        value: Buffer.from('{"orderId":"ORD-001"}'),
        headers: { source: Buffer.from("test") },
        timestamp: "1700000000000",
        offset: "5",
      },
    });
  }),
  stop: vi.fn().mockResolvedValue(undefined),
};

const MockKafkaJS = vi.fn().mockImplementation(() => ({
  admin: vi.fn().mockReturnValue(mockAdmin),
  producer: vi.fn().mockReturnValue(mockProducer),
  consumer: vi.fn().mockReturnValue(mockConsumer),
}));

vi.mock("@confluentinc/kafka-javascript", () => ({
  KafkaJS: { Kafka: MockKafkaJS },
}));

const { KafkaClient } = await import("./client.js");

describe("KafkaClient", () => {
  let client: InstanceType<typeof KafkaClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new KafkaClient({
      brokers: ["localhost:9092"],
      clientId: "queue-pilot-test",
    });
  });

  describe("listTopics", () => {
    it("returns topic names from admin", async () => {
      const topics = await client.listTopics();

      expect(topics).toEqual(["orders", "events"]);
      expect(mockAdmin.connect).toHaveBeenCalled();
    });
  });

  describe("describeTopic", () => {
    it("returns topic metadata with partition details", async () => {
      const topic = await client.describeTopic("orders");

      expect(topic.name).toBe("orders");
      expect(topic.partitions).toHaveLength(1);
      expect(topic.partitions[0].partitionId).toBe(0);
      expect(topic.partitions[0].leader).toBe(1);
    });

    it("throws when topic is not found in metadata", async () => {
      mockAdmin.fetchTopicMetadata.mockResolvedValueOnce({ topics: [] });

      await expect(client.describeTopic("nonexistent")).rejects.toThrow(
        "Topic 'nonexistent' not found",
      );
    });
  });

  describe("createTopic", () => {
    it("creates a topic with specified partitions and replication", async () => {
      const result = await client.createTopic("payments", 3, 1);

      expect(mockAdmin.createTopics).toHaveBeenCalledWith({
        topics: [{ topic: "payments", numPartitions: 3, replicationFactor: 1 }],
      });
      expect(result).toBe(true);
    });
  });

  describe("deleteTopic", () => {
    it("deletes a topic by name", async () => {
      await client.deleteTopic("stale-topic");

      expect(mockAdmin.deleteTopics).toHaveBeenCalledWith({
        topics: ["stale-topic"],
      });
    });
  });

  describe("purge", () => {
    it("deletes all records from all partitions", async () => {
      mockAdmin.fetchTopicOffsets.mockResolvedValueOnce([
        { partition: 0, offset: "10", high: "10", low: "0" },
        { partition: 1, offset: "20", high: "20", low: "0" },
      ]);

      await client.purge("orders");

      expect(mockAdmin.deleteTopicRecords).toHaveBeenCalledWith({
        topic: "orders",
        partitions: [
          { partition: 0, offset: "10" },
          { partition: 1, offset: "20" },
        ],
      });
    });
  });

  describe("peekMessages", () => {
    it("returns messages from a temporary consumer", async () => {
      const messages = await client.peekMessages("orders", 1);

      expect(messages).toHaveLength(1);
      expect(messages[0].value).toBe('{"orderId":"ORD-001"}');
      expect(messages[0].key).toBe("ORD-001");
      expect(messages[0].partition).toBe(0);
      expect(messages[0].offset).toBe("5");
      expect(messages[0].headers).toEqual({ source: "test" });
    });

    it("disconnects consumer and cleans up group after peek", async () => {
      await client.peekMessages("orders", 1);

      expect(mockConsumer.disconnect).toHaveBeenCalled();
      expect(mockAdmin.deleteGroups).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining("queue-pilot-peek-")]),
      );
    });
  });

  describe("publish", () => {
    it("sends a message to the specified topic", async () => {
      const result = await client.publish(
        "orders",
        "ORD-002",
        '{"orderId":"ORD-002"}',
        { source: "test" },
      );

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: "orders",
        messages: [
          {
            key: "ORD-002",
            value: '{"orderId":"ORD-002"}',
            headers: { source: "test" },
          },
        ],
      });
      expect(result).toEqual([{ topicName: "orders", partition: 0, errorCode: 0 }]);
    });

    it("sends a message without key or headers", async () => {
      await client.publish("events", null, '{"type":"ping"}');

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: "events",
        messages: [
          {
            key: null,
            value: '{"type":"ping"}',
            headers: undefined,
          },
        ],
      });
    });
  });

  describe("checkHealth", () => {
    it("returns ok when cluster is reachable", async () => {
      const result = await client.checkHealth();

      expect(result.status).toBe("ok");
      expect(result.brokersConnected).toBe(1);
    });

    it("returns failed when cluster is unreachable", async () => {
      mockAdmin.describeCluster.mockRejectedValueOnce(
        new Error("Connection refused"),
      );

      const result = await client.checkHealth();

      expect(result.status).toBe("failed");
      expect(result.reason).toContain("Connection refused");
    });
  });

  describe("getOverview", () => {
    it("returns cluster and topic information", async () => {
      const overview = await client.getOverview();

      expect(overview.cluster.clusterId).toBe("test-cluster-id");
      expect(overview.cluster.brokers).toHaveLength(1);
      expect(overview.topics).toEqual(["orders", "events"]);
    });
  });

  describe("listConsumerGroups", () => {
    it("returns consumer group list", async () => {
      const groups = await client.listConsumerGroups();

      expect(groups).toHaveLength(1);
      expect(groups[0].groupId).toBe("order-processor");
      expect(groups[0].state).toBe("Stable");
    });
  });

  describe("describeConsumerGroup", () => {
    it("returns group details with member assignments", async () => {
      const group = await client.describeConsumerGroup("order-processor");

      expect(group.groupId).toBe("order-processor");
      expect(group.state).toBe("Stable");
      expect(group.members).toHaveLength(1);
      expect(group.members[0].clientId).toBe("client-1");
    });

    it("throws when group is not found", async () => {
      mockAdmin.describeGroups.mockResolvedValueOnce({ groups: [] });

      await expect(client.describeConsumerGroup("nonexistent")).rejects.toThrow(
        "Consumer group 'nonexistent' not found",
      );
    });
  });

  describe("fetchTopicOffsets", () => {
    it("returns partition offsets for a topic", async () => {
      const offsets = await client.fetchTopicOffsets("orders");

      expect(offsets).toHaveLength(1);
      expect(offsets[0].partition).toBe(0);
      expect(offsets[0].offset).toBe("42");
    });
  });

  describe("disconnect", () => {
    it("disconnects admin and producer", async () => {
      // Force admin/producer to be created
      await client.listTopics();
      await client.publish("test", null, "data");

      await client.disconnect();

      expect(mockAdmin.disconnect).toHaveBeenCalled();
      expect(mockProducer.disconnect).toHaveBeenCalled();
    });
  });

  describe("dynamic import failure", () => {
    it("throws descriptive error when package is not installed", async () => {
      vi.doMock("@confluentinc/kafka-javascript", () => {
        throw new Error("Cannot find module");
      });

      // Re-import to get the version with broken import
      const { KafkaClient: BrokenClient } = await import("./client.js");
      const broken = new BrokenClient({ brokers: ["localhost:9092"] });

      await expect(broken.listTopics()).rejects.toThrow(
        /install @confluentinc\/kafka-javascript/i,
      );

      // Restore the mock
      vi.doMock("@confluentinc/kafka-javascript", () => ({
        KafkaJS: { Kafka: MockKafkaJS },
      }));
    });
  });
});
