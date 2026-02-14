import { describe, it, expect, vi } from "vitest";
import type { BrokerAdapter } from "../broker/types.js";
import { checkHealth } from "./check-health.js";

describe("checkHealth", () => {
  it("returns ok status when broker is healthy", async () => {
    const adapter = {
      checkHealth: vi.fn().mockResolvedValue({ status: "ok" }),
    } as unknown as BrokerAdapter;

    const result = await checkHealth(adapter);

    expect(result).toEqual({ status: "ok" });
    expect(adapter.checkHealth).toHaveBeenCalledOnce();
  });

  it("returns failed status with reason when broker is unhealthy", async () => {
    const adapter = {
      checkHealth: vi.fn().mockResolvedValue({
        status: "failed",
        reason: "There are alarms in effect in the cluster",
      }),
    } as unknown as BrokerAdapter;

    const result = await checkHealth(adapter);

    expect(result).toEqual({
      status: "failed",
      reason: "There are alarms in effect in the cluster",
    });
  });

  it("omits reason field when not present", async () => {
    const adapter = {
      checkHealth: vi.fn().mockResolvedValue({ status: "ok" }),
    } as unknown as BrokerAdapter;

    const result = await checkHealth(adapter);

    expect(result).not.toHaveProperty("reason");
  });

  it("propagates network errors", async () => {
    const adapter = {
      checkHealth: vi
        .fn()
        .mockRejectedValue(new Error("ECONNREFUSED")),
    } as unknown as BrokerAdapter;

    await expect(checkHealth(adapter)).rejects.toThrow("ECONNREFUSED");
  });
});
