import { createRequire } from "module";
import { describe, it, expect } from "vitest";
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

  it("wires list_queues tool to the RabbitMQ client", async () => {
    const client = await createTestClient();

    const result = await client.callTool({
      name: "list_queues",
      arguments: { vhost: "/" },
    });

    // Tool is wired and executes — returns either queue data or a connection error
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toBeDefined();
  });

  it("wires peek_messages tool to the RabbitMQ client", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "peek_messages",
      arguments: { queue: "test-queue", count: 1, vhost: "/" },
    });
    expect(result.isError).toBe(true);
  });

  it("wires inspect_queue tool to the RabbitMQ client", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "inspect_queue",
      arguments: { queue: "test-queue", count: 1, vhost: "/" },
    });
    expect(result.isError).toBe(true);
  });
});
