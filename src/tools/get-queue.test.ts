import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { getQueue } from "./get-queue.js";

const sampleQueueDetail = {
  name: "order-events",
  vhost: "/",
  state: "running",
  messages_ready: 15,
  messages_unacknowledged: 3,
  consumers: 2,
  consumer_utilisation: 0.85,
  memory: 131072,
  message_stats: { publish: 500, deliver: 480 },
  policy: "ha-all",
  arguments: { "x-message-ttl": 86400000 },
  node: "rabbit@node-1",
};

describe("getQueue", () => {
  it("returns detailed queue information", async () => {
    const client = {
      getQueue: vi.fn().mockResolvedValue(sampleQueueDetail),
    } as unknown as RabbitMQClient;

    const result = await getQueue(client, "/", "order-events");

    expect(result).toEqual({
      name: "order-events",
      vhost: "/",
      state: "running",
      messages_ready: 15,
      messages_unacknowledged: 3,
      consumers: 2,
      consumer_utilisation: 0.85,
      memory: 131072,
      message_stats: { publish: 500, deliver: 480 },
      policy: "ha-all",
      arguments: { "x-message-ttl": 86400000 },
      node: "rabbit@node-1",
    });
    expect(client.getQueue).toHaveBeenCalledWith("/", "order-events");
  });

  it("handles null message_stats for idle queues", async () => {
    const client = {
      getQueue: vi.fn().mockResolvedValue({
        ...sampleQueueDetail,
        message_stats: null,
        consumer_utilisation: null,
        policy: null,
      }),
    } as unknown as RabbitMQClient;

    const result = await getQueue(client, "/", "order-events");

    expect(result.message_stats).toBeNull();
    expect(result.consumer_utilisation).toBeNull();
    expect(result.policy).toBeNull();
  });

  it("defaults null message counts to zero", async () => {
    const client = {
      getQueue: vi.fn().mockResolvedValue({
        ...sampleQueueDetail,
        messages_ready: null,
        messages_unacknowledged: null,
      }),
    } as unknown as RabbitMQClient;

    const result = await getQueue(client, "/", "order-events");

    expect(result.messages_ready).toBe(0);
    expect(result.messages_unacknowledged).toBe(0);
  });

  it("propagates errors from the RabbitMQ client", async () => {
    const client = {
      getQueue: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 404 Not Found")),
    } as unknown as RabbitMQClient;

    await expect(getQueue(client, "/", "nonexistent")).rejects.toThrow(
      "RabbitMQ API error: 404 Not Found",
    );
  });
});
