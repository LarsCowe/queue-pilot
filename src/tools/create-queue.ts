import type { BrokerAdapter } from "../broker/types.js";

export interface CreateQueueParams {
  queue: string;
  durable: boolean;
  auto_delete: boolean;
  vhost: string;
}

export interface CreateQueueResult {
  queue: string;
  durable: boolean;
  auto_delete: boolean;
  vhost: string;
}

export async function createQueue(
  adapter: BrokerAdapter,
  params: CreateQueueParams,
): Promise<CreateQueueResult> {
  await adapter.createQueue({
    name: params.queue,
    durable: params.durable,
    auto_delete: params.auto_delete,
    scope: params.vhost,
  });

  return {
    queue: params.queue,
    durable: params.durable,
    auto_delete: params.auto_delete,
    vhost: params.vhost,
  };
}
