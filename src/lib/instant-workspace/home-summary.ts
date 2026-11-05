import "server-only";
import { clientScopeWhere, type AccessContext } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import type { HomeSection, HomeSummary } from "@/lib/workspace/home-contract";
async function section<T>(operation: () => Promise<T>, message: string): Promise<HomeSection<T>> { try { return { state: "ready", data: await operation() }; } catch { return { state: "unavailable", message }; } }
export async function readHomeSummary(scope: { userId: string; firmId: string; context: AccessContext }): Promise<HomeSummary> {
  const started = Date.now(), clientsWhere = clientScopeWhere(scope.context);
        const tasksWhere = { userId: scope.userId, status: { notIn: ["Complete", "Completed", "Cancelled"] }, OR: [{ clientId: null }, { client: clientsWhere }] };
        // Fixed, bounded read plan. No collector, provider, AI call or write is started by dashboard navigation.
        const [clients, tasks, approvals, scenarios, research] = await Promise.all([
            section(async () => ({ count: await prisma.clientProfile.count({ where: clientsWhere }) }), "Client summary could not be loaded."),
            section(async () => { const [count, items] = await Promise.all([prisma.meetingTask.count({ where: tasksWhere }), prisma.meetingTask.findMany({ where: tasksWhere, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], take: 6, select: { id: true, title: true, priority: true, dueDate: true } })]); return { count, items: items.map(r => ({ id: r.id, title: r.title, priority: r.priority, dueAt: r.dueDate?.toISOString() ?? null })) }; }, "Task summary could not be loaded."),
            section(async () => ({ count: await prisma.personalUserBotApprovalItem.count({ where: { userId: scope.userId, status: "Pending" } }) }), "Assistant approval summary could not be loaded."),
            section(async () => { const where = { userId: scope.userId, firmId: scope.firmId, status: { notIn: ["Archived", "Complete"] } }; const [count, items] = await Promise.all([prisma.sliceForwardScenario.count({ where }), prisma.sliceForwardScenario.findMany({ where, orderBy: { updatedAt: "desc" }, take: 3, select: { id: true, name: true, status: true, lastSession: true, updatedAt: true } })]); return { count, items: items.map(r => ({ ...r, updatedAt: r.updatedAt.toISOString() })) }; }, "Scenario summary is unavailable. Check that the prior scenario upgrade and migration are complete."),
            section(async () => (await prisma.sliceForecastBundle.findMany({ where: { userId: scope.userId, status: "Ready", provider: "Alpha Vantage" }, orderBy: { createdAt: "desc" }, take: 4, select: { symbol: true, researchRunId: true, asOfAt: true, createdAt: true } })).map(r => ({ symbol: r.symbol, runId: r.researchRunId, asOf: r.asOfAt.toISOString(), createdAt: r.createdAt.toISOString() })), "Saved research is unavailable. Check the preceding research migration.")
        ]);
        const body: HomeSummary = { ok: true, updatedAt: new Date().toISOString(), elapsedMs: Date.now() - started, identity: { name: scope.context.user.name, firm: scope.context.firm?.name || "Slice", role: scope.context.membership?.role || "Firm access" }, clients, tasks, approvals, scenarios, research };

 return body;
}
