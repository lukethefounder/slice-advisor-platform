export type FastPdfTone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";

export type FastPdfMetric = {
  label: string;
  value: string | number;
  helper?: string;
  tone?: FastPdfTone;
};

export type FastPdfSource = {
  title: string;
  sourceName?: string | null;
  url?: string | null;
  score?: number | null;
  summary?: string | null;
  date?: string | null;
};

export type FastPdfChart = {
  type: "bar" | "line";
  title: string;
  subtitle?: string;
  valueLabel?: string;
  data: Array<{
    label: string;
    value: number;
    secondary?: number | null;
  }>;
};

export type FastPdfTable = {
  columns: string[];
  rows: Array<Array<string | number | null | undefined>>;
};

export type FastPdfSection = {
  title: string;
  body?: string;
  bullets?: string[];
  metrics?: FastPdfMetric[];
  sources?: FastPdfSource[];
  chart?: FastPdfChart;
  table?: FastPdfTable;
  footnote?: string;
};

export type FastPdfInput = {
  title: string;
  subtitle?: string;
  summary?: string;
  preparedFor?: string;
  preparedBy?: string;
  asOf?: string;
  investmentGrade?: string;
  confidenceScore?: number;
  metrics?: FastPdfMetric[];
  sources?: FastPdfSource[];
  charts?: FastPdfChart[];
  sections: FastPdfSection[];
  footer?: string;
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
  slate: "#64748b",
};

function toneColor(tone?: FastPdfTone) {
  if (tone === "green") return COLORS.green;
  if (tone === "amber") return COLORS.amber;
  if (tone === "purple") return COLORS.purple;
  if (tone === "cyan") return COLORS.cyan;
  if (tone === "slate") return COLORS.slate;
  return COLORS.red;
}

function sanitize(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/•/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{4,}/g, "\n\n")
    .trim();
}

