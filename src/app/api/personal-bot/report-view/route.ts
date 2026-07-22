import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

type ReportSection = {
  title: string;
  body: string;
  bullets: string[];
};

type ReportMetric = {
  label: string;
  value: string | number;
  helper: string;
  tone: string;
};

type ReportChart = {
  title: string;
  subtitle: string;
  data: Array<{
    label: string;
    value: number;
  }>;
};

type ReportSource = {
  type: "web" | "file" | "unknown";
  title: string;
  url: string;
};

function noStoreJson(
  body: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(
    body,
    init,
  );

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate",
  );

  response.headers.set(
    "Pragma",
    "no-cache",
  );

  response.headers.set(
    "X-Slice-AI-Report",
    "source-backed",
  );

  return response;
}

function parseJson<T>(
  value: string | null | undefined,
  fallback: T,
): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function cleanText(
  value: unknown,
  maximum = 30_000,
) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/\n{4,}/g, "\n\n")
    .trim()
    .slice(0, maximum);
}

function normalizeSections(
  raw: unknown,
): ReportSection[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((section: any) => ({
      title: cleanText(
        section?.title ||
          "Report Section",
        240,
      ),

      body: cleanText(
        section?.body || "",
      ),

      bullets: Array.isArray(
        section?.bullets,
      )
        ? section.bullets
            .map((item: unknown) =>
              cleanText(
                item,
                3000,
              ),
            )
            .filter(Boolean)
        : [],
    }))
    .filter(
      (section) =>
        section.title ||
        section.body ||
        section.bullets.length,
    )
    .slice(0, 50);
}

function normalizeMetrics(
  raw: unknown,
): ReportMetric[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((metric: any) => ({
      label: cleanText(
        metric?.label ||
          metric?.name ||
          "Metric",
        100,
      ),

      value:
        typeof metric?.value ===
          "number" ||
        typeof metric?.value ===
          "string"
          ? metric.value
          : typeof metric?.score ===
                "number"
            ? metric.score
            : "—",

      helper: cleanText(
        metric?.helper || "",
        180,
      ),

      tone: cleanText(
        metric?.tone || "slate",
        30,
      ).toLowerCase(),
    }))
    .filter(
      (metric) =>
        metric.label,
    )
    .slice(0, 12);
}

function normalizeCharts(
  raw: unknown,
): ReportChart[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((chart: any) => ({
      title: cleanText(
        chart?.title ||
          "Report Chart",
        180,
      ),

      subtitle: cleanText(
        chart?.subtitle || "",
        300,
      ),

      data: Array.isArray(
        chart?.data,
      )
        ? chart.data
            .map((item: any) => ({
              label: cleanText(
                item?.label ||
                  item?.name ||
                  "",
                80,
              ),

              value: Number(
                item?.value ??
                  item?.score ??
                  0,
              ),
            }))
            .filter(
              (item: {
                label: string;
                value: number;
              }) =>
                item.label &&
                Number.isFinite(
                  item.value,
                ),
            )
            .slice(0, 12)
        : [],
    }))
    .filter(
      (chart) =>
        chart.title &&
        chart.data.length,
    )
    .slice(0, 8);
}

function normalizeSources(
  raw: unknown,
): ReportSource[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const unique =
    new Map<
      string,
      ReportSource
    >();

  for (const item of raw) {
    if (
      !item ||
      typeof item !==
        "object"
    ) {
      continue;
    }

    const value =
      item as Record<
        string,
        unknown
      >;

    const url = cleanText(
      value.url,
      2000,
    );

    if (
      !/^https?:\/\//i.test(
        url,
      )
    ) {
      continue;
    }

    const type =
      value.type === "file"
        ? "file"
        : value.type === "web"
          ? "web"
          : "unknown";

    let fallbackTitle =
      "Research source";

    try {
      fallbackTitle =
        new URL(url).hostname ||
        fallbackTitle;
    } catch {
      fallbackTitle =
        "Research source";
    }

    if (!unique.has(url)) {
      unique.set(url, {
        type,

        title: cleanText(
          value.title ||
            fallbackTitle,
          300,
        ),

        url,
      });
    }
  }

  return Array.from(
    unique.values(),
  ).slice(0, 24);
}

function sourcesFromSections(
  sections: ReportSection[],
) {
  const candidates: ReportSource[] =
    [];

  for (const section of sections) {
    const values = [
      section.body,
      ...section.bullets,
    ];

    for (const value of values) {
      const urls =
        value.match(
          /https?:\/\/[^\s)\]}>,]+/gi,
        ) ?? [];

      for (const url of urls) {
        candidates.push({
          type: "web",

          title:
            section.title ||
            "Research source",

          url: url.replace(
            /[.,;:]+$/,
            "",
          ),
        });
      }
    }
  }

  return normalizeSources(
    candidates,
  );
}

function mergeSources(
  ...groups: ReportSource[][]
) {
  const unique =
    new Map<
      string,
      ReportSource
    >();

  for (const source of groups.flat()) {
    if (
      source.url &&
      !unique.has(source.url)
    ) {
      unique.set(
        source.url,
        source,
      );
    }
  }

  return Array.from(
    unique.values(),
  ).slice(0, 24);
}

