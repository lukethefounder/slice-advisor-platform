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
const MARGIN = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_SAFE = 58;

const COLORS = {
  bg: "#050505",
  panel: "#111827",
  panelSoft: "#1f2937",
  white: "#ffffff",
  text: "#e5e7eb",
  muted: "#94a3b8",
  faint: "#475569",
  red: "#dc2626",
  redDark: "#450a0a",
  green: "#10b981",
  amber: "#f59e0b",
  purple: "#a855f7",
  cyan: "#06b6d4",
  slate: "#64748b",
  black: "#020617",
  lightBg: "#f8fafc",
  darkText: "#0f172a",
};

function toneColor(tone?: FastPdfTone) {
  if (tone === "green") return COLORS.green;
  if (tone === "amber") return COLORS.amber;
  if (tone === "purple") return COLORS.purple;
  if (tone === "cyan") return COLORS.cyan;
  if (tone === "slate") return COLORS.slate;
  return COLORS.red;
}

function sanitizePdfText(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/\s+;/g, ";")
    .replace(/\s+:/g, ":")
    .replace(/\n{4,}/g, "\n\n")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .trim();
}

function escapePdfText(value: unknown) {
  return sanitizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);

  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

function setFill(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
}

function setStroke(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`;
}

function pdfY(y: number) {
  return PAGE_HEIGHT - y;
}

function rectOp(x: number, y: number, width: number, height: number, fill?: string, stroke?: string) {
  const ops = ["q"];

  if (fill) ops.push(setFill(fill));
  if (stroke) ops.push(setStroke(stroke));

  ops.push(`${x.toFixed(2)} ${(PAGE_HEIGHT - y - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`);

  if (fill && stroke) ops.push("B");
  else if (fill) ops.push("f");
  else if (stroke) ops.push("S");

  ops.push("Q");
  return ops.join("\n");
}

function lineOp(x1: number, y1: number, x2: number, y2: number, stroke = COLORS.faint, width = 1) {
  return [
    "q",
    setStroke(stroke),
    `${width.toFixed(2)} w`,
    `${x1.toFixed(2)} ${pdfY(y1).toFixed(2)} m`,
    `${x2.toFixed(2)} ${pdfY(y2).toFixed(2)} l`,
    "S",
    "Q",
  ].join("\n");
}

function textOp(input: {
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
    setFill(color),
    `/${font} ${size} Tf`,
    `1 0 0 1 ${input.x.toFixed(2)} ${pdfY(input.y).toFixed(2)} Tm`,
    `(${escapePdfText(input.text)}) Tj`,
    "ET",
  ].join("\n");
}

function estimateChars(width: number, fontSize: number) {
  return Math.max(24, Math.floor(width / (fontSize * 0.52)));
}

function wrapText(value: unknown, maxChars = 90) {
  const clean = sanitizePdfText(value);

  if (!clean) return [];

  const paragraphs = clean.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const rawLines = paragraph.split(/\n/);

    for (const rawLine of rawLines) {
      const words = rawLine.split(/\s+/);
      let line = "";

      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;

        if (candidate.length > maxChars) {
          if (line) lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }

      if (line) lines.push(line);
    }

    lines.push("");
  }

  return lines;
}

class PdfBuilder {
  private pages: string[][] = [[]];
  private cursorY = MARGIN;
  private currentPageIndex = 0;
  private title: string;

  constructor(title: string) {
    this.title = title;
    this.paintPageBackground();
  }

  private get ops() {
    return this.pages[this.currentPageIndex];
  }

  private paintPageBackground() {
    this.ops.push(rectOp(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.bg));
    this.ops.push(rectOp(0, 0, PAGE_WIDTH, 130, COLORS.redDark));
    this.ops.push(rectOp(0, 0, PAGE_WIDTH, 18, COLORS.red));
    this.ops.push(textOp({
      x: MARGIN,
      y: 28,
      text: "SLICE ADVISOR INTELLIGENCE",
      size: 8,
      font: "bold",
      color: "#fecaca",
    }));
  }

  private newPage() {
    this.pages.push([]);
    this.currentPageIndex += 1;
    this.cursorY = MARGIN;
    this.paintPageBackground();
  }

  private ensureSpace(height: number) {
    if (this.cursorY + height > PAGE_HEIGHT - BOTTOM_SAFE) {
      this.newPage();
    }
  }

  addCover(input: FastPdfInput) {
    this.ops.push(rectOp(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.bg));
    this.ops.push(rectOp(0, 0, PAGE_WIDTH, 280, COLORS.redDark));
    this.ops.push(rectOp(0, 0, PAGE_WIDTH, 24, COLORS.red));

    this.ops.push(textOp({
      x: MARGIN,
      y: 52,
      text: "SLICE RESEARCH REPORT",
      size: 10,
      font: "bold",
      color: "#fecaca",
    }));

    const titleLines = wrapText(input.title, 34).slice(0, 4);
    let y = 100;

    for (const line of titleLines) {
      this.ops.push(textOp({
        x: MARGIN,
        y,
        text: line,
        size: 26,
        font: "bold",
        color: COLORS.white,
      }));
      y += 31;
    }

    if (input.subtitle) {
      for (const line of wrapText(input.subtitle, 74).slice(0, 3)) {
        this.ops.push(textOp({
          x: MARGIN,
          y,
          text: line,
          size: 11,
          color: "#fecaca",
        }));
        y += 15;
      }
    }

    const grade = input.investmentGrade || "Advisor Review";
    const confidence = typeof input.confidenceScore === "number" ? `${input.confidenceScore}/100` : "Review Required";

    this.ops.push(rectOp(MARGIN, 308, CONTENT_WIDTH, 104, COLORS.panel, COLORS.faint));

    this.ops.push(textOp({ x: MARGIN + 18, y: 335, text: "Investment Grade", size: 8, font: "bold", color: COLORS.muted }));
    this.ops.push(textOp({ x: MARGIN + 18, y: 360, text: grade, size: 22, font: "bold", color: COLORS.white }));

    this.ops.push(lineOp(MARGIN + 220, 326, MARGIN + 220, 396, COLORS.faint));

    this.ops.push(textOp({ x: MARGIN + 250, y: 335, text: "Confidence Score", size: 8, font: "bold", color: COLORS.muted }));
    this.ops.push(textOp({ x: MARGIN + 250, y: 360, text: confidence, size: 22, font: "bold", color: COLORS.cyan }));

    this.ops.push(textOp({ x: MARGIN + 425, y: 335, text: "Sources", size: 8, font: "bold", color: COLORS.muted }));
    this.ops.push(textOp({ x: MARGIN + 425, y: 360, text: String(input.sources?.length ?? 0), size: 22, font: "bold", color: COLORS.amber }));

    if (input.summary) {
      let summaryY = 452;
      this.ops.push(textOp({
        x: MARGIN,
        y: summaryY,
        text: "Executive Summary",
        size: 15,
        font: "bold",
        color: COLORS.white,
      }));
      summaryY += 24;

      for (const line of wrapText(input.summary, 88).slice(0, 15)) {
        this.ops.push(textOp({
          x: MARGIN,
          y: summaryY,
          text: line || " ",
          size: 10,
          color: COLORS.text,
        }));
        summaryY += 14;
      }
    }

    const prepared = [
      input.preparedFor ? `Prepared for: ${input.preparedFor}` : null,
      input.preparedBy ? `Prepared by: ${input.preparedBy}` : "Prepared by: Slice",
      input.asOf ? `As of: ${input.asOf}` : `As of: ${new Date().toLocaleString()}`,
    ].filter(Boolean) as string[];

    let metaY = 706;
    for (const item of prepared) {
      this.ops.push(textOp({
        x: MARGIN,
        y: metaY,
        text: item,
        size: 9,
        color: COLORS.muted,
      }));
      metaY += 13;
    }

    this.newPage();
  }

  addHeading(title: string, eyebrow?: string) {
    this.ensureSpace(64);

    if (eyebrow) {
      this.ops.push(textOp({
        x: MARGIN,
        y: this.cursorY,
        text: eyebrow.toUpperCase(),
        size: 8,
        font: "bold",
        color: COLORS.red,
      }));
      this.cursorY += 14;
    }

    const lines = wrapText(title, 48).slice(0, 3);

    for (const line of lines) {
      this.ops.push(textOp({
        x: MARGIN,
        y: this.cursorY,
        text: line,
        size: 18,
        font: "bold",
        color: COLORS.white,
      }));
      this.cursorY += 22;
    }

    this.cursorY += 8;
  }

  addParagraph(body: unknown, options?: { size?: number; color?: string; indent?: number }) {
    const size = options?.size ?? 10;
    const color = options?.color ?? COLORS.text;
    const indent = options?.indent ?? 0;
    const maxChars = estimateChars(CONTENT_WIDTH - indent, size);

    for (const line of wrapText(body, maxChars)) {
      this.ensureSpace(line ? 16 : 10);

      if (!line) {
        this.cursorY += 8;
        continue;
      }

      this.ops.push(textOp({
        x: MARGIN + indent,
        y: this.cursorY,
        text: line,
        size,
        color,
      }));

      this.cursorY += size + 4;
    }
  }

  addBullets(items: string[]) {
    for (const item of items.filter(Boolean)) {
      const lines = wrapText(item, 84);
      this.ensureSpace(lines.length * 14 + 4);

      this.ops.push(textOp({
        x: MARGIN,
        y: this.cursorY,
        text: "•",
        size: 10,
        font: "bold",
        color: COLORS.red,
      }));

      let first = true;
      for (const line of lines) {
        this.ops.push(textOp({
          x: MARGIN + 16,
          y: this.cursorY,
          text: line,
          size: 10,
          color: COLORS.text,
        }));
        this.cursorY += first ? 14 : 13;
        first = false;
      }

      this.cursorY += 4;
    }
  }

  addMetrics(metrics: FastPdfMetric[]) {
    if (!metrics.length) return;

    const boxGap = 10;
    const boxWidth = (CONTENT_WIDTH - boxGap * 2) / 3;
    const boxHeight = 74;

    for (let index = 0; index < metrics.length; index += 3) {
      this.ensureSpace(boxHeight + 16);

      const row = metrics.slice(index, index + 3);

      row.forEach((metric, col) => {
        const x = MARGIN + col * (boxWidth + boxGap);
        const y = this.cursorY;
        const color = toneColor(metric.tone);

        this.ops.push(rectOp(x, y, boxWidth, boxHeight, COLORS.panel, COLORS.faint));
        this.ops.push(rectOp(x, y, 5, boxHeight, color));

        this.ops.push(textOp({
          x: x + 14,
          y: y + 20,
          text: metric.label.toUpperCase(),
          size: 7,
          font: "bold",
          color: COLORS.muted,
        }));

        this.ops.push(textOp({
          x: x + 14,
          y: y + 43,
          text: String(metric.value).slice(0, 24),
          size: 16,
          font: "bold",
          color: COLORS.white,
        }));

        if (metric.helper) {
          this.ops.push(textOp({
            x: x + 14,
            y: y + 61,
            text: metric.helper.slice(0, 38),
            size: 7,
            color: COLORS.muted,
          }));
        }
      });

      this.cursorY += boxHeight + 14;
    }
  }

  addSources(sources: FastPdfSource[], title = "Source Intelligence") {
    if (!sources.length) return;

    this.addHeading(title, "Evidence");
    this.addParagraph(
      "Slice consolidates source context into a reviewable evidence table so the advisor can quickly understand why each item was retained.",
      { color: COLORS.muted }
    );

    const headerHeight = 24;
    const rowHeight = 54;

    this.ensureSpace(headerHeight + rowHeight);

    this.ops.push(rectOp(MARGIN, this.cursorY, CONTENT_WIDTH, headerHeight, COLORS.panelSoft, COLORS.faint));
    this.ops.push(textOp({ x: MARGIN + 10, y: this.cursorY + 16, text: "Source", size: 8, font: "bold", color: COLORS.white }));
    this.ops.push(textOp({ x: MARGIN + 220, y: this.cursorY + 16, text: "Score", size: 8, font: "bold", color: COLORS.white }));
    this.ops.push(textOp({ x: MARGIN + 285, y: this.cursorY + 16, text: "Finding", size: 8, font: "bold", color: COLORS.white }));
    this.cursorY += headerHeight;

    for (const source of sources.slice(0, 18)) {
      this.ensureSpace(rowHeight + 8);

      this.ops.push(rectOp(MARGIN, this.cursorY, CONTENT_WIDTH, rowHeight, COLORS.panel, COLORS.faint));
      this.ops.push(textOp({
        x: MARGIN + 10,
        y: this.cursorY + 16,
        text: sanitizePdfText(source.sourceName || "Source").slice(0, 28),
        size: 8,
        font: "bold",
        color: COLORS.cyan,
      }));
      this.ops.push(textOp({
        x: MARGIN + 10,
        y: this.cursorY + 32,
        text: sanitizePdfText(source.url || source.date || "").slice(0, 34),
        size: 6,
        color: COLORS.muted,
      }));
      this.ops.push(textOp({
        x: MARGIN + 220,
        y: this.cursorY + 24,
        text: source.score === null || source.score === undefined ? "—" : String(source.score),
        size: 14,
        font: "bold",
        color: toneColor(source.score && source.score >= 80 ? "green" : source.score && source.score >= 60 ? "amber" : "slate"),
      }));

      const finding = `${source.title}${source.summary ? ` - ${source.summary}` : ""}`;
      const lines = wrapText(finding, 48).slice(0, 3);

      lines.forEach((line, index) => {
        this.ops.push(textOp({
          x: MARGIN + 285,
          y: this.cursorY + 14 + index * 12,
          text: line,
          size: 7,
          color: COLORS.text,
        }));
      });

      this.cursorY += rowHeight + 6;
    }
  }

  addTable(table: FastPdfTable) {
    if (!table.columns.length || !table.rows.length) return;

    const columnCount = table.columns.length;
    const columnWidth = CONTENT_WIDTH / columnCount;
    const headerHeight = 24;
    const rowHeight = 36;

    this.ensureSpace(headerHeight + rowHeight);

    this.ops.push(rectOp(MARGIN, this.cursorY, CONTENT_WIDTH, headerHeight, COLORS.panelSoft, COLORS.faint));

    table.columns.forEach((column, index) => {
      this.ops.push(textOp({
        x: MARGIN + index * columnWidth + 8,
        y: this.cursorY + 16,
        text: sanitizePdfText(column).slice(0, 22),
        size: 8,
        font: "bold",
        color: COLORS.white,
      }));
    });

    this.cursorY += headerHeight;

    for (const row of table.rows.slice(0, 24)) {
      this.ensureSpace(rowHeight + 4);
      this.ops.push(rectOp(MARGIN, this.cursorY, CONTENT_WIDTH, rowHeight, COLORS.panel, COLORS.faint));

      row.forEach((cell, index) => {
        const lines = wrapText(String(cell ?? "—"), Math.max(10, Math.floor(columnWidth / 5.5))).slice(0, 2);

        lines.forEach((line, lineIndex) => {
          this.ops.push(textOp({
            x: MARGIN + index * columnWidth + 8,
            y: this.cursorY + 14 + lineIndex * 11,
            text: line,
            size: 7,
            color: COLORS.text,
          }));
        });
      });

      this.cursorY += rowHeight + 3;
    }
  }

  addBarChart(chart: FastPdfChart) {
    const data = chart.data.filter((item) => Number.isFinite(item.value)).slice(0, 12);

    if (!data.length) return;

    const height = 205;
    const chartX = MARGIN;
    const chartY = this.cursorY + 56;
    const chartW = CONTENT_WIDTH;
    const chartH = 135;

    this.ensureSpace(height);

    this.ops.push(textOp({
      x: MARGIN,
      y: this.cursorY,
      text: chart.title,
      size: 14,
      font: "bold",
      color: COLORS.white,
    }));

    if (chart.subtitle) {
      this.ops.push(textOp({
        x: MARGIN,
        y: this.cursorY + 17,
        text: chart.subtitle,
        size: 8,
        color: COLORS.muted,
      }));
    }

    this.ops.push(rectOp(chartX, chartY, chartW, chartH, COLORS.panel, COLORS.faint));

    const maxValue = Math.max(1, ...data.map((item) => item.value));
    const gap = 8;
    const barW = (chartW - 24 - gap * (data.length - 1)) / data.length;

    data.forEach((item, index) => {
      const barH = Math.max(3, (item.value / maxValue) * (chartH - 36));
      const x = chartX + 12 + index * (barW + gap);
      const y = chartY + chartH - 22 - barH;
      const tone: FastPdfTone = item.value >= 85 ? "green" : item.value >= 65 ? "amber" : "red";

      this.ops.push(rectOp(x, y, barW, barH, toneColor(tone)));
      this.ops.push(textOp({
        x,
        y: chartY + chartH - 8,
        text: item.label.slice(0, 8),
        size: 6,
        color: COLORS.muted,
      }));
      this.ops.push(textOp({
        x,
        y: y - 5,
        text: String(Math.round(item.value)),
        size: 7,
        font: "bold",
        color: COLORS.white,
      }));
    });

    this.cursorY += height;
  }

  addLineChart(chart: FastPdfChart) {
    const data = chart.data.filter((item) => Number.isFinite(item.value)).slice(0, 30);

    if (data.length < 2) return;

    const height = 220;
    const chartX = MARGIN;
    const chartY = this.cursorY + 58;
    const chartW = CONTENT_WIDTH;
    const chartH = 140;

    this.ensureSpace(height);

    this.ops.push(textOp({
      x: MARGIN,
      y: this.cursorY,
      text: chart.title,
      size: 14,
      font: "bold",
      color: COLORS.white,
    }));

    if (chart.subtitle) {
      this.ops.push(textOp({
        x: MARGIN,
        y: this.cursorY + 17,
        text: chart.subtitle,
        size: 8,
        color: COLORS.muted,
      }));
    }

    this.ops.push(rectOp(chartX, chartY, chartW, chartH, COLORS.panel, COLORS.faint));

    const values = data.map((item) => item.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    const points = data.map((item, index) => {
      const x = chartX + 14 + (index / (data.length - 1)) * (chartW - 28);
      const y = chartY + 16 + (1 - (item.value - minValue) / range) * (chartH - 38);

      return { x, y, label: item.label, value: item.value };
    });

    const ops = ["q", setStroke(COLORS.cyan), "2 w"];
    ops.push(`${points[0].x.toFixed(2)} ${pdfY(points[0].y).toFixed(2)} m`);

    for (const point of points.slice(1)) {
      ops.push(`${point.x.toFixed(2)} ${pdfY(point.y).toFixed(2)} l`);
    }

    ops.push("S", "Q");
    this.ops.push(ops.join("\n"));

    for (const point of points.filter((_, index) => index === 0 || index === points.length - 1)) {
      this.ops.push(rectOp(point.x - 2, point.y - 2, 4, 4, COLORS.white));
      this.ops.push(textOp({
        x: point.x - 8,
        y: point.y - 8,
        text: String(Math.round(point.value)),
        size: 7,
        font: "bold",
        color: COLORS.white,
      }));
    }

    this.ops.push(textOp({
      x: chartX + 14,
      y: chartY + chartH - 7,
      text: data[0].label.slice(0, 18),
      size: 6,
      color: COLORS.muted,
    }));
    this.ops.push(textOp({
      x: chartX + chartW - 90,
      y: chartY + chartH - 7,
      text: data[data.length - 1].label.slice(0, 18),
      size: 6,
      color: COLORS.muted,
    }));

    this.cursorY += height;
  }

  addChart(chart: FastPdfChart) {
    if (chart.type === "line") {
      this.addLineChart(chart);
    } else {
      this.addBarChart(chart);
    }
  }

  addSection(section: FastPdfSection) {
    this.addHeading(section.title, "Research");

    if (section.metrics?.length) {
      this.addMetrics(section.metrics);
    }

    if (section.body) {
      this.addParagraph(section.body);
    }

    if (section.bullets?.length) {
      this.addBullets(section.bullets);
    }

    if (section.chart) {
      this.addChart(section.chart);
    }

    if (section.table) {
      this.addTable(section.table);
    }

    if (section.sources?.length) {
      this.addSources(section.sources, "Section Sources");
    }

    if (section.footnote) {
      this.addParagraph(section.footnote, { size: 8, color: COLORS.muted });
    }

    this.cursorY += 14;
  }

  addFooterToPages() {
    const total = this.pages.length;

    this.pages.forEach((ops, index) => {
      ops.push(lineOp(MARGIN, PAGE_HEIGHT - 42, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 42, COLORS.faint));
      ops.push(textOp({
        x: MARGIN,
        y: PAGE_HEIGHT - 24,
        text: `Slice Advisor Intelligence - ${this.title.slice(0, 58)}`,
        size: 7,
        color: COLORS.muted,
      }));
      ops.push(textOp({
        x: PAGE_WIDTH - MARGIN - 70,
        y: PAGE_HEIGHT - 24,
        text: `Page ${index + 1} of ${total}`,
        size: 7,
        color: COLORS.muted,
      }));
    });
  }

  toBuffer() {
    this.addFooterToPages();

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
  const builder = new PdfBuilder(input.title || "Slice Research Report");

  builder.addCover(input);

  if (input.metrics?.length) {
    builder.addHeading("Advisor Scorecard", "Overview");
    builder.addMetrics(input.metrics);
  }

  if (input.sources?.length) {
    builder.addSources(input.sources);
  }

  if (input.charts?.length) {
    builder.addHeading("Research Visuals", "Graphs");
    for (const chart of input.charts) {
      builder.addChart(chart);
    }
  }

  for (const section of input.sections) {
    builder.addSection(section);
  }

  if (input.footer) {
    builder.addHeading("Important Notes", "Compliance");
    builder.addParagraph(input.footer, { color: COLORS.muted });
  }

  return builder.toBuffer();
}