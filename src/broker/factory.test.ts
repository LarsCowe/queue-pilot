import { describe, it, expect } from "vitest";
import { createAdapter } from "./factory.js";
import { hasOverview, hasConsumers, hasConnections } from "./types.js";

describe("createAdapter", () => {
  it("creates a RabbitMQ adapter with all capabilities", () => {
    const { adapter } = createAdapter({
      broker: "rabbitmq",
      url: "http://localhost:15672",
      username: "guest",
      password: "guest",
    });

    expect(hasOverview(adapter)).toBe(true);
    expect(hasConsumers(adapter)).toBe(true);
    expect(hasConnections(adapter)).toBe(true);
  });

  it("returns 6 broker-specific tools for RabbitMQ", () => {
    const { tools } = createAdapter({
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

  it("throws for unsupported broker type", () => {
    expect(() =>
      createAdapter({ broker: "kafka" as never, url: "", username: "", password: "" }),
    ).toThrow("Unsupported broker: kafka");
  });
});
