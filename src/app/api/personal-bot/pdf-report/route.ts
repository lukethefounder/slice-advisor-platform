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
  type:
    | "web"
    | "file"
    | "unknown";
  title: string;
  url: string;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 44;
const CONTENT_WIDTH =
  PAGE_WIDTH -
  MARGIN * 2;
const BOTTOM_SAFE = 62;

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
  blue: "#3b82f6",
  slate: "#64748b",
};

function parseJson<T>(
  value:
    | string
    | null
    | undefined,
  fallback: T,
): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(
      value,
    ) as T;
  } catch {
    return fallback;
  }
}

function cleanText(
  value: unknown,
  maximum = 40_000,
) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/•/g, "-")
    .replace(
      /[^\x09\x0A\x0D\x20-\x7E]/g,
      "",
    )
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/\s+;/g, ";")
    .replace(/\s+:/g, ":")
    .replace(
      /\n{4,}/g,
      "\n\n",
    )
    .replace(
      /[ \t]{2,}/g,
      " ",
    )
    .trim()
    .slice(0, maximum);
}

function cleanFileName(
  value: string,
) {
  return (
    cleanText(value)
      .replace(
        /[^a-z0-9\s._-]/gi,
        "",
      )
      .replace(/\s+/g, "-")
      .slice(0, 90)
      .toLowerCase() ||
    "slice-report"
  );
}

function escapePdf(
  value: unknown,
) {
  return cleanText(value)
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .replace(
      /\\/g,
      "\\\\",
    )
    .replace(
      /\(/g,
      "\\(",
    )
    .replace(
      /\)/g,
      "\\)",
    );
}

function hexToRgb(
  hex: string,
) {
  const clean =
    hex.replace("#", "");

  const value =
    Number.parseInt(
      clean,
      16,
    );

  return {
    r:
      ((value >> 16) &
        255) /
      255,

    g:
      ((value >> 8) &
        255) /
      255,

    b:
      (value & 255) /
      255,
  };
}

function fill(
  hex: string,
) {
  const {
    r,
    g,
    b,
  } = hexToRgb(hex);

  return `${r.toFixed(
    3,
  )} ${g.toFixed(
    3,
  )} ${b.toFixed(
    3,
  )} rg`;
}

function stroke(
  hex: string,
) {
  const {
    r,
    g,
    b,
  } = hexToRgb(hex);

  return `${r.toFixed(
    3,
  )} ${g.toFixed(
    3,
  )} ${b.toFixed(
    3,
  )} RG`;
}

function yPdf(
  y: number,
) {
  return PAGE_HEIGHT - y;
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor?: string,
  strokeColor?: string,
) {
  const operations = [
    "q",
  ];

  if (fillColor) {
    operations.push(
      fill(fillColor),
    );
  }

  if (strokeColor) {
    operations.push(
      stroke(
        strokeColor,
      ),
    );
  }

  operations.push(
    `${x.toFixed(
      2,
    )} ${(
      PAGE_HEIGHT -
      y -
      height
    ).toFixed(
      2,
    )} ${width.toFixed(
      2,
    )} ${height.toFixed(
      2,
    )} re`,
  );

  if (
    fillColor &&
    strokeColor
  ) {
    operations.push("B");
  } else if (fillColor) {
    operations.push("f");
  } else if (
    strokeColor
  ) {
    operations.push("S");
  }

  operations.push("Q");

  return operations.join(
    "\n",
  );
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color =
    COLORS.border,
  width = 1,
) {
  return [
    "q",

    stroke(color),

    `${width.toFixed(
      2,
    )} w`,

    `${x1.toFixed(
      2,
    )} ${yPdf(
      y1,
    ).toFixed(2)} m`,

    `${x2.toFixed(
      2,
    )} ${yPdf(
      y2,
    ).toFixed(2)} l`,

    "S",
    "Q",
  ].join("\n");
}

