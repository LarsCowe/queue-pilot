import { describe, it, expect } from "vitest";
import { SchemaValidator } from "../schemas/validator.js";
import { listSchemas } from "./list-schemas.js";
import type { SchemaEntry } from "../schemas/types.js";

const testSchemas: SchemaEntry[] = [
  {
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
    },
  },
  {
    name: "invoice.generated",
    version: "2.0.0",
    title: "Invoice Generated",
    description: "Emitted when an invoice is generated",
    schema: {
      $id: "invoice.generated",
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Invoice Generated",
      description: "Emitted when an invoice is generated",
      version: "2.0.0",
      type: "object",
    },
  },
];

describe("listSchemas", () => {
  it("returns all loaded schemas with metadata", () => {
    const validator = new SchemaValidator(testSchemas);

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
