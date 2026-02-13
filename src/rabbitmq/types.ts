export interface RabbitMQConfig {
  url: string;
  username: string;
  password: string;
}

export interface QueueInfo {
  name: string;
  messages_ready: number | null;
  messages_unacknowledged: number | null;
  state: string;
  vhost: string;
}

export interface MessageProperties {
  correlation_id?: string;
  message_id?: string;
  type?: string;
  timestamp?: number;
  headers?: Record<string, unknown>;
  content_type?: string;
}

export interface QueueMessage {
  payload: string;
  payload_encoding: string;
  properties: MessageProperties;
  exchange: string;
  routing_key: string;
  message_count: number;
  redelivered: boolean;
}

export interface ExchangeInfo {
  name: string;
  type: string;
  durable: boolean;
  vhost: string;
}

export interface BindingInfo {
  source: string;
  destination: string;
  destination_type: string;
  routing_key: string;
  vhost: string;
}

export interface PublishMessageBody {
  routing_key: string;
  payload: string;
  payload_encoding: string;
  properties: Record<string, unknown>;
}

export interface PublishResponse {
  routed: boolean;
}

export interface PurgeResponse {
  message_count: number;
}
