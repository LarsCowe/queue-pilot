import type { BrokerAdapter } from "../broker/types.js";

export interface DeleteQueueParams {
  queue: string;
  vhost: string;
}

export interface DeleteQueueResult {
  queue: string;
  vhost: string;
  deleted: true;
}

export async function deleteQueue(
  adapter: BrokerAdapter,
  params: DeleteQueueParams,
): Promise<DeleteQueueResult> {
  await adapter.deleteQueue(params.queue, params.vhost);

  return {
    queue: params.queue,
    vhost: params.vhost,
    deleted: true,
  };
}
