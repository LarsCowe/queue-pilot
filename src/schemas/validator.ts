import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { SchemaDefinition, SchemaEntry, ValidationResult } from "./types.js";

const CUSTOM_KEYWORDS = new Set(["version"]);

function stripCustomKeywords(schema: SchemaDefinition): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!CUSTOM_KEYWORDS.has(key)) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export class SchemaValidator {
  private readonly ajv: Ajv;
  private readonly schemas: Map<string, SchemaEntry>;

  constructor(schemas: SchemaEntry[]) {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
    this.schemas = new Map();

    for (const entry of schemas) {
      this.schemas.set(entry.name, entry);
      this.ajv.addSchema(stripCustomKeywords(entry.schema), entry.name);
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
