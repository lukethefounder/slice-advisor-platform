export const STRATEGY_ROOT = "/workspace/strategy-lab";
export const STRATEGY_TABS = [
  { href: STRATEGY_ROOT, label: "Build & backtest", detail: "Verified history · frozen rules" },
  { href: `${STRATEGY_ROOT}/sensitivity`, label: "Cost sensitivity", detail: "Same data · different costs" },
  { href: `${STRATEGY_ROOT}/scenarios`, label: "Forward scenarios", detail: "Registered daily paper replay" },
  { href: `${STRATEGY_ROOT}/live`, label: "Live watch", detail: "Quotes beside accepted results" },
] as const;
export function legacyStrategyTarget(path: string): string {
  const u = new URL(path, "https://slice.invalid");
  const aliases: Record<string,string> = {
    "/workspace/intelligence/strategy-lab": STRATEGY_ROOT,
    "/workspace/intelligence/scenarios": `${STRATEGY_ROOT}/scenarios`,
  };
  return (aliases[u.pathname] ?? u.pathname) + u.search + u.hash;
}
export function queryString(params: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  for (const [k,v] of Object.entries(params)) for (const item of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k,item);
  return q.size ? `?${q}` : "";
}
export function validRecordId(v: unknown): v is string { return typeof v === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(v); }
