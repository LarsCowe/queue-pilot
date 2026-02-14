export interface BrokerQueueInfo {
  name: string;
  messages_ready: number | null;
  messages_unacknowledged: number | null;
  state: string;
  metadata: Record<string, unknown>;
}

export interface BrokerMessage {
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
  metadata: Record<string, unknown>;
}

export interface BrokerHealthResult {
  status: string;
  reason?: string;
}

export interface CreateQueueParams {
  name: string;
  durable?: boolean;
  auto_delete?: boolean;
  scope?: string;
}

export interface CreateQueueResult {
  name: string;
  created: boolean;
}

export interface PurgeResult {
  messagesRemoved: number;
}

export interface PublishParams {
  destination: string;
  routing_key: string;
  payload: string;
  properties?: Record<string, unknown>;
  scope?: string;
}

export interface PublishResult {
  published: boolean;
  routed: boolean;
}

export interface BrokerAdapter {
  listQueues(scope?: string): Promise<BrokerQueueInfo[]>;
  getQueue(name: string, scope?: string): Promise<BrokerQueueInfo>;
  createQueue(params: CreateQueueParams): Promise<CreateQueueResult>;
  deleteQueue(name: string, scope?: string): Promise<void>;
  purgeQueue(name: string, scope?: string): Promise<PurgeResult>;
  peekMessages(queue: string, count: number, scope?: string): Promise<BrokerMessage[]>;
  publishMessage(params: PublishParams): Promise<PublishResult>;
  checkHealth(): Promise<BrokerHealthResult>;
}

export interface OverviewCapability {
  getOverview(): Promise<Record<string, unknown>>;
}

export interface ConsumerCapability {
  listConsumers(scope?: string): Promise<Record<string, unknown>[]>;
}

export interface ConnectionCapability {
  listConnections(): Promise<Record<string, unknown>[]>;
}

export function hasOverview(adapter: BrokerAdapter): adapter is BrokerAdapter & OverviewCapability {
  return typeof (adapter as BrokerAdapter & OverviewCapability).getOverview === "function";
}

export function hasConsumers(adapter: BrokerAdapter): adapter is BrokerAdapter & ConsumerCapability {
  return typeof (adapter as BrokerAdapter & ConsumerCapability).listConsumers === "function";
}

export function hasConnections(adapter: BrokerAdapter): adapter is BrokerAdapter & ConnectionCapability {
  return typeof (adapter as BrokerAdapter & ConnectionCapability).listConnections === "function";
}
