import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

type ReportSection = {
  title?: string;
  body?: string;
  bullets?: string[];
};

type ReportMetric = {
  label?: string;
  value?: string | number;
  helper?: string;
  tone?: string;
};

type ReportChart = {
  title?: string;
  subtitle?: string;
  data?: Array<{
    label?: string;
    value?: number;
  }>;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_SAFE = 66;

const COLORS = {
  bg: "#050505",
  panel: "#111827",
  panel2: "#1f2937",
  border: "#334155",
  white: "#ffffff",
  text: "#e5e7eb",
  muted: "#94a3b8",
  red: "#dc2626",
  redSoft: "#ef4444",
  redDark: "#450a0a",
  green: "#10b981",
  amber: "#f59e0b",
  purple: "#a855f7",
  cyan: "#06b6d4",
  slate: "#64748b"
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
    .replace(/•/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/\s+;/g, ";")
    .replace(/\s+:/g, ":")
    .replace(/\n{4,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanFileName(value: string) {
  return (
    cleanText(value)
      .replace(/[^a-z0-9\s._-]/gi, "")
      .replace(/\s+/g, "-")
      .slice(0, 90)
      .toLowerCase() || "slice-report"
  );
}

function escapePdf(value: unknown) {
  return cleanText(value)
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);

  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255
  };
}

function fill(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
}

function stroke(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`;
}

function yPdf(y: number) {
  return PAGE_HEIGHT - y;
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor?: string,
  strokeColor?: string
) {
  const ops = ["q"];

  if (fillColor) ops.push(fill(fillColor));
  if (strokeColor) ops.push(stroke(strokeColor));

  ops.push(
    `${x.toFixed(2)} ${(PAGE_HEIGHT - y - height).toFixed(2)} ${width.toFixed(
      2
    )} ${height.toFixed(2)} re`
  );

  if (fillColor && strokeColor) ops.push("B");
  else if (fillColor) ops.push("f");
  else if (strokeColor) ops.push("S");

  ops.push("Q");
  return ops.join("\n");
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = COLORS.border,
  width = 1
) {
  return [
    "q",
    stroke(color),
    `${width.toFixed(2)} w`,
    `${x1.toFixed(2)} ${yPdf(y1).toFixed(2)} m`,
    `${x2.toFixed(2)} ${yPdf(y2).toFixed(2)} l`,
    "S",
    "Q"
  ].join("\n");
}

function text(input: {
  x: number;
  y: number;
  text: string;
  size?: number;
  font?: "regular" | "bold" | "mono";
  color?: string;
}) {
  const font = input.font === "bold" ? "F2" : input.font === "mono" ? "F3" : "F1";
  const size = input.size ?? 10;
  const color = input.color ?? COLORS.text;

  return [
    "BT",
    fill(color),
    `/${font} ${size} Tf`,
    `1 0 0 1 ${input.x.toFixed(2)} ${yPdf(input.y).toFixed(2)} Tm`,
    `(${escapePdf(input.text)}) Tj`,
    "ET"
  ].join("\n");
}

function wrap(value: unknown, maxChars = 90) {
  const clean = cleanText(value);

  if (!clean) return [];

  const lines: string[] = [];

  for (const paragraph of clean.split(/\n{2,}/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;

      if (candidate.length > maxChars) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }

    if (current) lines.push(current);
    lines.push("");
  }

  return lines;
}

function toneColor(tone?: string) {
  const lower = String(tone ?? "").toLowerCase();

  if (lower.includes("green")) return COLORS.green;
  if (lower.includes("amber")) return COLORS.amber;
  if (lower.includes("purple")) return COLORS.purple;
  if (lower.includes("cyan")) return COLORS.cyan;
  if (lower.includes("slate")) return COLORS.slate;

  return COLORS.red;
}

function metricValue(value: string | number | undefined) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  return cleanText(value ?? "—").slice(0, 28) || "—";
}

function normalizeSections(raw: unknown): ReportSection[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((section: any) => ({
      title: cleanText(section.title || "Report Section"),
      body: section.body ? cleanText(section.body) : "",
      bullets: Array.isArray(section.bullets)
        ? section.bullets.map(cleanText).filter(Boolean)
        : []
    }))
    .filter((section) => section.title || section.body || section.bullets.length);
}

function normalizeMetrics(raw: unknown): ReportMetric[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((metric: any) => ({
      label: cleanText(metric.label || metric.name || "Metric"),
      value: metric.value ?? metric.score ?? "—",
      helper: metric.helper ? cleanText(metric.helper) : "",
      tone: metric.tone || "slate"
    }))
    .filter((metric) => metric.label);
}

function normalizeCharts(raw: unknown): ReportChart[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((chart: any) => ({
      title: cleanText(chart.title || "Capability Chart"),
      subtitle: chart.subtitle ? cleanText(chart.subtitle) : "",
      data: Array.isArray(chart.data)
        ? chart.data
            .map((item: any) => ({
              label: cleanText(item.label || item.name || ""),
              value: Number(item.value ?? item.score ?? 0)
            }))
            .filter(
              (item: { label: string; value: number }) =>
                item.label && Number.isFinite(item.value)
            )
        : []
    }))
    .filter((chart) => chart.title && chart.data.length);
}

function defaultMetrics(): ReportMetric[] {
  return [
    {
      label: "Presentation Polish",
      value: 92,
      helper: "Demo-ready output",
      tone: "green"
    },
    {
      label: "Advisor Utility",
      value: 90,
      helper: "Workflow-focused",
      tone: "green"
    },
    {
      label: "Review Safety",
      value: 86,
      helper: "Approval-first posture",
      tone: "amber"
    }
  ];
}

function defaultChart(): ReportChart {
  return {
    title: "Slice AI Capability Strength",
    subtitle: "Internal presentation scorecard.",
    data: [
      { label: "Answers", value: 92 },
      { label: "Voice", value: 86 },
      { label: "Reports", value: 90 },
      { label: "Workflow", value: 88 },
      { label: "Review", value: 87 }
    ]
  };
}

function defaultSections(summary: string): ReportSection[] {
  return [
    {
      title: "Executive Summary",
      body:
        summary ||
        "Slice AI Studio is designed to help advisors answer questions, prepare reports, interpret intelligence, and move faster while preserving review gates before external use.",
      bullets: [
        "Fast professional answers inside the advisor workspace.",
        "Voice input and spoken assistant responses.",
        "Presentation-ready report generation.",
        "Advisor-review posture for sensitive actions."
      ]
    },
    {
      title: "Advisor Value Proposition",
      body:
        "Slice is best positioned as an advisor operating layer rather than a simple chatbot. The platform helps compress research, alerts, reports, tasks, and communication preparation into a single workflow.",
      bullets: [
        "Reduce time spent moving between tools.",
        "Improve preparation quality before client meetings.",
        "Convert rough prompts into professional output.",
        "Keep final external use subject to advisor review."
      ]
    },
    {
      title: "Important Review Notes",
      body:
        "This report is AI-assisted and should be reviewed before external distribution. Verify source freshness, client suitability, compliance requirements, tax impact, liquidity needs, and risk tolerance before relying on the content."
    }
  ];
}

class SimplePdf {
  private pages: string[][] = [[]];
  private currentPage = 0;
  private cursorY = MARGIN;
  private title: string;

  constructor(title: string) {
    this.title = cleanText(title || "Slice AI Report");
    this.paintBackground();
  }

  private get ops() {
    return this.pages[this.currentPage];
  }

  private paintBackground() {
    this.ops.push(rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.bg));
    this.ops.push(rect(0, 0, PAGE_WIDTH, 126, COLORS.redDark));
    this.ops.push(rect(0, 0, PAGE_WIDTH, 18, COLORS.red));
    this.ops.push(
      text({
        x: MARGIN,
        y: 32,
        text: "SLICE ADVISOR INTELLIGENCE",
        size: 8,
        font: "bold",
        color: "#fecaca"
      })
    );
  }

  private newPage() {
    this.pages.push([]);
    this.currentPage += 1;
    this.cursorY = MARGIN;
    this.paintBackground();
    this.cursorY = 152;
  }

  private ensureSpace(height: number) {
    if (this.cursorY + height > PAGE_HEIGHT - BOTTOM_SAFE) {
      this.newPage();
    }
  }

  cover(input: {
    title: string;
    reportType: string;
    summary: string;
    preparedBy: string;
    preparedFor: string;
    asOf: string;
    status: string;
    confidenceScore: number;
  }) {
    this.ops.push(rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.bg));
    this.ops.push(rect(0, 0, PAGE_WIDTH, 292, COLORS.redDark));
    this.ops.push(rect(0, 0, PAGE_WIDTH, 24, COLORS.red));
    this.ops.push(rect(MARGIN, 48, 82, 82, COLORS.red, "#fecaca"));
    this.ops.push(rect(MARGIN + 18, 66, 46, 46, COLORS.bg, COLORS.white));

    this.ops.push(
      text({
        x: MARGIN + 30,
        y: 97,
        text: "S",
        size: 28,
        font: "bold",
        color: COLORS.white
      })
    );

    this.ops.push(
      text({
        x: MARGIN + 104,
        y: 62,
        text: "PREMIUM AI REPORT",
        size: 9,
        font: "bold",
        color: "#fecaca"
      })
    );

    this.ops.push(
      text({
        x: MARGIN + 104,
        y: 84,
        text: "Advisor-grade intelligence packet",
        size: 10,
        color: "#fca5a5"
      })
    );

    let titleY = 153;

    for (const lineText of wrap(input.title, 34).slice(0, 4)) {
      this.ops.push(
        text({
          x: MARGIN,
          y: titleY,
          text: lineText,
          size: 25,
          font: "bold",
          color: COLORS.white
        })
      );
      titleY += 30;
    }

    this.ops.push(
      text({
        x: MARGIN,
        y: titleY + 8,
        text: input.reportType,
        size: 10,
        color: "#fecaca"
      })
    );

    this.ops.push(rect(MARGIN, 322, CONTENT_WIDTH, 112, COLORS.panel, COLORS.border));
    this.ops.push(rect(MARGIN, 322, CONTENT_WIDTH, 5, COLORS.red));

    const coverCards = [
      ["Posture", input.status, COLORS.white],
      ["Confidence", `${input.confidenceScore}/100`, COLORS.cyan],
      ["Prepared For", input.preparedFor, COLORS.amber]
    ];

    coverCards.forEach(([label, value, color], index) => {
      const x = MARGIN + 18 + index * 170;

      if (index > 0) {
        this.ops.push(line(x - 22, 348, x - 22, 410, COLORS.border));
      }

      this.ops.push(
        text({
          x,
          y: 356,
          text: String(label).toUpperCase(),
          size: 7,
          font: "bold",
          color: COLORS.muted
        })
      );

      this.ops.push(
        text({
          x,
          y: 385,
          text: String(value).slice(0, 26),
          size: 17,
          font: "bold",
          color: String(color)
        })
      );
    });

    this.ops.push(
      text({
        x: MARGIN,
        y: 478,
        text: "Executive Summary",
        size: 16,
        font: "bold",
        color: COLORS.white
      })
    );

    let summaryY = 506;

    for (const lineText of wrap(input.summary, 88).slice(0, 13)) {
      this.ops.push(
        text({
          x: MARGIN,
          y: summaryY,
          text: lineText || " ",
          size: 10,
          color: COLORS.text
        })
      );
      summaryY += 14;
    }

    const prepared = [
      `Prepared by: ${input.preparedBy}`,
      `Prepared for: ${input.preparedFor}`,
      `As of: ${input.asOf}`,
      "Advisor review required before external use"
    ];

    let metaY = 700;

    for (const item of prepared) {
      this.ops.push(
        text({
          x: MARGIN,
          y: metaY,
          text: item,
          size: 8,
          color: COLORS.muted
        })
      );
      metaY += 12;
    }

    this.newPage();
  }

  heading(titleText: string, eyebrow = "Report") {
    this.ensureSpace(72);

    this.ops.push(
      text({
        x: MARGIN,
        y: this.cursorY,
        text: eyebrow.toUpperCase(),
        size: 7,
        font: "bold",
        color: COLORS.redSoft
      })
    );

    this.cursorY += 14;

    for (const lineText of wrap(titleText, 48).slice(0, 3)) {
      this.ops.push(
        text({
          x: MARGIN,
          y: this.cursorY,
          text: lineText,
          size: 18,
          font: "bold",
          color: COLORS.white
        })
      );
      this.cursorY += 22;
    }

    this.ops.push(line(MARGIN, this.cursorY + 2, PAGE_WIDTH - MARGIN, this.cursorY + 2, COLORS.red, 1.2));
    this.cursorY += 18;
  }

  paragraph(body: unknown, color = COLORS.text) {
    const maxChars = 90;

    for (const lineText of wrap(body, maxChars)) {
      this.ensureSpace(lineText ? 16 : 10);

      if (!lineText) {
        this.cursorY += 8;
        continue;
      }

      this.ops.push(
        text({
          x: MARGIN,
          y: this.cursorY,
          text: lineText,
          size: 10,
          color
        })
      );

      this.cursorY += 14;
    }
  }

  bullets(items: string[]) {
    for (const item of items.filter(Boolean)) {
      const lines = wrap(item, 84);

      this.ensureSpace(lines.length * 14 + 8);

      this.ops.push(
        text({
          x: MARGIN,
          y: this.cursorY,
          text: "-",
          size: 10,
          font: "bold",
          color: COLORS.redSoft
        })
      );

      for (const lineText of lines) {
        this.ops.push(
          text({
            x: MARGIN + 16,
            y: this.cursorY,
            text: lineText,
            size: 10,
            color: COLORS.text
          })
        );
        this.cursorY += 14;
      }

      this.cursorY += 4;
    }
  }

  metrics(metrics: ReportMetric[]) {
    if (!metrics.length) return;

    const gap = 10;
    const width = (CONTENT_WIDTH - gap * 2) / 3;
    const height = 78;

    for (let index = 0; index < metrics.length; index += 3) {
      this.ensureSpace(height + 18);

      metrics.slice(index, index + 3).forEach((metric, column) => {
        const x = MARGIN + column * (width + gap);
        const y = this.cursorY;
        const color = toneColor(metric.tone);

        this.ops.push(rect(x, y, width, height, COLORS.panel, COLORS.border));
        this.ops.push(rect(x, y, 6, height, color));
        this.ops.push(rect(x + 6, y, width - 6, 4, color));

        this.ops.push(
          text({
            x: x + 16,
            y: y + 21,
            text: cleanText(metric.label || "Metric").toUpperCase().slice(0, 32),
            size: 7,
            font: "bold",
            color: COLORS.muted
          })
        );

        this.ops.push(
          text({
            x: x + 16,
            y: y + 47,
            text: metricValue(metric.value),
            size: 16,
            font: "bold",
            color: COLORS.white
          })
        );

        if (metric.helper) {
          this.ops.push(
            text({
              x: x + 16,
              y: y + 65,
              text: cleanText(metric.helper).slice(0, 38),
              size: 7,
              color: COLORS.muted
            })
          );
        }
      });

      this.cursorY += height + 16;
    }
  }

  chart(chart: ReportChart) {
    const data = (chart.data || [])
      .filter((item) => Number.isFinite(Number(item.value)))
      .slice(0, 10);

    if (!data.length) return;

    const height = 205;
    const chartX = MARGIN;
    const chartY = this.cursorY + 58;
    const chartW = CONTENT_WIDTH;
    const chartH = 138;

    this.ensureSpace(height);

    this.ops.push(
      text({
        x: MARGIN,
        y: this.cursorY,
        text: cleanText(chart.title || "Chart"),
        size: 14,
        font: "bold",
        color: COLORS.white
      })
    );

    if (chart.subtitle) {
      this.ops.push(
        text({
          x: MARGIN,
          y: this.cursorY + 17,
          text: cleanText(chart.subtitle),
          size: 8,
          color: COLORS.muted
        })
      );
    }

    this.ops.push(rect(chartX, chartY, chartW, chartH, COLORS.panel, COLORS.border));

    const max = Math.max(1, ...data.map((item) => Number(item.value || 0)));
    const gap = 8;
    const barWidth = (chartW - 24 - gap * (data.length - 1)) / data.length;

    data.forEach((item, index) => {
      const value = Number(item.value || 0);
      const barHeight = Math.max(4, (value / max) * (chartH - 40));
      const x = chartX + 12 + index * (barWidth + gap);
      const y = chartY + chartH - 24 - barHeight;
      const color = value >= 85 ? COLORS.green : value >= 65 ? COLORS.amber : COLORS.red;

      this.ops.push(rect(x, y, barWidth, barHeight, color));
      this.ops.push(
        text({
          x,
          y: y - 5,
          text: String(Math.round(value)),
          size: 7,
          font: "bold",
          color: COLORS.white
        })
      );
      this.ops.push(
        text({
          x,
          y: chartY + chartH - 8,
          text: cleanText(item.label).slice(0, 8),
          size: 6,
          color: COLORS.muted
        })
      );
    });

    this.cursorY += height;
  }

  section(section: ReportSection) {
    this.heading(section.title || "Report Section", "Research");

    if (section.body) {
      this.paragraph(section.body);
    }

    if (section.bullets?.length) {
      this.bullets(section.bullets);
    }

    this.cursorY += 14;
  }

  footer() {
    const total = this.pages.length;

    this.pages.forEach((pageOps, index) => {
      pageOps.push(line(MARGIN, PAGE_HEIGHT - 42, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 42, COLORS.border));
      pageOps.push(
        text({
          x: MARGIN,
          y: PAGE_HEIGHT - 24,
          text: `Slice Advisor Intelligence - ${this.title.slice(0, 58)}`,
          size: 7,
          color: COLORS.muted
        })
      );
      pageOps.push(
        text({
          x: PAGE_WIDTH - MARGIN - 72,
          y: PAGE_HEIGHT - 24,
          text: `Page ${index + 1} of ${total}`,
          size: 7,
          color: COLORS.muted
        })
      );
    });
  }

  buffer() {
    this.footer();

    const fontObjectNumber = 3 + this.pages.length * 2;
    const boldFontObjectNumber = fontObjectNumber + 1;
    const monoFontObjectNumber = fontObjectNumber + 2;

    const objects: string[] = [];

    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push(
      `<< /Type /Pages /Kids ${this.pages
        .map((_, index) => `${3 + index * 2} 0 R`)
        .join(" ")} /Count ${this.pages.length} >>`
    );

    this.pages.forEach((pageOps, index) => {
      const pageObjectNumber = 3 + index * 2;
      const contentObjectNumber = pageObjectNumber + 1;
      const stream = pageOps.join("\n");

      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectNumber} 0 R /F2 ${boldFontObjectNumber} 0 R /F3 ${monoFontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
      );

      objects.push(
        `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`
      );
    });

    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

    const header = "%PDF-1.4\n";
    const bodyParts: string[] = [];
    const offsets: number[] = [0];
    let offset = Buffer.byteLength(header, "utf8");

    objects.forEach((object, index) => {
      offsets.push(offset);
      const part = `${index + 1} 0 obj\n${object}\nendobj\n`;
      bodyParts.push(part);
      offset += Buffer.byteLength(part, "utf8");
    });

    const xrefOffset = offset;
    const xref = [
      "xref",
      `0 ${objects.length + 1}`,
      "0000000000 65535 f ",
      ...offsets.slice(1).map((item) => `${String(item).padStart(10, "0")} 00000 n `),
      "trailer",
      `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
      "startxref",
      String(xrefOffset),
      "%%EOF"
    ].join("\n");

    return Buffer.from(`${header}${bodyParts.join("")}${xref}`, "utf8");
  }
}

