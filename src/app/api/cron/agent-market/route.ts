import { timingSafeEqual } from "node:crypto";
import { apiJson, ApiError, withApiRoute } from "@/lib/api-route";
import { AgentDeskError } from "@/lib/agent-desk/contracts";
import { agentMarketWorkerConfiguration, ingestAgentMarket } from "@/lib/agent-desk/market-stream";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function authorize(request: Request) {
  const secret = process.env.CRON_SECRET?.trim(), provided = Buffer.from(request.headers.get("authorization") ?? ""), expected = Buffer.from(secret ? `Bearer ${secret}` : "");
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Unauthorized." });
}
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Authorization" };
export const GET = withApiRoute({ route: "/api/cron/agent-market" }, async ({ request }) => {
  authorize(request);
  return apiJson({ ok: true, ...await agentMarketWorkerConfiguration() }, { headers: privateHeaders });
});
export const POST = withApiRoute({ route: "/api/cron/agent-market" }, async ({ request }) => {
  authorize(request);
  if (Number(request.headers.get("content-length") ?? 0) > 32_768) throw new ApiError({ status: 413, code: "MARKET_BATCH_SIZE", message: "Market batch too large." });
  const reader = request.body?.getReader(); if (!reader) throw new ApiError({ status: 400, code: "MARKET_BATCH_REQUIRED", message: "A market batch is required." });
  let size = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 32_768) { await reader.cancel(); throw new ApiError({ status: 413, code: "MARKET_BATCH_SIZE", message: "Market batch too large." }); } chunks.push(part.value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let input: unknown; try { input = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiError({ status: 400, code: "INVALID_MARKET_BATCH", message: "A valid market batch is required." }); }
  try { return apiJson({ ok: true, ...await ingestAgentMarket(input) }, { headers: privateHeaders }); }
  catch (error) { if (error instanceof AgentDeskError) throw new ApiError({ status: error.status, code: error.code, message: error.message, expose: true }); throw error; }
});
