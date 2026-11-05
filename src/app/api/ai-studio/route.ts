import { readMarketHealth, readPreferences } from "@/lib/market-evidence/storage";
import { prisma } from "@/lib/prisma";
import { studioAccess, failure, PRIVATE_HEADERS, limitedJson } from "@/lib/studio/request";
import { listThreads, loadThread, archiveThread, readHealth } from "@/lib/studio/store";
import { providerConfiguration } from "@/lib/studio/provider";
import { StudioError, text } from "@/lib/studio/core";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
    try {
        const scope = await studioAccess(request);
        const url = new URL(request.url), id = url.searchParams.get("threadId");
        if (id && !/^[a-zA-Z0-9_-]{1,120}$/.test(id))
            throw new StudioError("THREAD_ID", "Invalid conversation identifier.");
        const c = providerConfiguration();
        const [page, health, selected, choices] = await Promise.all([listThreads(scope, url.searchParams.get("before") || undefined), readHealth(scope, c.model, c.key), id ? loadThread(scope, id) : Promise.resolve(null), prisma.sliceForecastBundle.findMany({ where: { userId: scope.userId, status: "Ready", provider: "Alpha Vantage" }, orderBy: { createdAt: "desc" }, take: 12, select: { symbol: true, researchRunId: true, asOfAt: true } }).catch(() => [])]);
        return Response.json({ ok: true, ...page, health, marketHealth: await readMarketHealth(scope), marketDefaults: (await readPreferences(scope)).preferences.symbols.slice(0, 3), selected, transcriptionConfigured: Boolean(c.key), researchChoices: choices.map(r => ({ symbol: r.symbol, runId: r.researchRunId, asOf: r.asOfAt.toISOString() })) }, { headers: PRIVATE_HEADERS });
    }
    catch (e) {
        return failure(e);
    }
}
export async function POST(request: Request) {
    try {
        const scope = await studioAccess(request, true), body = await limitedJson(request), id = text(body.threadId, 120);
        if (body.action !== "archive" || !id)
            throw new StudioError("ACTION", "Choose an existing conversation to archive.");
        await archiveThread(scope, id);
        return Response.json({ ok: true }, { headers: PRIVATE_HEADERS });
    }
    catch (e) {
        return failure(e);
    }
}
