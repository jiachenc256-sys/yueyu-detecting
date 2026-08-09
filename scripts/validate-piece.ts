#!/usr/bin/env node
/**
 * Validate piece JSON against schemas/piece.schema.json.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main(): Promise<void> {
  const schema = JSON.parse(
    await readFile(path.join(root, "schemas/piece.schema.json"), "utf8"),
  ) as object;

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const dir = path.join(root, "data/transcripts");
  const files = (await readdir(dir)).filter(
    (name) => name.endsWith(".json") && !name.endsWith(".base.json"),
  );

  if (files.length === 0) {
    throw new Error(`No piece JSON files found in ${dir}`);
  }

  let failed = 0;
  for (const name of files) {
    const filePath = path.join(dir, name);
    const data: unknown = JSON.parse(await readFile(filePath, "utf8"));
    const ok = validate(data);
    if (ok) {
      console.log(`OK  ${name}`);
    } else {
      failed += 1;
      console.error(`FAIL ${name}`);
      console.error(validate.errors);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
