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
  const schemas = names
    .map((name) => {
      const entry = validator.getSchema(name);
      if (!entry) return null;
      return {
        name: entry.name,
        version: entry.version,
        title: entry.title,
        description: entry.description,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return { schemas };
}