function text(
  input: {
    x: number;
    y: number;
    text: string;
    size?: number;
    font?:
      | "regular"
      | "bold"
      | "mono";
    color?: string;
  },
) {
  const font =
    input.font === "bold"
      ? "F2"
      : input.font ===
          "mono"
        ? "F3"
        : "F1";

  const size =
    input.size ?? 10;

  const color =
    input.color ??
    COLORS.text;

  return [
    "BT",

    fill(color),

    `/${font} ${size} Tf`,

    `1 0 0 1 ${input.x.toFixed(
      2,
    )} ${yPdf(
      input.y,
    ).toFixed(2)} Tm`,

    `(${escapePdf(
      input.text,
    )}) Tj`,

    "ET",
  ].join("\n");
}

function wrap(
  value: unknown,
  maximumCharacters = 90,
) {
  const clean =
    cleanText(value);

  if (!clean) {
    return [];
  }

  const output: string[] =
    [];

  for (
    const paragraph of clean.split(
      /\n{2,}/,
    )
  ) {
    const words =
      paragraph
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    let current = "";

    for (const word of words) {
      if (
        word.length >
        maximumCharacters
      ) {
        if (current) {
          output.push(
            current,
          );

          current = "";
        }

        for (
          let index = 0;
          index <
          word.length;
          index +=
            maximumCharacters
        ) {
          output.push(
            word.slice(
              index,
              index +
                maximumCharacters,
            ),
          );
        }

        continue;
      }

      const candidate =
        current
          ? `${current} ${word}`
          : word;

      if (
        candidate.length >
        maximumCharacters
      ) {
        if (current) {
          output.push(
            current,
          );
        }

        current = word;
      } else {
        current =
          candidate;
      }
    }

    if (current) {
      output.push(
        current,
      );
    }

    output.push("");
  }

  while (
    output[
      output.length - 1
    ] === ""
  ) {
    output.pop();
  }

  return output;
}

function toneColor(
  value?: string,
) {
  const lower =
    String(
      value ?? "",
    ).toLowerCase();

  if (
    lower.includes(
      "green",
    )
  ) {
    return COLORS.green;
  }

  if (
    lower.includes(
      "amber",
    )
  ) {
    return COLORS.amber;
  }

  if (
    lower.includes(
      "purple",
    )
  ) {
    return COLORS.purple;
  }

  if (
    lower.includes(
      "cyan",
    )
  ) {
    return COLORS.cyan;
  }

  if (
    lower.includes(
      "blue",
    )
  ) {
    return COLORS.blue;
  }

  if (
    lower.includes(
      "slate",
    )
  ) {
    return COLORS.slate;
  }

  return COLORS.red;
}

