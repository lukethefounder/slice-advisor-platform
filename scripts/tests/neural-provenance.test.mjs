import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(new URL("../../src/lib/intelligence/research-evidence.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  fileName: "research-evidence.ts",
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
const { aggregateResearchEvidence, deduplicateResearchEvidence } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);

const evaluatedAt = "2026-11-19T12:00:00.000Z";
const options = { evaluatedAt };
const record = changes => ({
  id: "valid-original", cohort: "media", kind: "news", symbol: "TEST",
  title: "Company publishes a detailed quarterly earnings report", summary: "The original dated report.",
  source: "Original publisher", sourceUrl: "https://news.example/report",
  asOf: "2026-11-19T11:00:00.000Z", retrievedAt: "2026-11-19T11:58:00.000Z",
  score: 74, confidence: 83, freshnessScore: 94, relevanceScore: 100, polarity: "positive",
  sector: "Technology", industry: "Software", topics: ["earnings"], metrics: { sentiment: 0.48 }, warnings: [],
  ...changes,
});
const valid = record();
const undated = record({ id: "a-undated", asOf: null, score: 5, confidence: 99, summary: "Undated provider copy." });
const future = record({ id: "a-future", asOf: "2026-11-20T11:00:00.000Z", retrievedAt: "2026-11-20T11:01:00.000Z", score: 99, confidence: 99 });
const stale = record({ id: "a-stale", asOf: "2026-11-01T11:00:00.000Z", retrievedAt: "2026-11-01T11:01:00.000Z", score: 1, confidence: 100 });
const canonicalFields = ["id", "cohort", "kind", "symbol", "title", "summary", "source", "asOf", "retrievedAt", "score", "confidence", "freshnessScore", "relevanceScore", "polarity", "sector", "industry", "topics", "metrics", "warnings"];
const coherentFields = value => Object.fromEntries(canonicalFields.map(key => [key, value[key]]));
const permutations = items => items.length < 2 ? [items] : items.flatMap((item, index) => permutations(items.filter((_, other) => other !== index)).map(tail => [item, ...tail]));

const input = [undated, future, stale, valid];
const originalInput = structuredClone(input);
const expected = deduplicateResearchEvidence(input, options);
assert.equal(expected.evidence.length, 1);
assert.equal(expected.duplicateCount, 3);
assert.equal(expected.evidence[0].duplicateCount, 3);
assert.deepEqual(coherentFields(expected.evidence[0]), coherentFields(valid), "The selected evidence must come from one coherent original record");
const expectedScore = aggregateResearchEvidence(input, options);
assert.equal(expectedScore.evidenceCount, 1);
assert.deepEqual(expectedScore.eligibleEvidenceIds, [valid.id], "Keep the chosen original ID so agent/source references remain valid");
for (const order of permutations(input)) {
  assert.deepEqual(deduplicateResearchEvidence(order, options), expected, "Canonical evidence must not depend on arrival order");
  assert.deepEqual(aggregateResearchEvidence(order, options), expectedScore, "Duplicate order must not change score or diagnostics");
}
assert.deepEqual(input, originalInput, "Deduplication must not mutate caller records");
assert.deepEqual(deduplicateResearchEvidence(expected.evidence, options).evidence, expected.evidence, "A retained canonical record remains stable when deduplicated again");

const invalid = deduplicateResearchEvidence([future, undated], options).evidence[0];
assert.equal(invalid.asOf, null, "A missing observation date must never be replaced with an invented or borrowed date");
assert.deepEqual(coherentFields(invalid), coherentFields(undated));
assert.equal(aggregateResearchEvidence([future, undated], options).evidenceCount, 0);

const unverified = record({ id: "a-unverified", sourceUrl: "", score: 2, confidence: 100 });
const zeroQuality = record({ id: "a-zero-quality", score: 100, confidence: 0 });
for (const order of permutations([valid, unverified, zeroQuality])) {
  const chosen = deduplicateResearchEvidence(order, options).evidence[0];
  assert.deepEqual(coherentFields(chosen), coherentFields(valid), "Valid timestamps alone must not let unusable evidence displace an eligible record");
  assert.equal(chosen.sourceUrl, valid.sourceUrl);
}

const newer = record({ id: "newer-original", asOf: "2026-11-19T11:30:00.000Z", score: 35, confidence: 72, summary: "A revised report." });
for (const order of permutations([valid, newer])) {
  assert.deepEqual(coherentFields(deduplicateResearchEvidence(order, options).evidence[0]), coherentFields(newer), "A newer eligible observation is retained as a complete record");
}

const retained = record({ duplicateCount: 2, relatedSources: [{ source: "Original filing", url: "https://filings.example/document?id=7", asOf: valid.asOf }] });
const republished = record({
  id: "z-republication", source: "Republisher", sourceUrl: "https://republisher.example/copy?utm_source=feed",
  relatedSources: [{ source: "Related report", url: "https://related.example/story?token=PRIVATE", asOf: null }],
});
for (const order of permutations([republished, retained])) {
  const result = deduplicateResearchEvidence(order, options);
  assert.deepEqual(coherentFields(result.evidence[0]), coherentFields(retained));
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.evidence[0].duplicateCount, 3, "Preserve preexisting duplicate counts");
  assert.deepEqual(result.evidence[0].relatedSources, [
    { source: "Original filing", url: "https://filings.example/document?id=7", asOf: valid.asOf },
    { source: "Related report", url: "https://related.example/story", asOf: null },
    { source: "Republisher", url: "https://republisher.example/copy", asOf: valid.asOf },
  ], "Retain safe, ordered provenance aliases without synthesizing their dates");
}

const independent = record({ id: "independent", title: "Separate customer survey reports demand weakness", sourceUrl: "https://independent.example/survey", score: 30 });
for (const order of permutations([valid, undated, independent])) {
  const result = deduplicateResearchEvidence(order, options);
  assert.equal(result.evidence.length, 2, "Distinct evidence must remain distinct");
  assert.deepEqual(new Set(result.evidence.map(item => item.id)), new Set([valid.id, independent.id]));
}

console.log("Neural provenance tests passed: eligible canonical records, duplicate permutation invariance, coherent timestamps, aliases, and input immutability.");
