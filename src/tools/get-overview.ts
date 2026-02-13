import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface GetOverviewResult {
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

export async function getOverview(
  client: RabbitMQClient,
): Promise<GetOverviewResult> {
  const overview = await client.getOverview();

  return {
    cluster_name: overview.cluster_name,
    rabbitmq_version: overview.rabbitmq_version,
    erlang_version: overview.erlang_version,
    message_stats: overview.message_stats,
    queue_totals: overview.queue_totals,
    object_totals: overview.object_totals,
    node: overview.node,
  };
}
