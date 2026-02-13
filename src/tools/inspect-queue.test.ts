import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { SchemaValidator } from "../schemas/validator.js";
import { inspectQueue } from "./inspect-queue.js";
import type { SchemaEntry } from "../schemas/types.js";

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

function mockClient(messages: unknown[]): RabbitMQClient {
  return {
    peekMessages: vi.fn().mockResolvedValue(messages),
  } as unknown as RabbitMQClient;
}

describe("inspectQueue", () => {
  it("validates messages against their schema type", async () => {
    const client = mockClient([
      {
        payload: '{"orderId":"ORD-001","amount":49.99}',
        payload_encoding: "string",
        properties: { type: "order.created" },
        exchange: "events",
        routing_key: "order.created",
        message_count: 0,
        redelivered: false,
      },
    ]);
    const validator = new SchemaValidator([orderSchema]);

    const result = await inspectQueue(client, validator, "/", "orders", 5);

    expect(result.count).toBe(1);
    expect(result.messages[0].validation.valid).toBe(true);
    expect(result.messages[0].validation.schemaName).toBe("order.created");
    expect(result.messages[0].validation.errors).toEqual([]);
    expect(result.summary.valid).toBe(1);
    expect(result.summary.invalid).toBe(0);
  });

  it("reports invalid messages with validation errors", async () => {
    const client = mockClient([
      {
        payload: '{"orderId":"ORD-001"}',
        payload_encoding: "string",
        properties: { type: "order.created" },
        exchange: "events",
        routing_key: "order.created",
        message_count: 0,
        redelivered: false,
      },
    ]);
    const validator = new SchemaValidator([orderSchema]);

    const result = await inspectQueue(client, validator, "/", "orders", 5);

    expect(result.messages[0].validation.valid).toBe(false);
    expect(result.messages[0].validation.errors.length).toBeGreaterThan(0);
    expect(result.summary.invalid).toBe(1);
  });

  it("handles messages without a type property", async () => {
    const client = mockClient([
      {
        payload: '{"data":"test"}',
        payload_encoding: "string",
        properties: {},
        exchange: "",
        routing_key: "",
        message_count: 0,
        redelivered: false,
      },
    ]);
    const validator = new SchemaValidator([orderSchema]);

    const result = await inspectQueue(client, validator, "/", "orders", 5);

    expect(result.messages[0].validation.schemaName).toBeNull();
    expect(result.messages[0].validation.valid).toBeNull();
    expect(result.summary.noSchema).toBe(1);
  });

  it("handles messages with unknown schema type", async () => {
    const client = mockClient([
      {
        payload: '{"data":"test"}',
        payload_encoding: "string",
        properties: { type: "unknown.event" },
        exchange: "",
        routing_key: "",
        message_count: 0,
        redelivered: false,
      },
    ]);
    const validator = new SchemaValidator([orderSchema]);

    const result = await inspectQueue(client, validator, "/", "orders", 5);

    expect(result.messages[0].validation.schemaName).toBe("unknown.event");
    expect(result.messages[0].validation.valid).toBeNull();
    expect(result.messages[0].validation.errors[0].message).toContain(
      "unknown.event",
    );
    expect(result.summary.noSchema).toBe(1);
  });

  it("provides a correct summary for mixed results", async () => {
    const client = mockClient([
      {
        payload: '{"orderId":"ORD-001","amount":49.99}',
        payload_encoding: "string",
        properties: { type: "order.created" },
        exchange: "events",
        routing_key: "order.created",
        message_count: 0,
        redelivered: false,
      },
      {
        payload: '{"orderId":"ORD-002"}',
        payload_encoding: "string",
        properties: { type: "order.created" },
        exchange: "events",
        routing_key: "order.created",
        message_count: 0,
        redelivered: false,
      },
      {
        payload: '{"other":"data"}',
        payload_encoding: "string",
        properties: {},
        exchange: "",
        routing_key: "",
        message_count: 0,
        redelivered: false,
      },
    ]);
    const validator = new SchemaValidator([orderSchema]);

    const result = await inspectQueue(client, validator, "/", "orders", 5);

    expect(result.summary).toEqual({
      total: 3,
      valid: 1,
      invalid: 1,
      noSchema: 1,
    });
  });

  it("parses JSON payloads for inspection", async () => {
    const client = mockClient([
      {
        payload: '{"orderId":"ORD-001","amount":49.99}',
        payload_encoding: "string",
        properties: { type: "order.created" },
        exchange: "events",
        routing_key: "order.created",
        message_count: 0,
        redelivered: false,
      },
    ]);
    const validator = new SchemaValidator([orderSchema]);

    const result = await inspectQueue(client, validator, "/", "orders", 5);

    expect(result.messages[0].parsedPayload).toEqual({
      orderId: "ORD-001",
      amount: 49.99,
    });
  });
});
