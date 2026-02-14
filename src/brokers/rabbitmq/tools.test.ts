import { describe, it, expect, vi } from "vitest";
import { createRabbitMQTools } from "./tools.js";
import type { RabbitMQAdapter } from "./adapter.js";
import type { RabbitMQClient } from "../../rabbitmq/client.js";
import type { ToolDefinition } from "../../broker/tool-definition.js";

function mockClient(
  overrides: Partial<Record<keyof RabbitMQClient, unknown>> = {},
): RabbitMQClient {
  return {
    listExchanges: vi.fn().mockResolvedValue([]),
    createExchange: vi.fn().mockResolvedValue(undefined),
    deleteExchange: vi.fn().mockResolvedValue(undefined),
    listBindings: vi.fn().mockResolvedValue([]),
    createBinding: vi.fn().mockResolvedValue(undefined),
    deleteBinding: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as RabbitMQClient;
}

function mockAdapter(client: RabbitMQClient): RabbitMQAdapter {
  return { getClient: () => client } as unknown as RabbitMQAdapter;
}

function findTool(tools: ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

describe("createRabbitMQTools", () => {
  it("returns 6 tool definitions", () => {
    const tools = createRabbitMQTools(mockAdapter(mockClient()));

    expect(tools).toHaveLength(6);
  });

  it("returns tools with expected names", () => {
    const tools = createRabbitMQTools(mockAdapter(mockClient()));
    const names = tools.map((t) => t.name);

    expect(names).toContain("list_exchanges");
    expect(names).toContain("create_exchange");
    expect(names).toContain("delete_exchange");
    expect(names).toContain("list_bindings");
    expect(names).toContain("create_binding");
    expect(names).toContain("delete_binding");
  });

  describe("list_exchanges", () => {
    it("calls client.listExchanges and maps result", async () => {
      const client = mockClient({
        listExchanges: vi.fn().mockResolvedValue([
          { name: "events", type: "topic", durable: true, vhost: "/" },
          { name: "amq.direct", type: "direct", durable: true, vhost: "/" },
        ]),
      });
      const tool = findTool(createRabbitMQTools(mockAdapter(client)), "list_exchanges");

      const result = await tool.handler({ vhost: "/" });

      expect(client.listExchanges).toHaveBeenCalledWith("/");
      expect(result).toEqual({
        exchanges: [
          { name: "events", type: "topic", durable: true },
          { name: "amq.direct", type: "direct", durable: true },
        ],
      });
    });

    it("uses default vhost / when not provided", async () => {
      const client = mockClient();
      const tool = findTool(createRabbitMQTools(mockAdapter(client)), "list_exchanges");

      await tool.handler({});

      expect(client.listExchanges).toHaveBeenCalledWith("/");
    });
  });

  describe("create_exchange", () => {
    it("calls client.createExchange with all parameters", async () => {
      const client = mockClient();
      const tool = findTool(createRabbitMQTools(mockAdapter(client)), "create_exchange");

      const result = await tool.handler({
        exchange: "notifications",
        type: "fanout",
        durable: true,
        auto_delete: false,
        vhost: "/",
      });

      expect(client.createExchange).toHaveBeenCalledWith("/", "notifications", {
        type: "fanout",
        durable: true,
        auto_delete: false,
      });
      expect(result).toEqual({
        exchange: "notifications",
        type: "fanout",
        durable: true,
        auto_delete: false,
        vhost: "/",
      });
    });

    it("uses defaults for optional parameters", async () => {
      const client = mockClient();
      const tool = findTool(createRabbitMQTools(mockAdapter(client)), "create_exchange");

      const result = await tool.handler({ exchange: "my-exchange" });

      expect(client.createExchange).toHaveBeenCalledWith("/", "my-exchange", {
        type: "direct",
        durable: false,
        auto_delete: false,
      });
      expect(result).toEqual({
        exchange: "my-exchange",
        type: "direct",
        durable: false,
        auto_delete: false,
        vhost: "/",
      });
    });
  });

  describe("delete_exchange", () => {
    it("calls client.deleteExchange and returns confirmation", async () => {
      const client = mockClient();
      const tool = findTool(createRabbitMQTools(mockAdapter(client)), "delete_exchange");

      const result = await tool.handler({ exchange: "old-exchange", vhost: "/" });

      expect(client.deleteExchange).toHaveBeenCalledWith("/", "old-exchange");
      expect(result).toEqual({
        exchange: "old-exchange",
        vhost: "/",
        deleted: true,
      });
    });

    it("uses default vhost / when not provided", async () => {
      const client = mockClient();
      const tool = findTool(createRabbitMQTools(mockAdapter(client)), "delete_exchange");

      await tool.handler({ exchange: "stale-exchange" });

      expect(client.deleteExchange).toHaveBeenCalledWith("/", "stale-exchange");
    });
  });

  describe("list_bindings", () => {
    it("calls client.listBindings and maps result", async () => {
      const client = mockClient({
        listBindings: vi.fn().mockResolvedValue([
          {
            source: "events",
            destination: "orders",
            destination_type: "queue",
            routing_key: "order.created",
            properties_key: "order.created",
          },
        ]),
      });
      const tool = findTool(createRabbitMQTools(mockAdapter(client)), "list_bindings");

      const result = await tool.handler({ vhost: "/" });

      expect(client.listBindings).toHaveBeenCalledWith("/");
      expect(result).toEqual({
        bindings: [
          {
            source: "events",
            destination: "orders",
            destination_type: "queue",
            routing_key: "order.created",
            properties_key: "order.created",
          },
        ],
      });
    });

    it("uses default vhost / when not provided", async () => {
      const client = mockClient();
      const tool = findTool(createRabbitMQTools(mockAdapter(client)), "list_bindings");

      await tool.handler({});

      expect(client.listBindings).toHaveBeenCalledWith("/");
    });
  });

  describe("create_binding", () => {
    it("calls client.createBinding with all parameters", async () => {
      const client = mockClient();
      const tool = findTool(createRabbitMQTools(mockAdapter(client)), "create_binding");

      const result = await tool.handler({
        exchange: "events",
        queue: "orders",
        routing_key: "order.created",
        vhost: "/",
      });

      expect(client.createBinding).toHaveBeenCalledWith("/", "events", "orders", "order.created");
      expect(result).toEqual({
        exchange: "events",
        queue: "orders",
        routing_key: "order.created",
        vhost: "/",
      });
    });

    it("uses defaults for optional parameters", async () => {
      const client = mockClient();
      const tool = findTool(createRabbitMQTools(mockAdapter(client)), "create_binding");

      const result = await tool.handler({ exchange: "events", queue: "orders" });

      expect(client.createBinding).toHaveBeenCalledWith("/", "events", "orders", "");
      expect(result).toEqual({
        exchange: "events",
        queue: "orders",
        routing_key: "",
        vhost: "/",
      });
    });
  });

  describe("delete_binding", () => {
    it("calls client.deleteBinding and returns confirmation", async () => {
      const client = mockClient();
      const tool = findTool(createRabbitMQTools(mockAdapter(client)), "delete_binding");

      const result = await tool.handler({
        exchange: "events",
        queue: "orders",
        properties_key: "order.created",
        vhost: "/",
      });

      expect(client.deleteBinding).toHaveBeenCalledWith("/", "events", "orders", "order.created");
      expect(result).toEqual({
        exchange: "events",
        queue: "orders",
        properties_key: "order.created",
        vhost: "/",
        deleted: true,
      });
    });

    it("uses defaults for optional parameters", async () => {
      const client = mockClient();
      const tool = findTool(createRabbitMQTools(mockAdapter(client)), "delete_binding");

      const result = await tool.handler({ exchange: "events", queue: "orders" });

      expect(client.deleteBinding).toHaveBeenCalledWith("/", "events", "orders", "~");
      expect(result).toEqual({
        exchange: "events",
        queue: "orders",
        properties_key: "~",
        vhost: "/",
        deleted: true,
      });
    });
  });
});
