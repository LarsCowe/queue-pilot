import type { BrokerAdapter } from "../broker/types.js";

export interface CheckHealthResult {
  status: string;
  reason?: string;
}

export async function checkHealth(
  adapter: BrokerAdapter,
): Promise<CheckHealthResult> {
  const health = await adapter.checkHealth();

  const result: CheckHealthResult = { status: health.status };
  if (health.reason) {
    result.reason = health.reason;
  }
  return result;
}
