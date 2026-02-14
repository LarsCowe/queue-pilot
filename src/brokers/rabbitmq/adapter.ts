import { RabbitMQClient } from "../../rabbitmq/client.js";
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
  ConnectionCapability,
} from "../../broker/types.js";

export class RabbitMQAdapter
  implements BrokerAdapter, OverviewCapability, ConsumerCapability, ConnectionCapability
{
  private readonly client: RabbitMQClient;

  constructor(client: RabbitMQClient) {
    this.client = client;
  }

  getClient(): RabbitMQClient {
    return this.client;
  }

  async listQueues(scope?: string): Promise<BrokerQueueInfo[]> {
    const vhost = scope ?? "/";
    const queues = await this.client.listQueues(vhost);
    return queues.map((q) => ({
      name: q.name,
      messages_ready: q.messages_ready,
      messages_unacknowledged: q.messages_unacknowledged,
      state: q.state,
      metadata: { vhost: q.vhost },
    }));
  }

  async getQueue(name: string, scope?: string): Promise<BrokerQueueInfo> {
    const vhost = scope ?? "/";
    const detail = await this.client.getQueue(vhost, name);
    return {
      name: detail.name,
      messages_ready: detail.messages_ready,
      messages_unacknowledged: detail.messages_unacknowledged,
      state: detail.state,
      metadata: {
        vhost: detail.vhost,
        consumers: detail.consumers,
        consumer_utilisation: detail.consumer_utilisation,
        memory: detail.memory,
        message_stats: detail.message_stats,
        policy: detail.policy,
        arguments: detail.arguments,
        node: detail.node,
      },
    };
  }

  async createQueue(params: CreateQueueParams): Promise<CreateQueueResult> {
    const vhost = params.scope ?? "/";
    await this.client.createQueue(vhost, params.name, {
      durable: params.durable ?? false,
      auto_delete: params.auto_delete ?? false,
    });
    return { name: params.name, created: true };
  }

  async deleteQueue(name: string, scope?: string): Promise<void> {
    const vhost = scope ?? "/";
    await this.client.deleteQueue(vhost, name);
  }

  async purgeQueue(name: string, scope?: string): Promise<PurgeResult> {
    const vhost = scope ?? "/";
    const response = await this.client.purgeQueue(vhost, name);
    return { messagesRemoved: response.message_count };
  }

  async peekMessages(queue: string, count: number, scope?: string): Promise<BrokerMessage[]> {
    const vhost = scope ?? "/";
    const messages = await this.client.peekMessages(vhost, queue, count);
    return messages.map((m) => ({
      payload: m.payload,
      payload_encoding: m.payload_encoding,
      properties: {
        correlation_id: m.properties.correlation_id,
        message_id: m.properties.message_id,
        type: m.properties.type,
        timestamp: m.properties.timestamp,
        headers: m.properties.headers,
        content_type: m.properties.content_type,
      },
      metadata: {
        exchange: m.exchange,
        routing_key: m.routing_key,
        message_count: m.message_count,
        redelivered: m.redelivered,
      },
    }));
  }

  async publishMessage(params: PublishParams): Promise<PublishResult> {
    const vhost = params.scope ?? "/";
    const response = await this.client.publishMessage(vhost, params.destination, {
      routing_key: params.routing_key,
      payload: params.payload,
      payload_encoding: "string",
      properties: params.properties ?? {},
    });
    return { published: true, routed: response.routed };
  }

  async checkHealth(): Promise<BrokerHealthResult> {
    const health = await this.client.checkHealth();
    const result: BrokerHealthResult = { status: health.status };
    if (health.reason) {
      result.reason = health.reason;
    }
    return result;
  }

  async getOverview(): Promise<Record<string, unknown>> {
    const result = await this.client.getOverview();
    return result as unknown as Record<string, unknown>;
  }

  async listConsumers(scope?: string): Promise<Record<string, unknown>[]> {
    const vhost = scope ?? "/";
    const result = await this.client.listConsumers(vhost);
    return result as unknown as Record<string, unknown>[];
  }

  async listConnections(): Promise<Record<string, unknown>[]> {
    const result = await this.client.listConnections();
    return result as unknown as Record<string, unknown>[];
  }
}
