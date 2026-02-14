import type {
  KafkaConfig,
  TopicInfo,
  ConsumerGroupInfo,
  ConsumerGroupMember,
} from "./types.js";

interface KafkaModule {
  KafkaJS: {
    Kafka: new (config: Record<string, unknown>) => KafkaInstance;
  };
}

interface KafkaInstance {
  admin(): KafkaAdmin;
  producer(): KafkaProducer;
  consumer(config: { groupId: string }): KafkaConsumer;
}

interface KafkaAdmin {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTopics(): Promise<string[]>;
  fetchTopicMetadata(options: {
    topics: string[];
  }): Promise<{ topics: TopicMetadataEntry[] }>;
  createTopics(options: {
    topics: { topic: string; numPartitions: number; replicationFactor: number }[];
  }): Promise<boolean>;
  deleteTopics(options: { topics: string[] }): Promise<void>;
  deleteTopicRecords(options: {
    topic: string;
    partitions: { partition: number; offset: string }[];
  }): Promise<void>;
  fetchTopicOffsets(
    topic: string,
  ): Promise<{ partition: number; offset: string; high: string; low: string }[]>;
  describeCluster(): Promise<{
    brokers: { nodeId: number; host: string; port: number }[];
    controller: number;
    clusterId: string;
  }>;
  listGroups(): Promise<{
    groups: { groupId: string; protocolType: string; state: string }[];
  }>;
  describeGroups(
    groupIds: string[],
  ): Promise<{
    groups: {
      groupId: string;
      state: string;
      protocol: string;
      protocolType: string;
      members: {
        memberId: string;
        clientId: string;
        clientHost: string;
        memberAssignment: Buffer;
      }[];
    }[];
  }>;
  deleteGroups(groupIds: string[]): Promise<unknown[]>;
}

interface KafkaProducer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(options: {
    topic: string;
    messages: {
      key: string | null;
      value: string;
      headers?: Record<string, string>;
    }[];
  }): Promise<{ topicName: string; partition: number; errorCode: number }[]>;
}

interface KafkaConsumer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(options: { topic: string; fromBeginning: boolean }): Promise<void>;
  run(options: {
    eachMessage: (payload: {
      topic: string;
      partition: number;
      message: {
        key: Buffer | null;
        value: Buffer | null;
        headers?: Record<string, Buffer>;
        timestamp: string;
        offset: string;
      };
    }) => Promise<void>;
  }): Promise<void>;
  stop(): Promise<void>;
}

interface TopicMetadataEntry {
  name: string;
  partitions: {
    partitionId: number;
    leader: number;
    replicas: number[];
    isr: number[];
  }[];
}

export interface PeekedMessage {
  key: string | null;
  value: string | null;
  headers: Record<string, string>;
  timestamp: string;
  partition: number;
  offset: string;
  topic: string;
}

export interface KafkaHealthResult {
  status: string;
  brokersConnected?: number;
  reason?: string;
}

export interface KafkaOverview {
  cluster: {
    clusterId: string;
    controller: number;
    brokers: { nodeId: number; host: string; port: number }[];
  };
  topics: string[];
}

async function loadKafkaModule(): Promise<KafkaModule> {
  try {
    return (await import("@confluentinc/kafka-javascript")) as unknown as KafkaModule;
  } catch {
    throw new Error(
      "Kafka support requires @confluentinc/kafka-javascript. " +
        "Install it with: npm install @confluentinc/kafka-javascript",
    );
  }
}

export class KafkaClient {
  private readonly config: KafkaConfig;
  private kafka: KafkaInstance | null = null;
  private adminInstance: KafkaAdmin | null = null;
  private producerInstance: KafkaProducer | null = null;

  constructor(config: KafkaConfig) {
    this.config = config;
  }

  private async getKafka(): Promise<KafkaInstance> {
    if (!this.kafka) {
      const mod = await loadKafkaModule();
      const kafkaConfig: Record<string, unknown> = {
        brokers: this.config.brokers,
        clientId: this.config.clientId ?? "queue-pilot",
      };
      if (this.config.ssl) {
        kafkaConfig.ssl = true;
      }
      if (this.config.sasl) {
        kafkaConfig.sasl = this.config.sasl;
      }
      this.kafka = new mod.KafkaJS.Kafka(kafkaConfig);
    }
    return this.kafka;
  }

  private async getAdmin(): Promise<KafkaAdmin> {
    if (!this.adminInstance) {
      const kafka = await this.getKafka();
      this.adminInstance = kafka.admin();
      await this.adminInstance.connect();
    }
    return this.adminInstance;
  }

  private async getProducer(): Promise<KafkaProducer> {
    if (!this.producerInstance) {
      const kafka = await this.getKafka();
      this.producerInstance = kafka.producer();
      await this.producerInstance.connect();
    }
    return this.producerInstance;
  }

  async listTopics(): Promise<string[]> {
    const admin = await this.getAdmin();
    return admin.listTopics();
  }

  async describeTopic(name: string): Promise<TopicInfo> {
    const admin = await this.getAdmin();
    const metadata = await admin.fetchTopicMetadata({ topics: [name] });
    const topic = metadata.topics.find((t) => t.name === name);
    if (!topic) {
      throw new Error(`Topic '${name}' not found`);
    }
    return {
      name: topic.name,
      partitions: topic.partitions.map((p) => ({
        partitionId: p.partitionId,
        leader: p.leader,
        replicas: p.replicas,
        isr: p.isr,
      })),
    };
  }

