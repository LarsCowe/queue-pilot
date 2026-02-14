import type { BrokerAdapter } from "../broker/types.js";
import type { SchemaValidator } from "../schemas/validator.js";

export interface InspectedMessage {
  payload: string;
  payload_encoding: string;
  parsedPayload: unknown;
  properties: {
    correlation_id?: string;
    message_id?: string;
    type?: string;
    timestamp?: number;
    headers?: Record<string, unknown>;
    content_type?: string;
  };
  exchange: string;
  routing_key: string;
  validation: {
    schemaName: string | null;
    valid: boolean | null;
    errors: Array<{ path: string; message: string }>;
  };
}

export interface InspectQueueResult {
  queue: string;
  messages: InspectedMessage[];
  count: number;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    noSchema: number;
    skipped: number;
  };
}

export async function inspectQueue(
  adapter: BrokerAdapter,
  validator: SchemaValidator,
  scope: string,
  queue: string,
  count: number,
): Promise<InspectQueueResult> {
  const messages = await adapter.peekMessages(queue, count, scope);

  let validCount = 0;
  let invalidCount = 0;
  let noSchemaCount = 0;
  let skippedCount = 0;

  const inspected: InspectedMessage[] = messages.map((m) => {
    const schemaName = m.properties.type ?? null;
    let parsedPayload: unknown = null;
    let valid: boolean | null = null;
    let errors: Array<{ path: string; message: string }> = [];

    if (m.payload_encoding === "base64") {
      skippedCount++;
    } else {
      let jsonParsed = false;
      try {
        parsedPayload = JSON.parse(m.payload);
        jsonParsed = true;
      } catch {
        parsedPayload = m.payload;
      }

      if (schemaName) {
        const schemaEntry = validator.getSchema(schemaName);
        if (schemaEntry) {
          if (jsonParsed) {
            const result = validator.validate(schemaName, parsedPayload);
            valid = result.valid;
            errors = result.errors;

            if (valid) {
              validCount++;
            } else {
              invalidCount++;
            }
          } else {
            valid = false;
            errors = [{ path: "", message: "Invalid JSON payload" }];
            invalidCount++;
          }
        } else {
          noSchemaCount++;
          errors = [
            {
              path: "",
              message: `Schema "${schemaName}" not found`,
            },
          ];
        }
      } else {
        noSchemaCount++;
      }
    }

    return {
      payload: m.payload,
      payload_encoding: m.payload_encoding,
      parsedPayload,
      properties: {
        correlation_id: m.properties.correlation_id,
        message_id: m.properties.message_id,
        type: m.properties.type,
        timestamp: m.properties.timestamp,
        headers: m.properties.headers,
        content_type: m.properties.content_type,
      },
      exchange: m.metadata.exchange as string,
      routing_key: m.metadata.routing_key as string,
      validation: {
        schemaName,
        valid,
        errors,
      },
    };
  });

  return {
    queue,
    messages: inspected,
    count: inspected.length,
    summary: {
      total: inspected.length,
      valid: validCount,
      invalid: invalidCount,
      noSchema: noSchemaCount,
      skipped: skippedCount,
    },
  };
}
