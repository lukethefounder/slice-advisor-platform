/** Only explicit, read-only route surfaces. Never prefetch APIs, signout, actions, or arbitrary URLs. */
export const PREFETCH_ROUTES = new Set([
 "/workspace", "/workspace/clients", "/workspace/client-portal-inbox", "/workspace/documents", "/workspace/client-emails", "/workspace/brief", "/workspace/watchlists", "/workspace/team-board", "/workspace/settings", "/workspace/personal-bot", "/workspace/connected", "/workspace/intelligence", "/workspace/intelligence/knowledge-graph", "/workspace/intelligence/forecast-lab", "/workspace/intelligence/strategy-lab", "/workspace/intelligence/scenarios", "/market-visuals",
]);
export function prefetchPath(href: string, origin: string): string | null {
 try {
  const u = new URL(href, origin);
  if (u.origin !== origin || u.username || u.password || !PREFETCH_ROUTES.has(u.pathname)) return null;
  // Prefetch the static route/skeleton, not a client ID, token, or arbitrary query payload.
  return u.pathname;
 } catch { return null; }
}
export class PrefetchBudget {
 private seen = new Map<string, number>();
 constructor(private limit = 8, private ttl = 120000) {}
 claim(path: string, now = Date.now()) {
  for (const [p,t] of this.seen) if (now-t >= this.ttl) this.seen.delete(p);
  if (this.seen.has(path) || this.seen.size >= this.limit) return false;
  this.seen.set(path, now); return true;
 }
}
