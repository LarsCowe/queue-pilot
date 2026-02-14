import { describe, it, expect, vi } from "vitest";
import type { BrokerAdapter } from "../broker/types.js";
import { listQueues } from "./list-queues.js";

describe("listQueues", () => {
  it("returns queue list from broker adapter", async () => {
    const adapter = {
      listQueues: vi.fn().mockResolvedValue([
        {
          name: "orders",
          messages_ready: 10,
          messages_unacknowledged: 3,
          state: "running",
          metadata: {},
        },
        {
          name: "notifications",
          messages_ready: 0,
          messages_unacknowledged: 0,
          state: "running",
          metadata: {},
        },
      ]),
    } as unknown as BrokerAdapter;

    const result = await listQueues(adapter, "/");

    expect(result.queues).toHaveLength(2);
    expect(result.queues[0].name).toBe("orders");
    expect(result.queues[0].messages_ready).toBe(10);
    expect(adapter.listQueues).toHaveBeenCalledWith("/");
  });

  it("returns empty list when no queues exist", async () => {
    const adapter = {
      listQueues: vi.fn().mockResolvedValue([]),
    } as unknown as BrokerAdapter;

    const result = await listQueues(adapter, "/");

    expect(result.queues).toEqual([]);
  });

  it("coerces null message counts to zero for clustered setups", async () => {
    const adapter = {
      listQueues: vi.fn().mockResolvedValue([
        {
          name: "cluster-queue",
          messages_ready: null,
          messages_unacknowledged: null,
          state: "running",
          metadata: {},
        },
      ]),
    } as unknown as BrokerAdapter;

    const result = await listQueues(adapter, "/");

    expect(result.queues[0].messages_ready).toBe(0);
    expect(result.queues[0].messages_unacknowledged).toBe(0);
  });

  it("propagates errors from the broker adapter", async () => {
    const adapter = {
      listQueues: vi.fn().mockRejectedValue(new Error("Connection refused")),
    } as unknown as BrokerAdapter;

    await expect(listQueues(adapter, "/")).rejects.toThrow("Connection refused");
  });
});
