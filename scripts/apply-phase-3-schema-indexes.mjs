import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PHASE_3_INDEXES } from "./phase-3-indexes.mjs";

const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");
const checkOnly = process.argv.includes("--check");

function fail(message) {
  process.stderr.write(`Phase 3 schema preparation failed:\n- ${message}\n`);
  process.exit(1);
}

function modelRange(source, modelName) {
  const marker = `model ${modelName} {`;
  const start = source.indexOf(marker);

  if (start === -1) return null;

  const openingBrace = source.indexOf("{", start);
  let depth = 0;

  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;

    if (depth === 0) {
      return {
        start,
        openingBrace,
        closingBrace: index,
        body: source.slice(openingBrace + 1, index),
      };
    }
  }

  return null;
}

if (!existsSync(schemaPath)) {
  fail("prisma/schema.prisma was not found. Run this command from the Slice repository root.");
}

const original = readFileSync(schemaPath, "utf8");
const newline = original.includes("\r\n") ? "\r\n" : "\n";
const byModel = new Map();

for (const index of PHASE_3_INDEXES) {
  const items = byModel.get(index.model) ?? [];
  items.push(index);
  byModel.set(index.model, items);
}

const missingModels = [];
const missingFields = [];
const missingIndexes = [];
const insertions = [];

for (const [modelName, indexes] of byModel.entries()) {
  const range = modelRange(original, modelName);

  if (!range) {
    missingModels.push(modelName);
    continue;
  }

  const fieldNames = new Set(
    range.body
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s+/)?.[1] ?? "")
      .filter(Boolean),
  );

  for (const index of indexes) {
    const absentFields = index.fields.filter((field) => !fieldNames.has(field));

    if (absentFields.length) {
      missingFields.push(`${modelName}: ${absentFields.join(", ")}`);
      continue;
    }

    if (range.body.includes(`map: "${index.name}"`)) {
      continue;
    }

    missingIndexes.push(index.name);
    insertions.push({
      position: range.closingBrace,
      text: `  ${index.prisma}${newline}`,
    });
  }
}

if (missingModels.length || missingFields.length) {
  const messages = [
    ...missingModels.map((model) => `Model not found: ${model}`),
    ...missingFields.map((fields) => `Expected field not found: ${fields}`),
  ];

  fail(messages.join("\n- "));
}

if (checkOnly) {
  if (missingIndexes.length) {
    fail(`Missing Prisma index declarations: ${missingIndexes.join(", ")}`);
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        mode: "check",
        schema: "prisma/schema.prisma",
        expectedIndexes: PHASE_3_INDEXES.length,
        missingIndexes: [],
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

if (!insertions.length) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        mode: "write",
        schema: "prisma/schema.prisma",
        changed: false,
        addedIndexes: [],
        expectedIndexes: PHASE_3_INDEXES.length,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

let updated = original;

for (const insertion of insertions.sort((left, right) => right.position - left.position)) {
  updated = `${updated.slice(0, insertion.position)}${insertion.text}${updated.slice(insertion.position)}`;
}

writeFileSync(schemaPath, updated, "utf8");

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      mode: "write",
      schema: "prisma/schema.prisma",
      changed: true,
      addedIndexes: missingIndexes,
      expectedIndexes: PHASE_3_INDEXES.length,
      checkedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);