"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Loader2,
  Printer,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  WorkspaceAlert,
  WorkspaceButton,
  WorkspaceEmptyState,
  WorkspacePill,
  WorkspaceSurface,
  cx,
} from "@/components/workspace/core/workspace-ui";

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
  data: Array<{ label: string; value: number }>;
};

type ReportSource = {
  type: "web" | "file" | "unknown";
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
      requestId: string | null;
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

function dateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Not recorded"
    : parsed.toLocaleString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function domain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function metricTone(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("risk") || normalized.includes("warning")) return "amber" as const;
  if (normalized.includes("source") || normalized.includes("research")) return "cyan" as const;
  if (normalized.includes("model") || normalized.includes("ai")) return "violet" as const;
  return "emerald" as const;
}

function ChartCard({ chart }: { chart: ReportChart }) {
  const maximum = Math.max(1, ...chart.data.map((item) => Math.abs(item.value)));
  return (
    <article className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 print:border-slate-200 print:bg-white">
      <h3 className="text-lg font-black text-white print:text-slate-950">{chart.title}</h3>
      {chart.subtitle ? <p className="mt-1 text-xs font-semibold text-slate-500 print:text-slate-600">{chart.subtitle}</p> : null}
      <div className="mt-5 flex min-h-52 items-end gap-3 overflow-x-auto rounded-xl border border-white/8 bg-black/25 p-4 print:border-slate-200 print:bg-slate-50">
        {chart.data.map((item, index) => {
          const height = Math.max(6, (Math.abs(item.value) / maximum) * 100);
          return (
            <div key={`${item.label}-${index}`} className="grid min-w-16 flex-1 content-end gap-2 text-center">
              <span className="text-xs font-black text-white print:text-slate-950">{item.value}</span>
              <div className="flex h-36 items-end overflow-hidden rounded-lg border border-white/8 bg-white/[0.03] print:border-slate-200">
                <div className="w-full rounded-t-lg bg-gradient-to-t from-emerald-800 via-emerald-500 to-cyan-300 print:bg-emerald-600" style={{ height: `${height}%` }} />
              </div>
              <span className="truncate text-[9px] font-bold text-slate-500 print:text-slate-600">{item.label}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default function PersonalBotReportViewer() {
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"client" | "research">("client");

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") || "";
  }, []);

  useEffect(() => {
    if (!token) {
      setError("Report token is missing.");
      return;
    }

    void (async () => {
      try {
        const response = await fetch(
          `/api/personal-bot/report-view?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const data = (await response.json().catch(() => ({}))) as ReportPayload & {
          error?: string;
          detail?: string;
        };
        if (!response.ok) throw new Error(data.detail || data.error || "Report could not be loaded.");
        setPayload(data);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Report could not be loaded.");
      }
    })();
  }, [token]);

  const report = payload?.report;
  const sections = report?.sections ?? [];
  const sources = report?.design.sources ?? [];
  const metrics = report?.design.metrics ?? [];
  const charts = report?.design.charts ?? [];
  const clientSections = sections.filter((section) =>
    !/original request|research sources|advisor review checklist/i.test(section.title),
  );

  return (
    <main className="min-h-dvh bg-[linear-gradient(145deg,#010604,#06120d_58%,#020806)] p-3 text-white print:bg-white print:p-0 print:text-slate-950 sm:p-6">
      <div className="mx-auto max-w-[1320px] space-y-4">
        <header className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/55 p-4 shadow-2xl backdrop-blur-xl print:hidden sm:flex-row sm:items-center sm:justify-between">
          <Link href="/workspace/personal-bot" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> AI Studio
          </Link>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-xl border border-white/8 bg-black/25 p-1">
              <button type="button" onClick={() => setView("client")} className={cx("rounded-lg px-3 py-2 text-xs font-black", view === "client" ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-white")}>Client Preview</button>
              <button type="button" onClick={() => setView("research")} className={cx("rounded-lg px-3 py-2 text-xs font-black", view === "research" ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-white")}>Research Detail</button>
            </div>
            <WorkspaceButton variant="secondary" tone="slate" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print / Save</WorkspaceButton>
            {report?.pdfUrl ? <WorkspaceButton href={report.pdfUrl} variant="primary" icon={<Download className="h-4 w-4" />}>Open PDF</WorkspaceButton> : null}
          </div>
        </header>

        {error ? (
          <WorkspaceSurface className="p-6">
            <WorkspaceAlert tone="error" title="Report could not be opened">{error}</WorkspaceAlert>
          </WorkspaceSurface>
        ) : null}

        {!report && !error ? (
          <WorkspaceSurface className="grid min-h-80 place-items-center p-8 text-center">
            <div><Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-300" /><h1 className="mt-4 text-2xl font-black">Loading client-ready report…</h1></div>
          </WorkspaceSurface>
        ) : null}

        {report ? (
          <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#030a07] shadow-[0_38px_120px_rgba(0,0,0,0.54)] print:rounded-none print:border-0 print:bg-white print:shadow-none">
            <section className="relative overflow-hidden border-b border-white/8 p-6 sm:p-10 print:border-slate-200 print:bg-white">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.25),transparent_35%),radial-gradient(circle_at_90%_10%,rgba(34,211,238,0.11),transparent_28%)] print:hidden" />
              <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <WorkspacePill tone="emerald"><Sparkles className="h-3 w-3" /> Slice AI Report</WorkspacePill>
                    <WorkspacePill tone="cyan"><ShieldCheck className="h-3 w-3" /> Advisor review required</WorkspacePill>
                    <WorkspacePill tone="slate">{report.reportType}</WorkspacePill>
                  </div>
                  <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-[-0.045em] text-white print:text-slate-950 sm:text-6xl">{report.title}</h1>
                  <p className="mt-5 max-w-4xl text-base font-semibold leading-8 text-slate-300 print:text-slate-700">{report.summary}</p>
                  <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-500 print:text-slate-600"><span>Prepared for {report.design.preparedFor}</span><span>{dateTime(report.createdAt)}</span><span>{report.design.provider} · {report.design.model}</span></div>
                </div>
                <div className="rounded-[1.6rem] border border-white/10 bg-black/45 p-5 print:border-slate-200 print:bg-slate-50">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Evidence confidence</p>
                  <p className="mt-3 text-5xl font-black text-white print:text-slate-950">{Math.round(report.design.confidenceScore)}<span className="text-lg text-slate-500">/100</span></p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07] print:bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-cyan-300" style={{ width: `${Math.max(2, Math.min(100, report.design.confidenceScore))}%` }} /></div>
                  <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 print:border-slate-200"><p className="text-[8px] uppercase text-slate-500">Sources</p><p className="mt-1 text-lg font-black text-white print:text-slate-950">{report.design.sourceCount}</p></div><div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 print:border-slate-200"><p className="text-[8px] uppercase text-slate-500">Research</p><p className="mt-1 text-sm font-black text-white print:text-slate-950">{report.design.researchUsed ? "Included" : "Internal"}</p></div></div>
                </div>
              </div>
            </section>

            {metrics.length ? <section className="grid gap-3 border-b border-white/8 p-5 print:border-slate-200 sm:grid-cols-2 lg:grid-cols-4 sm:p-8">{metrics.map((metric, index) => <div key={`${metric.label}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 print:border-slate-200 print:bg-white"><div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{metric.label}</p><WorkspacePill tone={metricTone(metric.tone)}>{metric.tone || "Metric"}</WorkspacePill></div><p className="mt-3 text-3xl font-black text-white print:text-slate-950">{metric.value}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-500 print:text-slate-600">{metric.helper}</p></div>)}</section> : null}

            <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                {(view === "client" ? clientSections : sections).map((section, index) => <section key={`${section.title}-${index}`} className="rounded-[1.6rem] border border-white/8 bg-white/[0.025] p-5 print:border-slate-200 print:bg-white sm:p-7"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200 print:border-emerald-200 print:bg-emerald-50 print:text-emerald-700"><FileText className="h-4 w-4" /></div><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Section {String(index + 1).padStart(2, "0")}</p><h2 className="mt-1 text-2xl font-black text-white print:text-slate-950">{section.title}</h2></div></div>{section.body ? <div className="mt-5 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-300 print:text-slate-700">{section.body}</div> : null}{section.bullets?.length ? <ul className="mt-5 space-y-2">{section.bullets.map((bullet, bulletIndex) => <li key={bulletIndex} className="flex gap-3 text-sm font-semibold leading-6 text-slate-300 print:text-slate-700"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300 print:text-emerald-600" />{bullet}</li>)}</ul> : null}</section>)}
                {charts.map((chart, index) => <ChartCard key={`${chart.title}-${index}`} chart={chart} />)}
              </div>

              <aside className="space-y-4 print:hidden">
                <WorkspaceSurface className="p-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-500/[0.07] text-cyan-200"><Gauge className="h-4 w-4" /></div><div><p className="text-sm font-black text-white">Report integrity</p><p className="text-[10px] text-slate-500">Backing information retained</p></div></div><div className="mt-4 space-y-3 text-xs font-semibold text-slate-400"><div className="flex justify-between gap-3"><span>Generated by</span><span className="text-right font-black text-white">{report.design.generatedBy}</span></div><div className="flex justify-between gap-3"><span>Investment grade</span><span className="text-right font-black text-white">{report.design.investmentGrade}</span></div><div className="flex justify-between gap-3"><span>Request ID</span><span className="max-w-36 truncate text-right font-black text-white">{report.design.requestId || "Not provided"}</span></div><div className="flex justify-between gap-3"><span>Updated</span><span className="text-right font-black text-white">{dateTime(report.updatedAt)}</span></div></div></WorkspaceSurface>
                <WorkspaceSurface className="p-5"><div className="flex items-center justify-between"><p className="text-sm font-black text-white">Research sources</p><WorkspacePill tone="cyan">{sources.length}</WorkspacePill></div>{sources.length ? <div className="mt-4 space-y-2">{sources.map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-cyan-400/14 bg-cyan-500/[0.045] p-3 transition hover:border-cyan-300/30"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-xs font-black text-white">{source.title || `Source ${index + 1}`}</p><ExternalLink className="h-3.5 w-3.5 shrink-0 text-cyan-300" /></div><p className="mt-1 truncate text-[9px] font-semibold text-cyan-300/70">{domain(source.url)}</p></a>)}</div> : <WorkspaceEmptyState compact title="No public sources returned" description="Treat time-sensitive claims as unverified until sources are added." />}</WorkspaceSurface>
                <WorkspaceAlert tone="warning" title="Advisor review required">{report.design.disclosure || "Verify facts, suitability, dates, assumptions, and sources before sharing externally."}</WorkspaceAlert>
              </aside>
            </div>
          </article>
        ) : null}
      </div>
    </main>
  );
}