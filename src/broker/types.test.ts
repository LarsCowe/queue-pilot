import { describe, it, expect } from "vitest";
import {
  hasOverview,
  hasConsumers,
  hasConnections,
} from "./types.js";
import type {
  BrokerAdapter,
  OverviewCapability,
  ConsumerCapability,
  ConnectionCapability,
} from "./types.js";

function createBaseAdapter(): BrokerAdapter {
  return {
    listQueues: async () => [],
    getQueue: async () => ({
      name: "test",
      messages_ready: 0,
      messages_unacknowledged: 0,
      state: "running",
      metadata: {},
    }),
    createQueue: async () => ({ name: "test", created: true }),
    deleteQueue: async () => {},
    purgeQueue: async () => ({ messagesRemoved: 0 }),
    peekMessages: async () => [],
    publishMessage: async () => ({ published: true, routed: true }),
    checkHealth: async () => ({ status: "ok" }),
    disconnect: async () => {},
  };
}

describe("hasOverview", () => {
  it("returns false for a base adapter without getOverview", () => {
    const adapter = createBaseAdapter();
    expect(hasOverview(adapter)).toBe(false);
  });

  it("returns true when adapter implements getOverview", () => {
    const adapter: BrokerAdapter & OverviewCapability = {
      ...createBaseAdapter(),
      getOverview: async () => ({}),
    };
    expect(hasOverview(adapter)).toBe(true);
  });
});

describe("hasConsumers", () => {
  it("returns false for a base adapter without listConsumers", () => {
    const adapter = createBaseAdapter();
    expect(hasConsumers(adapter)).toBe(false);
  });

  it("returns true when adapter implements listConsumers", () => {
    const adapter: BrokerAdapter & ConsumerCapability = {
      ...createBaseAdapter(),
      listConsumers: async () => [],
    };
    expect(hasConsumers(adapter)).toBe(true);
  });
});

describe("hasConnections", () => {
  it("returns false for a base adapter without listConnections", () => {
    const adapter = createBaseAdapter();
    expect(hasConnections(adapter)).toBe(false);
  });

  it("returns true when adapter implements listConnections", () => {
    const adapter: BrokerAdapter & ConnectionCapability = {
      ...createBaseAdapter(),
      listConnections: async () => [],
    };
    expect(hasConnections(adapter)).toBe(true);
  });
});
