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
      "check_health",
      "create_binding",
      "create_exchange",
      "create_queue",
      "delete_binding",
      "delete_exchange",
      "delete_queue",
      "get_overview",
      "get_queue",
      "get_schema",
      "inspect_queue",
      "list_bindings",
      "list_connections",
      "list_consumers",
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

    it("create_exchange returns exchange details on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 204 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "create_exchange",
        arguments: { exchange: "order-events", type: "topic", durable: true },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.exchange).toBe("order-events");
      expect(parsed.type).toBe("topic");
      expect(parsed.durable).toBe(true);
    });

    it("delete_queue confirms deletion on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 204 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "delete_queue",
        arguments: { queue: "old-queue" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.queue).toBe("old-queue");
      expect(parsed.deleted).toBe(true);
    });

    it("delete_exchange confirms deletion on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 204 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "delete_exchange",
        arguments: { exchange: "old-exchange" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.exchange).toBe("old-exchange");
      expect(parsed.deleted).toBe(true);
    });

    it("delete_binding confirms deletion on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 204 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "delete_binding",
        arguments: { exchange: "events", queue: "orders" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.exchange).toBe("events");
      expect(parsed.queue).toBe("orders");
      expect(parsed.deleted).toBe(true);
    });

    it("get_overview returns cluster information on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({
          cluster_name: "rabbit@localhost",
          rabbitmq_version: "3.13.2",
          erlang_version: "26.2.5",
          message_stats: { publish: 100, deliver: 90 },
          queue_totals: { messages: 10, messages_ready: 7, messages_unacknowledged: 3 },
          object_totals: { queues: 5, exchanges: 8, connections: 2, consumers: 3 },
          node: "rabbit@localhost",
        }), { status: 200 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "get_overview",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.cluster_name).toBe("rabbit@localhost");
      expect(parsed.rabbitmq_version).toBe("3.13.2");
      expect(parsed.object_totals.queues).toBe(5);
    });

    it("check_health returns status on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "check_health",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.status).toBe("ok");
    });

    it("get_queue returns detailed queue info on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({
          name: "order-events",
          vhost: "/",
          state: "running",
          messages_ready: 5,
          messages_unacknowledged: 2,
          consumers: 3,
          consumer_utilisation: 0.75,
          memory: 65536,
          message_stats: { publish: 200, deliver: 195 },
          policy: null,
          arguments: {},
          node: "rabbit@node-1",
        }), { status: 200 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "get_queue",
        arguments: { queue: "order-events" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.name).toBe("order-events");
      expect(parsed.consumers).toBe(3);
      expect(parsed.node).toBe("rabbit@node-1");
    });

    it("list_consumers returns consumer array on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([
          {
            queue: { name: "orders" },
            consumer_tag: "ctag-1",
            channel_details: { connection_name: "app:5672" },
            ack_required: true,
            prefetch_count: 10,
          },
        ]), { status: 200 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "list_consumers",
        arguments: { vhost: "/" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.consumers).toHaveLength(1);
      expect(parsed.consumers[0].queue).toBe("orders");
      expect(parsed.consumers[0].consumer_tag).toBe("ctag-1");
    });

    it("list_connections returns connection array on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([
          {
            name: "172.17.0.3:43210 -> 172.17.0.2:5672",
            user: "guest",
            state: "running",
            channels: 1,
            connected_at: 1700000000000,
            client_properties: { connection_name: "my-app" },
            peer_host: "172.17.0.3",
            peer_port: 43210,
          },
        ]), { status: 200 }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "list_connections",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.connections).toHaveLength(1);
      expect(parsed.connections[0].user).toBe("guest");
      expect(parsed.connections[0].connection_name).toBe("my-app");
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

    it("create_exchange propagates API errors", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Precondition Failed", { status: 412, statusText: "Precondition Failed" }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "create_exchange",
        arguments: { exchange: "existing-exchange" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("RabbitMQ API error");
    });

    it("delete_queue propagates fetch errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
      const client = await createTestClient();
      const result = await client.callTool({
        name: "delete_queue",
        arguments: { queue: "orders" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("fetch failed");
    });

    it("delete_exchange propagates fetch errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
      const client = await createTestClient();
      const result = await client.callTool({
        name: "delete_exchange",
        arguments: { exchange: "events" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("fetch failed");
    });

    it("delete_binding propagates fetch errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
      const client = await createTestClient();
      const result = await client.callTool({
        name: "delete_binding",
        arguments: { exchange: "events", queue: "orders" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("fetch failed");
    });

    it("get_overview propagates fetch errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
      const client = await createTestClient();
      const result = await client.callTool({
        name: "get_overview",
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("fetch failed");
    });

    it("check_health propagates fetch errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
      const client = await createTestClient();
      const result = await client.callTool({
        name: "check_health",
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("fetch failed");
    });

    it("get_queue propagates API errors", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Not Found", { status: 404, statusText: "Not Found" }),
      );
      const client = await createTestClient();
      const result = await client.callTool({
        name: "get_queue",
        arguments: { queue: "nonexistent" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("RabbitMQ API error");
    });

    it("list_consumers propagates fetch errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
      const client = await createTestClient();
      const result = await client.callTool({
        name: "list_consumers",
        arguments: { vhost: "/" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("fetch failed");
    });

    it("list_connections propagates fetch errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
      const client = await createTestClient();
      const result = await client.callTool({
        name: "list_connections",
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("fetch failed");
    });
  });

  describe("MCP Resources", () => {
    it("lists schema resources", async () => {
      const client = await createTestClient();
      const { resources } = await client.listResources();

      expect(resources).toHaveLength(1);
      expect(resources[0].name).toBe("order.created");
      expect(resources[0].uri).toBe("schema:///order.created");
    });

    it("reads a schema resource by URI", async () => {
      const client = await createTestClient();
      const { contents } = await client.readResource({
        uri: "schema:///order.created",
      });

      expect(contents).toHaveLength(1);
      expect(contents[0].uri).toBe("schema:///order.created");
      expect(contents[0].mimeType).toBe("application/schema+json");

      const schema = JSON.parse(contents[0].text as string);
      expect(schema.$id).toBe("order.created");
      expect(schema.required).toContain("orderId");
    });
  });

  describe("MCP Prompts", () => {
    it("lists all registered prompts", async () => {
      const client = await createTestClient();
      const { prompts } = await client.listPrompts();
      const promptNames = prompts.map((p) => p.name).sort();

      expect(promptNames).toEqual([
        "debug-flow",
        "health-report",
        "schema-compliance",
      ]);
    });

    it("gets debug-flow prompt with arguments", async () => {
      const client = await createTestClient();
      const result = await client.getPrompt({
        name: "debug-flow",
        arguments: { exchange: "events", queue: "orders" },
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      const text = (result.messages[0].content as { type: string; text: string }).text;
      expect(text).toContain("events");
      expect(text).toContain("orders");
      expect(text).toContain("list_bindings");
    });

    it("gets health-report prompt without arguments", async () => {
      const client = await createTestClient();
      const result = await client.getPrompt({
        name: "health-report",
      });

      expect(result.messages).toHaveLength(1);
      const text = (result.messages[0].content as { type: string; text: string }).text;
      expect(text).toContain("check_health");
      expect(text).toContain("get_overview");
    });

    it("gets schema-compliance prompt for a specific queue", async () => {
      const client = await createTestClient();
      const result = await client.getPrompt({
        name: "schema-compliance",
        arguments: { queue: "orders" },
      });

      expect(result.messages).toHaveLength(1);
      const text = (result.messages[0].content as { type: string; text: string }).text;
      expect(text).toContain("orders");
      expect(text).toContain("peek_messages");
    });

    it("gets schema-compliance prompt for all queues", async () => {
      const client = await createTestClient();
      const result = await client.getPrompt({
        name: "schema-compliance",
        arguments: {},
      });

      expect(result.messages).toHaveLength(1);
      const text = (result.messages[0].content as { type: string; text: string }).text;
      expect(text).toContain("list_queues");
      expect(text).toContain("compliance status per queue");
    });
  });
});
