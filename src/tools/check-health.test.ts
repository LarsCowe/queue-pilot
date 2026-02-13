import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { checkHealth } from "./check-health.js";

describe("checkHealth", () => {
  it("returns ok status when broker is healthy", async () => {
    const client = {
      checkHealth: vi.fn().mockResolvedValue({ status: "ok" }),
    } as unknown as RabbitMQClient;

    const result = await checkHealth(client);

    expect(result).toEqual({ status: "ok" });
    expect(client.checkHealth).toHaveBeenCalledOnce();
  });

  it("returns failed status with reason when broker is unhealthy", async () => {
    const client = {
      checkHealth: vi.fn().mockResolvedValue({
        status: "failed",
        reason: "There are alarms in effect in the cluster",
      }),
    } as unknown as RabbitMQClient;

    const result = await checkHealth(client);

    expect(result).toEqual({
      status: "failed",
      reason: "There are alarms in effect in the cluster",
    });
  });

  it("omits reason field when not present", async () => {
    const client = {
      checkHealth: vi.fn().mockResolvedValue({ status: "ok" }),
    } as unknown as RabbitMQClient;

    const result = await checkHealth(client);

    expect(result).not.toHaveProperty("reason");
  });

  it("propagates network errors", async () => {
    const client = {
      checkHealth: vi
        .fn()
        .mockRejectedValue(new Error("ECONNREFUSED")),
    } as unknown as RabbitMQClient;

    await expect(checkHealth(client)).rejects.toThrow("ECONNREFUSED");
  });
});
