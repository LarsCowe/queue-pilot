import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { SchemaValidator } from "../schemas/validator.js";
import { inspectQueue } from "./inspect-queue.js";
import { orderSchema, paymentSchema } from "../test-fixtures.js";

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

  it("validates mixed message types against their respective schemas", async () => {
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
        payload: '{"invoiceId":"INV-001","amount":99.50,"currency":"EUR"}',
        payload_encoding: "string",
        properties: { type: "payment.processed" },
        exchange: "events",
        routing_key: "payment.processed",
        message_count: 0,
        redelivered: false,
      },
    ]);
    const validator = new SchemaValidator([orderSchema, paymentSchema]);

    const result = await inspectQueue(client, validator, "/", "mixed-events", 5);

    expect(result.messages[0].validation.schemaName).toBe("order.created");
    expect(result.messages[0].validation.valid).toBe(true);
    expect(result.messages[1].validation.schemaName).toBe("payment.processed");
    expect(result.messages[1].validation.valid).toBe(true);
    expect(result.summary).toEqual({
      total: 2,
      valid: 2,
      invalid: 0,
      noSchema: 0,
    });
  });

  it("handles malformed non-JSON payloads gracefully", async () => {
    const client = mockClient([
      {
        payload: "this is not valid JSON",
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

    expect(result.messages[0].parsedPayload).toBe("this is not valid JSON");
    expect(result.messages[0].validation.valid).toBe(false);
  });

  it("returns correct summary for an empty queue", async () => {
    const client = mockClient([]);
    const validator = new SchemaValidator([orderSchema]);

    const result = await inspectQueue(client, validator, "/", "empty-queue", 5);

    expect(result.messages).toEqual([]);
    expect(result.count).toBe(0);
    expect(result.summary).toEqual({
      total: 0,
      valid: 0,
      invalid: 0,
      noSchema: 0,
    });
  });

  it("passes through all message properties", async () => {
    const client = mockClient([
      {
        payload: '{"orderId":"ORD-001","amount":49.99}',
        payload_encoding: "string",
        properties: {
          type: "order.created",
          correlation_id: "corr-abc-123",
          message_id: "msg-def-456",
          timestamp: 1705312200,
          headers: { "x-retry-count": 2, source: "billing-service" },
        },
        exchange: "events",
        routing_key: "order.created",
        message_count: 0,
        redelivered: false,
      },
    ]);
    const validator = new SchemaValidator([orderSchema]);

    const result = await inspectQueue(client, validator, "/", "orders", 5);

    expect(result.messages[0].properties).toEqual({
      type: "order.created",
      correlation_id: "corr-abc-123",
      message_id: "msg-def-456",
      timestamp: 1705312200,
      headers: { "x-retry-count": 2, source: "billing-service" },
    });
  });

  it("includes the queue name in the result", async () => {
    const client = mockClient([]);
    const validator = new SchemaValidator([orderSchema]);

    const result = await inspectQueue(client, validator, "/", "payments-dlq", 5);

    expect(result.queue).toBe("payments-dlq");
  });

  it("propagates errors from the RabbitMQ client", async () => {
    const client = {
      peekMessages: vi.fn().mockRejectedValue(new Error("Connection refused")),
    } as unknown as RabbitMQClient;
    const validator = new SchemaValidator([orderSchema]);

    await expect(
      inspectQueue(client, validator, "/", "orders", 5),
    ).rejects.toThrow("Connection refused");
  });
});
