import { readdir, readFile } from "fs/promises";
import { join } from "path";
import type { SchemaDefinition, SchemaEntry } from "./types.js";

export async function loadSchemas(directory: string): Promise<SchemaEntry[]> {
  const files = await readdir(directory);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const entries: SchemaEntry[] = [];

  for (const file of jsonFiles) {
    const filePath = join(directory, file);
    const content = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;

    if (!parsed.$id || typeof parsed.$id !== "string") {
      throw new Error(
        `Schema file "${file}" is missing a required "$id" field`,
      );
    }

    const schema = parsed as SchemaDefinition;

    entries.push({
      name: schema.$id,
      version: schema.version ?? "0.0.0",
      title: schema.title ?? schema.$id,
      description: schema.description ?? "",
      schema,
    });
  }

  return entries;
}
