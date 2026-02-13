import type { SchemaValidator } from "../schemas/validator.js";

export interface GetSchemaResult {
  found: boolean;
  name: string;
  schema?: Record<string, unknown>;
  error?: string;
}

export function getSchema(
  validator: SchemaValidator,
  name: string,
): GetSchemaResult {
  const entry = validator.getSchema(name);

  if (!entry) {
    return {
      found: false,
      name,
      error: `Schema "${name}" not found. Use list_schemas to see available schemas.`,
    };
  }

  return {
    found: true,
    name: entry.name,
    schema: entry.schema as unknown as Record<string, unknown>,
  };
}
