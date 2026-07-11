"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/slice-ui";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";

type ReportSection = {
  title?: string;
  body?: string;
  bullets?: string[];
};

type ReportMetric = {
  label?: string;
  value?: string | number;
  helper?: string;
  tone?: Tone;
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
    downloadToken: string;
    pdfUrl: string;
    viewerUrl: string;
    sections: ReportSection[];
    design: {
      generatedBy: string;
      preparedFor: string;
      investmentGrade: string;
      confidenceScore: number;
      metrics: ReportMetric[];
      charts: Array<{
        title?: string;
        subtitle?: string;
        data?: Array<{ label?: string; value?: number }>;
      }>;
    };
  };
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneClasses(tone: Tone = "slate") {
  const tones: Record<Tone, string> = {
    red: "border-red-500/30 bg-red-500/10 text-red-100",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-100",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-100",
    slate: "border-slate-500/20 bg-slate-500/10 text-slate-100",
  };

  return tones[tone];
}

function formatDate(value?: string) {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cx("inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]", toneClasses(tone))}>
      {children}
    </span>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-[2rem] border border-white/10 bg-zinc-950/82 shadow-2xl shadow-red-950/20 backdrop-blur-xl", className)}>
      {children}
    </div>
  );
}

function MetricCard({ metric }: { metric: ReportMetric }) {
  return (
    <div className={cx("rounded-[1.35rem] border p-4", toneClasses(metric.tone || "red"))}>
      <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">
        {metric.label || "Metric"}
      </div>
      <div className="mt-2 text-3xl font-black text-white print:text-slate-950">{metric.value ?? "—"}</div>
      {metric.helper ? <div className="mt-1 text-xs font-semibold opacity-70">{metric.helper}</div> : null}
    </div>
  );
}

export default function ReportViewerPage() {
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [error, setError] = useState("");

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") || "";
  }, []);

  useEffect(() => {
    async function loadReport() {
      if (!token) {
        setError("Report token is missing.");
        return;
      }

      try {
        const response = await fetch(`/api/personal-bot/report-view?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Report could not be loaded.");
          return;
        }

        setPayload(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Report could not be loaded.");
      }
    }

    void loadReport();
  }, [token]);

  const report = payload?.report;
  const metrics = report?.design.metrics?.length
    ? report.design.metrics
    : [
        { label: "Advisor Utility", value: 92, helper: "Workflow-ready", tone: "green" as Tone },
        { label: "Review Safety", value: 88, helper: "Advisor review required", tone: "amber" as Tone },
        { label: "Report Polish", value: 94, helper: "Premium Slice view", tone: "red" as Tone },
      ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(239,68,68,0.20),_transparent_28%),linear-gradient(135deg,_#020202,_#09090b,_#1f0707)] p-4 text-white print:bg-white print:p-0 print:text-slate-950">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-4 flex flex-col gap-3 print:hidden md:flex-row md:items-center md:justify-between">
          <BrandMark />
          <div className="flex flex-wrap gap-2">
            <Link href="/workspace/personal-bot" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white">
              ← AI Studio
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
            >
              Print / Save PDF
            </button>
            {report?.pdfUrl ? (
              <a
                href={report.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100"
              >
                Open Raw PDF
              </a>
            ) : null}
          </div>
        </div>

        {error ? (
          <Card className="p-8 text-center">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Report Error</div>
            <h1 className="mt-3 text-3xl font-black">Report could not be opened.</h1>
            <p className="mt-3 text-sm text-slate-400">{error}</p>
            <Link href="/workspace/personal-bot" className="mt-6 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
              Return to AI Studio
            </Link>
          </Card>
        ) : null}

        {!report && !error ? (
          <Card className="p-8 text-center">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Slice Report Viewer</div>
            <h1 className="mt-3 text-3xl font-black">Loading report...</h1>
          </Card>
        ) : null}

        {report ? (
          <article className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-zinc-950/88 shadow-2xl shadow-black/30 print:rounded-none print:border-0 print:bg-white print:shadow-none">
            <section className="relative overflow-hidden bg-gradient-to-br from-red-950 via-black to-red-800 p-8 print:bg-white print:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(239,68,68,0.28),transparent_34%)] print:hidden" />

              <div className="relative">
                <div className="print:hidden">
                  <BrandMark />
                </div>

                <div className="mt-10 flex flex-wrap gap-2">
                  <Pill tone="red">{report.reportType}</Pill>
                  <Pill tone="green">{report.status}</Pill>
                  <Pill tone="amber">Advisor review required</Pill>
                </div>

                <h1 className="mt-6 max-w-5xl text-5xl font-black tracking-tight text-white print:text-4xl print:text-slate-950">
                  {report.title}
                </h1>

                <p className="mt-5 max-w-4xl text-base leading-8 text-red-100 print:text-slate-600">
                  {report.summary}
                </p>

                <div className="mt-8 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.08] p-4 print:border-slate-200 print:bg-slate-50">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red-200 print:text-slate-500">Prepared by</div>
                    <div className="mt-2 text-xl font-black text-white print:text-slate-950">{report.design.generatedBy}</div>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.08] p-4 print:border-slate-200 print:bg-slate-50">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red-200 print:text-slate-500">Prepared for</div>
                    <div className="mt-2 text-xl font-black text-white print:text-slate-950">{report.design.preparedFor}</div>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.08] p-4 print:border-slate-200 print:bg-slate-50">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red-200 print:text-slate-500">As of</div>
                    <div className="mt-2 text-xl font-black text-white print:text-slate-950">{formatDate(report.createdAt)}</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="p-8 print:p-8">
              <div className="grid gap-4 md:grid-cols-3">
                {metrics.slice(0, 6).map((metric, index) => (
                  <MetricCard key={`${metric.label}-${index}`} metric={metric} />
                ))}
              </div>
            </section>

            <section className="grid gap-6 p-8 pt-0 print:p-8 print:pt-0">
              {report.sections.map((section, index) => (
                <div key={`${section.title}-${index}`} className="rounded-[1.7rem] border border-white/10 bg-white/[0.055] p-6 print:border-slate-200 print:bg-white">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-red-300 print:text-red-700">
                    Section {index + 1}
                  </div>
                  <h2 className="mt-2 text-3xl font-black text-white print:text-slate-950">
                    {section.title}
                  </h2>

                  {section.body ? (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300 print:text-slate-700">
                      {section.body}
                    </p>
                  ) : null}

                  {section.bullets?.length ? (
                    <ul className="mt-4 grid gap-3">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-slate-300 print:border-slate-200 print:bg-slate-50 print:text-slate-700">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </section>

            <section className="border-t border-white/10 bg-black/35 p-8 print:border-slate-200 print:bg-slate-50">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-300 print:text-red-700">
                Important Review Notes
              </div>
              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400 print:text-slate-700">
                This report is AI-assisted and intended for advisor review. Verify source freshness, client suitability,
                compliance requirements, tax considerations, liquidity needs, and risk tolerance before using externally.
              </p>
            </section>
          </article>
        ) : null}
      </div>
    </main>
  );
}