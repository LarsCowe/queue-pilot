import { describe, it, expect } from "vitest";
import { SchemaValidator } from "../schemas/validator.js";
import { validateMessage } from "./validate-message.js";
import type { SchemaEntry } from "../schemas/types.js";

const testSchema: SchemaEntry = {
  name: "order.created",
  version: "1.0.0",
  title: "Order Created",
  description: "Emitted when a new order is placed",
  schema: {
    $id: "order.created",
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Order Created",
    description: "Emitted when a new order is placed",
    version: "1.0.0",
    type: "object",
    required: ["orderId", "amount"],
    properties: {
      orderId: { type: "string" },
      amount: { type: "number" },
    },
  },
};

describe("validateMessage", () => {
  it("validates a correct JSON message", () => {
    const validator = new SchemaValidator([testSchema]);
    const message = JSON.stringify({ orderId: "ORD-001", amount: 99.95 });

    const result = validateMessage(validator, "order.created", message);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.schemaName).toBe("order.created");
  });

  it("returns validation errors for invalid message", () => {
    const validator = new SchemaValidator([testSchema]);
    const message = JSON.stringify({ orderId: "ORD-001" }); // missing amount

    const result = validateMessage(validator, "order.created", message);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns error for invalid JSON input", () => {
    const validator = new SchemaValidator([testSchema]);

    const result = validateMessage(validator, "order.created", "not json {{{");

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("Invalid JSON");
  });

  it("returns error for unknown schema", () => {
    const validator = new SchemaValidator([testSchema]);
    const message = JSON.stringify({ data: "test" });

    const result = validateMessage(validator, "unknown.event", message);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("unknown.event");
  });
});
