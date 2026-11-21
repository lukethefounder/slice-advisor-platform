import { ApiError, withApiRoute } from "@/lib/api-route";
import { connectedAccess } from "@/lib/connected-research/access";
import { AgentDeskError } from "@/lib/agent-desk/contracts";
import { requireAgentDeskAccess } from "@/lib/agent-desk/access";
import { readAgentMarket } from "@/lib/agent-desk/market-stream";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withApiRoute({ route: "/api/intelligence/agent-desk/market-stream" }, async ({ request }) => {
  const scope = await connectedAccess(request);
  try { await requireAgentDeskAccess(scope); }
  catch (error) { if (error instanceof AgentDeskError) throw new ApiError({ status: error.status, code: error.code, message: error.message, expose: true }); throw error; }
  const abort = new AbortController(), encoder = new TextEncoder();
  let output: ReadableStreamDefaultController<Uint8Array> | null = null, closed = false;
  const close = () => { if (closed) return; closed = true; try { output?.close(); } catch { /* A canceled consumer has already closed its stream. */ } };
  const cancel = () => { abort.abort(); close(); }; request.signal.addEventListener("abort", cancel, { once: true });
  if (request.signal.aborted) cancel();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      output = controller;
      if (abort.signal.aborted) { closed = false; close(); request.signal.removeEventListener("abort", cancel); return; }
      const send = (event: string, body: unknown) => { if (!abort.signal.aborted && !closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(body)}\n\n`)); };
      void (async () => {
        let sessionCheckedAt = Date.now();
        try {
          while (!abort.signal.aborted) {
            try {
              if (Date.now() - sessionCheckedAt >= 30_000) {
                const currentScope = await connectedAccess(request);
                if (currentScope.userId !== scope.userId || currentScope.firmId !== scope.firmId) throw new ApiError({ status: 403, code: "STREAM_SESSION_CHANGED", message: "The stream session changed." });
                await requireAgentDeskAccess(currentScope);
                sessionCheckedAt = Date.now();
              }
              // Keep a single queued snapshot for a slow consumer. The next
              // available read receives a fresh snapshot, not an unbounded log.
              if ((controller.desiredSize ?? 0) > 0) send("market", await readAgentMarket(scope));
            }
            catch (error) {
              if ((error instanceof AgentDeskError || error instanceof ApiError) && [401, 403].includes(error.status)) { send("revoked", { message: "Founder access is no longer active." }); break; }
              send("market", { version: 1, status: "error", feed: null, checkedAt: new Date().toISOString(), lastMessageAt: null, quotes: [], message: "The market snapshot could not be read. Check the worker and data connection." });
            }
            await new Promise<void>(resolve => {
              const done = () => { clearTimeout(timer); abort.signal.removeEventListener("abort", done); resolve(); };
              const timer = setTimeout(done, 1_000); abort.signal.addEventListener("abort", done, { once: true }); if (abort.signal.aborted) done();
            });
          }
        } finally { request.signal.removeEventListener("abort", cancel); close(); abort.abort(); }
      })().catch(() => { request.signal.removeEventListener("abort", cancel); close(); abort.abort(); });
    }, cancel,
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "private, no-store, no-transform", "X-Accel-Buffering": "no", Vary: "Cookie" } });
});
