import type { KafkaClient } from "../../kafka/client.js";
import type {
  BrokerAdapter,
  BrokerMessage,
  BrokerQueueInfo,
  BrokerHealthResult,
  CreateQueueParams,
  CreateQueueResult,
  PurgeResult,
  PublishParams,
  PublishResult,
  OverviewCapability,
  ConsumerCapability,
} from "../../broker/types.js";

export class KafkaAdapter
  implements BrokerAdapter, OverviewCapability, ConsumerCapability
{
  private readonly client: KafkaClient;

  constructor(client: KafkaClient) {
    this.client = client;
  }

  getClient(): KafkaClient {
    return this.client;
  }

  async listQueues(_scope?: string): Promise<BrokerQueueInfo[]> {
    const topicNames = await this.client.listTopics();
    const topics = await Promise.all(
      topicNames.map((name) => this.client.describeTopic(name)),
    );
    return topics.map((t) => ({
      name: t.name,
      messages_ready: null,
      messages_unacknowledged: null,
      state: "active",
      metadata: { partitions: t.partitions.length },
    }));
  }

  async getQueue(name: string, _scope?: string): Promise<BrokerQueueInfo> {
    const topic = await this.client.describeTopic(name);
    return {
      name: topic.name,
      messages_ready: null,
      messages_unacknowledged: null,
      state: "active",
      metadata: { partitions: topic.partitions },
    };
  }

  async createQueue(params: CreateQueueParams): Promise<CreateQueueResult> {
    await this.client.createTopic(params.name, 1, 1);
    return { name: params.name, created: true };
  }

  async deleteQueue(name: string, _scope?: string): Promise<void> {
    await this.client.deleteTopic(name);
  }

  async purgeQueue(name: string, _scope?: string): Promise<PurgeResult> {
    await this.client.purge(name);
    return { messagesRemoved: 0 };
  }

  async peekMessages(
    queue: string,
    count: number,
    _scope?: string,
  ): Promise<BrokerMessage[]> {
    const messages = await this.client.peekMessages(queue, count);
    return messages.map((m) => ({
      payload: m.value ?? "",
      payload_encoding: "string",
      properties: {
        headers: m.headers,
        timestamp: parseInt(m.timestamp, 10) || 0,
      },
      metadata: {
        partition: m.partition,
        offset: m.offset,
        key: m.key,
        topic: m.topic,
      },
    }));
  }

  async publishMessage(params: PublishParams): Promise<PublishResult> {
    const key = params.routing_key || null;
    const headers = params.properties as Record<string, string> | undefined;
    await this.client.publish(params.destination, key, params.payload, headers);
    return { published: true, routed: true };
  }

  async checkHealth(): Promise<BrokerHealthResult> {
    const result = await this.client.checkHealth();
    const health: BrokerHealthResult = { status: result.status };
    if (result.reason) {
      health.reason = result.reason;
    }
    return health;
  }

  async getOverview(): Promise<Record<string, unknown>> {
    return (await this.client.getOverview()) as unknown as Record<
      string,
      unknown
    >;
  }

  async listConsumers(_scope?: string): Promise<Record<string, unknown>[]> {
    const groups = await this.client.listConsumerGroups();
    return groups as unknown as Record<string, unknown>[];
  }
}
