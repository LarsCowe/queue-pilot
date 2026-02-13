import { readdir, readFile, access } from "fs/promises";
import { join } from "path";
import type { SchemaDefinition, SchemaEntry } from "./types.js";

export async function loadSchemas(directory: string): Promise<SchemaEntry[]> {
  try {
    await access(directory);
  } catch {
    throw new Error(`Schema directory not found: ${directory}`);
  }

  const files = await readdir(directory);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const entries: SchemaEntry[] = [];

  for (const file of jsonFiles) {
    try {
      const filePath = join(directory, file);
      const content = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(content) as Record<string, unknown>;

      if (!parsed.$id || typeof parsed.$id !== "string") {
        throw new Error(`Missing required "$id" field`);
      }

      const schema = parsed as SchemaDefinition;

      entries.push({
        name: schema.$id,
        version: schema.version ?? "0.0.0",
        title: schema.title ?? schema.$id,
        description: schema.description ?? "",
        schema,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Warning: skipping ${file}: ${message}\n`);
    }
  }

  return entries;
}
