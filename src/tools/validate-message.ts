import type { SchemaValidator } from "../schemas/validator.js";

export interface ValidateMessageResult {
  schemaName: string;
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
}

export function validateMessage(
  validator: SchemaValidator,
  schemaName: string,
  messageJson: string,
): ValidateMessageResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(messageJson);
  } catch {
    return {
      schemaName,
      valid: false,
      errors: [{ path: "", message: "Invalid JSON: failed to parse message" }],
    };
  }

  const result = validator.validate(schemaName, parsed);

  return {
    schemaName,
    valid: result.valid,
    errors: result.errors,
  };
}
