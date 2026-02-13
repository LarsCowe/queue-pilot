import { describe, it, expect } from "vitest";
import { SchemaValidator } from "../schemas/validator.js";
import { getSchema } from "./get-schema.js";
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
    required: ["orderId"],
    properties: {
      orderId: { type: "string" },
    },
  },
};

describe("getSchema", () => {
  it("returns the full schema definition for a known schema", () => {
    const validator = new SchemaValidator([testSchema]);

    const result = getSchema(validator, "order.created");

    expect(result.found).toBe(true);
    expect(result.name).toBe("order.created");
    expect(result.schema).toBeDefined();
    expect((result.schema as Record<string, unknown>).required).toEqual([
      "orderId",
    ]);
  });

  it("returns an error for an unknown schema", () => {
    const validator = new SchemaValidator([testSchema]);

    const result = getSchema(validator, "nonexistent.event");

    expect(result.found).toBe(false);
    expect(result.error).toContain("nonexistent.event");
    expect(result.error).toContain("not found");
  });
});
