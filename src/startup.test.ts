import { describe, it, expect } from "vitest";
import {
  checkNodeVersion,
  checkSchemaCount,
  checkBrokerConnectivity,
} from "./startup.js";
import type { BrokerHealthResult } from "./broker/types.js";

describe("checkNodeVersion", () => {
  it("returns ok for v22", () => {
    const result = checkNodeVersion("v22.1.0");
    expect(result).toEqual({ ok: true, current: 22, required: 22 });
  });

  it("returns ok for v23", () => {
    const result = checkNodeVersion("v23.0.0");
    expect(result).toEqual({ ok: true, current: 23, required: 22 });
  });

  it("returns not ok for v20", () => {
    const result = checkNodeVersion("v20.11.0");
    expect(result).toEqual({ ok: false, current: 20, required: 22 });
  });

  it("returns not ok for v18", () => {
    const result = checkNodeVersion("v18.19.0");
    expect(result).toEqual({ ok: false, current: 18, required: 22 });
  });

  it("handles missing v prefix", () => {
    const result = checkNodeVersion("22.1.0");
    expect(result).toEqual({ ok: true, current: 22, required: 22 });
  });

  it("uses custom required major version", () => {
    const result = checkNodeVersion("v20.0.0", 20);
    expect(result).toEqual({ ok: true, current: 20, required: 20 });
  });
});

describe("checkSchemaCount", () => {
  it("returns warning when count is 0", () => {
    const result = checkSchemaCount(0);
    expect(result.count).toBe(0);
    expect(result.warning).toEqual(expect.any(String));
  });

  it("returns null warning when count is greater than 0", () => {
    const result = checkSchemaCount(3);
    expect(result).toEqual({ count: 3, warning: null });
  });
});

describe("checkBrokerConnectivity", () => {
  it("returns reachable when health check succeeds", async () => {
    const healthFn = async (): Promise<BrokerHealthResult> => ({
      status: "ok",
    });
    const result = await checkBrokerConnectivity(healthFn);
    expect(result.reachable).toBe(true);
    expect(result.status).toBe("ok");
    expect(result.message).toEqual(expect.any(String));
  });

  it("returns unhealthy when status is not ok", async () => {
    const healthFn = async (): Promise<BrokerHealthResult> => ({
      status: "failed",
      reason: "disk alarm",
    });
    const result = await checkBrokerConnectivity(healthFn);
    expect(result.reachable).toBe(true);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("disk alarm");
  });

  it("returns unreachable on network error", async () => {
    const healthFn = async (): Promise<BrokerHealthResult> => {
      throw new Error("ECONNREFUSED");
    };
    const result = await checkBrokerConnectivity(healthFn);
    expect(result.reachable).toBe(false);
    expect(result.status).toBeNull();
    expect(result.message).toContain("ECONNREFUSED");
  });

  it("returns unreachable on timeout", async () => {
    const neverResolve = (): Promise<BrokerHealthResult> =>
      new Promise<never>(() => {});
    const result = await checkBrokerConnectivity(neverResolve, 50);
    expect(result.reachable).toBe(false);
    expect(result.status).toBeNull();
    expect(result.message).toContain("timed out");
  });
});
