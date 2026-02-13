import type { RabbitMQClient } from "../rabbitmq/client.js";
import type { SchemaValidator } from "../schemas/validator.js";

export interface InspectedMessage {
  payload: string;
  parsedPayload: unknown;
  properties: {
    correlation_id?: string;
    message_id?: string;
    type?: string;
    timestamp?: number;
    headers?: Record<string, unknown>;
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
  };
}

export async function inspectQueue(
  client: RabbitMQClient,
  validator: SchemaValidator,
  vhost: string,
  queue: string,
  count: number,
): Promise<InspectQueueResult> {
  const messages = await client.peekMessages(vhost, queue, count);

  let validCount = 0;
  let invalidCount = 0;
  let noSchemaCount = 0;

  const inspected: InspectedMessage[] = messages.map((m) => {
    const schemaName = m.properties.type ?? null;
    let parsedPayload: unknown = null;
    let valid: boolean | null = null;
    let errors: Array<{ path: string; message: string }> = [];

    try {
      parsedPayload = JSON.parse(m.payload);
    } catch {
      parsedPayload = m.payload;
    }

    if (schemaName) {
      const schemaEntry = validator.getSchema(schemaName);
      if (schemaEntry) {
        const result = validator.validate(schemaName, parsedPayload);
        valid = result.valid;
        errors = result.errors;

        if (valid) {
          validCount++;
        } else {
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

    return {
      payload: m.payload,
      parsedPayload,
      properties: {
        correlation_id: m.properties.correlation_id,
        message_id: m.properties.message_id,
        type: m.properties.type,
        timestamp: m.properties.timestamp,
        headers: m.properties.headers,
      },
      exchange: m.exchange,
      routing_key: m.routing_key,
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
    },
  };
}
