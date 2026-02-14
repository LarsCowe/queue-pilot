import type { OverviewCapability } from "../broker/types.js";

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
  adapter: OverviewCapability,
): Promise<GetOverviewResult> {
  const overview = await adapter.getOverview();

  return {
    cluster_name: overview.cluster_name as string,
    rabbitmq_version: overview.rabbitmq_version as string,
    erlang_version: overview.erlang_version as string,
    message_stats: overview.message_stats as { publish: number; deliver: number },
    queue_totals: overview.queue_totals as { messages: number; messages_ready: number; messages_unacknowledged: number },
    object_totals: overview.object_totals as { queues: number; exchanges: number; connections: number; consumers: number },
    node: overview.node as string,
  };
}
