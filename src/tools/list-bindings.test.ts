import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { listBindings } from "./list-bindings.js";

describe("listBindings", () => {
  it("returns bindings from RabbitMQ client", async () => {
    const client = {
      listBindings: vi.fn().mockResolvedValue([
        {
          source: "events",
          destination: "orders",
          destination_type: "queue",
          routing_key: "order.#",
          properties_key: "~",
          vhost: "/",
        },
      ]),
    } as unknown as RabbitMQClient;

    const result = await listBindings(client, "/");

    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0]).toEqual({
      source: "events",
      destination: "orders",
      destination_type: "queue",
      routing_key: "order.#",
      properties_key: "~",
    });
  });

  it("returns empty list when no bindings exist", async () => {
    const client = {
      listBindings: vi.fn().mockResolvedValue([]),
    } as unknown as RabbitMQClient;

    const result = await listBindings(client, "/");

    expect(result.bindings).toEqual([]);
  });

  it("propagates errors from the RabbitMQ client", async () => {
    const client = {
      listBindings: vi.fn().mockRejectedValue(new Error("Connection refused")),
    } as unknown as RabbitMQClient;

    await expect(listBindings(client, "/")).rejects.toThrow("Connection refused");
  });
});