function metricValue(
  value:
    | string
    | number
    | undefined,
) {
  if (
    typeof value ===
    "number"
  ) {
    return Number.isInteger(
      value,
    )
      ? String(value)
      : value.toFixed(1);
  }

  return (
    cleanText(
      value ?? "—",
    ).slice(0, 30) ||
    "—"
  );
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
            .map(
              (
                item: unknown,
              ) =>
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
        metric?.tone ||
          "slate",
        30,
      ),
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

    const record =
      item as Record<
        string,
        unknown
      >;

    const url =
      cleanText(
        record.url,
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
      record.type === "file"
        ? "file"
        : record.type ===
            "web"
          ? "web"
          : "unknown";

    let fallbackTitle =
      "Research source";

    try {
      fallbackTitle =
        new URL(
          url,
        ).hostname ||
        fallbackTitle;
    } catch {
      fallbackTitle =
        "Research source";
    }

    if (!unique.has(url)) {
      unique.set(url, {
        type,

        title: cleanText(
          record.title ||
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
    for (
      const value of [
        section.body,
        ...section.bullets,
      ]
    ) {
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

function defaultMetrics(
  input: {
    sourceCount: number;
    researchUsed: boolean;
  },
) {
  return [
    {
      label: "Sources",
      value:
        input.sourceCount,
      helper:
        "Visible research references",
      tone:
        input.sourceCount
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
        : "No external public source was stored with this report.",

      bullets: sources.length
        ? sources.map(
            (source) =>
              `${source.title} - ${source.url}`,
          )
        : [
            "Verify all current factual claims independently before external use.",
          ],
    },
  ];
}

class SimplePdf {
  private pages: string[][] =
    [[]];

  private currentPage = 0;

  private cursorY = 148;

  private title: string;

  constructor(
    title: string,
  ) {
    this.title =
      cleanText(
        title ||
          "Slice AI Report",
        300,
      );

    this.paintBackground();
  }

  private get operations() {
    return this.pages[
      this.currentPage
    ];
  }

  private paintBackground() {
    this.operations.push(
      rect(
        0,
        0,
        PAGE_WIDTH,
        PAGE_HEIGHT,
        COLORS.bg,
      ),
    );

    this.operations.push(
      rect(
        0,
        0,
        PAGE_WIDTH,
        118,
        COLORS.redDark,
      ),
    );

    this.operations.push(
      rect(
        0,
        0,
        PAGE_WIDTH,
        18,
        COLORS.red,
      ),
    );

    this.operations.push(
      text({
        x: MARGIN,
        y: 35,
        text:
          "SLICE ADVISOR INTELLIGENCE",
        size: 8,
        font: "bold",
        color: "#fecaca",
      }),
    );

    this.operations.push(
      text({
        x: MARGIN,
        y: 61,
        text:
          this.title.slice(
            0,
            72,
          ),
        size: 13,
        font: "bold",
        color:
          COLORS.white,
      }),
    );

    this.operations.push(
      text({
        x: MARGIN,
        y: 83,
        text:
          "AI-assisted financial research and operating report",
        size: 8,
        color: "#fca5a5",
      }),
    );
  }

  private newPage() {
    this.pages.push([]);

    this.currentPage += 1;

    this.cursorY = 148;

    this.paintBackground();
  }

  private ensureSpace(
    height: number,
  ) {
    if (
      this.cursorY +
        height >
      PAGE_HEIGHT -
        BOTTOM_SAFE
    ) {
      this.newPage();
    }
  }

  private addWrappedText(
    input: {
      value: unknown;
      x?: number;
      maximumCharacters?: number;
      size?: number;
      color?: string;
      font?:
        | "regular"
        | "bold"
        | "mono";
      lineHeight?: number;
      maximumLines?: number;
    },
  ) {
    const lines =
      wrap(
        input.value,
        input.maximumCharacters ??
          90,
      );

    const lineHeight =
      input.lineHeight ??
      14;

    const maximumLines =
      input.maximumLines ??
      lines.length;

    for (
      const item of lines.slice(
        0,
        maximumLines,
      )
    ) {
      this.ensureSpace(
        item
          ? lineHeight + 2
          : 10,
      );

      if (!item) {
        this.cursorY += 8;
        continue;
      }

      this.operations.push(
        text({
          x:
            input.x ??
            MARGIN,

          y: this.cursorY,

          text: item,

          size:
            input.size ??
            10,

          color:
            input.color ??
            COLORS.text,

          font: input.font,
        }),
      );

      this.cursorY +=
        lineHeight;
    }
  }

  cover(
    input: {
      title: string;
      reportType: string;
      summary: string;
      preparedBy: string;
      preparedFor: string;
      asOf: string;
      status: string;
      confidenceScore: number;
      provider: string;
      model: string;
      sourceCount: number;
      researchUsed: boolean;
    },
  ) {
    this.pages[
      this.currentPage
    ] = [];

    this.operations.push(
      rect(
        0,
        0,
        PAGE_WIDTH,
        PAGE_HEIGHT,
        COLORS.bg,
      ),
    );

    this.operations.push(
      rect(
        0,
        0,
        PAGE_WIDTH,
        304,
        COLORS.redDark,
      ),
    );

    this.operations.push(
      rect(
        0,
        0,
        PAGE_WIDTH,
        24,
        COLORS.red,
      ),
    );

    this.operations.push(
      rect(
        MARGIN,
        52,
        82,
        82,
        COLORS.red,
        "#fecaca",
      ),
    );

    this.operations.push(
      rect(
        MARGIN + 18,
        70,
        46,
        46,
        COLORS.bg,
        COLORS.white,
      ),
    );

    this.operations.push(
      text({
        x: MARGIN + 30,
        y: 102,
        text: "S",
        size: 28,
        font: "bold",
        color:
          COLORS.white,
      }),
    );

    this.operations.push(
      text({
        x: MARGIN + 104,
        y: 68,
        text:
          "SOURCE-BACKED AI REPORT",
        size: 9,
        font: "bold",
        color: "#fecaca",
      }),
    );

    this.operations.push(
      text({
        x: MARGIN + 104,
        y: 91,
        text:
          `${cleanText(
            input.provider,
          ).slice(
            0,
            38,
          )} | ${cleanText(
            input.model,
          ).slice(
            0,
            34,
          )}`,
        size: 8,
        color: "#fca5a5",
      }),
    );

    let titleY = 162;

    for (
      const titleLine of wrap(
        input.title,
        34,
      ).slice(0, 4)
    ) {
      this.operations.push(
        text({
          x: MARGIN,
          y: titleY,
          text:
            titleLine,
          size: 25,
          font: "bold",
          color:
            COLORS.white,
        }),
      );

      titleY += 30;
    }

    this.operations.push(
      text({
        x: MARGIN,

        y: Math.min(
          titleY + 8,
          284,
        ),

        text:
          cleanText(
            input.reportType,
          ).slice(
            0,
            80,
          ),

        size: 10,

        color: "#fecaca",
      }),
    );

    const cardY = 330;

    this.operations.push(
      rect(
        MARGIN,
        cardY,
        CONTENT_WIDTH,
        116,
        COLORS.panel,
        COLORS.border,
      ),
    );

    this.operations.push(
      rect(
        MARGIN,
        cardY,
        CONTENT_WIDTH,
        5,
        COLORS.red,
      ),
    );

    const cards = [
      [
        "Posture",
        input.status,
        COLORS.white,
      ],

      [
        "Confidence",
        `${input.confidenceScore}/100`,
        COLORS.cyan,
      ],

      [
        "Sources",
        String(
          input.sourceCount,
        ),
        input.sourceCount
          ? COLORS.green
          : COLORS.amber,
      ],

      [
        "Research",
        input.researchUsed
          ? "Live"
          : "Internal",
        input.researchUsed
          ? COLORS.green
          : COLORS.amber,
      ],
    ];

    cards.forEach(
      (
        [
          label,
          value,
          color,
        ],
        index,
      ) => {
        const width =
          CONTENT_WIDTH /
          cards.length;

        const x =
          MARGIN +
          index * width +
          14;

        if (index > 0) {
          this.operations.push(
            line(
              MARGIN +
                index *
                  width,
              cardY + 22,
              MARGIN +
                index *
                  width,
              cardY + 94,
            ),
          );
        }

        this.operations.push(
          text({
            x,

            y:
              cardY + 31,

            text:
              String(
                label,
              ).toUpperCase(),

            size: 7,

            font: "bold",

            color:
              COLORS.muted,
          }),
        );

        this.operations.push(
          text({
            x,

            y:
              cardY + 62,

            text:
              String(
                value,
              ).slice(
                0,
                22,
              ),

            size: 15,

            font: "bold",

            color:
              String(
                color,
              ),
          }),
        );
      },
    );

    this.operations.push(
      text({
        x: MARGIN,
        y: 488,
        text:
          "EXECUTIVE SUMMARY",
        size: 8,
        font: "bold",
        color:
          COLORS.redSoft,
      }),
    );

    let summaryY = 518;

    for (
      const summaryLine of wrap(
        input.summary,
        88,
      ).slice(0, 12)
    ) {
      this.operations.push(
        text({
          x: MARGIN,
          y: summaryY,
          text:
            summaryLine ||
            " ",
          size: 10,
          color:
            COLORS.text,
        }),
      );

      summaryY += 14;
    }

    const metadata = [
      `Prepared by: ${input.preparedBy}`,

      `Prepared for: ${input.preparedFor}`,

      `As of: ${input.asOf}`,

      "Advisor and firm review required before external use",
    ];

    let metadataY = 712;

    for (
      const item of metadata
    ) {
      this.operations.push(
        text({
          x: MARGIN,
          y: metadataY,
          text: item,
          size: 8,
          color:
            COLORS.muted,
        }),
      );

      metadataY += 12;
    }

    this.newPage();
  }

  heading(
    titleValue: string,
    eyebrow = "Report",
  ) {
    const titleLines =
      wrap(
        titleValue,
        48,
      ).slice(0, 3);

    this.ensureSpace(
      34 +
        titleLines.length *
          23,
    );

    this.operations.push(
      text({
        x: MARGIN,
        y: this.cursorY,
        text:
          eyebrow.toUpperCase(),
        size: 7,
        font: "bold",
        color:
          COLORS.redSoft,
      }),
    );

    this.cursorY += 16;

    for (
      const titleLine of titleLines
    ) {
      this.operations.push(
        text({
          x: MARGIN,
          y: this.cursorY,
          text: titleLine,
          size: 18,
          font: "bold",
          color:
            COLORS.white,
        }),
      );

      this.cursorY += 22;
    }

    this.operations.push(
      line(
        MARGIN,
        this.cursorY + 2,
        PAGE_WIDTH -
          MARGIN,
        this.cursorY + 2,
        COLORS.red,
        1.2,
      ),
    );

    this.cursorY += 18;
  }

  paragraph(
    body: unknown,
    color = COLORS.text,
  ) {
    this.addWrappedText({
      value: body,
      color,
    });
  }

  bullets(
    items: string[],
  ) {
    for (
      const item of items.filter(
        Boolean,
      )
    ) {
      const lines =
        wrap(item, 82);

      this.ensureSpace(
        lines.length *
          14 +
          10,
      );

      this.operations.push(
        text({
          x: MARGIN,
          y: this.cursorY,
          text: "-",
          size: 10,
          font: "bold",
          color:
            COLORS.redSoft,
        }),
      );

      for (
        const itemLine of lines
      ) {
        this.operations.push(
          text({
            x: MARGIN + 16,

            y: this.cursorY,

            text:
              itemLine,

            size: 10,

            color:
              COLORS.text,
          }),
        );

        this.cursorY +=
          14;
      }

      this.cursorY += 4;
    }
  }

  metrics(
    metrics: ReportMetric[],
  ) {
    if (!metrics.length) {
      return;
    }

    const gap = 10;

    const width =
      (CONTENT_WIDTH -
        gap * 2) /
      3;

    const height = 82;

    for (
      let index = 0;
      index <
      metrics.length;
      index += 3
    ) {
      this.ensureSpace(
        height + 18,
      );

      metrics
        .slice(
          index,
          index + 3,
        )
        .forEach(
          (
            metric,
            column,
          ) => {
            const x =
              MARGIN +
              column *
                (width +
                  gap);

            const y =
              this.cursorY;

            const color =
              toneColor(
                metric.tone,
              );

            this.operations.push(
              rect(
                x,
                y,
                width,
                height,
                COLORS.panel,
                COLORS.border,
              ),
            );

            this.operations.push(
              rect(
                x,
                y,
                6,
                height,
                color,
              ),
            );

            this.operations.push(
              rect(
                x + 6,
                y,
                width - 6,
                4,
                color,
              ),
            );

            this.operations.push(
              text({
                x: x + 16,

                y: y + 22,

                text:
                  cleanText(
                    metric.label,
                  )
                    .toUpperCase()
                    .slice(
                      0,
                      30,
                    ),

                size: 7,

                font: "bold",

                color:
                  COLORS.muted,
              }),
            );

            this.operations.push(
              text({
                x: x + 16,

                y: y + 49,

                text:
                  metricValue(
                    metric.value,
                  ),

                size: 16,

                font: "bold",

                color:
                  COLORS.white,
              }),
            );

            if (
              metric.helper
            ) {
              this.operations.push(
                text({
                  x:
                    x + 16,

                  y:
                    y + 68,

                  text:
                    cleanText(
                      metric.helper,
                    ).slice(
                      0,
                      38,
                    ),

                  size: 7,

                  color:
                    COLORS.muted,
                }),
              );
            }
          },
        );

      this.cursorY +=
        height + 16;
    }
  }

  chart(
    chartValue: ReportChart,
  ) {
    const data =
      chartValue.data
        .filter(
          (item) =>
            Number.isFinite(
              item.value,
            ),
        )
        .slice(0, 10);

    if (!data.length) {
      return;
    }

    const height = 218;

    this.ensureSpace(
      height,
    );

    this.operations.push(
      text({
        x: MARGIN,

        y: this.cursorY,

        text:
          chartValue.title,

        size: 14,

        font: "bold",

        color:
          COLORS.white,
      }),
    );

    if (
      chartValue.subtitle
    ) {
      this.operations.push(
        text({
          x: MARGIN,

          y:
            this.cursorY +
            18,

          text:
            chartValue.subtitle.slice(
              0,
              90,
            ),

          size: 8,

          color:
            COLORS.muted,
        }),
      );
    }

    const chartX =
      MARGIN;

    const chartY =
      this.cursorY + 50;

    const chartWidth =
      CONTENT_WIDTH;

    const chartHeight =
      142;

    this.operations.push(
      rect(
        chartX,
        chartY,
        chartWidth,
        chartHeight,
        COLORS.panel,
        COLORS.border,
      ),
    );

    const maximum =
      Math.max(
        1,
        ...data.map(
          (item) =>
            item.value,
        ),
      );

    const gap = 8;

    const barWidth =
      (chartWidth -
        24 -
        gap *
          (data.length -
            1)) /
      data.length;

    data.forEach(
      (
        item,
        index,
      ) => {
        const barHeight =
          Math.max(
            4,
            (item.value /
              maximum) *
              (chartHeight -
                42),
          );

        const x =
          chartX +
          12 +
          index *
            (barWidth +
              gap);

        const y =
          chartY +
          chartHeight -
          26 -
          barHeight;

        const color =
          item.value >= 85
            ? COLORS.green
            : item.value >=
                65
              ? COLORS.amber
              : COLORS.red;

        this.operations.push(
          rect(
            x,
            y,
            barWidth,
            barHeight,
            color,
          ),
        );

        this.operations.push(
          text({
            x,

            y: y - 5,

            text: String(
              Math.round(
                item.value,
              ),
            ),

            size: 7,

            font: "bold",

            color:
              COLORS.white,
          }),
        );

        this.operations.push(
          text({
            x,

            y:
              chartY +
              chartHeight -
              8,

            text:
              item.label.slice(
                0,
                9,
              ),

            size: 6,

            color:
              COLORS.muted,
          }),
        );
      },
    );

    this.cursorY +=
      height;
  }

  sourceList(
    sources: ReportSource[],
  ) {
    if (!sources.length) {
      this.heading(
        "Research Sources",
        "Provenance",
      );

      this.paragraph(
        "No external public sources were stored with this report. Verify every current factual claim independently before external use.",
        COLORS.amber,
      );

      this.cursorY += 12;

      return;
    }

    this.heading(
      "Research Sources",
      "Provenance",
    );

    this.paragraph(
      `This report contains ${sources.length} unique visible research source(s). URLs are printed for verification.`,
      COLORS.muted,
    );

    this.cursorY += 8;

    sources.forEach(
      (
        source,
        index,
      ) => {
        const titleLines =
          wrap(
            `${index + 1}. ${source.title}`,
            82,
          );

        const urlLines =
          wrap(
            source.url,
            78,
          );

        this.ensureSpace(
          (titleLines.length +
            urlLines.length) *
            13 +
            18,
        );

        for (
          const sourceTitleLine of titleLines
        ) {
          this.operations.push(
            text({
              x: MARGIN,

              y:
                this.cursorY,

              text:
                sourceTitleLine,

              size: 9,

              font: "bold",

              color:
                COLORS.white,
            }),
          );

          this.cursorY +=
            13;
        }

        for (
          const sourceUrlLine of urlLines
        ) {
          this.operations.push(
            text({
              x:
                MARGIN +
                16,

              y:
                this.cursorY,

              text:
                sourceUrlLine,

              size: 7,

              font: "mono",

              color:
                COLORS.cyan,
            }),
          );

          this.cursorY +=
            11;
        }

        this.cursorY += 7;
      },
    );
  }

  section(
    sectionValue: ReportSection,
    index: number,
  ) {
    this.heading(
      sectionValue.title ||
        "Report Section",
      `Section ${index + 1}`,
    );

    if (
      sectionValue.body
    ) {
      this.paragraph(
        sectionValue.body,
      );
    }

    if (
      sectionValue
        .bullets.length
    ) {
      this.cursorY += 6;

      this.bullets(
        sectionValue.bullets,
      );
    }

    this.cursorY += 14;
  }

  disclosure(
    value: string,
    requestId?:
      | string
      | null,
  ) {
    this.heading(
      "Advisor Review Disclosure",
      "Compliance",
    );

    this.paragraph(
      value,
      COLORS.muted,
    );

    if (requestId) {
      this.cursorY += 10;

      this.addWrappedText(
        {
          value:
            `AI request reference: ${requestId}`,

          size: 7,

          color:
            COLORS.slate,

          font: "mono",

          maximumCharacters:
            78,
        },
      );
    }
  }

  private footer() {
    const total =
      this.pages.length;

    this.pages.forEach(
      (
        pageOperations,
        index,
      ) => {
        pageOperations.push(
          line(
            MARGIN,
            PAGE_HEIGHT -
              42,
            PAGE_WIDTH -
              MARGIN,
            PAGE_HEIGHT -
              42,
          ),
        );

        pageOperations.push(
          text({
            x: MARGIN,

            y:
              PAGE_HEIGHT -
              24,

            text:
              `Slice Advisor Intelligence - ${this.title.slice(
                0,
                58,
              )}`,

            size: 7,

            color:
              COLORS.muted,
          }),
        );

        pageOperations.push(
          text({
            x:
              PAGE_WIDTH -
              MARGIN -
              72,

            y:
              PAGE_HEIGHT -
              24,

            text:
              `Page ${
                index + 1
              } of ${total}`,

            size: 7,

            color:
              COLORS.muted,
          }),
        );
      },
    );
  }

  buffer() {
    this.footer();

    const regularFontObject =
      3 +
      this.pages.length *
        2;

    const boldFontObject =
      regularFontObject +
      1;

    const monoFontObject =
      regularFontObject +
      2;

    const objects: string[] =
      [];

    objects.push(
      "<< /Type /Catalog /Pages 2 0 R >>",
    );

    objects.push(
      `<< /Type /Pages /Kids ${this.pages
        .map(
          (
            _,
            index,
          ) =>
            `${3 + index * 2} 0 R`,
        )
        .join(
          " ",
        )} /Count ${this.pages.length} >>`,
    );

    this.pages.forEach(
      (
        pageOperations,
        index,
      ) => {
        const pageObject =
          3 + index * 2;

        const contentObject =
          pageObject + 1;

        const stream =
          pageOperations.join(
            "\n",
          );

        objects.push(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontObject} 0 R /F2 ${boldFontObject} 0 R /F3 ${monoFontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`,
        );

        objects.push(
          `<< /Length ${Buffer.byteLength(
            stream,
            "utf8",
          )} >>\nstream\n${stream}\nendstream`,
        );
      },
    );

    objects.push(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    );

    objects.push(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    );

    objects.push(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    );

    const header =
      "%PDF-1.4\n";

    const bodyParts: string[] =
      [];

    const offsets: number[] =
      [0];

    let offset =
      Buffer.byteLength(
        header,
        "utf8",
      );

    objects.forEach(
      (
        object,
        index,
      ) => {
        offsets.push(
          offset,
        );

        const part =
          `${index + 1} 0 obj\n${object}\nendobj\n`;

        bodyParts.push(
          part,
        );

        offset +=
          Buffer.byteLength(
            part,
            "utf8",
          );
      },
    );

    const xrefOffset =
      offset;

    const xref = [
      "xref",

      `0 ${objects.length + 1}`,

      "0000000000 65535 f ",

      ...offsets
        .slice(1)
        .map(
          (item) =>
            `${String(
              item,
            ).padStart(
              10,
              "0",
            )} 00000 n `,
        ),

      "trailer",

      `<< /Size ${objects.length + 1} /Root 1 0 R >>`,

      "startxref",

      String(
        xrefOffset,
      ),

      "%%EOF",
    ].join("\n");

    return Buffer.from(
      `${header}${bodyParts.join(
        "",
      )}${xref}`,
      "utf8",
    );
  }
}

function jsonError(
  message: string,
  detail:
    | string
    | null,
  status = 500,
) {
  return Response.json(
    {
      error: message,
      detail,
    },
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",

        Pragma:
          "no-cache",

        "X-Slice-AI-Report":
          "source-backed",
      },
    },
  );
}

export async function GET(
  request: Request,
) {
  const user =
    await getCurrentUser();

  if (!user) {
    return jsonError(
      "Unauthorized.",
      null,
      401,
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

    const debug =
      url.searchParams.get(
        "debug",
      ) === "1";

    if (!token) {
      return jsonError(
        "Report token is required.",
        null,
        400,
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
      return jsonError(
        "Report not found.",
        null,
        404,
      );
    }

    if (
      report.userId !==
      user.id
    ) {
      return jsonError(
        "You do not have access to this report.",
        null,
        403,
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

    const sources =
      mergeSources(
        normalizeSources(
          design.sources,
        ),

        sourcesFromSections(
          normalizedSections,
        ),
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

    const finalMetrics =
      metrics.length
        ? metrics
        : defaultMetrics({
            sourceCount:
              sources.length,

            researchUsed,
          });

    const finalSections =
      normalizedSections.length
        ? normalizedSections
        : defaultSections(
            cleanText(
              report.summary,
            ),
            sources,
          );

    const provider =
      cleanText(
        design.provider ||
          "Slice AI",
        180,
      );

    const model =
      cleanText(
        design.model ||
          "Not recorded",
        180,
      );

    const confidenceScore =
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
          : 78;

    const disclosure =
      cleanText(
        design.disclosure ||
          "AI-assisted report for advisor review. Verify sources, market data, client suitability, tax and legal considerations, liquidity, concentration, and firm compliance requirements before external use.",
      );

    if (debug) {
      return Response.json(
        {
          ok: true,

          reportId:
            report.id,

          title:
            report.title,

          reportType:
            report.reportType,

          sections:
            finalSections.length,

          metrics:
            finalMetrics.length,

          charts:
            charts.length,

          sources:
            sources.length,

          researchUsed,
          provider,
          model,
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    const title =
      cleanText(
        report.title ||
          "Slice AI Report",
        300,
      );

    const pdf =
      new SimplePdf(
        title,
      );

    pdf.cover({
      title,

      reportType:
        cleanText(
          report.reportType ||
            "Source-Backed Advisor Intelligence",
          180,
        ),

      summary:
        cleanText(
          report.summary ||
            "Slice AI advisor report.",
        ),

      preparedBy:
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

      asOf:
        new Date(
          report.createdAt,
        ).toLocaleString(),

      status:
        cleanText(
          design.investmentGrade ||
            design.grade ||
            report.status ||
            "Advisor Review Ready",
          180,
        ),

      confidenceScore,
      provider,
      model,

      sourceCount:
        sources.length,

      researchUsed,
    });

    pdf.heading(
      "Advisor Scorecard",
      "Overview",
    );

    pdf.metrics(
      finalMetrics,
    );

    if (charts.length) {
      pdf.heading(
        "Research Visuals",
        "Charts",
      );

      for (
        const chartValue of charts
      ) {
        pdf.chart(
          chartValue,
        );
      }
    }

    pdf.sourceList(
      sources,
    );

    finalSections.forEach(
      (
        section,
        index,
      ) => {
        pdf.section(
          section,
          index,
        );
      },
    );

    pdf.disclosure(
      disclosure,

      cleanText(
        design.requestId ||
          "",
        300,
      ) || null,
    );

    const buffer =
      pdf.buffer();

    if (
      !buffer
        .toString(
          "utf8",
          0,
          5,
        )
        .startsWith(
          "%PDF-",
        )
    ) {
      return jsonError(
        "PDF generation failed.",
        "Invalid PDF header.",
        500,
      );
    }

    return new Response(
      new Uint8Array(
        buffer,
      ),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `inline; filename="${cleanFileName(
              report.title,
            )}.pdf"`,

          "Cache-Control":
            "no-store, no-cache, must-revalidate",

          Pragma:
            "no-cache",

          "Content-Length":
            String(
              buffer.byteLength,
            ),

          "X-Slice-AI-Report":
            "source-backed",

          "X-Slice-Research-Used":
            String(
              researchUsed,
            ),

          "X-Slice-Source-Count":
            String(
              sources.length,
            ),

          "X-Slice-AI-Provider":
            provider,

          "X-Slice-AI-Model":
            model,

          "Access-Control-Expose-Headers":
            "X-Slice-AI-Report, X-Slice-Research-Used, X-Slice-Source-Count, X-Slice-AI-Provider, X-Slice-AI-Model",
        },
      },
    );
  } catch (error) {
    return jsonError(
      "PDF generation failed.",

      error instanceof Error
        ? error.message
        : "Unknown PDF error.",

      500,
    );
  }
}