  async createTopic(
    name: string,
    numPartitions: number,
    replicationFactor: number,
  ): Promise<boolean> {
    const admin = await this.getAdmin();
    return admin.createTopics({
      topics: [{ topic: name, numPartitions, replicationFactor }],
    });
  }

  async deleteTopic(name: string): Promise<void> {
    const admin = await this.getAdmin();
    await admin.deleteTopics({ topics: [name] });
  }

  async purge(name: string): Promise<void> {
    const admin = await this.getAdmin();
    const offsets = await admin.fetchTopicOffsets(name);
    await admin.deleteTopicRecords({
      topic: name,
      partitions: offsets.map((o) => ({
        partition: o.partition,
        offset: o.high,
      })),
    });
  }

  async peekMessages(topic: string, count: number): Promise<PeekedMessage[]> {
    const kafka = await this.getKafka();
    const groupId = `queue-pilot-peek-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const consumer = kafka.consumer({ groupId });
    const messages: PeekedMessage[] = [];

    try {
      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: true });

      await consumer.run({
        eachMessage: async ({ topic: msgTopic, partition, message }) => {
          if (messages.length < count) {
            messages.push({
              key: message.key ? message.key.toString() : null,
              value: message.value ? message.value.toString() : null,
              headers: decodeHeaders(message.headers),
              timestamp: message.timestamp,
              partition,
              offset: message.offset,
              topic: msgTopic,
            });
          }

          if (messages.length >= count) {
            await consumer.stop();
          }
        },
      });
    } finally {
      await consumer.disconnect();
      try {
        const admin = await this.getAdmin();
        await admin.deleteGroups([groupId]);
      } catch {
        // Group cleanup is best-effort
      }
    }

    return messages;
  }

  async publish(
    topic: string,
    key: string | null,
    value: string,
    headers?: Record<string, string>,
  ): Promise<{ topicName: string; partition: number; errorCode: number }[]> {
    const producer = await this.getProducer();
    return producer.send({
      topic,
      messages: [{ key, value, headers }],
    });
  }

  async checkHealth(): Promise<KafkaHealthResult> {
    try {
      const admin = await this.getAdmin();
      const cluster = await admin.describeCluster();
      return {
        status: "ok",
        brokersConnected: cluster.brokers.length,
      };
    } catch (error: unknown) {
      return {
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getOverview(): Promise<KafkaOverview> {
    const admin = await this.getAdmin();
    const [cluster, topics] = await Promise.all([
      admin.describeCluster(),
      admin.listTopics(),
    ]);
    return {
      cluster: {
        clusterId: cluster.clusterId,
        controller: cluster.controller,
        brokers: cluster.brokers.map((b) => ({
          nodeId: b.nodeId,
          host: b.host,
          port: b.port,
        })),
      },
      topics,
    };
  }

  async listConsumerGroups(): Promise<
    { groupId: string; protocolType: string; state: string }[]
  > {
    const admin = await this.getAdmin();
    const result = await admin.listGroups();
    return result.groups;
  }

  async describeConsumerGroup(groupId: string): Promise<ConsumerGroupInfo> {
    const admin = await this.getAdmin();
    const result = await admin.describeGroups([groupId]);
    const group = result.groups.find((g) => g.groupId === groupId);
    if (!group) {
      throw new Error(`Consumer group '${groupId}' not found`);
    }
    return {
      groupId: group.groupId,
      state: group.state,
      protocol: group.protocol,
      protocolType: group.protocolType,
      members: group.members.map(
        (m): ConsumerGroupMember => ({
          memberId: m.memberId,
          clientId: m.clientId,
          clientHost: m.clientHost,
          assignment: decodeMemberAssignment(m.memberAssignment),
        }),
      ),
    };
  }

  async fetchTopicOffsets(
    topic: string,
  ): Promise<{ partition: number; offset: string; high: string; low: string }[]> {
    const admin = await this.getAdmin();
    return admin.fetchTopicOffsets(topic);
  }

  async disconnect(): Promise<void> {
    if (this.adminInstance) {
      await this.adminInstance.disconnect();
      this.adminInstance = null;
    }
    if (this.producerInstance) {
      await this.producerInstance.disconnect();
      this.producerInstance = null;
    }
    this.kafka = null;
  }
}

function decodeHeaders(
  headers?: Record<string, Buffer>,
): Record<string, string> {
  if (!headers) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = value.toString();
  }
  return result;
}

function decodeMemberAssignment(
  buffer: Buffer,
): { topic: string; partitions: number[] }[] {
  if (!buffer || buffer.length === 0) return [];
  try {
    let offset = 2; // skip version (int16)
    const topicCount = buffer.readInt32BE(offset);
    offset += 4;
    const assignments: { topic: string; partitions: number[] }[] = [];
    for (let i = 0; i < topicCount; i++) {
      const topicLength = buffer.readInt16BE(offset);
      offset += 2;
      const topic = buffer.toString("utf8", offset, offset + topicLength);
      offset += topicLength;
      const partitionCount = buffer.readInt32BE(offset);
      offset += 4;
      const partitions: number[] = [];
      for (let j = 0; j < partitionCount; j++) {
        partitions.push(buffer.readInt32BE(offset));
        offset += 4;
      }
      assignments.push({ topic, partitions });
    }
    return assignments;
  } catch {
    return [];
  }
}
