"use client";

import Link from "next/link";
import type {
  ReactNode,
} from "react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { BrandMark } from "@/components/slice-ui";

type Tone =
  | "red"
  | "green"
  | "amber"
  | "purple"
  | "cyan"
  | "blue"
  | "slate";

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

type ReportPayload = {
  ok: boolean;

  report: {
    id: string;
    title: string;
    reportType: string;
    summary: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    downloadToken: string;
    pdfUrl: string;
    viewerUrl: string;
    sections: ReportSection[];

    design: {
      generatedBy: string;
      preparedFor: string;
      investmentGrade: string;
      confidenceScore: number;
      provider: string;
      model: string;
      requestId:
        | string
        | null;
      researchUsed: boolean;
      sourceCount: number;
      sources: ReportSource[];
      metrics: ReportMetric[];
      charts: ReportChart[];
      advisorReviewRequired: boolean;
      disclosure: string;
    };
  };
};

function cx(
  ...classes: Array<
    string | false | null | undefined
  >
) {
  return classes
    .filter(Boolean)
    .join(" ");
}

function toneFor(
  value:
    | string
    | number
    | null
    | undefined,
): Tone {
  const lower =
    String(
      value ?? "",
    ).toLowerCase();

  const numeric =
    typeof value ===
    "number"
      ? value
      : Number.NaN;

  if (
    lower.includes(
      "failed",
    ) ||
    lower.includes(
      "missing",
    ) ||
    lower.includes(
      "critical",
    ) ||
    lower.includes(
      "invalid",
    ) ||
    (!Number.isNaN(
      numeric,
    ) &&
      numeric < 45)
  ) {
    return "red";
  }

  if (
    lower.includes(
      "ready",
    ) ||
    lower.includes(
      "complete",
    ) ||
    lower.includes(
      "active",
    ) ||
    lower.includes(
      "live",
    ) ||
    (!Number.isNaN(
      numeric,
    ) &&
      numeric >= 75)
  ) {
    return "green";
  }

  if (
    lower.includes(
      "review",
    ) ||
    lower.includes(
      "required",
    ) ||
    lower.includes(
      "pending",
    ) ||
    (!Number.isNaN(
      numeric,
    ) &&
      numeric >= 45 &&
      numeric < 75)
  ) {
    return "amber";
  }

  if (
    lower.includes(
      "research",
    ) ||
    lower.includes(
      "source",
    )
  ) {
    return "cyan";
  }

  if (
    lower.includes("ai") ||
    lower.includes(
      "model",
    )
  ) {
    return "purple";
  }

  return "slate";
}

function toneClasses(
  tone: Tone = "slate",
) {
  const tones: Record<
    Tone,
    string
  > = {
    red:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",

    green:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",

    amber:
      "border-amber-500/30 bg-amber-500/10 text-amber-100",

    purple:
      "border-purple-500/30 bg-purple-500/10 text-purple-100",

    cyan:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",

    blue:
      "border-blue-500/30 bg-blue-500/10 text-blue-100",

    slate:
      "border-slate-500/20 bg-slate-500/10 text-slate-100",
  };

  return tones[tone];
}

