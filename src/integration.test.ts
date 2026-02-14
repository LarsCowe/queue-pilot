import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.js";
import { createAdapter } from "./broker/factory.js";
import { orderSchema } from "./test-fixtures.js";

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? "http://localhost:15672";
const RABBITMQ_USER = process.env.RABBITMQ_USER ?? "guest";
const RABBITMQ_PASS = process.env.RABBITMQ_PASS ?? "guest";

async function createTestClient(): Promise<Client> {
  const { adapter, tools } = await createAdapter({
    broker: "rabbitmq",
    url: RABBITMQ_URL,
    username: RABBITMQ_USER,
    password: RABBITMQ_PASS,
  });
  const server = createServer({
    schemas: [orderSchema],
    adapter,
    brokerTools: tools,
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

  afterAll(async () => {
    await deleteQueue(testQueue).catch(() => {});
  });

  it("lists queues including the test queue", async () => {
    const result = await client.callTool({
      name: "list_queues",
      arguments: { vhost: "/" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.queues.length).toBeGreaterThan(0);
    const queueNames = parsed.queues.map((q: { name: string }) => q.name);
    expect(queueNames).toContain(testQueue);
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

    expect(Array.isArray(parsed.bindings)).toBe(true);
  });
});

describe("Integration: Write Operations", () => {
  let client: Client;
  const writeTestQueue = "qp-write-test";

  beforeAll(async () => {
    await deleteQueue(writeTestQueue).catch(() => {});
    client = await createTestClient();
  });

  afterAll(async () => {
    await deleteQueue(writeTestQueue).catch(() => {});
  });

  it("creates a queue via create_queue", async () => {
    const result = await client.callTool({
      name: "create_queue",
      arguments: { queue: writeTestQueue, durable: false, auto_delete: false },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.queue).toBe(writeTestQueue);
    expect(parsed.durable).toBe(false);
    expect(parsed.auto_delete).toBe(false);

    const listResult = await client.callTool({
      name: "list_queues",
      arguments: { vhost: "/" },
    });
    const listContent = listResult.content as Array<{
      type: string;
      text: string;
    }>;
    const listParsed = JSON.parse(listContent[0].text);
    const queueNames = listParsed.queues.map(
      (q: { name: string }) => q.name,
    );
    expect(queueNames).toContain(writeTestQueue);
  });

  it("creates a binding via create_binding", async () => {
    const result = await client.callTool({
      name: "create_binding",
      arguments: {
        exchange: "amq.topic",
        queue: writeTestQueue,
        routing_key: "test.#",
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.exchange).toBe("amq.topic");
    expect(parsed.queue).toBe(writeTestQueue);
    expect(parsed.routing_key).toBe("test.#");

    const listResult = await client.callTool({
      name: "list_bindings",
      arguments: { vhost: "/" },
    });
    const listContent = listResult.content as Array<{
      type: string;
      text: string;
    }>;
    const listParsed = JSON.parse(listContent[0].text);
    const binding = listParsed.bindings.find(
      (b: { source: string; destination: string; routing_key: string }) =>
        b.source === "amq.topic" &&
        b.destination === writeTestQueue &&
        b.routing_key === "test.#",
    );
    expect(binding).toBeDefined();
  });

  it("publishes a valid message with schema validation", async () => {
    const payload = JSON.stringify({ orderId: "ORD-INT-001", amount: 99.99 });

    const result = await client.callTool({
      name: "publish_message",
      arguments: {
        exchange: "amq.topic",
        routing_key: "test.order",
        payload,
        message_type: "order.created",
        validate: true,
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.published).toBe(true);
    expect(parsed.routed).toBe(true);
    expect(parsed.validation.valid).toBe(true);

    const peekResult = await client.callTool({
      name: "peek_messages",
      arguments: { queue: writeTestQueue, count: 5 },
    });
    const peekContent = peekResult.content as Array<{
      type: string;
      text: string;
    }>;
    const peekParsed = JSON.parse(peekContent[0].text);
    expect(peekParsed.count).toBe(1);
    expect(peekParsed.messages[0].payload).toContain("ORD-INT-001");
  });

  it("blocks publish when validation fails", async () => {
    const payload = JSON.stringify({ orderId: "ORD-INT-002" });

    const result = await client.callTool({
      name: "publish_message",
      arguments: {
        exchange: "amq.topic",
        routing_key: "test.order",
        payload,
        message_type: "order.created",
        validate: true,
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.published).toBe(false);
    expect(parsed.validation.valid).toBe(false);

    const peekResult = await client.callTool({
      name: "peek_messages",
      arguments: { queue: writeTestQueue, count: 5 },
    });
    const peekContent = peekResult.content as Array<{
      type: string;
      text: string;
    }>;
    const peekParsed = JSON.parse(peekContent[0].text);
    expect(peekParsed.count).toBe(1);
  });

  it("purges the queue via purge_queue", async () => {
    const result = await client.callTool({
      name: "purge_queue",
      arguments: { queue: writeTestQueue },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);

    expect(parsed.messages_purged).toBeGreaterThanOrEqual(1);

    const peekResult = await client.callTool({
      name: "peek_messages",
      arguments: { queue: writeTestQueue, count: 5 },
    });
    const peekContent = peekResult.content as Array<{
      type: string;
      text: string;
    }>;
    const peekParsed = JSON.parse(peekContent[0].text);
    expect(peekParsed.count).toBe(0);
  });
});
