import { apiJson, withApiRoute } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { TEMPLATES, METRICS, SECTOR_ETFS } from "@/lib/strategy-lab/contracts";
import { validateSpec } from "@/lib/strategy-lab/validation";
import { strategyAccess, readResearchJson, strategyFailure } from "@/lib/strategy-lab/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withApiRoute({ route: "/api/strategy-lab/templates", timeoutMs: 15000 }, async ({ request }) => {
  const userId = await strategyAccess(request, false);
  const saved = await prisma.sliceStrategyDefinition.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 100 });
  return apiJson({ ok: true, templates: TEMPLATES, criteria: METRICS, sectors: SECTOR_ETFS,
    saved: saved.map(s => ({ id: s.id, name: s.name, updatedAt: s.updatedAt, spec: JSON.parse(s.specJson) as unknown })) });
});
export const POST = withApiRoute({ route: "/api/strategy-lab/templates", timeoutMs: 15000 }, async ({ request }) => {
  const userId = await strategyAccess(request, true);
  try { const body = await readResearchJson(request), spec = validateSpec(body.spec);
    const saved = await prisma.sliceStrategyDefinition.create({ data: { userId, name: spec.name, specJson: JSON.stringify(spec) } });
    return apiJson({ ok: true, id: saved.id, name: saved.name });
  } catch (error) { strategyFailure(error); }
});
