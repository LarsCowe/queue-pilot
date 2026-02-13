export interface SchemaDefinition {
  $id: string;
  $schema: string;
  title?: string;
  description?: string;
  version?: string;
  type: string;
  required?: string[];
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SchemaEntry {
  name: string;
  version: string;
  title: string;
  description: string;
  schema: SchemaDefinition;
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
