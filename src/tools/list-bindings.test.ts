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
    });
  });
});
