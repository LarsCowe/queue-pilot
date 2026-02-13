import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { SchemaValidator } from "../schemas/validator.js";
import { publishMessage } from "./publish-message.js";
import { orderSchema } from "../test-fixtures.js";

function mockClient(response: { routed: boolean } = { routed: true }): RabbitMQClient {
  return {
    publishMessage: vi.fn().mockResolvedValue(response),
  } as unknown as RabbitMQClient;
}

describe("publishMessage", () => {
  it("publishes a valid message when schema validation passes", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    const result = await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "order.created",
      payload: '{"orderId":"ORD-001","amount":49.99}',
      message_type: "order.created",
      validate: true,
      vhost: "/",
    });

    expect(result.published).toBe(true);
    expect(result.validation.valid).toBe(true);
    expect(result.validation.validated).toBe(true);
    expect(result.validation.schemaName).toBe("order.created");
    expect(result.validation.errors).toEqual([]);

    const publishCall = vi.mocked(client.publishMessage).mock.calls[0];
    expect(publishCall[0]).toBe("/");
    expect(publishCall[1]).toBe("events");
    expect(publishCall[2]).toMatchObject({
      routing_key: "order.created",
      payload: '{"orderId":"ORD-001","amount":49.99}',
      payload_encoding: "string",
      properties: {
        content_type: "application/json",
        type: "order.created",
      },
    });
  });

  it("blocks publish when validation fails", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    const result = await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "order.created",
      payload: '{"orderId":"ORD-001"}',
      message_type: "order.created",
      validate: true,
      vhost: "/",
    });

    expect(result.published).toBe(false);
    expect(result.validation.valid).toBe(false);
    expect(result.validation.validated).toBe(true);
    expect(result.validation.errors.length).toBeGreaterThan(0);
    expect(client.publishMessage).not.toHaveBeenCalled();
  });

  it("skips validation when validate is false", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    const result = await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "order.created",
      payload: '{"orderId":"ORD-001"}',
      message_type: "order.created",
      validate: false,
      vhost: "/",
    });

    expect(result.published).toBe(true);
    expect(result.validation.validated).toBe(false);
    expect(client.publishMessage).toHaveBeenCalled();
  });

  it("skips validation when no message_type is provided", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    const result = await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "order.created",
      payload: '{"orderId":"ORD-001"}',
      validate: true,
      vhost: "/",
    });

    expect(result.published).toBe(true);
    expect(result.validation.validated).toBe(false);
    expect(result.validation.schemaName).toBeNull();
    expect(client.publishMessage).toHaveBeenCalled();
  });

  it("blocks publish when message_type has no matching schema", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    const result = await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "unknown.event",
      payload: '{"data":"test"}',
      message_type: "unknown.event",
      validate: true,
      vhost: "/",
    });

    expect(result.published).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
    expect(result.validation.errors[0].message).toContain("unknown.event");
    expect(client.publishMessage).not.toHaveBeenCalled();
  });

  it("blocks publish when payload is not valid JSON", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    const result = await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "order.created",
      payload: "not valid json",
      validate: false,
      vhost: "/",
    });

    expect(result.published).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
    expect(result.validation.errors[0].message).toMatch(/invalid json/i);
    expect(client.publishMessage).not.toHaveBeenCalled();
  });

  it("propagates errors from the RabbitMQ client", async () => {
    const client = {
      publishMessage: vi.fn().mockRejectedValue(new Error("Connection refused")),
    } as unknown as RabbitMQClient;
    const validator = new SchemaValidator([orderSchema]);

    await expect(
      publishMessage(client, validator, {
        exchange: "events",
        routing_key: "order.created",
        payload: '{"orderId":"ORD-001","amount":49.99}',
        message_type: "order.created",
        validate: true,
        vhost: "/",
      }),
    ).rejects.toThrow("Connection refused");
  });

  it("reports routed as false when the API indicates the message was not routed", async () => {
    const client = mockClient({ routed: false });
    const validator = new SchemaValidator([orderSchema]);

    const result = await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "order.created",
      payload: '{"orderId":"ORD-001","amount":49.99}',
      message_type: "order.created",
      validate: true,
      vhost: "/",
    });

    expect(result.published).toBe(true);
    expect(result.routed).toBe(false);
  });

  it("passes custom headers through to the message properties", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "order.created",
      payload: '{"orderId":"ORD-001","amount":49.99}',
      message_type: "order.created",
      headers: { "x-source": "billing" },
      validate: true,
      vhost: "/",
    });

    const publishCall = vi.mocked(client.publishMessage).mock.calls[0];
    expect(publishCall[2].properties).toMatchObject({
      headers: { "x-source": "billing" },
    });
  });

  it("publishes an empty object payload successfully", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    const result = await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "order.created",
      payload: "{}",
      validate: false,
      vhost: "/",
    });

    expect(result.published).toBe(true);
    expect(client.publishMessage).toHaveBeenCalled();
  });

  it("blocks publish for empty string payload", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    const result = await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "order.created",
      payload: "",
      validate: false,
      vhost: "/",
    });

    expect(result.published).toBe(false);
    expect(result.validation.errors[0].message).toMatch(/invalid json/i);
    expect(client.publishMessage).not.toHaveBeenCalled();
  });

  it("blocks publish for valid JSON non-object payload", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    const result = await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "order.created",
      payload: "42",
      message_type: "order.created",
      validate: true,
      vhost: "/",
    });

    expect(result.published).toBe(false);
    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
    expect(client.publishMessage).not.toHaveBeenCalled();
  });

  it("publishes with validate:false even with unknown message_type", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    const result = await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "unknown.event",
      payload: '{"data":"test"}',
      message_type: "unknown.event",
      validate: false,
      vhost: "/",
    });

    expect(result.published).toBe(true);
    const publishCall = vi.mocked(client.publishMessage).mock.calls[0];
    expect(publishCall[2].properties.type).toBe("unknown.event");
  });

  it("does not set properties.type when message_type is absent", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "order.created",
      payload: '{"orderId":"ORD-001"}',
      validate: false,
      vhost: "/",
    });

    const publishCall = vi.mocked(client.publishMessage).mock.calls[0];
    expect(publishCall[2].properties).not.toHaveProperty("type");
  });

  it("returns validation.valid as null when validation is skipped", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    const result = await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "order.created",
      payload: '{"orderId":"ORD-001"}',
      message_type: "order.created",
      validate: false,
      vhost: "/",
    });

    expect(result.validation.valid).toBeNull();
  });

  it("returns validation.schemaName when validate is false", async () => {
    const client = mockClient();
    const validator = new SchemaValidator([orderSchema]);

    const result = await publishMessage(client, validator, {
      exchange: "events",
      routing_key: "order.created",
      payload: '{"orderId":"ORD-001"}',
      message_type: "order.created",
      validate: false,
      vhost: "/",
    });

    expect(result.validation.schemaName).toBe("order.created");
  });
});
