import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { listExchanges } from "./list-exchanges.js";

describe("listExchanges", () => {
  it("returns exchanges from RabbitMQ client", async () => {
    const client = {
      listExchanges: vi.fn().mockResolvedValue([
        { name: "events", type: "topic", durable: true, vhost: "/" },
        { name: "amq.direct", type: "direct", durable: true, vhost: "/" },
      ]),
    } as unknown as RabbitMQClient;

    const result = await listExchanges(client, "/");

    expect(result.exchanges).toHaveLength(2);
    expect(result.exchanges[0]).toEqual({
      name: "events",
      type: "topic",
      durable: true,
    });
  });

  it("returns empty list when no exchanges exist", async () => {
    const client = {
      listExchanges: vi.fn().mockResolvedValue([]),
    } as unknown as RabbitMQClient;

    const result = await listExchanges(client, "/");

    expect(result.exchanges).toEqual([]);
  });

  it("propagates errors from the RabbitMQ client", async () => {
    const client = {
      listExchanges: vi.fn().mockRejectedValue(new Error("Connection refused")),
    } as unknown as RabbitMQClient;

    await expect(listExchanges(client, "/")).rejects.toThrow("Connection refused");
  });
});
