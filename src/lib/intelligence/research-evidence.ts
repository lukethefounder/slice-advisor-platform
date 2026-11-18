import type { ResearchEvidence } from "./research-swarm-types";

const PRIVATE_PARAMETER = /(?:api[-_]?key|access[-_]?key|(?:^|[-_])key(?:$|[-_])|token|auth|password|secret|signature|(?:^|[-_])sig(?:$|[-_])|credential|session|jwt|^code$)/i;
const TRACKING_PARAMETER = /^(?:utm_.+|fbclid|gclid|msclkid|_hs.+|mc_cid|mc_eid)$/i;

/** Provenance links are public HTTP(S) URLs, never provider credentials. */
export function safeResearchSourceUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (PRIVATE_PARAMETER.test(key) || TRACKING_PARAMETER.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return "";
  }
}

/** Domains, rather than endpoint names, are the unit of publisher diversity. */
export function researchSourceIdentity(evidence: Pick<ResearchEvidence, "sourceUrl" | "source">) {
  const url = safeResearchSourceUrl(evidence.sourceUrl);
  return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, "") : "";
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function evidenceKeys(evidence: ResearchEvidence) {
  const url = safeResearchSourceUrl(evidence.sourceUrl);
  const narrative = evidence.kind === "news" || evidence.kind === "social-narrative" || evidence.kind === "filing";
  const prefix = `${evidence.cohort}:${evidence.symbol}:${evidence.kind}:`;
  const title = normalized(evidence.title);
  const day = evidence.asOf?.slice(0, 10) ?? "undated";
  // Measurements can share an API documentation URL without being duplicates.
  if (!narrative) return [`${prefix}${title}:${evidence.asOf ?? ""}`];
  return [
    ...(url ? [`${prefix}url:${url}`] : []),
    `${prefix}text:${title}:${day}:${title.length >= 32 ? "" : normalized(evidence.summary)}`,
  ];
}

function mergeRelatedSources(sources: NonNullable<ResearchEvidence["relatedSources"]>, primaryUrl: string) {
  const unique = new Map<string, NonNullable<ResearchEvidence["relatedSources"]>[number]>();
  for (const source of sources) {
    const url = safeResearchSourceUrl(source.url);
    if (url && url !== primaryUrl && !unique.has(url)) unique.set(url, { ...source, url });
  }
  return [...unique.values()];
}

export function deduplicateResearchEvidence(input: ResearchEvidence[]) {
  const records: ResearchEvidence[] = [];
  const keys = new Map<string, number>();
  let duplicates = 0;
  for (const original of input) {
    const sourceUrl = safeResearchSourceUrl(original.sourceUrl);
    const item: ResearchEvidence = {
      ...original,
      sourceUrl,
      canonicalUrl: sourceUrl || null,
      sourceDomain: researchSourceIdentity({ ...original, sourceUrl }) || null,
      duplicateCount: original.duplicateCount ?? 0,
      relatedSources: mergeRelatedSources(original.relatedSources ?? [], sourceUrl),
    };
    const identities = evidenceKeys(item);
    const existingIndex = identities.map((key) => keys.get(key)).find((index) => index !== undefined);
    if (existingIndex !== undefined) {
      duplicates += 1;
      const existing = records[existingIndex];
      const primaryUrl = existing.sourceUrl || sourceUrl;
      const aliases = mergeRelatedSources([
        ...(existing.relatedSources ?? []),
        ...(item.relatedSources ?? []),
        { source: item.source, url: sourceUrl, asOf: item.asOf },
      ], primaryUrl);
      records[existingIndex] = {
        ...existing,
        source: existing.sourceUrl ? existing.source : item.source,
        sourceUrl: primaryUrl,
        canonicalUrl: primaryUrl || null,
        sourceDomain: researchSourceIdentity({ ...existing, sourceUrl: primaryUrl }) || null,
        duplicateCount: (existing.duplicateCount ?? 0) + (item.duplicateCount ?? 0) + 1,
        relatedSources: aliases,
      };
      for (const identity of identities) keys.set(identity, existingIndex);
      continue;
    }
    for (const identity of identities) keys.set(identity, records.length);
    records.push(item);
  }
  return { evidence: records, duplicateCount: duplicates };
}

function bounded(value: number) { return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0; }

/** Scores and confidence depend on independent evidence, never the agent count. */
export function aggregateResearchEvidence(input: ResearchEvidence[]) {
  const { evidence } = deduplicateResearchEvidence(input.filter((item) => item.kind !== "industry-context"));
  if (!evidence.length) return { score: 50, confidence: 0, dispersion: 0, agreement: 0, sourceCount: 0, evidenceCount: 0 };
  const sourceSizes = new Map<string, number>();
  const identities = evidence.map((item) => researchSourceIdentity(item));
  for (const identity of identities) sourceSizes.set(identity || "unverified", (sourceSizes.get(identity || "unverified") ?? 0) + 1);
  const sourceCount = [...sourceSizes.keys()].filter((key) => key !== "unverified").length;
  const weighted = evidence.map((item, index) => ({
    item,
    weight: Math.max(1, bounded(item.confidence)) * Math.max(0.05, bounded(item.relevanceScore) / 100)
      / (sourceSizes.get(identities[index] || "unverified") ?? 1) * (identities[index] ? 1 : 0.25),
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const mean = (select: (item: ResearchEvidence) => number) => weighted.reduce((sum, entry) => sum + select(entry.item) * entry.weight, 0) / Math.max(total, 1e-12);
  const score = mean((item) => bounded(item.score));
  const dispersion = Math.sqrt(mean((item) => (bounded(item.score) - score) ** 2));
  const agreement = bounded(100 - dispersion * 3.5);
  // Shared-source agreement is not independent confirmation. Missing evidence cannot become confidence.
  const sourceCap = sourceCount ? Math.min(90, 50 + sourceCount * 10) : 25;
  const confidence = Math.min(sourceCap, bounded(mean((item) => bounded(item.confidence)) * 0.7
    + agreement * 0.15 + Math.min(sourceCount * 10, 100) * 0.15));
  return { score, confidence, dispersion, agreement, sourceCount, evidenceCount: evidence.length };
}
