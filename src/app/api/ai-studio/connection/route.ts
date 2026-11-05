import { studioAccess, failure, PRIVATE_HEADERS, limitedJson } from "@/lib/studio/request";
import { acquireOperation, credentialFingerprint, saveHealth } from "@/lib/studio/store";
import { providerConfiguration, testConnection } from "@/lib/studio/provider";
import { StudioError } from "@/lib/studio/core";
import type { ProviderHealth } from "@/lib/studio/contracts";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
    let lease: Awaited<ReturnType<typeof acquireOperation>> | null = null;
    try {
        const scope = await studioAccess(request, true), body = await limitedJson(request);
        if (body.confirm !== true)
            throw new StudioError("CONFIRM_TEST", "Confirm the small billable connection test.");
        lease = await acquireOperation(scope, "test");
        const config = providerConfiguration(), started = Date.now();
        let health: ProviderHealth;
        try {
            health = await testConnection(AbortSignal.any([request.signal, AbortSignal.timeout(45000)]));
        }
        catch (e) {
            const timeout = e instanceof Error && ["TimeoutError", "AbortError"].includes(e.name);
            health = { state: timeout ? "timeout" : "unavailable", configured: Boolean(config.key), model: config.model, message: timeout ? "The connection test timed out or was cancelled. It was not marked successful." : "The provider connection failed. Verify server networking and project access.", checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, requestId: null };
        }
        await saveHealth(scope, health, credentialFingerprint(config.key));
        return Response.json({ ok: true, health }, { headers: PRIVATE_HEADERS });
    }
    catch (e) {
        return failure(e);
    }
    finally {
        await lease?.release().catch(() => undefined);
    }
}
