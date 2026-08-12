"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  GitCommitHorizontal,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  GreenSliceLogo,
  WorkspaceButton,
  WorkspacePill,
  WorkspaceSurface,
  cx,
} from "@/components/workspace/core/workspace-ui";

type CheckState = "ready" | "degraded" | "blocked";

type ProductionCheck = {
  id: string;
  label: string;
  state: CheckState;
  summary: string;
  durationMs: number;
  details: Record<string, unknown>;
  recommendations: string[];
};

type WebVital = {
  name: string;
  p75: number;
  sampleCount: number;
  rating: "good" | "needs-improvement" | "poor" | "insufficient-data";
  target: number;
  unit: string;
};

type ReadinessResponse = {
  ok: boolean;
  status: CheckState;
  readinessScore: number;
  generatedAt: string;
  durationMs: number;
  deployment: Record<string, unknown>;
  summary: {
    ready: number;
    degraded: number;
    blocked: number;
    total: number;
  };
  checks: ProductionCheck[];
  webVitals: WebVital[];
  recommendations: string[];
  acceptance: {
    productionTrafficRecommended: boolean;
    reason: string;
  };
  access: {
    firmName: string | null;
    role: string;
  };
};

type ErrorPayload = {
  error?: string | { message?: string };
};

function messageFromError(body: ErrorPayload, status: number) {
  if (typeof body.error === "string") return body.error;
  if (body.error?.message) return body.error.message;
  return `Readiness request failed with HTTP ${status}.`;
}

function stateTone(state: CheckState) {
  if (state === "ready") return "emerald" as const;
  if (state === "degraded") return "amber" as const;
  return "violet" as const;
}

function stateIcon(state: CheckState) {
  if (state === "ready") return CheckCircle2;
  if (state === "degraded") return AlertTriangle;
  return XCircle;
}

function detailEntries(details: Record<string, unknown>) {
  return Object.entries(details)
    .filter(([, value]) =>
      ["string", "number", "boolean"].includes(typeof value) || value === null,
    )
    .slice(0, 8);
}

