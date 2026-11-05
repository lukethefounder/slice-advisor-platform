import type { PulsePreferences } from "@/lib/market-evidence/contracts";
import { workspaceRequests } from "@/lib/instant-workspace/compose";
export function prioritizedWorkspaceRequests(p: PulsePreferences) {
 const seen = new Set<string>();
 const all = workspaceRequests(p).filter(r => { const key = `${r.section}:${r.symbol}`; if (seen.has(key)) return false; seen.add(key); return true; });
 return [
  all.filter(r => r.symbol === p.primary && (r.section === "quote" || r.section === "history")),
  all.filter(r => r.section !== "news" && r.symbol !== p.primary),
  all.filter(r => r.section === "news"),
 ];
}
