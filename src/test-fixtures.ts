import type { SchemaEntry } from "./schemas/types.js";

export const orderSchema: SchemaEntry = {
  name: "order.created",
  version: "1.0.0",
  title: "Order Created",
  description: "Emitted when a new order is placed",
  schema: {
    $id: "order.created",
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Order Created",
    description: "Emitted when a new order is placed",
    version: "1.0.0",
    type: "object",
    required: ["orderId", "amount"],
    properties: {
      orderId: { type: "string" },
      amount: { type: "number" },
    },
  },
};

export const paymentSchema: SchemaEntry = {
  name: "payment.processed",
  version: "1.0.0",
  title: "Payment Processed",
  description: "Emitted when a payment has been processed",
  schema: {
    $id: "payment.processed",
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Payment Processed",
    description: "Emitted when a payment has been processed",
    version: "1.0.0",
    type: "object",
    required: ["invoiceId", "amount", "currency"],
    properties: {
      invoiceId: { type: "string" },
      amount: { type: "number" },
      currency: { type: "string" },
    },
  },
};
