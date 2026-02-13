import { createRequire } from "module";
import type { SchemaDefinition, SchemaEntry, ValidationResult } from "./types.js";

interface AjvInstance {
  addSchema(schema: Record<string, unknown>, key: string): void;
  validate(schemaKeyRef: string, data: unknown): boolean;
  errors: Array<{ instancePath: string; message?: string }> | null;
}

const require = createRequire(import.meta.url);
const AjvConstructor = (require("ajv").default ?? require("ajv")) as new (opts: { allErrors: boolean }) => AjvInstance;
const addFormats = (require("ajv-formats").default ?? require("ajv-formats")) as (ajv: AjvInstance) => void;

const JSON_SCHEMA_DRAFT07_KEYWORDS = new Set([
  "$id",
  "$schema",
  "$ref",
  "$comment",
  "title",
  "description",
  "default",
  "readOnly",
  "writeOnly",
  "examples",
  "type",
  "enum",
  "const",
  "properties",
  "required",
  "additionalProperties",
  "patternProperties",
  "propertyNames",
  "minProperties",
  "maxProperties",
  "dependencies",
  "items",
  "additionalItems",
  "contains",
  "minItems",
  "maxItems",
  "uniqueItems",
  "allOf",
  "anyOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else",
  "format",
  "minLength",
  "maxLength",
  "pattern",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "contentMediaType",
  "contentEncoding",
  "definitions",
]);

function stripNonStandardKeywords(schema: SchemaDefinition): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (JSON_SCHEMA_DRAFT07_KEYWORDS.has(key)) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export class SchemaValidator {
  private readonly ajv: AjvInstance;
  private readonly schemas: Map<string, SchemaEntry>;

  constructor(schemas: SchemaEntry[]) {
    this.ajv = new AjvConstructor({ allErrors: true });
    addFormats(this.ajv);
    this.schemas = new Map();

    for (const entry of schemas) {
      this.schemas.set(entry.name, entry);
      this.ajv.addSchema(stripNonStandardKeywords(entry.schema), entry.name);
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
