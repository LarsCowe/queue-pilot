import type { BrokerAdapter } from "../broker/types.js";
import type { SchemaValidator } from "../schemas/validator.js";

export interface PublishMessageParams {
  exchange: string;
  routing_key: string;
  payload: string;
  message_type?: string;
  headers?: Record<string, string | number | boolean | null>;
  validate: boolean;
  vhost: string;
}

export interface PublishMessageResult {
  published: boolean;
  routed: boolean;
  exchange: string;
  routing_key: string;
  validation: {
    validated: boolean;
    schemaName: string | null;
    valid: boolean | null;
    errors: Array<{ path: string; message: string }>;
  };
}

export async function publishMessage(
  adapter: BrokerAdapter,
  validator: SchemaValidator,
  params: PublishMessageParams,
): Promise<PublishMessageResult> {
  const { exchange, routing_key, payload, message_type, headers, validate, vhost } = params;

  const baseResult: PublishMessageResult = {
    published: false,
    routed: false,
    exchange,
    routing_key,
    validation: {
      validated: false,
      schemaName: message_type ?? null,
      valid: null,
      errors: [],
    },
  };

  // 1. Always parse payload as JSON. Block publish if invalid.
  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(payload);
  } catch {
    return {
      ...baseResult,
      validation: {
        ...baseResult.validation,
        errors: [{ path: "", message: "Invalid JSON payload" }],
      },
    };
  }

  // 2. Validate if requested and message_type is provided
  let validation = baseResult.validation;

  if (validate && message_type) {
    const schemaEntry = validator.getSchema(message_type);

    if (!schemaEntry) {
      return {
        ...baseResult,
        validation: {
          ...baseResult.validation,
          validated: true,
          valid: false,
          errors: [{ path: "", message: `Schema "${message_type}" not found` }],
        },
      };
    }

    const validationResult = validator.validate(message_type, parsedPayload);

    if (!validationResult.valid) {
      return {
        ...baseResult,
        validation: {
          ...baseResult.validation,
          validated: true,
          valid: false,
          errors: validationResult.errors,
        },
      };
    }

    validation = {
      ...baseResult.validation,
      validated: true,
      valid: true,
    };
  }

  // 3. Publish via adapter
  const properties: Record<string, unknown> = {
    content_type: "application/json",
  };

  if (message_type) {
    properties.type = message_type;
  }

  if (headers) {
    properties.headers = headers;
  }

  const response = await adapter.publishMessage({
    destination: exchange,
    routing_key,
    payload,
    properties,
    scope: vhost,
  });

  return {
    ...baseResult,
    published: true,
    routed: response.routed,
    validation,
  };
}
