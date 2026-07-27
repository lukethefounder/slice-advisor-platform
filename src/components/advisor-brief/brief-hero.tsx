"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BellRing,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  Gauge,
  Mail,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Target,
  Wifi,
  WifiOff,
} from "lucide-react";

import type {
  AdvisorBriefApiPayload,
  AdvisorBriefPreference,
  AdvisorMarketBrief,
} from "@/lib/advisor-briefing/types";
import {
  Badge,
  Metric,
  Progress,
  cx,
  dateTime,
  number,
  panelClass,
} from "@/components/advisor-brief/ui";

export default function BriefHero({
  payload,
  brief,
  preference,
  loading,
  busy,
  action,
  message,
  onGenerate,
  onSendLatest,
}: {
  payload: AdvisorBriefApiPayload | null;
  brief: AdvisorMarketBrief | null;
  preference: AdvisorBriefPreference;
  loading: boolean;
  busy: boolean;
  action: string | null;
  message: string;
  onGenerate: (sendEmail: boolean) => void | Promise<void>;
  onSendLatest: () => void | Promise<void>;
}) {
  const freshnessTone =
    brief?.realTimeConfirmed
      ? "green"
      : brief?.providerMode === "Delayed" ||
          brief?.providerMode === "Market Closed"
        ? "amber"
        : "red";

  return (
    <>
        <section
          className={cx(
            panelClass,
            "overflow-hidden",
          )}
        >
          <div className="grid gap-7 bg-[radial-gradient(circle_at_8%_0%,rgba(16,185,129,0.21),transparent_35%),radial-gradient(circle_at_92%_12%,rgba(168,85,247,0.12),transparent_30%)] p-6 sm:p-8 xl:grid-cols-[1.25fr_0.75fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="red">
                  <BookOpen className="h-3.5 w-3.5" />
                  Autonomous Advisor Brief
                </Badge>
                <Badge
                  tone={
                    freshnessTone
                  }
                >
                  {brief?.realTimeConfirmed ? (
                    <Wifi className="h-3.5 w-3.5" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5" />
                  )}
                  {brief?.providerMode ??
                    "Provider timing pending"}
                </Badge>
                <Badge tone="cyan">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Advisor-only email
                </Badge>
              </div>

              <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl xl:text-7xl">
                The industries and securities that deserve attention now.
              </h1>
              <p className="mt-5 max-w-4xl text-sm font-semibold leading-7 text-slate-400 sm:text-base">
                Slice autonomously ranks three industries, selects five monitor securities inside each industry, assigns a cross-industry overall rank, explains every selection, and preserves the market, technical, fundamental, news, and economic sources behind the result.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    void onGenerate(false)
                  }
                  disabled={busy}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-950 px-6 text-sm font-black text-white shadow-xl shadow-emerald-950/35 transition hover:brightness-110 disabled:opacity-50"
                >
                  {action ===
                  "generate" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                  Generate current brief
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void onGenerate(true)
                  }
                  disabled={busy}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.08] px-6 text-sm font-black text-emerald-100 transition hover:bg-emerald-500/15 disabled:opacity-50"
                >
                  {action ===
                  "generate-send" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Generate and email
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void onSendLatest()
                  }
                  disabled={
                    busy || !brief
                  }
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-sm font-black text-slate-200 transition hover:border-emerald-400/25 hover:text-white disabled:opacity-40"
                >
                  {action ===
                  "send" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Email latest
                </button>
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm font-semibold leading-6 text-slate-300">
                {loading ||
                busy ? (
                  <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-emerald-300" />
                ) : brief ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                ) : (
                  <Activity className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                )}
                {message}
              </div>
            </div>

            <div className="grid content-start gap-4">
              <Link
                href="/workspace"
                className="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/45 px-4 py-3 text-xs font-black text-slate-300 transition hover:border-emerald-400/25 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Workspace
              </Link>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/52 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-slate-600">
                  Current brief status
                </p>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-4xl font-black text-white">
                      {brief
                        ? `${number(
                            brief.dataQuality,
                            0,
                          )}/100`
                        : "Pending"}
                    </p>
                    <p className="mt-2 text-sm font-black text-white">
                      Data quality
                    </p>
                  </div>
                  <div className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
                    <Gauge className="h-7 w-7" />
                  </div>
                </div>
                <div className="mt-4">
                  <Progress
                    value={
                      brief?.dataQuality ??
                      0
                    }
                    tone={
                      (brief?.dataQuality ??
                        0) >=
                      preference.minimumDataQuality
                        ? "green"
                        : "amber"
                    }
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <p className="text-[9px] uppercase tracking-[0.12em] text-slate-700">
                      Market as of
                    </p>
                    <p className="mt-1 font-black text-white">
                      {dateTime(
                        brief?.marketAsOf,
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <p className="text-[9px] uppercase tracking-[0.12em] text-slate-700">
                      Quote coverage
                    </p>
                    <p className="mt-1 font-black text-white">
                      {number(
                        brief?.quoteCoveragePercent,
                        0,
                      )}
                      %
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/52 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.17em] text-slate-600">
                      Scheduled delivery
                    </p>
                    <p className="mt-2 text-lg font-black text-white">
                      {preference.enabled
                        ? "Enabled"
                        : "Paused"}
                    </p>
                  </div>
                  <BellRing
                    className={cx(
                      "h-6 w-6",
                      preference.enabled
                        ? "text-emerald-300"
                        : "text-slate-700",
                    )}
                  />
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                  Last emailed{" "}
                  {dateTime(
                    preference.lastSentAt,
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Metric
            label="Market status"
            value={
              brief?.marketStatus ??
              "Unknown"
            }
            helper={
              brief?.providerMode ??
              "Provider mode pending"
            }
            icon={
              <Clock3 className="h-5 w-5" />
            }
          />
          <Metric
            label="Top industries"
            value={`${brief?.topIndustries.length ?? 0}`}
            helper="Ranked from ten diversified industry groups."
            icon={
              <Building2 className="h-5 w-5" />
            }
          />
          <Metric
            label="Ranked securities"
            value={`${brief?.overallRankedSecurities.length ?? 0}`}
            helper="Five securities inside each selected industry."
            icon={
              <Target className="h-5 w-5" />
            }
          />
          <Metric
            label="Research sources"
            value={`${brief?.sources.length ?? 0}`}
            helper="Provider observations and cited news records."
            icon={
              <Database className="h-5 w-5" />
            }
          />
          <Metric
            label="Email status"
            value={
              payload?.delivery?.status ??
              "Not sent"
            }
            helper={
              payload?.delivery?.destination ??
              "Advisor destination pending"
            }
            icon={
              <Mail className="h-5 w-5" />
            }
          />
          <Metric
            label="Brief history"
            value={`${payload?.history.length ?? 0}`}
            helper="Recent stored advisor market briefings."
            icon={
              <FileText className="h-5 w-5" />
            }
          />
        </section>
    </>
  );
}