function escapePdf(value: unknown) {
  return sanitize(value)
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
    b: (value & 255) / 255,
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

function rect(x: number, y: number, width: number, height: number, fillColor?: string, strokeColor?: string) {
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

function line(x1: number, y1: number, x2: number, y2: number, color = COLORS.border, width = 1) {
  return [
    "q",
    stroke(color),
    `${width.toFixed(2)} w`,
    `${x1.toFixed(2)} ${yPdf(y1).toFixed(2)} m`,
    `${x2.toFixed(2)} ${yPdf(y2).toFixed(2)} l`,
    "S",
    "Q",
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
    "ET",
  ].join("\n");
}

function wrap(value: unknown, maxChars = 90) {
  const clean = sanitize(value);

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

function metricValue(value: string | number) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  return sanitize(value).slice(0, 28) || "-";
}

class PdfBuilder {
  private pages: string[][] = [[]];
  private currentPage = 0;
  private cursorY = MARGIN;
  private title: string;

  constructor(title: string) {
    this.title = sanitize(title || "Slice AI Report");
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
        color: "#fecaca",
      })
    );
  }

  private newPage() {
    this.pages.push([]);
    this.currentPage += 1;
    this.cursorY = MARGIN;
    this.paintBackground();
  }

  private ensureSpace(height: number) {
    if (this.cursorY + height > PAGE_HEIGHT - BOTTOM_SAFE) {
      this.newPage();
    }
  }

  cover(input: FastPdfInput) {
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
        color: COLORS.white,
      })
    );

    this.ops.push(
      text({
        x: MARGIN + 104,
        y: 62,
        text: "PREMIUM AI REPORT",
        size: 9,
        font: "bold",
        color: "#fecaca",
      })
    );

    this.ops.push(
      text({
        x: MARGIN + 104,
        y: 84,
        text: "Advisor-grade intelligence packet",
        size: 10,
        color: "#fca5a5",
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
          color: COLORS.white,
        })
      );
      titleY += 30;
    }

    if (input.subtitle) {
      for (const lineText of wrap(input.subtitle, 76).slice(0, 3)) {
        this.ops.push(
          text({
            x: MARGIN,
            y: titleY,
            text: lineText,
            size: 10,
            color: "#fecaca",
          })
        );
        titleY += 14;
      }
    }

    const grade = input.investmentGrade || "Advisor Review";
    const confidence =
      typeof input.confidenceScore === "number" ? `${input.confidenceScore}/100` : "Review";

    this.ops.push(rect(MARGIN, 322, CONTENT_WIDTH, 112, COLORS.panel, COLORS.border));
    this.ops.push(rect(MARGIN, 322, CONTENT_WIDTH, 5, COLORS.red));

    const cards = [
      ["Posture", grade, COLORS.white],
      ["Confidence", confidence, COLORS.cyan],
      ["Sources", String(input.sources?.length ?? 0), COLORS.amber],
    ];

    cards.forEach(([label, value, color], index) => {
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
          color: COLORS.muted,
        })
      );

      this.ops.push(
        text({
          x,
          y: 385,
          text: String(value).slice(0, 25),
          size: 18,
          font: "bold",
          color: String(color),
        })
      );
    });

    if (input.summary) {
      let summaryY = 478;

      this.ops.push(
        text({
          x: MARGIN,
          y: summaryY,
          text: "Executive Summary",
          size: 15,
          font: "bold",
          color: COLORS.white,
        })
      );

      summaryY += 24;

      for (const lineText of wrap(input.summary, 88).slice(0, 14)) {
        this.ops.push(
          text({
            x: MARGIN,
            y: summaryY,
            text: lineText || " ",
            size: 10,
            color: COLORS.text,
          })
        );
        summaryY += 14;
      }
    }

    const prepared = [
      input.preparedFor ? `Prepared for: ${input.preparedFor}` : "Prepared for: Advisor Review",
      input.preparedBy ? `Prepared by: ${input.preparedBy}` : "Prepared by: Slice",
      input.asOf ? `As of: ${input.asOf}` : `As of: ${new Date().toLocaleString()}`,
      "Compliance status: advisor review required before external use",
    ];

    let metaY = 700;

    for (const item of prepared) {
      this.ops.push(
        text({
          x: MARGIN,
          y: metaY,
          text: item,
          size: 8,
          color: COLORS.muted,
        })
      );
      metaY += 12;
    }

    this.newPage();
  }

  heading(title: string, eyebrow?: string) {
    this.ensureSpace(72);

    if (eyebrow) {
      this.ops.push(
        text({
          x: MARGIN,
          y: this.cursorY,
          text: eyebrow.toUpperCase(),
          size: 7,
          font: "bold",
          color: COLORS.redSoft,
        })
      );
      this.cursorY += 14;
    }

    for (const lineText of wrap(title, 48).slice(0, 3)) {
      this.ops.push(
        text({
          x: MARGIN,
          y: this.cursorY,
          text: lineText,
          size: 18,
          font: "bold",
          color: COLORS.white,
        })
      );
      this.cursorY += 22;
    }

    this.ops.push(line(MARGIN, this.cursorY + 2, PAGE_WIDTH - MARGIN, this.cursorY + 2, COLORS.red, 1.2));
    this.cursorY += 18;
  }

  paragraph(body: unknown, options?: { size?: number; color?: string; indent?: number }) {
    const size = options?.size ?? 10;
    const color = options?.color ?? COLORS.text;
    const indent = options?.indent ?? 0;
    const maxChars = Math.max(24, Math.floor((CONTENT_WIDTH - indent) / (size * 0.52)));

    for (const lineText of wrap(body, maxChars)) {
      this.ensureSpace(lineText ? 16 : 10);

      if (!lineText) {
        this.cursorY += 8;
        continue;
      }

      this.ops.push(
        text({
          x: MARGIN + indent,
          y: this.cursorY,
          text: lineText,
          size,
          color,
        })
      );

      this.cursorY += size + 4;
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
          color: COLORS.redSoft,
        })
      );

      for (const lineText of lines) {
        this.ops.push(
          text({
            x: MARGIN + 16,
            y: this.cursorY,
            text: lineText,
            size: 10,
            color: COLORS.text,
          })
        );
        this.cursorY += 14;
      }

      this.cursorY += 4;
    }
  }

  metrics(metrics: FastPdfMetric[]) {
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
            text: metric.label.toUpperCase().slice(0, 32),
            size: 7,
            font: "bold",
            color: COLORS.muted,
          })
        );

        this.ops.push(
          text({
            x: x + 16,
            y: y + 47,
            text: metricValue(metric.value),
            size: 16,
            font: "bold",
            color: COLORS.white,
          })
        );

        if (metric.helper) {
          this.ops.push(
            text({
              x: x + 16,
              y: y + 65,
              text: sanitize(metric.helper).slice(0, 38),
              size: 7,
              color: COLORS.muted,
            })
          );
        }
      });

      this.cursorY += height + 16;
    }
  }

  chart(chart: FastPdfChart) {
    const data = chart.data.filter((item) => Number.isFinite(item.value)).slice(0, 10);

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
        text: chart.title,
        size: 14,
        font: "bold",
        color: COLORS.white,
      })
    );

    if (chart.subtitle) {
      this.ops.push(
        text({
          x: MARGIN,
          y: this.cursorY + 17,
          text: chart.subtitle,
          size: 8,
          color: COLORS.muted,
        })
      );
    }

    this.ops.push(rect(chartX, chartY, chartW, chartH, COLORS.panel, COLORS.border));

    const maxValue = Math.max(1, ...data.map((item) => item.value));
    const gap = 8;
    const barWidth = (chartW - 24 - gap * (data.length - 1)) / data.length;

    data.forEach((item, index) => {
      const barHeight = Math.max(3, (item.value / maxValue) * (chartH - 40));
      const x = chartX + 12 + index * (barWidth + gap);
      const y = chartY + chartH - 24 - barHeight;
      const barTone: FastPdfTone = item.value >= 85 ? "green" : item.value >= 65 ? "amber" : "red";

      this.ops.push(rect(x, y, barWidth, barHeight, toneColor(barTone)));
      this.ops.push(
        text({
          x,
          y: chartY + chartH - 8,
          text: item.label.slice(0, 8),
          size: 6,
          color: COLORS.muted,
        })
      );
      this.ops.push(
        text({
          x,
          y: y - 5,
          text: String(Math.round(item.value)),
          size: 7,
          font: "bold",
          color: COLORS.white,
        })
      );
    });

    this.cursorY += height;
  }

  sources(sources: FastPdfSource[]) {
    if (!sources.length) return;

    this.heading("Source Intelligence", "Evidence");
    this.paragraph(
      "Slice consolidates source context into a reviewable evidence table so the advisor can quickly understand why each item was retained.",
      { color: COLORS.muted }
    );

    const rowHeight = 58;

    for (const source of sources.slice(0, 18)) {
      this.ensureSpace(rowHeight + 8);

      const scoreTone: FastPdfTone =
        source.score && source.score >= 80
          ? "green"
          : source.score && source.score >= 60
            ? "amber"
            : "slate";

      this.ops.push(rect(MARGIN, this.cursorY, CONTENT_WIDTH, rowHeight, COLORS.panel, COLORS.border));
      this.ops.push(rect(MARGIN, this.cursorY, 4, rowHeight, toneColor(scoreTone)));

      this.ops.push(
        text({
          x: MARGIN + 12,
          y: this.cursorY + 16,
          text: sanitize(source.sourceName || "Source").slice(0, 28),
          size: 8,
          font: "bold",
          color: COLORS.cyan,
        })
      );

      this.ops.push(
        text({
          x: MARGIN + 12,
          y: this.cursorY + 33,
          text: sanitize(source.url || source.date || "").slice(0, 34),
          size: 6,
          color: COLORS.muted,
        })
      );

      this.ops.push(
        text({
          x: MARGIN + 220,
          y: this.cursorY + 27,
          text: source.score === null || source.score === undefined ? "-" : String(source.score),
          size: 14,
          font: "bold",
          color: toneColor(scoreTone),
        })
      );

      const finding = `${source.title}${source.summary ? ` - ${source.summary}` : ""}`;
      const lines = wrap(finding, 48).slice(0, 3);

      lines.forEach((lineText, index) => {
        this.ops.push(
          text({
            x: MARGIN + 285,
            y: this.cursorY + 14 + index * 12,
            text: lineText,
            size: 7,
            color: COLORS.text,
          })
        );
      });

      this.cursorY += rowHeight + 6;
    }
  }

  section(section: FastPdfSection) {
    this.heading(section.title, "Research");

    if (section.metrics?.length) this.metrics(section.metrics);
    if (section.body) this.paragraph(section.body);
    if (section.bullets?.length) this.bullets(section.bullets);
    if (section.chart) this.chart(section.chart);
    if (section.sources?.length) this.sources(section.sources);
    if (section.footnote) this.paragraph(section.footnote, { size: 8, color: COLORS.muted });

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
          color: COLORS.muted,
        })
      );
      pageOps.push(
        text({
          x: PAGE_WIDTH - MARGIN - 72,
          y: PAGE_HEIGHT - 24,
          text: `Page ${index + 1} of ${total}`,
          size: 7,
          color: COLORS.muted,
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
      "%%EOF",
    ].join("\n");

    return Buffer.from(`${header}${bodyParts.join("")}${xref}`, "utf8");
  }
}

export function createFastPdfBuffer(input: FastPdfInput) {
  const builder = new PdfBuilder(input.title || "Slice AI Report");

  builder.cover(input);

  if (input.metrics?.length) {
    builder.heading("Advisor Scorecard", "Overview");
    builder.metrics(input.metrics);
  }

  if (input.charts?.length) {
    builder.heading("Research Visuals", "Graphs");

    for (const chart of input.charts) {
      builder.chart(chart);
    }
  }

  if (input.sources?.length) {
    builder.sources(input.sources);
  }

  for (const section of input.sections) {
    builder.section(section);
  }

  if (input.footer) {
    builder.heading("Important Notes", "Compliance");
    builder.paragraph(input.footer, { color: COLORS.muted });
  }

  return builder.buffer();
}