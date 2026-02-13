import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
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

  it("rejects files that are not valid JSON", async () => {
    writeFileSync(join(tempDir, "broken.json"), "not valid json {{{");

    await expect(loadSchemas(tempDir)).rejects.toThrow();
  });

  it("rejects schemas missing required $id field", async () => {
    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Missing ID",
      description: "No $id",
      version: "1.0.0",
      type: "object",
    };
    writeFileSync(
      join(tempDir, "missing-id.json"),
      JSON.stringify(schema, null, 2),
    );

    await expect(loadSchemas(tempDir)).rejects.toThrow("$id");
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
});
