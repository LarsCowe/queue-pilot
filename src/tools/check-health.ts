import type { RabbitMQClient } from "../rabbitmq/client.js";

export interface CheckHealthResult {
  status: string;
  reason?: string;
}

export async function checkHealth(
  client: RabbitMQClient,
): Promise<CheckHealthResult> {
  const health = await client.checkHealth();

  const result: CheckHealthResult = { status: health.status };
  if (health.reason) {
    result.reason = health.reason;
  }
  return result;
}
