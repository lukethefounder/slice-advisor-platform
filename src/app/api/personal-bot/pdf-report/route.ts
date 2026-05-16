import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createFastPdfBuffer,
  type FastPdfChart,
  type FastPdfMetric,
  type FastPdfSection,
  type FastPdfSource,
  type FastPdfTone,
} from "@/lib/fast-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function cleanFileName(value: string) {
  return (
    value
      .replace(/[^a-z0-9\s._-]/gi, "")
      .replace(/\s+/g, "-")
      .slice(0, 90)
      .toLowerCase() || "slice-report"
  );
}

function cleanProse(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/\s+;/g, ";")
    .replace(/\s+:/g, ":")
    .replace(/\n{4,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTone(value: unknown): FastPdfTone {
  if (
    value === "red" ||
    value === "green" ||
    value === "amber" ||
    value === "purple" ||
    value === "cyan" ||
    value === "slate"
  ) {
    return value;
  }

  return "slate";
}

function sourceFromAlert(alert: any): FastPdfSource {
  return {
    title: cleanProse(alert.title),
    sourceName: cleanProse(alert.source || "Alert Source"),
    url: alert.sourceUrl,
    score: alert.score,
    summary: cleanProse(alert.aiBriefing || alert.body || ""),
    date: alert.createdAt ? new Date(alert.createdAt).toLocaleString() : null,
  };
}

function sourceFromHeadline(decision: any): FastPdfSource {
  return {
    title: cleanProse(decision.title),
    sourceName: cleanProse(decision.sourceName),
    url: decision.url,
    score: decision.score,
    summary: cleanProse(decision.summary || decision.action || ""),
    date: decision.createdAt
      ? new Date(decision.createdAt).toLocaleString()
      : null,
  };
}

function sourceFromOpportunity(signal: any): FastPdfSource {
  return {
    title: cleanProse(signal.title),
    sourceName: cleanProse(signal.sourceName || "Opportunity Signal"),
    url: signal.sourceUrl ?? signal.headlineDecision?.url ?? null,
    score: signal.compositeScore,
    summary: cleanProse(
      signal.aiBriefing || signal.summary || signal.suggestedAction || ""
    ),
    date: signal.createdAt ? new Date(signal.createdAt).toLocaleString() : null,
  };
}

function sourceFromResearch(note: any): FastPdfSource {
  return {
    title: cleanProse(note.title),
    sourceName: "Internal Research",
    url: note.sourceLinks || null,
    score:
      note.conviction === "High"
        ? 85
        : note.conviction === "Medium"
          ? 70
          : 55,
    summary: cleanProse(
      `${note.thesis || ""}${note.risks ? ` Risks: ${note.risks}` : ""}`
    ),
    date: note.createdAt ? new Date(note.createdAt).toLocaleString() : null,
  };
}

function normalizeMetrics(raw: unknown): FastPdfMetric[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item: any): FastPdfMetric => {
        const numericValue = toNumber(item.value ?? item.score);
        const value =
          numericValue !== null
            ? numericValue
            : cleanProse(item.value ?? item.score ?? "—");

        return {
          label: cleanProse(item.label || item.name || "Metric"),
          value,
          helper: item.helper ? cleanProse(item.helper) : undefined,
          tone: normalizeTone(item.tone),
        };
      })
      .filter((item) => item.label);
  }

  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(
      ([label, value]): FastPdfMetric => {
        const numericValue = toNumber(value);

        return {
          label,
          value: numericValue !== null ? numericValue : cleanProse(value),
          tone:
            numericValue !== null && numericValue >= 80
              ? "green"
              : numericValue !== null && numericValue >= 60
                ? "amber"
                : "slate",
        };
      }
    );
  }

  return [];
}

function normalizeCharts(raw: unknown): FastPdfChart[] {
  if (!Array.isArray(raw)) return [];

  const charts: FastPdfChart[] = raw
    .map((chart: any): FastPdfChart => {
      const type: "bar" | "line" = chart?.type === "line" ? "line" : "bar";

      return {
        type,
        title: cleanProse(chart?.title || "Research Chart"),
        subtitle: chart?.subtitle ? cleanProse(chart.subtitle) : undefined,
        valueLabel: chart?.valueLabel ? cleanProse(chart.valueLabel) : undefined,
        data: Array.isArray(chart?.data)
          ? chart.data
              .map((item: any) => ({
                label: cleanProse(item.label || item.name || ""),
                value: toNumber(item.value ?? item.score ?? item.y) ?? 0,
                secondary: toNumber(item.secondary),
              }))
              .filter((item: { label: string }) => item.label)
          : [],
      };
    })
    .filter((chart) => chart.title && chart.data.length);

  return charts;
}

