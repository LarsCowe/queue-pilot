import { createRequire } from "module";
import type { SchemaEntry, ValidationResult } from "./types.js";

interface AjvInstance {
  addSchema(schema: Record<string, unknown>, key: string): void;
  validate(schemaKeyRef: string, data: unknown): boolean;
  errors: Array<{ instancePath: string; message?: string }> | null;
}

const require = createRequire(import.meta.url);
const AjvConstructor = (require("ajv").default ?? require("ajv")) as new (opts: { allErrors: boolean; strict: boolean }) => AjvInstance;
const addFormats = (require("ajv-formats").default ?? require("ajv-formats")) as (ajv: AjvInstance) => void;

export class SchemaValidator {
  private readonly ajv: AjvInstance;
  private readonly schemas: Map<string, SchemaEntry>;

  constructor(schemas: SchemaEntry[]) {
    this.ajv = new AjvConstructor({ allErrors: true, strict: false });
    addFormats(this.ajv);
    this.schemas = new Map();

    for (const entry of schemas) {
      try {
        this.ajv.addSchema(entry.schema as Record<string, unknown>, entry.name);
        this.schemas.set(entry.name, entry);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Warning: skipping schema "${entry.name}": ${msg}\n`);
      }
    }
  }

  validate(schemaName: string, message: unknown): ValidationResult {
    const entry = this.schemas.get(schemaName);
    if (!entry) {
      return {
        valid: false,
        errors: [
          {
            path: "",
            message: `Schema "${schemaName}" not found`,
          },
        ],
      };
    }

    const valid = this.ajv.validate(schemaName, message);

    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors = (this.ajv.errors ?? []).map((err) => ({
      path: err.instancePath || "/",
      message: err.message ?? "Unknown validation error",
    }));

    return { valid: false, errors };
  }

  getSchemaNames(): string[] {
    return Array.from(this.schemas.keys());
  }

  getSchema(name: string): SchemaEntry | undefined {
    return this.schemas.get(name);
  }
}
