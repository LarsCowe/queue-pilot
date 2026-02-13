import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.js";
import type { SchemaEntry } from "./schemas/types.js";

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? "http://localhost:15672";
const RABBITMQ_USER = process.env.RABBITMQ_USER ?? "guest";
const RABBITMQ_PASS = process.env.RABBITMQ_PASS ?? "guest";

const orderSchema: SchemaEntry = {
  name: "order.created",
  version: "1.0.0",
  title: "Order Created",
  description: "Emitted when a new order is placed",
  schema: {
    $id: "order.created",
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Order Created",
    description: "Emitted when a new order is placed",
    version: "1.0.0",
    type: "object",
    required: ["orderId", "amount"],
    properties: {
      orderId: { type: "string" },
      amount: { type: "number" },
    },
  },
};

async function createTestClient(): Promise<Client> {
  const server = createServer({
    schemas: [orderSchema],
    rabbitmqUrl: RABBITMQ_URL,
    rabbitmqUser: RABBITMQ_USER,
    rabbitmqPass: RABBITMQ_PASS,
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "integration-test", version: "1.0.0" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return client;
}

async function publishTestMessage(
  queue: string,
  message: Record<string, unknown>,
  type?: string,
): Promise<void> {
  const auth = Buffer.from(`${RABBITMQ_USER}:${RABBITMQ_PASS}`).toString(
    "base64",
  );

  // Ensure queue exists
  await fetch(`${RABBITMQ_URL}/api/queues/%2F/${queue}`, {
    method: "PUT",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ durable: false, auto_delete: true }),
  });

  // Publish message via default exchange
  await fetch(`${RABBITMQ_URL}/api/exchanges/%2F/amq.default/publish`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      routing_key: queue,
      payload: JSON.stringify(message),
      payload_encoding: "string",
      properties: {
        content_type: "application/json",
        ...(type ? { type } : {}),
      },
    }),
  });
}

async function deleteQueue(queue: string): Promise<void> {
  const auth = Buffer.from(`${RABBITMQ_USER}:${RABBITMQ_PASS}`).toString(
    "base64",
  );
  await fetch(`${RABBITMQ_URL}/api/queues/%2F/${queue}`, {
    method: "DELETE",
    headers: { Authorization: `Basic ${auth}` },
  });
}

describe("Integration: Queue Pilot with RabbitMQ", () => {
  let client: Client;
  const testQueue = "qp-integration-test";

  beforeAll(async () => {
    // Verify RabbitMQ is reachable
    try {
      const auth = Buffer.from(`${RABBITMQ_USER}:${RABBITMQ_PASS}`).toString(
        "base64",
      );
      const res = await fetch(`${RABBITMQ_URL}/api/overview`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!res.ok) throw new Error(`RabbitMQ returned ${res.status}`);
    } catch (error) {
      throw new Error(
        `RabbitMQ not available at ${RABBITMQ_URL}. Start it with: docker compose up -d`,
      );
    }

    client = await createTestClient();

    // Clean up and prepare test queue
    await deleteQueue(testQueue).catch(() => {});
    await publishTestMessage(
      testQueue,
      { orderId: "ORD-001", amount: 49.99 },
      "order.created",
    );
    await publishTestMessage(
      testQueue,
      { orderId: "ORD-002" },
      "order.created",
    );
  });

  it("lists queues including the test queue", async () => {
    const result = await client.callTool({
      name: "list_queues",
      arguments: { vhost: "/" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    const testQ = parsed.queues.find(
      (q: { name: string }) => q.name === testQueue,
    );
    expect(testQ).toBeDefined();
    expect(testQ.messages_ready).toBeGreaterThanOrEqual(2);
  });

  it("peeks messages from the test queue", async () => {
    const result = await client.callTool({
      name: "peek_messages",
      arguments: { queue: testQueue, count: 5 },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.count).toBeGreaterThanOrEqual(2);
    expect(parsed.messages[0].payload).toContain("ORD-001");
  });

  it("inspects queue with schema validation", async () => {
    const result = await client.callTool({
      name: "inspect_queue",
      arguments: { queue: testQueue, count: 5 },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.summary.total).toBeGreaterThanOrEqual(2);
    expect(parsed.summary.valid).toBeGreaterThanOrEqual(1);
    expect(parsed.summary.invalid).toBeGreaterThanOrEqual(1);

    // First message should be valid
    const validMsg = parsed.messages.find(
      (m: { parsedPayload: { orderId: string } }) =>
        m.parsedPayload.orderId === "ORD-001",
    );
    expect(validMsg.validation.valid).toBe(true);

    // Second message (missing amount) should be invalid
    const invalidMsg = parsed.messages.find(
      (m: { parsedPayload: { orderId: string } }) =>
        m.parsedPayload.orderId === "ORD-002",
    );
    expect(invalidMsg.validation.valid).toBe(false);
    expect(invalidMsg.validation.errors.length).toBeGreaterThan(0);
  });

  it("lists exchanges", async () => {
    const result = await client.callTool({
      name: "list_exchanges",
      arguments: { vhost: "/" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.exchanges.length).toBeGreaterThan(0);
  });

  it("lists bindings", async () => {
    const result = await client.callTool({
      name: "list_bindings",
      arguments: { vhost: "/" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.bindings).toBeDefined();
  });
});
