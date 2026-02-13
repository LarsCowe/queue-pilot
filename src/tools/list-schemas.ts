import type { SchemaValidator } from "../schemas/validator.js";

export interface ListSchemasResult {
  schemas: Array<{
    name: string;
    version: string;
    title: string;
    description: string;
  }>;
}

export function listSchemas(validator: SchemaValidator): ListSchemasResult {
  const names = validator.getSchemaNames();
  const schemas = names.map((name) => {
    const entry = validator.getSchema(name)!;
    return {
      name: entry.name,
      version: entry.version,
      title: entry.title,
      description: entry.description,
    };
  });

  return { schemas };
}
