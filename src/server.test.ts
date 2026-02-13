import { createRequire } from "module";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.js";
import { orderSchema } from "./test-fixtures.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

async function createTestClient(): Promise<Client> {
  const server = createServer({
    schemas: [orderSchema],
    rabbitmqUrl: "http://localhost:15672",
    rabbitmqUser: "guest",
    rabbitmqPass: "guest",
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "test-client", version: "1.0.0" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return client;
}

describe("MCP Server", () => {
  it("reports the version from package.json", async () => {
    const client = await createTestClient();
    const serverVersion = client.getServerVersion();

    expect(serverVersion).toEqual({
      name: "queue-pilot",
      version: pkg.version,
    });
  });

  it("registers all expected tools", async () => {
    const client = await createTestClient();
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name).sort();

    expect(toolNames).toEqual([
      "create_binding",
      "create_queue",
      "get_schema",
      "inspect_queue",
      "list_bindings",
      "list_exchanges",
      "list_queues",
      "list_schemas",
      "peek_messages",
      "publish_message",
      "purge_queue",
      "validate_message",
    ]);
  });

  it("executes list_schemas tool", async () => {
    const client = await createTestClient();
    const result = await client.callTool({ name: "list_schemas", arguments: {} });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.schemas).toHaveLength(1);
    expect(parsed.schemas[0].name).toBe("order.created");
  });

  it("executes get_schema tool", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "get_schema",
      arguments: { name: "order.created" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.found).toBe(true);
    expect(parsed.name).toBe("order.created");
  });

  it("executes validate_message tool with valid message", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "validate_message",
      arguments: {
        schemaName: "order.created",
        message: JSON.stringify({ orderId: "ORD-001", amount: 49.99 }),
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.valid).toBe(true);
  });

  it("executes validate_message tool with invalid message", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "validate_message",
      arguments: {
        schemaName: "order.created",
        message: JSON.stringify({}),
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.valid).toBe(false);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it("does not set isError for get_schema with unknown name", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "get_schema",
      arguments: { name: "nonexistent.schema" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.found).toBe(false);
  });

  it("does not set isError for validate_message with unknown schema", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "validate_message",
      arguments: {
        schemaName: "nonexistent.schema",
        message: JSON.stringify({ data: "test" }),
      },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.valid).toBe(false);
  });

  it("does not set isError for validate_message with invalid message", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "validate_message",
      arguments: {
        schemaName: "order.created",
        message: JSON.stringify({}),
      },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.valid).toBe(false);
  });

  describe("wiring (success)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("list_queues returns queue array on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([
          { name: "orders", messages_ready: 5, messages_unacknowledged: 1, state: "running", vhost: "/" },
        ]), { status: 200 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "list_queues",
        arguments: { vhost: "/" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.queues).toEqual([
        { name: "orders", messages_ready: 5, messages_unacknowledged: 1, state: "running" },
      ]);
    });

    it("peek_messages returns messages on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([
          {
            payload: '{"orderId":"ORD-001","amount":49.99}',
            payload_encoding: "string",
            properties: { content_type: "application/json", type: "order.created" },
            exchange: "amq.default",
            routing_key: "orders",
            message_count: 3,
            redelivered: false,
          },
        ]), { status: 200 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "peek_messages",
        arguments: { queue: "orders", count: 1, vhost: "/" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.messages[0].payload).toBe('{"orderId":"ORD-001","amount":49.99}');
      expect(parsed.messages[0].exchange).toBe("amq.default");
    });

    it("inspect_queue returns inspected messages on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([
          {
            payload: '{"orderId":"ORD-002","amount":25.00}',
            payload_encoding: "string",
            properties: { content_type: "application/json", type: "order.created" },
            exchange: "amq.default",
            routing_key: "orders",
            message_count: 1,
            redelivered: false,
          },
        ]), { status: 200 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "inspect_queue",
        arguments: { queue: "orders", count: 1, vhost: "/" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.queue).toBe("orders");
      expect(parsed.summary.total).toBe(1);
      expect(parsed.summary.valid).toBe(1);
    });

    it("publish_message returns publish result on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ routed: true }), { status: 200 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "publish_message",
        arguments: {
          exchange: "amq.default",
          routing_key: "orders",
          payload: JSON.stringify({ orderId: "ORD-999", amount: 10 }),
          validate: false,
        },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.published).toBe(true);
      expect(parsed.routed).toBe(true);
      expect(parsed.exchange).toBe("amq.default");
      expect(parsed.routing_key).toBe("orders");
    });

    it("purge_queue returns purge count on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ message_count: 7 }), { status: 200 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "purge_queue",
        arguments: { queue: "orders" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.queue).toBe("orders");
      expect(parsed.messages_purged).toBe(7);
    });

    it("create_queue returns queue details on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 204 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "create_queue",
        arguments: { queue: "new-queue" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.queue).toBe("new-queue");
      expect(parsed.durable).toBe(false);
      expect(parsed.auto_delete).toBe(false);
    });

    it("create_binding returns binding details on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 201 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "create_binding",
        arguments: { exchange: "amq.topic", queue: "orders" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.exchange).toBe("amq.topic");
      expect(parsed.queue).toBe("orders");
    });
  });

  describe("wiring (error)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("list_queues propagates fetch errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
      const client = await createTestClient();
      const result = await client.callTool({
        name: "list_queues",
        arguments: { vhost: "/" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("fetch failed");
    });

    it("peek_messages propagates fetch errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
      const client = await createTestClient();
      const result = await client.callTool({
        name: "peek_messages",
        arguments: { queue: "orders", count: 1, vhost: "/" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("fetch failed");
    });

    it("inspect_queue propagates fetch errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
      const client = await createTestClient();
      const result = await client.callTool({
        name: "inspect_queue",
        arguments: { queue: "orders", count: 1, vhost: "/" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("fetch failed");
    });

    it("publish_message propagates API errors", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Not Found", { status: 404, statusText: "Not Found" }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "publish_message",
        arguments: {
          exchange: "amq.default",
          routing_key: "orders",
          payload: JSON.stringify({ orderId: "ORD-999", amount: 10 }),
          validate: false,
        },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("RabbitMQ API error");
    });

    it("purge_queue propagates fetch errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
      const client = await createTestClient();
      const result = await client.callTool({
        name: "purge_queue",
        arguments: { queue: "orders" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("fetch failed");
    });

    it("create_queue propagates API errors", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Precondition Failed", { status: 412, statusText: "Precondition Failed" }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "create_queue",
        arguments: { queue: "existing-queue" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("RabbitMQ API error");
    });

    it("create_binding propagates fetch errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
      const client = await createTestClient();
      const result = await client.callTool({
        name: "create_binding",
        arguments: { exchange: "amq.topic", queue: "orders" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("fetch failed");
    });
  });
});