function jsonError(message: string, detail: string | null, status = 500) {
  return Response.json(
    {
      error: message,
      detail
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const debug = url.searchParams.get("debug") === "1";

    if (!token) {
      return jsonError("Report token is required.", null, 400);
    }

    const report = await db.personalUserBotPdfReport.findUnique({
      where: {
        downloadToken: token
      }
    });

    if (!report) {
      return jsonError("Report not found.", null, 404);
    }

    const sections = normalizeSections(parseJson(report.sectionsJson, []));
    const design = parseJson<Record<string, any>>(report.designJson, {});
    const metrics = normalizeMetrics(design.metrics || design.scorecards || []);
    const charts = normalizeCharts(design.charts || []);

    const finalMetrics = metrics.length ? metrics : defaultMetrics();
    const finalCharts = charts.length ? charts : [defaultChart()];
    const finalSections = sections.length ? sections : defaultSections(report.summary);

    if (debug) {
      return Response.json({
        ok: true,
        reportId: report.id,
        title: report.title,
        type: report.reportType,
        sections: finalSections.length,
        metrics: finalMetrics.length,
        charts: finalCharts.length
      });
    }

    const title = cleanText(report.title || "Slice AI Report");
    const pdf = new SimplePdf(title);

    pdf.cover({
      title,
      reportType: cleanText(report.reportType || "Premium AI Report"),
      summary: cleanText(report.summary || "Premium Slice AI Studio report."),
      preparedBy: cleanText(design.generatedBy || "Slice AI Studio"),
      preparedFor: cleanText(design.preparedFor || "Advisor Review"),
      asOf: new Date(report.createdAt).toLocaleString(),
      status: cleanText(design.investmentGrade || design.grade || report.status || "Presentation Ready"),
      confidenceScore:
        typeof design.confidenceScore === "number" ? design.confidenceScore : 88
    });

    pdf.heading("Advisor Scorecard", "Overview");
    pdf.metrics(finalMetrics);

    if (finalCharts.length) {
      pdf.heading("Research Visuals", "Graphs");

      for (const chart of finalCharts) {
        pdf.chart(chart);
      }
    }

    for (const section of finalSections) {
      pdf.section(section);
    }

    pdf.heading("Important Notes", "Compliance");
    pdf.paragraph(
      "This report is AI-assisted and intended for advisor review. Verify source freshness, suitability, compliance requirements, tax considerations, liquidity needs, and risk tolerance before using externally.",
      COLORS.muted
    );

    const buffer = pdf.buffer();

    if (!buffer.toString("utf8", 0, 5).startsWith("%PDF-")) {
      return jsonError("PDF generation failed.", "Invalid PDF header.", 500);
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${cleanFileName(report.title)}.pdf"`,
        "Cache-Control": "no-store",
        "Content-Length": String(buffer.byteLength)
      }
    });
  } catch (error) {
    return jsonError(
      "PDF generation failed.",
      error instanceof Error ? error.message : "Unknown PDF error.",
      500
    );
  }
}