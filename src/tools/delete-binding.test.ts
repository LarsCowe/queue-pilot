import { describe, it, expect, vi } from "vitest";
import { RabbitMQClient } from "../rabbitmq/client.js";
import { deleteBinding } from "./delete-binding.js";

describe("deleteBinding", () => {
  it("deletes a binding with default properties key", async () => {
    const client = {
      deleteBinding: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMQClient;

    const result = await deleteBinding(client, {
      exchange: "events",
      queue: "orders",
      properties_key: "~",
      vhost: "/",
    });

    expect(result).toEqual({
      exchange: "events",
      queue: "orders",
      properties_key: "~",
      vhost: "/",
      deleted: true,
    });
    expect(client.deleteBinding).toHaveBeenCalledWith(
      "/",
      "events",
      "orders",
      "~",
    );
  });

  it("deletes a binding with a specific properties key", async () => {
    const client = {
      deleteBinding: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMQClient;

    const result = await deleteBinding(client, {
      exchange: "notifications",
      queue: "email-sender",
      properties_key: "%7E",
      vhost: "/",
    });

    expect(result).toEqual({
      exchange: "notifications",
      queue: "email-sender",
      properties_key: "%7E",
      vhost: "/",
      deleted: true,
    });
    expect(client.deleteBinding).toHaveBeenCalledWith(
      "/",
      "notifications",
      "email-sender",
      "%7E",
    );
  });

  it("propagates errors from the RabbitMQ client", async () => {
    const client = {
      deleteBinding: vi
        .fn()
        .mockRejectedValue(new Error("RabbitMQ API error: 404 Not Found")),
    } as unknown as RabbitMQClient;

    await expect(
      deleteBinding(client, {
        exchange: "nonexistent",
        queue: "orders",
        properties_key: "~",
        vhost: "/",
      }),
    ).rejects.toThrow("RabbitMQ API error: 404 Not Found");
  });
});
