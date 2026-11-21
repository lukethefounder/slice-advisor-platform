import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const input = await readFile(new URL("../../src/components/knowledge-graph/neural-geometry.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(input, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const geometry = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const illustration = geometry.buildNeuralGeometry(null);
assert.equal(illustration.illustrative, true);
assert.equal(illustration.vertices.length, 680);
assert.deepEqual(geometry.buildNeuralGeometry(null), illustration, "SSR/client geometry must be deterministic");
assert.equal(illustration.vertices.filter(point => point.x < 0).length, 340);
assert.equal(illustration.vertices.filter(point => point.x > 0).length, 340);
assert.ok(illustration.links.length <= 2100);
for (const point of illustration.vertices) {
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
  assert.ok(Math.abs(point.x) < 0.7 && Math.abs(point.y) < 0.7 && Math.abs(point.z) < 0.3);
  assert.equal(point.node, undefined, "Decorative points must not become research evidence");
  for (const time of [0, 1, 20, 10000]) {
    const moved = geometry.neuralDrift(point, point.phase, time);
    assert.ok(Math.hypot(moved.x - point.x, moved.y - point.y, moved.z - point.z) < 0.008);
    assert.deepEqual(geometry.neuralDrift(point, point.phase, time, false), point);
    const projected = geometry.projectNeuralPoint(moved, 0.22, -0.07);
    assert.ok(Number.isFinite(projected.x) && Number.isFinite(projected.y) && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1);
  }
}
for (const link of illustration.links) {
  assert.ok(link.source >= 0 && link.source < 680 && link.target >= 0 && link.target < 680);
}

const nodes = Array.from({ length: 10000 }, (_, index) => ({
  id: `agent:${index}`, kind: "agent", label: `Agent ${index}`, cohort: ["media", "technical", "economy"][index % 3],
  score: 50, confidence: 40, size: 4, group: "Research", properties: {},
}));
nodes.push({ id: "asset:MSFT", kind: "asset", label: "MSFT", cohort: "shared", score: null, confidence: null, size: 20, group: "Asset", properties: {} });
const edges = nodes.slice(0, 10000).map((node, index) => ({ id: `edge:${index}`, source: node.id, target: "asset:MSFT", kind: "RESEARCHES", weight: 0.5, cohort: node.cohort, properties: {} }));
const sourceGraph = { runId: "fixture", nodes, edges, nodeCount: nodes.length, edgeCount: edges.length };
const original = JSON.stringify(sourceGraph);
const actual = geometry.buildNeuralGeometry(sourceGraph);
assert.equal(actual.illustrative, false);
assert.equal(actual.vertices.length, 680);
assert.ok(actual.links.length <= 2000);
assert.ok(actual.vertices.some(vertex => vertex.id === "asset:MSFT"), "The stock must survive visual projection");
const actualPairs = new Set(edges.map(edge => `${edge.source}->${edge.target}`));
for (const link of actual.links) assert.ok(actualPairs.has(`${actual.vertices[link.source].id}->${actual.vertices[link.target].id}`), "Saved graphs must not acquire decorative evidence edges");
assert.equal(JSON.stringify(sourceGraph), original, "Layout must not change saved graph data");
for (const vertex of actual.vertices) assert.ok(vertex.node && nodes.includes(vertex.node));

console.log("Neural geometry checks passed: deterministic brain anatomy, finite bounded motion, reduced-motion stability, 10,000-node projection, original evidence edges, and immutable source records.");
