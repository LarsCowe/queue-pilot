import { describe, it, expect, vi } from "vitest";
import {
  registerSchemaTools,
  registerUniversalTools,
  registerCapabilityTools,
  registerBrokerTools,
} from "./registry.js";
import type {
  BrokerAdapter,
  OverviewCapability,
  ConsumerCapability,
  ConnectionCapability,
} from "./types.js";
import type { SchemaValidator } from "../schemas/validator.js";
import type { ToolDefinition } from "./tool-definition.js";

function createMockServer() {
  return { tool: vi.fn() };
}

function createMockValidator(): SchemaValidator {
  return {} as unknown as SchemaValidator;
}

function createMockAdapter(): BrokerAdapter {
  return {
    listQueues: vi.fn(),
    getQueue: vi.fn(),
    createQueue: vi.fn(),
    deleteQueue: vi.fn(),
    purgeQueue: vi.fn(),
    peekMessages: vi.fn(),
    publishMessage: vi.fn(),
    checkHealth: vi.fn(),
  };
}

describe("registerSchemaTools", () => {
  it("registers 3 schema tools", () => {
    const server = createMockServer();
    registerSchemaTools(server as never, createMockValidator());

    expect(server.tool).toHaveBeenCalledTimes(3);
    const names = server.tool.mock.calls.map((c: unknown[]) => c[0]);
    expect(names).toContain("list_schemas");
    expect(names).toContain("get_schema");
    expect(names).toContain("validate_message");
  });
});

describe("registerUniversalTools", () => {
  it("registers 9 universal tools", () => {
    const server = createMockServer();
    registerUniversalTools(server as never, createMockAdapter(), createMockValidator());

    expect(server.tool).toHaveBeenCalledTimes(9);
    const names = server.tool.mock.calls.map((c: unknown[]) => c[0]);
    expect(names).toEqual([
      "list_queues",
      "get_queue",
      "create_queue",
      "delete_queue",
      "purge_queue",
      "peek_messages",
      "inspect_queue",
      "publish_message",
      "check_health",
    ]);
  });
});

describe("registerCapabilityTools", () => {
  it("registers all 3 capability tools when adapter has all capabilities", () => {
    const server = createMockServer();
    const adapter: BrokerAdapter & OverviewCapability & ConsumerCapability & ConnectionCapability = {
      ...createMockAdapter(),
      getOverview: vi.fn(),
      listConsumers: vi.fn(),
      listConnections: vi.fn(),
    };

    registerCapabilityTools(server as never, adapter);

    expect(server.tool).toHaveBeenCalledTimes(3);
    const names = server.tool.mock.calls.map((c: unknown[]) => c[0]);
    expect(names).toContain("get_overview");
    expect(names).toContain("list_consumers");
    expect(names).toContain("list_connections");
  });

  it("registers no tools when adapter has no capabilities", () => {
    const server = createMockServer();
    registerCapabilityTools(server as never, createMockAdapter());

    expect(server.tool).not.toHaveBeenCalled();
  });

  it("registers only overview when that is the sole capability", () => {
    const server = createMockServer();
    const adapter: BrokerAdapter & OverviewCapability = {
      ...createMockAdapter(),
      getOverview: vi.fn(),
    };

    registerCapabilityTools(server as never, adapter);

    expect(server.tool).toHaveBeenCalledTimes(1);
    expect(server.tool.mock.calls[0][0]).toBe("get_overview");
  });
});

describe("registerBrokerTools", () => {
  it("registers tools from ToolDefinition array", () => {
    const server = createMockServer();
    const tools: ToolDefinition[] = [
      { name: "list_exchanges", description: "List exchanges", parameters: {}, handler: vi.fn() },
      { name: "create_exchange", description: "Create exchange", parameters: {}, handler: vi.fn() },
    ];

    registerBrokerTools(server as never, tools);

    expect(server.tool).toHaveBeenCalledTimes(2);
    const names = server.tool.mock.calls.map((c: unknown[]) => c[0]);
    expect(names).toEqual(["list_exchanges", "create_exchange"]);
  });

  it("registers no tools for empty array", () => {
    const server = createMockServer();
    registerBrokerTools(server as never, []);

    expect(server.tool).not.toHaveBeenCalled();
  });
});
