import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

type ReportSection = {
  title?: string;
  body?: string;
  bullets?: string[];
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/\n{4,}/g, "\n\n")
    .trim();
}

function normalizeSections(raw: unknown): ReportSection[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((section: any) => ({
      title: cleanText(section.title || "Report Section"),
      body: section.body ? cleanText(section.body) : "",
      bullets: Array.isArray(section.bullets)
        ? section.bullets.map(cleanText).filter(Boolean)
        : [],
    }))
    .filter((section) => section.title || section.body || section.bullets.length);
}

function defaultSections(summary: string): ReportSection[] {
  return [
    {
      title: "Executive Summary",
      body:
        summary ||
        "Slice AI Studio prepared this advisor-facing report for review, discussion, and workflow execution.",
      bullets: [
        "Review all assumptions before external use.",
        "Verify client suitability, market data, source freshness, and compliance requirements.",
        "Use this page as the reliable browser-view report path.",
      ],
    },
    {
      title: "Advisor Review Notes",
      body:
        "This report is AI-assisted and intended for advisor review. It should not be treated as legal, tax, investment, or compliance approval.",
    },
  ];
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Report token is required." }, { status: 400 });
    }

    const report = await db.personalUserBotPdfReport.findUnique({
      where: {
        downloadToken: token,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    if (report.userId !== user.id) {
      return NextResponse.json({ error: "You do not have access to this report." }, { status: 403 });
    }

    const design = parseJson<Record<string, any>>(report.designJson, {});
    const sections = normalizeSections(parseJson(report.sectionsJson, []));

    return NextResponse.json(
      {
        ok: true,
        report: {
          id: report.id,
          title: report.title,
          reportType: report.reportType,
          summary: report.summary,
          status: report.status,
          createdAt: report.createdAt,
          downloadToken: report.downloadToken,
          pdfUrl: `/api/personal-bot/pdf-report?token=${report.downloadToken}`,
          viewerUrl: `/workspace/personal-bot/reports?token=${report.downloadToken}`,
          sections: sections.length ? sections : defaultSections(report.summary),
          design: {
            generatedBy: design.generatedBy || "Slice AI Studio",
            preparedFor: design.preparedFor || "Advisor Review",
            investmentGrade: design.investmentGrade || design.grade || report.status || "Advisor Review Ready",
            confidenceScore:
              typeof design.confidenceScore === "number" ? design.confidenceScore : 88,
            metrics: Array.isArray(design.metrics) ? design.metrics : [],
            charts: Array.isArray(design.charts) ? design.charts : [],
          },
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Report view failed.",
        detail: error instanceof Error ? error.message : "Unknown error.",
      },
      { status: 500 },
    );
  }
}