function formatDate(
  value?: string,
) {
  if (!value) {
    return "Not recorded";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Not recorded";
  }

  return date.toLocaleString(
    undefined,
    {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
}

function domainForUrl(
  value: string,
) {
  try {
    return new URL(
      value,
    ).hostname.replace(
      /^www\./,
      "",
    );
  } catch {
    return value;
  }
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
        toneClasses(
          tone,
        ),
      )}
    >
      {children}
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[2rem] border border-white/10 bg-zinc-950/82 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function MetricCard({
  metric,
}: {
  metric: ReportMetric;
}) {
  const tone =
    toneFor(
      metric.tone ||
        metric.value,
    );

  return (
    <div
      className={cx(
        "rounded-[1.35rem] border p-4",
        toneClasses(
          tone,
        ),
      )}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">
        {metric.label ||
          "Metric"}
      </div>

      <div className="mt-2 text-3xl font-black text-white print:text-slate-950">
        {metric.value ??
          "—"}
      </div>

      {metric.helper ? (
        <div className="mt-1 text-xs font-semibold opacity-70">
          {metric.helper}
        </div>
      ) : null}
    </div>
  );
}

function ChartCard({
  chart,
}: {
  chart: ReportChart;
}) {
  const maximum =
    Math.max(
      1,
      ...chart.data.map(
        (item) =>
          item.value,
      ),
    );

  return (
    <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.055] p-6 print:border-slate-200 print:bg-white">
      <h3 className="text-xl font-black text-white print:text-slate-950">
        {chart.title}
      </h3>

      {chart.subtitle ? (
        <p className="mt-2 text-sm text-slate-400 print:text-slate-600">
          {chart.subtitle}
        </p>
      ) : null}

      <div className="mt-6 grid min-h-[220px] grid-flow-col items-end gap-3 overflow-x-auto rounded-2xl border border-white/10 bg-black/25 p-5 print:border-slate-200 print:bg-slate-50">
        {chart.data.map(
          (
            item,
            index,
          ) => {
            const percentage =
              Math.max(
                4,
                Math.min(
                  100,
                  (item.value /
                    maximum) *
                    100,
                ),
              );

            return (
              <div
                key={`${item.label}-${index}`}
                className="grid min-w-[72px] content-end gap-2 text-center"
              >
                <div className="text-xs font-black text-white print:text-slate-950">
                  {item.value}
                </div>

                <div className="flex h-36 items-end overflow-hidden rounded-xl border border-white/10 bg-white/5 print:border-slate-200">
                  <div
                    className="w-full rounded-t-xl bg-gradient-to-t from-emerald-800 via-emerald-500 to-cyan-300 print:bg-emerald-600"
                    style={{
                      height:
                        `${percentage}%`,
                    }}
                  />
                </div>

                <div className="truncate text-[10px] font-bold text-slate-400 print:text-slate-600">
                  {item.label}
                </div>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}

function SourceCard({
  source,
  index,
}: {
  source: ReportSource;
  index: number;
}) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="rounded-[1.25rem] border border-cyan-500/20 bg-cyan-500/5 p-4 transition hover:border-cyan-400/50 hover:bg-cyan-500/10 print:border-slate-200 print:bg-white"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-black text-white print:text-slate-950">
            {source.title ||
              `Research source ${
                index + 1
              }`}
          </div>

          <div className="mt-2 truncate text-xs text-cyan-300 print:text-slate-600">
            {domainForUrl(
              source.url,
            )}
          </div>
        </div>

        <Pill tone="cyan">
          {source.type}
        </Pill>
      </div>
    </a>
  );
}

export default function ReportViewerPage() {
  const [
    payload,
    setPayload,
  ] =
    useState<
      ReportPayload | null
    >(null);

  const [
    error,
    setError,
  ] = useState("");

  const token =
    useMemo(() => {
      if (
        typeof window ===
        "undefined"
      ) {
        return "";
      }

      return (
        new URLSearchParams(
          window.location.search,
        ).get("token") ||
        ""
      );
    }, []);

  useEffect(() => {
    async function loadReport() {
      if (!token) {
        setError(
          "Report token is missing.",
        );

        return;
      }

      try {
        const response =
          await fetch(
            `/api/personal-bot/report-view?token=${encodeURIComponent(
              token,
            )}`,
            {
              cache:
                "no-store",
            },
          );

        const data =
          (await response.json()) as
            ReportPayload & {
              error?: string;
              detail?: string;
            };

        if (!response.ok) {
          setError(
            data.detail ||
              data.error ||
              "Report could not be loaded.",
          );

          return;
        }

        setPayload(data);
      } catch (caught) {
        setError(
          caught instanceof
            Error
            ? caught.message
            : "Report could not be loaded.",
        );
      }
    }

    void loadReport();
  }, [token]);

  const report =
    payload?.report;

  const metrics =
    report?.design
      .metrics ?? [];

  const sources =
    report?.design
      .sources ?? [];

  const charts =
    report?.design
      .charts ?? [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.14),_transparent_28%),linear-gradient(135deg,_#020202,_#09090b,_#1f0707)] p-4 text-white print:bg-white print:p-0 print:text-slate-950">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-4 flex flex-col gap-3 print:hidden md:flex-row md:items-center md:justify-between">
          <BrandMark />

          <div className="flex flex-wrap gap-2">
            <Link
              href="/workspace/personal-bot"
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white"
            >
              ← AI Studio
            </Link>

            <button
              type="button"
              onClick={() =>
                window.print()
              }
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
            >
              Print / Save PDF
            </button>

            {report?.pdfUrl ? (
              <a
                href={
                  report.pdfUrl
                }
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100"
              >
                Open Raw PDF
              </a>
            ) : null}
          </div>
        </div>

        {error ? (
          <Card className="p-8 text-center">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
              Report Error
            </div>

            <h1 className="mt-3 text-3xl font-black">
              Report could not be opened.
            </h1>

            <p className="mt-3 text-sm text-slate-400">
              {error}
            </p>

            <Link
              href="/workspace/personal-bot"
              className="mt-6 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
            >
              Return to AI Studio
            </Link>
          </Card>
        ) : null}

        {!report &&
        !error ? (
          <Card className="p-8 text-center">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
              Slice Report Viewer
            </div>

            <h1 className="mt-3 text-3xl font-black">
              Loading report...
            </h1>
          </Card>
        ) : null}

        {report ? (
          <article className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-zinc-950/88 shadow-2xl shadow-black/30 print:rounded-none print:border-0 print:bg-white print:shadow-none">
            <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-black to-emerald-800 p-8 print:bg-white print:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(6,182,212,0.18),transparent_34%)] print:hidden" />

              <div className="relative">
                <div className="print:hidden">
                  <BrandMark />
                </div>

                <div className="mt-10 flex flex-wrap gap-2">
                  <Pill tone="red">
                    {
                      report.reportType
                    }
                  </Pill>

                  <Pill
                    tone={toneFor(
                      report.status,
                    )}
                  >
                    {
                      report.status
                    }
                  </Pill>

                  <Pill
                    tone={
                      report.design
                        .researchUsed
                        ? "green"
                        : "amber"
                    }
                  >
                    {report.design
                      .researchUsed
                      ? "Research used"
                      : "Internal / unsourced"}
                  </Pill>

                  <Pill tone="cyan">
                    {
                      report.design
                        .sourceCount
                    }{" "}
                    sources
                  </Pill>

                  <Pill tone="amber">
                    Advisor review required
                  </Pill>
                </div>

                <h1 className="mt-6 max-w-5xl text-5xl font-black tracking-tight text-white print:text-4xl print:text-slate-950">
                  {report.title}
                </h1>

                <p className="mt-5 max-w-4xl text-base leading-8 text-emerald-100 print:text-slate-600">
                  {report.summary}
                </p>

                <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.08] p-4 print:border-slate-200 print:bg-slate-50">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200 print:text-slate-500">
                      Prepared by
                    </div>

                    <div className="mt-2 text-lg font-black text-white print:text-slate-950">
                      {
                        report.design
                          .generatedBy
                      }
                    </div>
                  </div>

                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.08] p-4 print:border-slate-200 print:bg-slate-50">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200 print:text-slate-500">
                      Prepared for
                    </div>

                    <div className="mt-2 text-lg font-black text-white print:text-slate-950">
                      {
                        report.design
                          .preparedFor
                      }
                    </div>
                  </div>

                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.08] p-4 print:border-slate-200 print:bg-slate-50">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200 print:text-slate-500">
                      AI runtime
                    </div>

                    <div className="mt-2 text-lg font-black text-white print:text-slate-950">
                      {report.design
                        .model ||
                        "Not recorded"}
                    </div>

                    <div className="mt-1 text-xs text-emerald-100/70 print:text-slate-600">
                      {
                        report.design
                          .provider
                      }
                    </div>
                  </div>

                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.08] p-4 print:border-slate-200 print:bg-slate-50">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200 print:text-slate-500">
                      As of
                    </div>

                    <div className="mt-2 text-base font-black text-white print:text-slate-950">
                      {formatDate(
                        report.createdAt,
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="p-8 print:p-8">
              <div className="grid gap-4 md:grid-cols-3">
                {metrics
                  .slice(0, 9)
                  .map(
                    (
                      metric,
                      index,
                    ) => (
                      <MetricCard
                        key={`${metric.label}-${index}`}
                        metric={
                          metric
                        }
                      />
                    ),
                  )}
              </div>
            </section>

            {sources.length ? (
              <section className="p-8 pt-0 print:p-8 print:pt-0">
                <div className="rounded-[1.7rem] border border-cyan-500/20 bg-cyan-500/5 p-6 print:border-slate-200 print:bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300 print:text-cyan-700">
                        Research Provenance
                      </div>

                      <h2 className="mt-2 text-3xl font-black text-white print:text-slate-950">
                        Visible supporting sources
                      </h2>
                    </div>

                    <Pill tone="cyan">
                      {
                        sources.length
                      }{" "}
                      unique sources
                    </Pill>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {sources.map(
                      (
                        source,
                        index,
                      ) => (
                        <SourceCard
                          key={`${source.url}-${index}`}
                          source={
                            source
                          }
                          index={
                            index
                          }
                        />
                      ),
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <section className="p-8 pt-0 print:p-8 print:pt-0">
                <div className="rounded-[1.7rem] border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100 print:border-slate-200 print:bg-white print:text-slate-700">
                  No external sources were stored with this report. Verify all current factual claims independently before external use.
                </div>
              </section>
            )}

            {charts.length ? (
              <section className="grid gap-6 p-8 pt-0 print:p-8 print:pt-0">
                {charts.map(
                  (
                    chart,
                    index,
                  ) => (
                    <ChartCard
                      key={`${chart.title}-${index}`}
                      chart={
                        chart
                      }
                    />
                  ),
                )}
              </section>
            ) : null}

            <section className="grid gap-6 p-8 pt-0 print:p-8 print:pt-0">
              {report.sections.map(
                (
                  section,
                  index,
                ) => (
                  <div
                    key={`${section.title}-${index}`}
                    className="rounded-[1.7rem] border border-white/10 bg-white/[0.055] p-6 print:border-slate-200 print:bg-white"
                  >
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300 print:text-emerald-700">
                      Section{" "}
                      {index + 1}
                    </div>

                    <h2 className="mt-2 text-3xl font-black text-white print:text-slate-950">
                      {
                        section.title
                      }
                    </h2>

                    {section.body ? (
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300 print:text-slate-700">
                        {
                          section.body
                        }
                      </p>
                    ) : null}

                    {section.bullets
                      .length ? (
                      <ul className="mt-4 grid gap-3">
                        {section.bullets.map(
                          (
                            bullet,
                            bulletIndex,
                          ) => (
                            <li
                              key={`${bullet}-${bulletIndex}`}
                              className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-slate-300 print:border-slate-200 print:bg-slate-50 print:text-slate-700"
                            >
                              {
                                bullet
                              }
                            </li>
                          ),
                        )}
                      </ul>
                    ) : null}
                  </div>
                ),
              )}
            </section>

            <section className="border-t border-white/10 bg-black/35 p-8 print:border-slate-200 print:bg-slate-50">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300 print:text-emerald-700">
                Advisor Review Disclosure
              </div>

              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400 print:text-slate-700">
                {
                  report.design
                    .disclosure
                }
              </p>

              {report.design
                .requestId ? (
                <div className="mt-4 text-[10px] text-slate-500 print:text-slate-500">
                  AI request reference:{" "}
                  {
                    report.design
                      .requestId
                  }
                </div>
              ) : null}
            </section>
          </article>
        ) : null}
      </div>
    </main>
  );
}