/** One canonical Strategy Studio page; only known, local modes are accepted. */
export const STUDIO_PATH = "/workspace/strategy-lab";
export const STUDIO_VIEWS = ["build", "results", "monitor", "evidence", "report", "sensitivity", "live", "audit", "earnings", "guided", "growth"] as const;
export type StudioView = typeof STUDIO_VIEWS[number];
export type StudioLocation = { view: StudioView; runId: string; scenarioId: string };
const id = (value: string | null) => value && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : "";
export function readStudioLocation(params: URLSearchParams, fallback: StudioView = "build"): StudioLocation {
 const requested = params.get("view");
 const runId = id(params.get("runId")) || id(params.get("strategyRunId")) || id(params.get("sourceRunId"));
 const scenarioId = id(params.get("scenarioId")) || id(params.get("id"));
 const view = STUDIO_VIEWS.includes(requested as StudioView) ? requested as StudioView : (scenarioId ? "monitor" : runId ? "results" : fallback);
 return {view, runId, scenarioId};
}
export function studioHref(view: StudioView, input?: URLSearchParams | StudioLocation): string {
 const params = input instanceof URLSearchParams ? new URLSearchParams(input) : new URLSearchParams();
 const source = input instanceof URLSearchParams ? readStudioLocation(input) : input;
 for (const key of ["id", "strategyRunId", "sourceRunId", "runId", "scenarioId", "view"]) params.delete(key);
 params.set("view", view);
 if(source?.runId && id(source.runId)) params.set("runId", source.runId);
 if(source?.scenarioId && id(source.scenarioId)) params.set("scenarioId", source.scenarioId);
 return `${STUDIO_PATH}?${params.toString()}`;
}
/** Preserve old bookmarks without accepting an external redirect target. */
export function legacyStudioHref(params: Record<string,string|string[]|undefined>, view: StudioView) {
 const q = new URLSearchParams();
 for(const [key,value] of Object.entries(params)) {
  if(typeof value === "string") q.set(key,value);
  else if(Array.isArray(value)) value.forEach(item=>q.append(key,item));
 }
 return studioHref(view,q);
}
export function canonicalStudioLink(href: string): string {
 const split=href.indexOf("?"), path=split<0?href:href.slice(0,split), q=new URLSearchParams(split<0?"":href.slice(split+1));
 const routes: Record<string,StudioView> = {
  "/workspace/strategy-lab/scenarios":"results", "/workspace/strategy-lab/scenarios/manage":"audit",
  "/workspace/strategy-lab/live":"live", "/workspace/strategy-lab/sensitivity":"sensitivity",
  "/workspace/intelligence/scenarios":"results", "/workspace/intelligence/strategy-lab":"build"
 };
 return routes[path] ? studioHref(routes[path],q) : href;
}