function formatDetail(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default function SystemPage() {
  const [report, setReport] = useState<ReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/operations/production-readiness", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = (await response.json().catch(() => ({}))) as
        | ReadinessResponse
        | ErrorPayload;

      if (!response.ok) {
        throw new Error(messageFromError(body as ErrorPayload, response.status));
      }

      setReport(body as ReadinessResponse);
    } catch (caught) {
      setReport(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Production readiness could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const deploymentEntries = useMemo(
    () => detailEntries(report?.deployment ?? {}),
    [report?.deployment],
  );

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(5,150,105,0.20),transparent_30%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_26%),linear-gradient(135deg,#010604,#020806,#07130e)] p-4 text-white sm:p-6"
    >
      <div className="mx-auto max-w-[1500px] space-y-5">
        <WorkspaceSurface className="p-5 sm:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <GreenSliceLogo />
              <div className="mt-5 flex flex-wrap gap-2">
                <WorkspacePill tone="emerald">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Production operations
                </WorkspacePill>
                <WorkspacePill tone={report ? stateTone(report.status) : "slate"}>
                  {report?.status ?? "Checking"}
                </WorkspacePill>
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.045em] sm:text-6xl">
                Release readiness without destructive controls.
              </h1>
              <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-slate-400 sm:text-base">
                Inspect database migrations, worker health, provider circuits,
                secure documents, communications, security signals, and measured
                p75 Web Vitals before directing production traffic.
              </p>
            </div>

            <div className="grid min-w-[280px] gap-2 sm:grid-cols-2 xl:w-[430px]">
              <WorkspaceButton href="/workspace" variant="primary">
                Back to Workspace
              </WorkspaceButton>
              <WorkspaceButton href="/security" variant="secondary">
                Security Center
              </WorkspaceButton>
              <WorkspaceButton href="/backend-kernel" variant="secondary">
                Background Jobs
              </WorkspaceButton>
              <WorkspaceButton
                onClick={() => void load()}
                disabled={loading}
                variant="secondary"
              >
                <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </WorkspaceButton>
            </div>
          </div>
        </WorkspaceSurface>

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-5 text-sm font-semibold text-amber-100"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">Readiness unavailable</p>
                <p className="mt-1 leading-6">{error}</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="mt-3 rounded-xl border border-amber-200/20 bg-black/20 px-4 py-2 text-xs font-black"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {loading && !report ? (
          <section aria-label="Loading production readiness" className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="h-40 animate-pulse rounded-[1.75rem] border border-white/8 bg-white/[0.035]"
              />
            ))}
          </section>
        ) : null}

        {report ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                {
                  label: "Readiness",
                  value: `${report.readinessScore}/100`,
                  helper: report.acceptance.productionTrafficRecommended
                    ? "Release target met"
                    : "Release gate active",
                  icon: Gauge,
                  tone: report.acceptance.productionTrafficRecommended
                    ? "emerald"
                    : "amber",
                },
                {
                  label: "Ready checks",
                  value: `${report.summary.ready}/${report.summary.total}`,
                  helper: "Passing now",
                  icon: CheckCircle2,
                  tone: "emerald",
                },
                {
                  label: "Degraded",
                  value: report.summary.degraded,
                  helper: "Needs improvement",
                  icon: AlertTriangle,
                  tone: "amber",
                },
                {
                  label: "Blocked",
                  value: report.summary.blocked,
                  helper: "Must resolve",
                  icon: XCircle,
                  tone: report.summary.blocked ? "violet" : "slate",
                },
                {
                  label: "Check duration",
                  value: `${report.durationMs}ms`,
                  helper: new Date(report.generatedAt).toLocaleString(),
                  icon: Clock3,
                  tone: "cyan",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <WorkspaceSurface key={item.label} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
                          {item.label}
                        </p>
                        <p className="mt-2 text-3xl font-black">{item.value}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          {item.helper}
                        </p>
                      </div>
                      <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-emerald-200">
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                  </WorkspaceSurface>
                );
              })}
            </section>

            <WorkspaceSurface className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                    Release decision
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    {report.acceptance.productionTrafficRecommended
                      ? "Production traffic is recommended."
                      : "Keep the release gate closed."}
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
                    {report.acceptance.reason}
                  </p>
                </div>
                <WorkspacePill
                  tone={
                    report.acceptance.productionTrafficRecommended
                      ? "emerald"
                      : "amber"
                  }
                >
                  {report.access.firmName ?? "Slice"} · {report.access.role}
                </WorkspacePill>
              </div>
            </WorkspaceSurface>

            <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {report.checks.map((check) => {
                const Icon = stateIcon(check.state);
                const open = expandedId === check.id;
                return (
                  <WorkspaceSurface key={check.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <WorkspacePill tone={stateTone(check.state)}>
                          <Icon className="h-3.5 w-3.5" />
                          {check.state}
                        </WorkspacePill>
                        <h2 className="mt-3 text-xl font-black">{check.label}</h2>
                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
                          {check.summary}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-black text-slate-600">
                        {check.durationMs}ms
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : check.id)}
                      className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-left text-xs font-black text-slate-300 hover:border-emerald-300/20 hover:text-white"
                      aria-expanded={open}
                    >
                      {open ? "Hide details" : "Show details"}
                    </button>

                    {open ? (
                      <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
                        {detailEntries(check.details).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-start justify-between gap-4 text-xs"
                          >
                            <span className="font-bold text-slate-500">{key}</span>
                            <span className="max-w-[60%] break-words text-right font-black text-slate-200">
                              {formatDetail(value)}
                            </span>
                          </div>
                        ))}
                        {check.recommendations.map((recommendation) => (
                          <div
                            key={recommendation}
                            className="rounded-xl border border-amber-400/15 bg-amber-500/[0.06] p-3 text-xs font-semibold leading-5 text-amber-100"
                          >
                            {recommendation}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </WorkspaceSurface>
                );
              })}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
              <WorkspaceSurface className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                      Measured performance
                    </p>
                    <h2 className="mt-2 text-2xl font-black">p75 Web Vitals</h2>
                  </div>
                  <Activity className="h-6 w-6 text-cyan-200" />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {report.webVitals.length ? (
                    report.webVitals.map((metric) => (
                      <div
                        key={metric.name}
                        className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-black">{metric.name}</span>
                          <WorkspacePill
                            tone={
                              metric.rating === "good"
                                ? "emerald"
                                : metric.rating === "poor"
                                  ? "violet"
                                  : "amber"
                            }
                          >
                            {metric.rating}
                          </WorkspacePill>
                        </div>
                        <p className="mt-3 text-3xl font-black">
                          {metric.p75}
                          <span className="ml-1 text-xs text-slate-500">
                            {metric.unit}
                          </span>
                        </p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          Target {metric.target}{metric.unit} · {metric.sampleCount} samples
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-semibold text-slate-500">
                      Web Vitals are collecting. More production samples are needed.
                    </div>
                  )}
                </div>
              </WorkspaceSurface>

              <WorkspaceSurface className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                      Deployment identity
                    </p>
                    <h2 className="mt-2 text-2xl font-black">Current release</h2>
                  </div>
                  <GitCommitHorizontal className="h-6 w-6 text-emerald-200" />
                </div>
                <div className="mt-5 space-y-3">
                  {deploymentEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.03] p-3 text-xs"
                    >
                      <span className="font-bold text-slate-500">{key}</span>
                      <span className="max-w-[65%] break-words text-right font-black text-slate-200">
                        {formatDetail(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </WorkspaceSurface>
            </section>

            {report.recommendations.length ? (
              <WorkspaceSurface className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <ServerCog className="h-6 w-6 text-amber-200" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                      Release actions
                    </p>
                    <h2 className="mt-1 text-2xl font-black">
                      Resolve these items before acceptance
                    </h2>
                  </div>
                </div>
                <ol className="mt-5 grid gap-3 md:grid-cols-2">
                  {report.recommendations.map((item, index) => (
                    <li
                      key={item}
                      className="flex gap-3 rounded-2xl border border-amber-400/15 bg-amber-500/[0.055] p-4 text-sm font-semibold leading-6 text-amber-50"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-200 text-xs font-black text-slate-950">
                        {index + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </WorkspaceSurface>
            ) : null}

            <WorkspaceSurface className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Direct operational endpoints
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-400">
                    Lightweight public probes remain separate from the authenticated release report.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["Liveness", "/api/health/live", Database],
                    ["Readiness", "/api/health/ready", ShieldCheck],
                  ] satisfies Array<[string, string, LucideIcon]>).map(([label, href, Icon]) => (
                    <Link
                      key={String(label)}
                      href={String(href)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-black text-slate-300 hover:border-emerald-300/20 hover:text-white"
                    >
                      <Icon className="h-4 w-4" />
                      {String(label)}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  ))}
                </div>
              </div>
            </WorkspaceSurface>
          </>
        ) : null}
      </div>
    </main>
  );
}