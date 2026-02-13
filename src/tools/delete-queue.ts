import type { RabbitMQClient } from "../rabbitmq/client.js";

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
  client: RabbitMQClient,
  params: DeleteQueueParams,
): Promise<DeleteQueueResult> {
  await client.deleteQueue(params.vhost, params.queue);

  return {
    queue: params.queue,
    vhost: params.vhost,
    deleted: true,
  };
}
