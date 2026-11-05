import { studioAccess, limitedJson, failure, PRIVATE_HEADERS } from "@/lib/studio/request";
import { MarketError, parsePreferences } from "@/lib/market-evidence/core";
import { readMarketHealth, readPreferences, savePreferences } from "@/lib/market-evidence/storage";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) { try { const scope = await studioAccess(request); const [prefs, market] = await Promise.all([readPreferences(scope), readMarketHealth(scope)]); return Response.json({ ok: true, ...prefs, market }, { headers: PRIVATE_HEADERS }); } catch (e) { return failure(e); } }
export async function PUT(request: Request) {
 try { const scope = await studioAccess(request, true), body = await limitedJson(request, 4000), preferences = parsePreferences(body.preferences);
  if (body.revision !== null && typeof body.revision !== "string") throw new MarketError("REVISION", "Reload preferences before saving.");
  const revision = await savePreferences(scope, preferences, body.revision as string | null); return Response.json({ ok: true, preferences, revision }, { headers: PRIVATE_HEADERS });
 } catch (e) { if (e instanceof MarketError) return Response.json({ ok: false, code: e.code, message: e.message }, { status: e.status, headers: PRIVATE_HEADERS }); return failure(e); }
}
