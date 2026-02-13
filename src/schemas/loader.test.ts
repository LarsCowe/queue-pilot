import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadSchemas } from "./loader.js";

describe("loadSchemas", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "qp-schemas-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("loads valid JSON Schema files from a directory", async () => {
    const schema = {
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
    };
    writeFileSync(
      join(tempDir, "order.created.json"),
      JSON.stringify(schema, null, 2),
    );

    const result = await loadSchemas(tempDir);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("order.created");
    expect(result[0].version).toBe("1.0.0");
    expect(result[0].title).toBe("Order Created");
    expect(result[0].description).toBe("Emitted when a new order is placed");
    expect(result[0].schema).toEqual(schema);
  });

  it("returns an empty list for an empty directory", async () => {
    const result = await loadSchemas(tempDir);

    expect(result).toEqual([]);
  });

  it("skips corrupt JSON files and loads valid ones", async () => {
    writeFileSync(join(tempDir, "broken.json"), "not valid json {{{");
    const validSchema = {
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
    };
    writeFileSync(
      join(tempDir, "order.created.json"),
      JSON.stringify(validSchema, null, 2),
    );

    const result = await loadSchemas(tempDir);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("order.created");
  });

  it("skips schemas missing $id and loads valid ones", async () => {
    const missingId = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Missing ID",
      description: "No $id",
      version: "1.0.0",
      type: "object",
    };
    writeFileSync(
      join(tempDir, "missing-id.json"),
      JSON.stringify(missingId, null, 2),
    );
    const validSchema = {
      $id: "valid.event",
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Valid Event",
      description: "A valid schema",
      version: "1.0.0",
      type: "object",
    };
    writeFileSync(
      join(tempDir, "valid.event.json"),
      JSON.stringify(validSchema, null, 2),
    );

    const result = await loadSchemas(tempDir);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("valid.event");
  });

  it("warns to stderr when skipping a corrupt file", async () => {
    writeFileSync(join(tempDir, "broken.json"), "not valid json {{{");
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await loadSchemas(tempDir);

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("broken.json"),
    );
    stderrSpy.mockRestore();
  });

  it("ignores non-JSON files in the directory", async () => {
    writeFileSync(join(tempDir, "readme.txt"), "not a schema");
    const schema = {
      $id: "valid.event",
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Valid Event",
      description: "A valid schema",
      version: "1.0.0",
      type: "object",
    };
    writeFileSync(
      join(tempDir, "valid.event.json"),
      JSON.stringify(schema, null, 2),
    );

    const result = await loadSchemas(tempDir);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("valid.event");
  });

  it("loads multiple schemas from a directory", async () => {
    const schemas = [
      {
        $id: "user.registered",
        $schema: "http://json-schema.org/draft-07/schema#",
        title: "User Registered",
        description: "New user registration",
        version: "1.0.0",
        type: "object",
      },
      {
        $id: "payment.processed",
        $schema: "http://json-schema.org/draft-07/schema#",
        title: "Payment Processed",
        description: "Payment was processed",
        version: "2.1.0",
        type: "object",
      },
    ];
    for (const s of schemas) {
      writeFileSync(
        join(tempDir, `${s.$id}.json`),
        JSON.stringify(s, null, 2),
      );
    }

    const result = await loadSchemas(tempDir);

    expect(result).toHaveLength(2);
    const names = result.map((r) => r.name).sort();
    expect(names).toEqual(["payment.processed", "user.registered"]);
  });

  it("uses default values when version, title, and description are missing", async () => {
    const schema = {
      $id: "minimal.event",
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
    };
    writeFileSync(
      join(tempDir, "minimal.event.json"),
      JSON.stringify(schema, null, 2),
    );

    const result = await loadSchemas(tempDir);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("minimal.event");
    expect(result[0].version).toBe("0.0.0");
    expect(result[0].title).toBe("minimal.event");
    expect(result[0].description).toBe("");
  });

  it("skips duplicate $id and warns to stderr", async () => {
    const schema1 = {
      $id: "payment.received",
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Payment Received v1",
      description: "First file with this $id",
      version: "1.0.0",
      type: "object",
    };
    const schema2 = {
      $id: "payment.received",
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Payment Received v2",
      description: "Second file with the same $id",
      version: "2.0.0",
      type: "object",
    };
    writeFileSync(
      join(tempDir, "payment-v1.json"),
      JSON.stringify(schema1, null, 2),
    );
    writeFileSync(
      join(tempDir, "payment-v2.json"),
      JSON.stringify(schema2, null, 2),
    );
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const result = await loadSchemas(tempDir);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("payment.received");
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("duplicate"),
    );
    stderrSpy.mockRestore();
  });

  it("throws a clear error when directory does not exist", async () => {
    const nonExistentDir = join(tempDir, "does-not-exist");

    await expect(loadSchemas(nonExistentDir)).rejects.toThrow(
      `Schema directory not found: ${nonExistentDir}`,
    );
  });

  it("loads schemas from subdirectories recursively", async () => {
    const subDir = join(tempDir, "events", "orders");
    mkdirSync(subDir, { recursive: true });
    const schema = {
      $id: "order.shipped",
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Order Shipped",
      description: "Emitted when an order is shipped",
      version: "1.0.0",
      type: "object",
      required: ["orderId"],
      properties: {
        orderId: { type: "string" },
      },
    };
    writeFileSync(
      join(subDir, "order.shipped.json"),
      JSON.stringify(schema, null, 2),
    );

    const result = await loadSchemas(tempDir);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("order.shipped");
  });
});
