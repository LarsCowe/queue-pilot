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
  properties_key: string;
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

export interface OverviewResponse {
  cluster_name: string;
  rabbitmq_version: string;
  erlang_version: string;
  message_stats: {
    publish: number;
    deliver: number;
  };
  queue_totals: {
    messages: number;
    messages_ready: number;
    messages_unacknowledged: number;
  };
  object_totals: {
    queues: number;
    exchanges: number;
    connections: number;
    consumers: number;
  };
  node: string;
}

export interface HealthCheckResponse {
  status: string;
  reason?: string;
}

export interface QueueDetail extends QueueInfo {
  consumers: number;
  consumer_utilisation: number | null;
  memory: number;
  message_stats: {
    publish: number;
    deliver: number;
  } | null;
  policy: string | null;
  arguments: Record<string, unknown>;
  node: string;
}

export interface ConsumerInfo {
  queue: { name: string };
  consumer_tag: string;
  channel_details: { connection_name: string };
  ack_required: boolean;
  prefetch_count: number;
}

export interface ConnectionInfo {
  name: string;
  user: string;
  state: string;
  channels: number;
  connected_at: number;
  client_properties: { connection_name?: string };
  peer_host: string;
  peer_port: number;
}
