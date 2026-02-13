import { describe, it, expect } from "vitest";
import { SchemaValidator } from "../schemas/validator.js";
import { getSchema } from "./get-schema.js";
import { orderSchema } from "../test-fixtures.js";

describe("getSchema", () => {
  it("returns the full schema definition for a known schema", () => {
    const validator = new SchemaValidator([orderSchema]);

    const result = getSchema(validator, "order.created");

    expect(result.found).toBe(true);
    expect(result.name).toBe("order.created");
    if (!result.found) throw new Error("expected found to be true");
    expect(result.schema).toBeDefined();
    expect(result.schema.required).toEqual(["orderId", "amount"]);
  });

  it("returns an error for an unknown schema", () => {
    const validator = new SchemaValidator([orderSchema]);

    const result = getSchema(validator, "nonexistent.event");

    expect(result.found).toBe(false);
    if (result.found) throw new Error("expected found to be false");
    expect(result.error).toContain("nonexistent.event");
    expect(result.error).toContain("not found");
  });
});
