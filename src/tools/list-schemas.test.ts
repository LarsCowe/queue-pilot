import { describe, it, expect } from "vitest";
import { SchemaValidator } from "../schemas/validator.js";
import { listSchemas } from "./list-schemas.js";
import { orderSchema, paymentSchema } from "../test-fixtures.js";

describe("listSchemas", () => {
  it("returns all loaded schemas with metadata", () => {
    const validator = new SchemaValidator([orderSchema, paymentSchema]);

    const result = listSchemas(validator);

    expect(result.schemas).toHaveLength(2);
    expect(result.schemas[0]).toEqual({
      name: "order.created",
      version: "1.0.0",
      title: "Order Created",
      description: "Emitted when a new order is placed",
    });
  });

  it("returns empty list when no schemas are loaded", () => {
    const validator = new SchemaValidator([]);

    const result = listSchemas(validator);

    expect(result.schemas).toEqual([]);
  });
});
