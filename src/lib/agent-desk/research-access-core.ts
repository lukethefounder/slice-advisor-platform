import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { AgentDeskError } from "./contracts";
import type { AgentResearchSource } from "./research-access-types";

export const researchHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const researchObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
export function researchJson(value: unknown): Record<string, unknown> {
  if (researchObject(value)) return value;
  if (typeof value !== "string" || value.length > 4_000_000) return {};
  try { const parsed: unknown = JSON.parse(value); return researchObject(parsed) ? parsed : {}; } catch { return {}; }
}
export function researchText(value: unknown, maximum = 500): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum) : "";
}
export function researchDate(value: unknown, now = Date.now()): string | null {
  const time = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time > 0 && time <= now + 300_000 ? new Date(time).toISOString() : null;
}
export function requireResearchSymbol(value: unknown): string {
  const symbol = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z0-9^][A-Z0-9.^:-]{0,31}$/.test(symbol)) throw new AgentDeskError("INVALID_AGENT_SYMBOL", "Choose a valid stock or explicit index symbol.", 400);
  return symbol;
}

/** Only globally routable addresses are eligible. Reject mixed public/private
 * DNS answers rather than allowing the HTTP client to pick an unsafe address. */
export function isPublicResearchAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0 || b === 2 || b === 88 && c === 99) || a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113);
  }
  if (family !== 6) return false;
  // No IPv4-mapped, NAT64, unique/local, link-local, multicast, Teredo, 6to4,
  // documentation, or other non-global addresses. Ordinary global IPv6 is 2000::/3.
  const canonical = new URL(`https://[${address}]/`).hostname.slice(1, -1).toLowerCase();
  const first = parseInt(canonical.split(":")[0], 16);
  const second = parseInt(canonical.split(":")[1] || "0", 16);
  return first >= 0x2000 && first <= 0x3fff && !(first === 0x2001 && second < 0x200) && !/^2002:/.test(canonical) && !/^2001:db8:/.test(canonical) && !/^3fff:/.test(canonical);
}

/** Syntactic public URL policy. DNS is checked and pinned separately at fetch
 * time. HTTPS, no embedded credentials, no signed/private query strings. */
export function publicResearchUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443" || !host.includes(".") || isIP(host.replace(/^\[|\]$/g, "")) || /(?:^|\.)(?:localhost|local|internal|intranet|lan|home|test|invalid|example|onion)$/.test(host) || host.endsWith(".arpa")) return null;
    for (const key of url.searchParams.keys()) if (/(?:^|[_-])(?:key|token|secret|auth|authorization|password|passwd|signature|credential|session|jwt|accesscode)(?:$|[_-])/i.test(key) || /apikey|accesstoken|authtoken|sessionid|^x-amz-|^x-goog-|^sig$/i.test(key)) return null;
    url.hostname = host; url.hash = "";
    return url.toString();
  } catch { return null; }
}

export function sourceIdentity(url: string): string {
  const parsed = new URL(url);
  for (const key of [...parsed.searchParams.keys()]) if (/^(?:utm_|fbclid$|gclid$)/i.test(key)) parsed.searchParams.delete(key);
  parsed.searchParams.sort();
  return parsed.toString();
}
export function uniqueResearchSources(sources: AgentResearchSource[], maximum = 40): AgentResearchSource[] {
  const seen = new Set<string>();
  return sources.filter(source => {
    const url = publicResearchUrl(source.url);
    if (!url) return false;
    const identity = sourceIdentity(url);
    if (seen.has(identity)) return false;
    seen.add(identity); return true;
  }).slice(0, maximum);
}

/** Sharing uses ONLY public-discovery metadata, never vendor sentiment feeds,
 * portfolios, private notes, derived decisions, graph payloads or article text. */
export function projectPublicDiscoverySources(raw: unknown, now = Date.now(), scope: AgentResearchSource["scope"] = "owner"): AgentResearchSource[] {
  const report = researchJson(raw);
  const current = researchJson(report.currentResearch);
  if (!Array.isArray(current.discoveries)) return [];
  const out: AgentResearchSource[] = [];
  for (const value of current.discoveries.slice(0, 120)) {
    if (!researchObject(value) || value.discoveryProvider !== "Google News RSS") continue;
    const url = publicResearchUrl(value.url), publishedAt = researchDate(value.publishedAt, now), retrievedAt = researchDate(value.retrievedAt, now);
    if (!url || !publishedAt || !retrievedAt || now - Date.parse(publishedAt) > 7 * 86_400_000) continue;
    const title = researchText(value.title, 300);
    if (!title) continue;
    out.push({ id: `source:${researchHash(sourceIdentity(url)).slice(0, 24)}`, title, url, publisher: researchText(value.publisher, 120) || new URL(url).hostname,
      publishedAt, retrievedAt, contentScope: "public-discovery-metadata", excerpt: null, sha256: null, scope });
  }
  return uniqueResearchSources(out);
}