function normalizeSources(raw: unknown): FastPdfSource[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item: any): FastPdfSource => ({
      title: cleanProse(item.title || item.headline || item.name || "Source"),
      sourceName: cleanProse(
        item.sourceName || item.source || item.publisher || ""
      ),
      url: item.url || item.sourceUrl || null,
      score: toNumber(item.score),
      summary: item.summary ? cleanProse(item.summary) : null,
      date: item.date || item.publishedAt || null,
    }))
    .filter((item) => item.title);
}

function normalizeSections(raw: unknown): FastPdfSection[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((section: any): FastPdfSection => ({
      title: cleanProse(section.title || "Research Section"),
      body: section.body ? cleanProse(section.body) : undefined,
      bullets: Array.isArray(section.bullets)
        ? section.bullets.map(cleanProse).filter(Boolean)
        : undefined,
      metrics: normalizeMetrics(section.metrics),
      sources: normalizeSources(section.sources),
      chart: normalizeCharts(section.chart ? [section.chart] : [])[0],
      table:
        section.table &&
        Array.isArray(section.table.columns) &&
        Array.isArray(section.table.rows)
          ? {
              columns: section.table.columns.map(cleanProse),
              rows: section.table.rows,
            }
          : undefined,
      footnote: section.footnote ? cleanProse(section.footnote) : undefined,
    }))
    .filter((section) => section.title);
}

function dedupeSources(sources: FastPdfSource[]) {
  const seen = new Set<string>();
  const output: FastPdfSource[] = [];

  for (const source of sources) {
    const key = `${source.title}:${source.url ?? ""}`.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      output.push(source);
    }
  }

  return output.slice(0, 28);
}

function buildScoreMetrics(
  sources: FastPdfSource[],
  reportStatus: string
): FastPdfMetric[] {
  const scores = sources
    .map((source) => source.score)
    .filter(
      (score): score is number =>
        typeof score === "number" && Number.isFinite(score)
    );

  const averageScore = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : 0;

  const topScore = scores.length ? Math.max(...scores) : 0;

  return [
    {
      label: "Source Count",
      value: sources.length,
      helper: "Consolidated evidence",
      tone:
        sources.length >= 8 ? "green" : sources.length >= 4 ? "amber" : "slate",
    },
    {
      label: "Average Score",
      value: averageScore || "—",
      helper: "Across scored sources",
      tone:
        averageScore >= 80 ? "green" : averageScore >= 60 ? "amber" : "slate",
    },
    {
      label: "Top Score",
      value: topScore || "—",
      helper: "Highest-ranked signal",
      tone: topScore >= 85 ? "green" : topScore >= 65 ? "amber" : "slate",
    },
    {
      label: "Report Status",
      value: reportStatus,
      helper: "Advisor review required",
      tone: reportStatus.toLowerCase().includes("ready") ? "green" : "amber",
    },
  ];
}

function buildSourceChart(sources: FastPdfSource[]): FastPdfChart | null {
  const scored = sources
    .filter((source) => typeof source.score === "number")
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, 10);

  if (!scored.length) return null;

  return {
    type: "bar",
    title: "Top Source Scores",
    subtitle: "Highest-ranked evidence retained inside Slice.",
    valueLabel: "Score",
    data: scored.map((source) => ({
      label: source.sourceName || source.title.slice(0, 8),
      value: Number(source.score),
    })),
  };
}

