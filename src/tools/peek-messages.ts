import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface PeekMessagesResult {
  messages: Array<{
    payload: string;
    payload_encoding: string;
    properties: {
      correlation_id?: string;
      message_id?: string;
      type?: string;
      timestamp?: number;
      headers?: Record<string, unknown>;
      content_type?: string;
    };
    exchange: string;
    routing_key: string;
  }>;
  count: number;
}

export async function peekMessages(
  client: RabbitMQClient,
  vhost: string,
  queue: string,
  count: number,
): Promise<PeekMessagesResult> {
  const messages = await client.peekMessages(vhost, queue, count);

  return {
    messages: messages.map((m) => ({
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
      exchange: m.exchange,
      routing_key: m.routing_key,
    })),
    count: messages.length,
  };
}
