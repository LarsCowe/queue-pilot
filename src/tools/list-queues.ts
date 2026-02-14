import type { BrokerAdapter } from "../broker/types.js";

export interface ListQueuesResult {
  queues: Array<{
    name: string;
    messages_ready: number;
    messages_unacknowledged: number;
    state: string;
  }>;
}

export async function listQueues(
  adapter: BrokerAdapter,
  scope: string,
): Promise<ListQueuesResult> {
  const queues = await adapter.listQueues(scope);

  return {
    queues: queues.map((q) => ({
      name: q.name,
      messages_ready: q.messages_ready ?? 0,
      messages_unacknowledged: q.messages_unacknowledged ?? 0,
      state: q.state,
    })),
  };
}
