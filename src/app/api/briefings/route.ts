import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateBriefingReport } from "@/lib/briefing-engine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanSymbols(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => cleanString(item).toUpperCase().replace(/[^A-Z0-9.-]/g, ""))
          .filter(Boolean)
      )
    ).slice(0, 20);
  }

  return Array.from(
    new Set(
      String(value ?? "")
        .split(/,|\s|\n|\t|;/)
        .map((item) => item.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, ""))
        .filter(Boolean)
    )
  ).slice(0, 20);
}

function readBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "no") return false;
  return fallback;
}

function readScope(value: unknown) {
  const scope = cleanString(value, "Country");

  if (scope === "Local" || scope === "State" || scope === "Country" || scope === "Global") {
    return scope;
  }

  return "Country";
}

function readTechnicalDepth(value: unknown) {
  const depth = cleanString(value, "Standard");

  if (depth === "Executive" || depth === "Standard" || depth === "Institutional") {
    return depth;
  }

  return "Standard";
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const reports = await prisma.briefingReport.findMany({
    where: { userId: user.id },
    include: { client: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return noStoreJson({ reports });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  const report = await generateBriefingReport({
    userId: user.id,
    audience: cleanString(body.audience, "Advisor"),
    briefType: cleanString(body.briefType, "Advisor Meeting"),
    clientId: cleanString(body.clientId) || undefined,
    scope: readScope(body.scope),
    geography: cleanString(body.geography, "United States"),
    symbols: cleanSymbols(body.symbols),
    reportFocus: cleanString(body.reportFocus),
    technicalDepth: readTechnicalDepth(body.technicalDepth),
    timeframe: cleanString(body.timeframe, cleanString(body.briefType, "Daily")) as
      | "Daily"
      | "Weekly"
      | "Monthly"
      | "Quarterly",
    includeTechnicals: readBoolean(body.includeTechnicals, true),
    includeMacro: readBoolean(body.includeMacro, true),
    includeGlobal: readBoolean(body.includeGlobal, true),
    includeAlternatives: readBoolean(body.includeAlternatives, true),
    includeMeetingAgenda: readBoolean(body.includeMeetingAgenda, true),
  });

  return noStoreJson({ report });
}