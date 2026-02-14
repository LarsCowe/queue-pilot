import type { z } from "zod";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, z.ZodTypeAny>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}
