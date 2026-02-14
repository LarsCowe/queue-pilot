import { describe, it, expect } from "vitest";
import { createAdapter } from "./factory.js";
import { hasOverview, hasConsumers, hasConnections } from "./types.js";

describe("createAdapter", () => {
  it("creates a RabbitMQ adapter with all capabilities", async () => {
    const { adapter } = await createAdapter({
      broker: "rabbitmq",
      url: "http://localhost:15672",
      username: "guest",
      password: "guest",
    });

    expect(hasOverview(adapter)).toBe(true);
    expect(hasConsumers(adapter)).toBe(true);
    expect(hasConnections(adapter)).toBe(true);
  });

  it("returns 6 broker-specific tools for RabbitMQ", async () => {
    const { tools } = await createAdapter({
      broker: "rabbitmq",
      url: "http://localhost:15672",
      username: "guest",
      password: "guest",
    });

    expect(tools).toHaveLength(6);
    const names = tools.map((t) => t.name);
    expect(names).toContain("list_exchanges");
    expect(names).toContain("create_exchange");
    expect(names).toContain("delete_exchange");
    expect(names).toContain("list_bindings");
    expect(names).toContain("create_binding");
    expect(names).toContain("delete_binding");
  });

  it("creates a Kafka adapter with overview and consumer capabilities", async () => {
    const { adapter } = await createAdapter({
      broker: "kafka",
      brokers: ["localhost:9092"],
    });

    expect(hasOverview(adapter)).toBe(true);
    expect(hasConsumers(adapter)).toBe(true);
    expect(hasConnections(adapter)).toBe(false);
  });

  it("returns 4 broker-specific tools for Kafka", async () => {
    const { tools } = await createAdapter({
      broker: "kafka",
      brokers: ["localhost:9092"],
    });

    expect(tools).toHaveLength(4);
    const names = tools.map((t) => t.name);
    expect(names).toContain("list_consumer_groups");
    expect(names).toContain("describe_consumer_group");
    expect(names).toContain("list_partitions");
    expect(names).toContain("get_offsets");
  });

  it("throws for unsupported broker type", async () => {
    await expect(
      createAdapter({
        broker: "activemq" as never,
        url: "",
        username: "",
        password: "",
      }),
    ).rejects.toThrow("Unsupported broker: activemq");
  });
});