function buildResearchContextSection(input: {
  alerts: any[];
  headlines: any[];
  opportunities: any[];
  researchNotes: any[];
}): FastPdfSection {
  const bullets = [
    `${input.alerts.length} alert event(s) reviewed from Slice intelligence.`,
    `${input.headlines.length} headline decision(s) reviewed from the triage engine.`,
    `${input.opportunities.length} opportunity signal(s) reviewed for source-backed investment context.`,
    `${input.researchNotes.length} internal research note(s) reviewed for advisor context.`,
  ];

  const strongestItems = [
    ...input.alerts
      .slice(0, 3)
      .map((item) => `Alert: ${item.title} — score ${item.score}`),
    ...input.headlines
      .slice(0, 3)
      .map((item) => `Headline: ${item.title} — score ${item.score}`),
    ...input.opportunities
      .slice(0, 3)
      .map(
        (item) =>
          `Opportunity: ${item.title} — composite ${item.compositeScore}`
      ),
  ];

  return {
    title: "Consolidated Research Context",
    body:
      "This section consolidates the strongest available Slice intelligence records connected to the advisor workspace. It is designed to help the advisor rapidly understand the current evidence base before using the report externally.",
    bullets: [...bullets, ...strongestItems],
  };
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Report token is required." }, { status: 400 });
  }

  const report = await prisma.personalUserBotPdfReport.findUnique({
    where: {
      downloadToken: token,
    },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const rawSections = parseJson<Array<Record<string, unknown>>>(
    report.sectionsJson,
    []
  );
  const design = parseJson<Record<string, any>>(report.designJson, {});

  const [alerts, headlines, opportunities, researchNotes] = await Promise.all([
    prisma.alertEvent.findMany({
      where: {
        userId: report.userId,
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.headlineDecision.findMany({
      where: {
        userId: report.userId,
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.opportunitySignal.findMany({
      where: {
        userId: report.userId,
      },
      include: {
        headlineDecision: true,
      },
      orderBy: [{ compositeScore: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.researchNote.findMany({
      where: {
        userId: report.userId,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const storedSources = [
    ...alerts.map(sourceFromAlert),
    ...headlines.map(sourceFromHeadline),
    ...opportunities.map(sourceFromOpportunity),
    ...researchNotes.map(sourceFromResearch),
  ];

  const explicitSources = normalizeSources(
    design.sources || design.evidence || design.sourceEvidence || []
  );

  const normalizedSections = normalizeSections(rawSections);
  const sectionSources = normalizedSections.flatMap(
    (section) => section.sources ?? []
  );

  const sources = dedupeSources([
    ...explicitSources,
    ...sectionSources,
    ...storedSources,
  ]);

  const explicitMetrics = normalizeMetrics(design.metrics || design.scorecards || []);
  const scoreMetrics = buildScoreMetrics(sources, report.status);
  const metrics = explicitMetrics.length ? explicitMetrics : scoreMetrics;

  const explicitCharts = normalizeCharts(design.charts || []);
  const sourceChart = buildSourceChart(sources);
  const charts = [...explicitCharts, ...(sourceChart ? [sourceChart] : [])];

  const contextSection = buildResearchContextSection({
    alerts,
    headlines,
    opportunities,
    researchNotes,
  });

  const finalSections: FastPdfSection[] = [
    contextSection,
    ...normalizedSections,
  ];

  if (!finalSections.length) {
    finalSections.push({
      title: "Research Report",
      body: cleanProse(report.summary),
    });
  }

  const confidenceScore =
    typeof design.confidenceScore === "number"
      ? design.confidenceScore
      : metrics
          .map((metric) => Number(metric.value))
          .filter(Number.isFinite)
          .sort((a, b) => b - a)[0] ?? undefined;

  const pdf = createFastPdfBuffer({
    title: cleanProse(report.title),
    subtitle: `${cleanProse(report.reportType)} · Premium Slice Research PDF`,
    summary: cleanProse(report.summary),
    preparedFor: cleanProse(design.preparedFor || "Advisor Review"),
    preparedBy: cleanProse(design.generatedBy || "Slice Advisor Intelligence"),
    asOf: new Date(report.createdAt).toLocaleString(),
    investmentGrade: cleanProse(
      design.investmentGrade || design.grade || "Advisor Review"
    ),
    confidenceScore,
    metrics,
    sources,
    charts,
    sections: finalSections,
    footer:
      "This report is generated for advisor review. It may contain AI-assisted research synthesis and consolidated platform intelligence. Verify source freshness, client suitability, risk tolerance, tax impact, liquidity needs, and compliance requirements before using externally or sending to clients.",
  });

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${cleanFileName(report.title)}.pdf"`,
      "Cache-Control": "private, max-age=120",
      "X-Slice-PDF-Render-Time-MS": String(Date.now() - startedAt),
      "X-Slice-PDF-Renderer": "premium-vector-report-v2",
      "X-Slice-Source-Count": String(sources.length),
    },
  });
}