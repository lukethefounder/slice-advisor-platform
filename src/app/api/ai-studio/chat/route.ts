import { gatherStudioEvidence, evidenceOnlyText } from "@/lib/studio/market-coverage";
import { MarketError } from "@/lib/market-evidence/core";
import type { MarketEvidence } from "@/lib/market-evidence/contracts";
import { healthAfterFailure } from "@/lib/studio/health-state";
import { createHash } from "node:crypto";
import { studioAccess, failure, PRIVATE_HEADERS, limitedJson } from "@/lib/studio/request";
import { acquireOperation, beginTurn, persistThread, saveHealth, credentialFingerprint } from "@/lib/studio/store";
import { providerConfiguration, openResponse, readResponse } from "@/lib/studio/provider";
import { parseChat, conversationInput, StudioError } from "@/lib/studio/core";
import { resolveResearch, instructions } from "@/lib/studio/research";
import type { StudioEvent } from "@/lib/studio/contracts";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
    let lease: Awaited<ReturnType<typeof acquireOperation>> | null = null;
    try {
        const scope = await studioAccess(request, true), input = parseChat(await limitedJson(request)), config = providerConfiguration();
        lease = await acquireOperation(scope, "chat");
        const reference = await resolveResearch(scope, input.research);
        const turn = await beginTurn(scope, { ...input, reference, model: config.model });
        const locked = lease;
        const abort = new AbortController(), signal = AbortSignal.any([abort.signal, request.signal, AbortSignal.timeout(100000)]), encoder = new TextEncoder();
        let closed = false, partial = "";
        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                const send = (event: StudioEvent) => { if (closed)
                    return; try {
                    controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                }
                catch {
                    closed = true;
                    abort.abort();
                } };
                send({ type: "start", threadId: turn.thread.id, title: turn.thread.title, user: turn.user, assistant: turn.assistant });
                let requestId: string | null = null, providerStarted = false, market: MarketEvidence | null = null;
                try {
                    const started = Date.now();
                    market = await gatherStudioEvidence(scope, input, turn.previous, AbortSignal.any([signal, AbortSignal.timeout(45000)]), message => send({ type: "status", message }));
                    if (market) {
                        turn.assistant.marketEvidence = market;
                        await persistThread(scope, turn.thread, "Running");
                        send({ type: "market", evidence: market });
                    }
                    send({ type: "status", message: "Explaining verified evidence…" });
                    providerStarted = true;
                    const provider = await openResponse({ instructions: instructions(input.mode, reference, market), messages: conversationInput(turn.previous, input.prompt), signal, safetyIdentifier: createHash("sha256").update(scope.userId).digest("hex") });
                    requestId = provider.requestId;
                    const output = await readResponse(provider.body, signal, delta => { partial += delta; send({ type: "delta", text: delta }); });
                    turn.assistant.text = output;
                    turn.assistant.state = "complete";
                    turn.assistant.responseKind = "model";
                    await persistThread(scope, turn.thread);
                    await saveHealth(scope, { state: "verified", configured: true, model: config.model, message: "The most recent text response completed successfully. Audio access is tested separately.", checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, requestId }, credentialFingerprint(config.key)).catch(() => undefined);
                    send({ type: "complete", message: turn.assistant, requestId });
                }
                catch (error) {
                    const cancelled = request.signal.aborted || abort.signal.aborted;
                    // Provider failures invalidate the old success badge; market failures do not.
                    const failedHealth = healthAfterFailure(error, config.model, requestId, cancelled) || (providerStarted && !cancelled && !(error instanceof MarketError) ? { configured: true, state: "unavailable" as const, model: config.model, message: "The most recent text request did not complete. Re-test the connection; key validity has not been inferred from this error.", checkedAt: new Date().toISOString(), latencyMs: null, requestId } : null);
                    if (failedHealth) await saveHealth(scope, failedHealth, credentialFingerprint(config.key)).catch(() => undefined);
                    const coverage = market && (market.quotes.length || market.news.length || market.details?.length);
                    const storageFailure = error instanceof StudioError && ["HISTORY_SAVE", "THREAD_FULL"].includes(error.code);
                    if (coverage && !cancelled && providerStarted && !storageFailure) {
                        turn.assistant.text = evidenceOnlyText(market!, error instanceof StudioError ? error.message : "The text provider did not complete the response.");
                        turn.assistant.state = "complete";
                        turn.assistant.responseKind = "evidence-only";
                        turn.assistant.model = "Provider evidence only — no AI interpretation";
                        try { await persistThread(scope, turn.thread); send({ type: "complete", message: turn.assistant, requestId }); return; }
                        catch { send({ type: "failure", code: "HISTORY_SAVE", message: "The evidence summary could not be saved. Reload history before retrying.", requestId }); return; }
                    }
                    turn.assistant.text = partial;
                    turn.assistant.state = cancelled ? "cancelled" : "failed";
                    let code = (error instanceof StudioError || error instanceof MarketError) ? error.code : signal.aborted ? "RESPONSE_TIMEOUT" : "RESPONSE_FAILED";
                    let message = (error instanceof StudioError || error instanceof MarketError) ? error.message : cancelled ? "Response stopped. Partial text may be retained." : signal.aborted ? "The response timed out. Partial text is not a completed answer." : "The response could not be completed. No fallback answer was generated.";
                    try {
                        await persistThread(scope, turn.thread);
                    }
                    catch {
                        code = "HISTORY_SAVE";
                        message = "The answer could not be saved. Copy the visible text before leaving, then reload to check history.";
                    }
                    send({ type: "failure", code, message, requestId: error instanceof StudioError ? error.requestId || requestId : requestId });
                }
                finally {
                    await locked.release().catch(() => undefined);
                    if (!closed) {
                        closed = true;
                        controller.close();
                    }
                }
            },
            cancel() { closed = true; abort.abort(); }
        });
        lease = null; // The stream owns this lease until its finally block.
        return new Response(stream, { headers: { ...PRIVATE_HEADERS, "Content-Type": "application/x-ndjson; charset=utf-8", "X-Accel-Buffering": "no" } });
    }
    catch (e) {
        await lease?.release().catch(() => undefined);
        return failure(e);
    }
}