function defaultSections(
  summary: string,
  sources: ReportSource[],
): ReportSection[] {
  return [
    {
      title:
        "Executive Summary",

      body:
        summary ||
        "Slice AI prepared this advisor-facing report for review, discussion, and workflow execution.",

      bullets: [
        "Review all assumptions and current facts before external use.",
        "Verify suitability, source freshness, liquidity, concentration, tax sensitivity, and compliance requirements.",
        "Document the advisor's final decision and any revisions made after review.",
      ],
    },

    {
      title:
        "Research Sources",

      body: sources.length
        ? "The public research sources used by the AI layer are listed below."
        : "No external public source was stored with this report. Current factual claims require independent verification.",

      bullets: sources.length
        ? sources.map(
            (source) =>
              `${source.title} — ${source.url}`,
          )
        : [
            "Add and verify authoritative sources before treating the report as externally researched.",
          ],
    },

    {
      title:
        "Advisor Review Notes",

      body:
        "This report is AI-assisted and intended for advisor review. It is not legal, tax, compliance, fiduciary, or investment approval.",

      bullets: [],
    },
  ];
}

function defaultMetrics(
  input: {
    sourceCount: number;
    researchUsed: boolean;
  },
) {
  return [
    {
      label: "Sources",
      value: input.sourceCount,
      helper:
        "Visible research references",
      tone: input.sourceCount
        ? "green"
        : "amber",
    },

    {
      label: "Research",
      value:
        input.researchUsed
          ? "Live"
          : "Internal",
      helper:
        "AI research posture",
      tone:
        input.researchUsed
          ? "green"
          : "amber",
    },

    {
      label: "Review",
      value: "Required",
      helper:
        "Advisor and firm review",
      tone: "amber",
    },
  ];
}

export async function GET(
  request: Request,
) {
  const user =
    await getCurrentUser();

  if (!user) {
    return noStoreJson(
      {
        error:
          "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const url =
      new URL(request.url);

    const token =
      cleanText(
        url.searchParams.get(
          "token",
        ),
        200,
      );

    if (!token) {
      return noStoreJson(
        {
          error:
            "Report token is required.",
        },
        {
          status: 400,
        },
      );
    }

    const report =
      await db.personalUserBotPdfReport.findUnique(
        {
          where: {
            downloadToken:
              token,
          },
        },
      );

    if (!report) {
      return noStoreJson(
        {
          error:
            "Report not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      report.userId !==
      user.id
    ) {
      return noStoreJson(
        {
          error:
            "You do not have access to this report.",
        },
        {
          status: 403,
        },
      );
    }

    const design =
      parseJson<
        Record<
          string,
          any
        >
      >(
        report.designJson,
        {},
      );

    const normalizedSections =
      normalizeSections(
        parseJson(
          report.sectionsJson,
          [],
        ),
      );

    const explicitSources =
      normalizeSources(
        design.sources,
      );

    const discoveredSources =
      sourcesFromSections(
        normalizedSections,
      );

    const sources =
      mergeSources(
        explicitSources,
        discoveredSources,
      );

    const researchUsed =
      Boolean(
        design.researchUsed ||
          sources.length,
      );

    const metrics =
      normalizeMetrics(
        design.metrics ||
          design.scorecards ||
          [],
      );

    const charts =
      normalizeCharts(
        design.charts || [],
      );

    const sections =
      normalizedSections.length
        ? normalizedSections
        : defaultSections(
            cleanText(
              report.summary,
            ),
            sources,
          );

    return noStoreJson({
      ok: true,

      report: {
        id: report.id,

        title: cleanText(
          report.title,
          300,
        ),

        reportType:
          cleanText(
            report.reportType,
            180,
          ),

        summary: cleanText(
          report.summary,
        ),

        status: cleanText(
          report.status,
          80,
        ),

        createdAt:
          report.createdAt,

        updatedAt:
          report.updatedAt,

        downloadToken:
          report.downloadToken,

        pdfUrl:
          `/api/personal-bot/pdf-report?token=${report.downloadToken}`,

        viewerUrl:
          `/workspace/personal-bot/reports?token=${report.downloadToken}`,

        sections,

        design: {
          generatedBy:
            cleanText(
              design.generatedBy ||
                "Slice AI Studio",
              180,
            ),

          preparedFor:
            cleanText(
              design.preparedFor ||
                user.name ||
                "Advisor Review",
              180,
            ),

          investmentGrade:
            cleanText(
              design.investmentGrade ||
                design.grade ||
                report.status ||
                "Advisor Review Ready",
              180,
            ),

          confidenceScore:
            typeof design.confidenceScore ===
              "number" &&
            Number.isFinite(
              design.confidenceScore,
            )
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(
                      design.confidenceScore,
                    ),
                  ),
                )
              : sources.length >= 3
                ? 90
                : 78,

          provider:
            cleanText(
              design.provider ||
                "Slice AI",
              180,
            ),

          model: cleanText(
            design.model ||
              "Not recorded",
            180,
          ),

          requestId:
            cleanText(
              design.requestId ||
                "",
              300,
            ) || null,

          researchUsed,

          sourceCount:
            sources.length,

          sources,

          metrics:
            metrics.length
              ? metrics
              : defaultMetrics({
                  sourceCount:
                    sources.length,

                  researchUsed,
                }),

          charts,

          advisorReviewRequired:
            true,

          disclosure:
            "AI-assisted report for advisor review. Verify sources, market data, client suitability, tax and legal considerations, liquidity, concentration, and firm compliance requirements before external use.",
        },
      },
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          "Report view failed.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      {
        status: 500,
      },
    );
  }
}