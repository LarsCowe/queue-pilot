import { readdir, readFile, realpath } from "fs/promises";
import { join, relative, isAbsolute } from "path";
import type { SchemaDefinition, SchemaEntry } from "./types.js";

export async function loadSchemas(directory: string): Promise<SchemaEntry[]> {
  let files: string[];
  try {
    files = await readdir(directory, { recursive: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Schema directory not found: ${directory}`);
    }
    throw error;
  }

  const jsonFiles = files.filter(
    (f) => typeof f === "string" && f.endsWith(".json"),
  );

  const resolvedDir = await realpath(directory);
  const entries: SchemaEntry[] = [];
  const seenIds = new Set<string>();

  for (const file of jsonFiles) {
    try {
      const filePath = join(directory, file);
      const resolvedPath = await realpath(filePath);
      const rel = relative(resolvedDir, resolvedPath);
      if (rel.startsWith("..") || isAbsolute(rel)) {
        process.stderr.write(`Warning: skipping ${file}: path outside schema directory\n`);
        continue;
      }
      const content = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(content) as Record<string, unknown>;

      if (!parsed.$id || typeof parsed.$id !== "string") {
        throw new Error(`Missing required "$id" field`);
      }

      const schema = parsed as SchemaDefinition;

      if (seenIds.has(schema.$id)) {
        process.stderr.write(`Warning: skipping ${file}: duplicate $id "${schema.$id}"\n`);
        continue;
      }
      seenIds.add(schema.$id);

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
