import { prisma } from "@/lib/prisma";
import {
  BackendContext,
  BACKEND_FEATURE_FLAGS,
  BACKEND_JOB_DEFINITIONS,
  BACKEND_VENDOR_DEFINITIONS,
  backendOwnerKey,
  envConfigured,
} from "@/lib/backend/config";
import { emitBackendEvent, recordDataQuality } from "@/lib/backend/events";

function asJson(value: unknown) {
  return JSON.stringify(value);
}

export async function ensureBackendVendors(context: BackendContext) {
  for (const vendor of BACKEND_VENDOR_DEFINITIONS) {
    const configured = envConfigured(vendor.envKeyName);

    await prisma.backendVendorIntegration.upsert({
      where: {
        userId_vendorKey: {
          userId: context.userId,
          vendorKey: vendor.vendorKey,
        },
      },
      update: {
        firmId: context.firmId,
        vendorName: vendor.vendorName,
        category: vendor.category,
        purpose: vendor.purpose,
        envKeyName: vendor.envKeyName,
        status: configured ? "Configured" : "Missing",
        riskLevel: vendor.riskLevel,
        dataAccessJson: asJson(vendor.dataAccess),
        fallbackBehavior: vendor.fallbackBehavior,
        enabled: configured,
        lastHealthStatus: configured ? "Ready" : "Missing Env",
        lastHealthCheckedAt: new Date(),
      },
      create: {
        userId: context.userId,
        firmId: context.firmId,
        vendorKey: vendor.vendorKey,
        vendorName: vendor.vendorName,
        category: vendor.category,
        purpose: vendor.purpose,
        envKeyName: vendor.envKeyName,
        status: configured ? "Configured" : "Missing",
        riskLevel: vendor.riskLevel,
        dataAccessJson: asJson(vendor.dataAccess),
        fallbackBehavior: vendor.fallbackBehavior,
        enabled: configured,
        lastHealthStatus: configured ? "Ready" : "Missing Env",
        lastHealthCheckedAt: new Date(),
      },
    });

    await recordDataQuality(context, {
      entityType: "Vendor",
      entityId: vendor.vendorKey,
      sourceName: vendor.vendorName,
      liveStatus: configured ? "Configured" : "Missing",
      freshnessStatus: "Config Check",
      qualityScore: configured ? 85 : 40,
      fallbackUsed: !configured,
      warning: configured
        ? `${vendor.vendorName} is configured.`
        : `${vendor.envKeyName ?? vendor.vendorKey} is missing.`,
    });
  }

  for (const flag of BACKEND_FEATURE_FLAGS) {
    const requiredVendor = flag.requiredVendorKey
      ? BACKEND_VENDOR_DEFINITIONS.find((vendor) => vendor.vendorKey === flag.requiredVendorKey)
      : null;

    const canEnable =
      !flag.requiresProvider || envConfigured(requiredVendor?.envKeyName);

    await prisma.backendFeatureFlag.upsert({
      where: {
        userId_flagKey: {
          userId: context.userId,
          flagKey: flag.flagKey,
        },
      },
      update: {
        firmId: context.firmId,
        flagName: flag.flagName,
        category: flag.category,
        description: flag.description,
        requiresProvider: flag.requiresProvider,
        requiredVendorKey: flag.requiredVendorKey,
        enabled: canEnable,
        status: canEnable ? "Ready" : "Provider Missing",
      },
      create: {
        userId: context.userId,
        firmId: context.firmId,
        flagKey: flag.flagKey,
        flagName: flag.flagName,
        category: flag.category,
        description: flag.description,
        requiresProvider: flag.requiresProvider,
        requiredVendorKey: flag.requiredVendorKey,
        enabled: canEnable,
        status: canEnable ? "Ready" : "Provider Missing",
      },
    });
  }

  for (const job of BACKEND_JOB_DEFINITIONS) {
    await prisma.backendJobDefinition.upsert({
      where: {
        ownerJobKey: backendOwnerKey(context, job.jobKey),
      },
      update: {
        firmId: context.firmId,
        jobName: job.jobName,
        category: job.category,
        description: job.description,
        scheduleLabel: job.scheduleLabel,
        cadence: job.cadence,
        status: "Planned",
      },
      create: {
        userId: context.userId,
        firmId: context.firmId,
        ownerJobKey: backendOwnerKey(context, job.jobKey),
        jobKey: job.jobKey,
        jobName: job.jobName,
        category: job.category,
        description: job.description,
        scheduleLabel: job.scheduleLabel,
        cadence: job.cadence,
        status: "Planned",
      },
    });
  }

  await emitBackendEvent(context, {
    eventKey: `backend-kernel-bootstrap:${new Date().toISOString().slice(0, 10)}`,
    eventType: "backend.kernel.bootstrap",
    area: "Backend Kernel",
    title: "Backend kernel bootstrapped",
    detail: "Vendor registry, feature flags, and job definitions were created or refreshed.",
    metadata: {
      vendors: BACKEND_VENDOR_DEFINITIONS.length,
      features: BACKEND_FEATURE_FLAGS.length,
      jobs: BACKEND_JOB_DEFINITIONS.length,
    },
  });
}