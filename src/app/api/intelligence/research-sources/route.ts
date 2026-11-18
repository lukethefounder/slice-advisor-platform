import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import { readCanonicalResearchSources } from "@/lib/intelligence-unified/service";
import { checkRateLimit, getClientIp, hashForSecurity } from "@/lib/security";
import { StrategyError } from "@/lib/strategy-lab/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withApiRoute({ route: "/api/intelligence/research-sources", timeoutMs: 18000 }, async ({ request }) => {
  const access = await requireCurrentAccessContext({ requireFirm: true });
  const rate = checkRateLimit({ key: `research-sources:${access.user.id}:${hashForSecurity(getClientIp(request))}`, limit: 120, windowMs: 60000 });
  if (!rate.allowed) throw new ApiError({ status: 429, code: "RESEARCH_SOURCE_RATE_LIMITED", message: "Too many source requests. Retry shortly.", expose: true });
  const params = new URL(request.url).searchParams;
  const symbol = (params.get("symbol") ?? "MSFT").trim().toUpperCase();
  if (!/^[A-Z0-9.\-:$]{1,24}$/.test(symbol)) throw new ApiError({status:400, code:"INVALID_RESEARCH_SYMBOL", message:"Provide a valid stock symbol.", expose:true});
  const cohort = params.get("cohort");
  const runId = params.get("runId")?.trim().slice(0,120) || undefined;
  try {
    const result = await readCanonicalResearchSources({
      userId: access.user.id, symbol, runId,
      page: Number(params.get("page") ?? 1), pageSize: Number(params.get("pageSize") ?? 30), q: params.get("q") ?? "",
      cohort: cohort === "media" || cohort === "technical" || cohort === "economy" ? cohort : null,
    });
    if (!result) throw new ApiError({status:404, code:"RESEARCH_RUN_NOT_FOUND", message:"No saved research run is available for this selection.", expose:true});
    return apiJson(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof StrategyError) throw new ApiError({status:error.status, code:error.code, message:error.message, expose:true});
    throw error;
  }
});
