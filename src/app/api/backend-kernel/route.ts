import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BackendContext } from "@/lib/backend/config";
import { emitBackendEvent } from "@/lib/backend/events";
import { runBackendJob } from "@/lib/backend/jobs";
import { queueBackendDelivery } from "@/lib/backend/notifications";
import { ensureBackendVendors } from "@/lib/backend/vendors";

export const dynamic = "force-dynamic";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function resolveContext(user: { id: string; name: string; email: string }): Promise<BackendContext> {
  const membership = await prisma.firmMembership.findFirst({
    where: {
      userId: user.id,
      status: "Active",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    userId: user.id,
    firmId: membership?.firmId ?? null,
    actorName: user.name,
    actorEmail: user.email,
  };
}

async function loadKernel(context: BackendContext) {
  const [
    vendors,
    flags,
    jobs,
    jobRuns,
    deliveries,
    dataQuality,
    toolRuns,
    events,
  ] = await Promise.all([
    prisma.backendVendorIntegration.findMany({
      where: { userId: context.userId },
      orderBy: [{ category: "asc" }, { vendorName: "asc" }],
    }),
    prisma.backendFeatureFlag.findMany({
      where: { userId: context.userId },
      orderBy: [{ category: "asc" }, { flagName: "asc" }],
    }),
    prisma.backendJobDefinition.findMany({
      where: { userId: context.userId },
      orderBy: [{ category: "asc" }, { jobName: "asc" }],
    }),
    prisma.backendJobRun.findMany({
      where: { userId: context.userId },
      orderBy: { startedAt: "desc" },
      take: 30,
    }),
    prisma.backendOutboundDelivery.findMany({
      where: { userId: context.userId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.backendDataQualityRecord.findMany({
      where: { userId: context.userId },
      orderBy: [{ qualityScore: "asc" }, { updatedAt: "desc" }],
      take: 40,
    }),
    prisma.backendAiToolRun.findMany({
      where: { userId: context.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.backendPlatformEvent.findMany({
      where: { userId: context.userId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const configuredVendors = vendors.filter((vendor) => vendor.status === "Configured").length;
  const enabledFeatures = flags.filter((flag) => flag.enabled).length;
  const queuedDeliveries = deliveries.filter((delivery) => delivery.status === "Queued").length;
  const failedRuns = jobRuns.filter((run) => run.status === "Failed").length;

  const readinessScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (configuredVendors / Math.max(1, vendors.length)) * 30 +
          (enabledFeatures / Math.max(1, flags.length)) * 25 +
          (jobs.length ? 20 : 0) +
          (dataQuality.filter((record) => record.qualityScore >= 70).length / Math.max(1, dataQuality.length)) * 15 +
          (failedRuns ? 0 : 10)
      )
    )
  );

  return {
    context,
    readinessScore,
    metrics: {
      vendors: vendors.length,
      configuredVendors,
      features: flags.length,
      enabledFeatures,
      jobs: jobs.length,
      jobRuns: jobRuns.length,
      queuedDeliveries,
      deliveries: deliveries.length,
      dataQuality: dataQuality.length,
      toolRuns: toolRuns.length,
      events: events.length,
      failedRuns,
    },
    vendors: vendors.map((vendor) => ({
      ...vendor,
      dataAccess: parseJson<string[]>(vendor.dataAccessJson, []),
    })),
    flags,
    jobs: jobs.map((job) => ({
      ...job,
      lastResult: parseJson<Record<string, unknown>>(job.lastResultJson, {}),
    })),
    jobRuns: jobRuns.map((run) => ({
      ...run,
      result: parseJson<Record<string, unknown>>(run.resultJson, {}),
    })),
    deliveries: deliveries.map((delivery) => ({
      ...delivery,
      payload: parseJson<Record<string, unknown>>(delivery.payloadJson, {}),
    })),
    dataQuality: dataQuality.map((record) => ({
      ...record,
      warnings: parseJson<string[]>(record.warningsJson, []),
    })),
    toolRuns: toolRuns.map((run) => ({
      ...run,
      input: parseJson<Record<string, unknown>>(run.inputJson, {}),
      output: parseJson<Record<string, unknown>>(run.outputJson, {}),
    })),
    events: events.map((event) => ({
      ...event,
      metadata: parseJson<Record<string, unknown>>(event.metadataJson, {}),
    })),
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const context = await resolveContext(user);
  return NextResponse.json(await loadKernel(context));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const context = await resolveContext(user);
  const body = await request.json().catch(() => ({}));
  const action = readText(body.action);

  if (action === "bootstrap") {
    await ensureBackendVendors(context);

    await emitBackendEvent(context, {
      eventType: "backend.kernel.ready",
      area: "Backend Kernel",
      title: "Backend Kernel initialized",
      detail: "Vendor registry, feature flags, and job registry are ready.",
    });

    return NextResponse.json({
      ...(await loadKernel(context)),
      message: "Backend Kernel initialized.",
    });
  }

  if (action === "runJob") {
    const jobKey = readText(body.jobKey);

    if (!jobKey) {
      return NextResponse.json({ error: "Job key is required." }, { status: 400 });
    }

    const result = await runBackendJob(context, jobKey);

    return NextResponse.json({
      ...(await loadKernel(context)),
      message: `Job completed: ${jobKey}`,
      result,
    });
  }

  if (action === "runCoreJobs") {
    const jobKeys = [
      "vendor_health",
      "watchlist_price_check",
      "notification_delivery",
      "data_quality_sweep",
      "advisor_day",
    ];

    const results = [];

    for (const jobKey of jobKeys) {
      try {
        results.push({
          jobKey,
          result: await runBackendJob(context, jobKey),
        });
      } catch (error) {
        results.push({
          jobKey,
          error: error instanceof Error ? error.message : "Job failed.",
        });
      }
    }

    return NextResponse.json({
      ...(await loadKernel(context)),
      message: "Core backend jobs completed.",
      results,
    });
  }

  if (action === "toggleFeature") {
    const flagKey = readText(body.flagKey);
    const enabled = Boolean(body.enabled);

    if (!flagKey) {
      return NextResponse.json({ error: "Feature flag key is required." }, { status: 400 });
    }

    await prisma.backendFeatureFlag.updateMany({
      where: {
        userId: context.userId,
        flagKey,
      },
      data: {
        enabled,
        status: enabled ? "Ready" : "Disabled",
      },
    });

    await emitBackendEvent(context, {
      eventType: "feature.toggled",
      area: "Feature Flags",
      title: `Feature ${enabled ? "enabled" : "disabled"}: ${flagKey}`,
      metadata: {
        flagKey,
        enabled,
      },
    });

    return NextResponse.json({
      ...(await loadKernel(context)),
      message: `Feature ${enabled ? "enabled" : "disabled"}.`,
    });
  }

  if (action === "queueTestDelivery") {
    await queueBackendDelivery(context, {
      channel: "Dashboard",
      destination: "Dashboard",
      title: "Backend Kernel Test Delivery",
      body: "This confirms the backend outbound delivery queue is working.",
      urgency: "Medium",
      score: 70,
      payload: {
        test: true,
      },
    });

    return NextResponse.json({
      ...(await loadKernel(context)),
      message: "Test delivery queued.",
    });
  }

  return NextResponse.json({ error: "Unknown Backend Kernel action." }, { status: 400 });
}