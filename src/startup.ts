import type { HealthCheckResponse } from "./rabbitmq/types.js";

export interface NodeVersionCheck {
  ok: boolean;
  current: number;
  required: number;
}

export interface SchemaLoadResult {
  count: number;
  warning: string | null;
}

export interface RabbitMQConnectivityResult {
  reachable: boolean;
  status: string | null;
  message: string;
}

export function checkNodeVersion(
  currentVersion: string,
  requiredMajor: number = 22,
): NodeVersionCheck {
  const version = currentVersion.startsWith("v")
    ? currentVersion.slice(1)
    : currentVersion;
  const current = parseInt(version.split(".")[0] ?? "0", 10);
  return { ok: current >= requiredMajor, current, required: requiredMajor };
}

export function checkSchemaCount(count: number): SchemaLoadResult {
  return {
    count,
    warning:
      count === 0
        ? "No schemas loaded — schema validation tools will have no schemas to validate against"
        : null,
  };
}

export async function checkRabbitMQConnectivity(
  healthCheckFn: () => Promise<HealthCheckResponse>,
  timeoutMs: number = 3000,
): Promise<RabbitMQConnectivityResult> {
  try {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Health check timed out")), timeoutMs);
    });
    const result = await Promise.race([healthCheckFn(), timeout]);

    if (result.status === "ok") {
      return { reachable: true, status: "ok", message: "RabbitMQ is healthy" };
    }
    return {
      reachable: true,
      status: result.status,
      message: `RabbitMQ is unhealthy: ${result.reason ?? result.status}`,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    return { reachable: false, status: null, message };
  }
}
