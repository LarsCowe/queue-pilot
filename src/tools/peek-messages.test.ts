import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { peekMessages } from "./peek-messages.js";

describe("peekMessages", () => {
  it("returns messages with properties from queue", async () => {
    const client = {
      peekMessages: vi.fn().mockResolvedValue([
        {
          payload: '{"orderId":"ORD-001"}',
          payload_encoding: "string",
          properties: {
            type: "order.created",
            message_id: "msg-123",
            correlation_id: "corr-456",
            timestamp: 1705312200,
            headers: { source: "shop" },
            content_type: "application/json",
          },
          exchange: "events",
          routing_key: "order.created",
          message_count: 4,
          redelivered: false,
        },
      ]),
    } as unknown as RabbitMQClient;

    const result = await peekMessages(client, "/", "orders", 5);

    expect(result.count).toBe(1);
    expect(result.messages[0].payload).toBe('{"orderId":"ORD-001"}');
    expect(result.messages[0].properties.type).toBe("order.created");
    expect(result.messages[0].properties.message_id).toBe("msg-123");
    expect(result.messages[0].exchange).toBe("events");
    expect(result.messages[0].routing_key).toBe("order.created");
    expect(client.peekMessages).toHaveBeenCalledWith("/", "orders", 5);
  });

  it("returns empty list when queue has no messages", async () => {
    const client = {
      peekMessages: vi.fn().mockResolvedValue([]),
    } as unknown as RabbitMQClient;

    const result = await peekMessages(client, "/", "empty-queue", 5);

    expect(result.count).toBe(0);
    expect(result.messages).toEqual([]);
  });
});
