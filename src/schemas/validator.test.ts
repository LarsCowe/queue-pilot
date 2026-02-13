import { describe, it, expect, beforeEach, vi } from "vitest";
import { SchemaValidator } from "./validator.js";
import type { SchemaEntry } from "./types.js";

const registrationSchema: SchemaEntry = {
  name: "registration.created",
  version: "1.0.0",
  title: "Registration Created",
  description: "Emitted when a person registers for a session",
  schema: {
    $id: "registration.created",
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Registration Created",
    description: "Emitted when a person registers for a session",
    version: "1.0.0",
    type: "object",
    required: ["messageId", "timestamp", "payload"],
    properties: {
      messageId: { type: "string", format: "uuid" },
      timestamp: { type: "string", format: "date-time" },
      payload: {
        type: "object",
        required: ["personId", "name", "email"],
        properties: {
          personId: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
        },
      },
    },
  },
};

describe("SchemaValidator", () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator([registrationSchema]);
  });

  it("validates a correct message as valid", () => {
    const message = {
      messageId: "550e8400-e29b-41d4-a716-446655440000",
      timestamp: "2025-01-15T10:30:00Z",
      payload: {
        personId: "P-12345",
        name: "Jan Janssen",
        email: "jan@example.com",
      },
    };

    const result = validator.validate("registration.created", message);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("detects missing required fields", () => {
    const message = {
      messageId: "550e8400-e29b-41d4-a716-446655440000",
      timestamp: "2025-01-15T10:30:00Z",
      // payload is missing
    };

    const result = validator.validate("registration.created", message);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain("payload");
  });

  it("detects wrong field types", () => {
    const message = {
      messageId: "550e8400-e29b-41d4-a716-446655440000",
      timestamp: "2025-01-15T10:30:00Z",
      payload: {
        personId: 12345, // should be string
        name: "Jan Janssen",
        email: "jan@example.com",
      },
    };

    const result = validator.validate("registration.created", message);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("personId"))).toBe(true);
  });

  it("detects invalid format (email)", () => {
    const message = {
      messageId: "550e8400-e29b-41d4-a716-446655440000",
      timestamp: "2025-01-15T10:30:00Z",
      payload: {
        personId: "P-12345",
        name: "Jan Janssen",
        email: "not-an-email",
      },
    };

    const result = validator.validate("registration.created", message);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("email"))).toBe(true);
  });

  it("provides clear error messages with path", () => {
    const message = {
      messageId: "not-a-uuid",
      timestamp: "2025-01-15T10:30:00Z",
      payload: {
        personId: "P-12345",
        name: "Jan Janssen",
        email: "jan@example.com",
      },
    };

    const result = validator.validate("registration.created", message);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toHaveProperty("path");
    expect(result.errors[0]).toHaveProperty("message");
    expect(result.errors[0].message.length).toBeGreaterThan(0);
  });

  it("returns error for unknown schema name", () => {
    const message = { some: "data" };

    const result = validator.validate("nonexistent.schema", message);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("nonexistent.schema");
  });

  it("returns the list of available schema names", () => {
    const names = validator.getSchemaNames();

    expect(names).toEqual(["registration.created"]);
  });

  it("returns a schema by name", () => {
    const schema = validator.getSchema("registration.created");

    expect(schema).toBeDefined();
    expect(schema!.name).toBe("registration.created");
  });

  it("returns undefined for unknown schema name", () => {
    const schema = validator.getSchema("unknown.event");

    expect(schema).toBeUndefined();
  });

  it("handles schemas with custom keywords like x-category", () => {
    const schemaWithCustomKeys: SchemaEntry = {
      name: "inventory.updated",
      version: "2.0.0",
      title: "Inventory Updated",
      description: "Emitted when inventory changes",
      schema: {
        $id: "inventory.updated",
        $schema: "http://json-schema.org/draft-07/schema#",
        title: "Inventory Updated",
        description: "Emitted when inventory changes",
        version: "2.0.0",
        "x-category": "warehouse",
        namespace: "inventory",
        "x-owner": "logistics-team",
        type: "object",
        required: ["sku", "quantity"],
        properties: {
          sku: { type: "string" },
          quantity: { type: "integer" },
        },
      },
    };

    const customValidator = new SchemaValidator([schemaWithCustomKeys]);

    const result = customValidator.validate("inventory.updated", {
      sku: "WIDGET-42",
      quantity: 150,
    });

    expect(result.valid).toBe(true);
  });

  it("handles schemas with nested custom keywords like x-display-name", () => {
    const schemaWithNestedCustomKeys: SchemaEntry = {
      name: "shipment.dispatched",
      version: "1.0.0",
      title: "Shipment Dispatched",
      description: "Emitted when a shipment leaves the warehouse",
      schema: {
        $id: "shipment.dispatched",
        $schema: "http://json-schema.org/draft-07/schema#",
        title: "Shipment Dispatched",
        description: "Emitted when a shipment leaves the warehouse",
        version: "1.0.0",
        type: "object",
        required: ["trackingCode", "carrier"],
        properties: {
          trackingCode: {
            type: "string",
            "x-display-name": "Tracking Code",
          },
          carrier: {
            type: "string",
            "x-display-name": "Carrier Name",
          },
        },
      },
    };

    const nestedValidator = new SchemaValidator([schemaWithNestedCustomKeys]);

    const result = nestedValidator.validate("shipment.dispatched", {
      trackingCode: "TRK-98765",
      carrier: "DHL Express",
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("skips a schema that causes addSchema to throw", () => {
    const invalidSchema: SchemaEntry = {
      name: "broken.event",
      version: "1.0.0",
      title: "Broken Event",
      description: "Schema with an invalid type value that Ajv rejects",
      schema: {
        $id: "broken.event",
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "invalid-type" as unknown as string,
      },
    };

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const validator = new SchemaValidator([invalidSchema, registrationSchema]);
    stderrSpy.mockRestore();

    const names = validator.getSchemaNames();

    expect(names).not.toContain("broken.event");
  });

  it("still loads valid schemas when an earlier schema fails", () => {
    const invalidSchema: SchemaEntry = {
      name: "broken.event",
      version: "1.0.0",
      title: "Broken Event",
      description: "Schema with an invalid type value that Ajv rejects",
      schema: {
        $id: "broken.event",
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "invalid-type" as unknown as string,
      },
    };

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const validator = new SchemaValidator([invalidSchema, registrationSchema]);
    stderrSpy.mockRestore();

    const result = validator.validate("registration.created", {
      messageId: "550e8400-e29b-41d4-a716-446655440000",
      timestamp: "2025-01-15T10:30:00Z",
      payload: {
        personId: "P-12345",
        name: "Jan Janssen",
        email: "jan@example.com",
      },
    });

    expect(result.valid).toBe(true);
  });

  it("writes a warning to stderr when a schema is skipped", () => {
    const invalidSchema: SchemaEntry = {
      name: "broken.event",
      version: "1.0.0",
      title: "Broken Event",
      description: "Schema with an invalid type value that Ajv rejects",
      schema: {
        $id: "broken.event",
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "invalid-type" as unknown as string,
      },
    };

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    new SchemaValidator([invalidSchema, registrationSchema]);

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: skipping schema "broken.event"')
    );

    stderrSpy.mockRestore();
  });

  it("dispatches validation to the correct schema when multiple are loaded", () => {
    const orderSchema: SchemaEntry = {
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

    const multiValidator = new SchemaValidator([registrationSchema, orderSchema]);

    const orderResult = multiValidator.validate("order.created", {
      orderId: "ORD-001",
      amount: 49.99,
    });
    expect(orderResult.valid).toBe(true);

    const crossResult = multiValidator.validate("registration.created", {
      orderId: "ORD-001",
      amount: 49.99,
    });
    expect(crossResult.valid).toBe(false);
  });
});
