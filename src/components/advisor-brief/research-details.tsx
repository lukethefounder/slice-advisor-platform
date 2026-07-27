"use client";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  Newspaper,
  Settings2,
  ShieldCheck,
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

export default function BriefResearchDetails({
  payload,
  brief,
  preference,
}: {
  payload: AdvisorBriefApiPayload | null;
  brief: AdvisorMarketBrief | null;
  preference: AdvisorBriefPreference;
}) {
  return (
    <>
        <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section
            className={cx(
              panelClass,
              "p-5 sm:p-6",
            )}
          >
            <Badge tone="purple">
              <Globe2 className="h-3.5 w-3.5" />
              Economic context
            </Badge>
            <h2 className="mt-3 text-2xl font-black text-white">
              Latest published macro releases
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              Economic observations retain their actual release dates and are not mislabeled as tick-by-tick market data.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(brief?.economicEvidence ??
                []).map(
                (evidence) => (
                  <article
                    key={
                      evidence.id
                    }
                    className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                  >
                    <p className="text-sm font-black text-white">
                      {
                        evidence.label
                      }
                    </p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.13em] text-slate-700">
                      {
                        evidence.interval
                      }{" "}
                      ·{" "}
                      {evidence.asOf ??
                        "unknown date"}
                    </p>
                    <p className="mt-4 text-2xl font-black text-white">
                      {evidence.latestValue ===
                      null
                        ? "—"
                        : `${number(
                            evidence.latestValue,
                            2,
                          )} ${
                            evidence.unit
                          }`}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>
                        Score{" "}
                        {number(
                          evidence.score,
                          0,
                        )}
                      </span>
                      <span>
                        {number(
                          evidence.confidence,
                          0,
                        )}
                        % confidence
                      </span>
                    </div>
                    <div className="mt-2">
                      <Progress
                        value={
                          evidence.score
                        }
                        tone="purple"
                      />
                    </div>
                  </article>
                ),
              )}
            </div>
          </section>

          <section
            className={cx(
              panelClass,
              "p-5 sm:p-6",
            )}
          >
            <Badge tone="green">
              <ShieldCheck className="h-3.5 w-3.5" />
              Reliability controls
            </Badge>
            <h2 className="mt-3 text-2xl font-black text-white">
              Delivery and research safeguards
            </h2>

            <div className="mt-5 space-y-3">
              {[
                [
                  "Provider truth",
                  "Realtime is displayed only when entitlement, timestamp age, market status, and quote coverage support that label.",
                ],
                [
                  "Data-quality gate",
                  `Scheduled email is withheld below ${preference.minimumDataQuality}/100.`,
                ],
                [
                  "Advisor-only destination",
                  "The cron route sends the briefing only to the saved advisor email; it does not contact clients.",
                ],
                [
                  "Duplicate protection",
                  "Database schedule locks and Resend idempotency keys prevent duplicate sends during retries.",
                ],
                [
                  "Human judgment",
                  "Rankings identify monitoring priorities and never execute trades.",
                ],
              ].map(
                ([title, copy]) => (
                  <div
                    key={
                      title
                    }
                    className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                  >
                    <p className="text-xs font-black text-white">
                      {title}
                    </p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                      {copy}
                    </p>
                  </div>
                ),
              )}
            </div>
          </section>
        </section>

        <section
          className={cx(
            panelClass,
            "mt-5 p-5 sm:p-6",
          )}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge tone="cyan">
                <Newspaper className="h-3.5 w-3.5" />
                Source ledger
              </Badge>
              <h2 className="mt-3 text-2xl font-black text-white">
                Evidence behind the ranking
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Every security and industry keeps source IDs that resolve into this provider and publisher ledger.
              </p>
            </div>
            <Badge tone="slate">
              {brief?.sources.length ??
                0}{" "}
              records
            </Badge>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(brief?.sources ??
              []).map(
              (source) => (
                <article
                  key={
                    source.id
                  }
                  className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">
                        {
                          source.label
                        }
                      </p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.13em] text-cyan-300">
                        {
                          source.kind
                        }{" "}
                        ·{" "}
                        {
                          source.publisher
                        }
                      </p>
                    </div>
                    <Database className="h-4 w-4 shrink-0 text-slate-700" />
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                    Used for{" "}
                    {source.usedFor.join(
                      ", ",
                    )}
                    .
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-bold text-slate-600">
                    <span>
                      {dateTime(
                        source.asOf,
                      )}
                    </span>
                    {source.url ? (
                      <a
                        href={
                          source.url
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-black text-emerald-300 hover:text-emerald-200"
                      >
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </article>
              ),
            )}
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <section
            className={cx(
              panelClass,
              "p-5 sm:p-6",
            )}
          >
            <Badge tone="amber">
              <Settings2 className="h-3.5 w-3.5" />
              Methodology
            </Badge>
            <h2 className="mt-3 text-2xl font-black text-white">
              Transparent ranking model
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
              {brief?.methodology.description ??
                "The methodology appears after the first briefing is generated."}
            </p>
            {brief ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Metric
                  label="Industry universe"
                  value={`${brief.methodology.industryUniverseSize}`}
                  helper="Diversified industry groups evaluated."
                  icon={
                    <Building2 className="h-4 w-4" />
                  }
                />
                <Metric
                  label="Security universe"
                  value={`${brief.methodology.selectionUniverseSize}`}
                  helper="Stocks and ETFs included in the first-pass quote scan."
                  icon={
                    <BarChart3 className="h-4 w-4" />
                  }
                />
              </div>
            ) : null}
          </section>

          <section
            className={cx(
              panelClass,
              "p-5 sm:p-6",
            )}
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <Badge tone="slate">
                  <FileText className="h-3.5 w-3.5" />
                  Brief history
                </Badge>
                <h2 className="mt-3 text-2xl font-black text-white">
                  Recent stored briefings
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {(payload?.history ??
                []).map(
                (record) => (
                  <div
                    key={
                      record.id
                    }
                    className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-black text-white">
                        {
                          record.title
                        }
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {dateTime(
                          record.createdAt,
                        )}{" "}
                        ·{" "}
                        {
                          record.status
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        tone={
                          record.brief
                            .dataQuality >=
                          preference.minimumDataQuality
                            ? "green"
                            : "amber"
                        }
                      >
                        Quality{" "}
                        {number(
                          record.brief
                            .dataQuality,
                          0,
                        )}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-slate-700" />
                    </div>
                  </div>
                ),
              )}
              {!payload?.history.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs font-semibold text-slate-500">
                  No briefing history exists yet.
                </div>
              ) : null}
            </div>
          </section>
        </section>

        {brief?.warnings.length ? (
          <section
            className={cx(
              panelClass,
              "mt-5 p-5 sm:p-6",
            )}
          >
            <Badge tone="amber">
              <AlertTriangle className="h-3.5 w-3.5" />
              Active limitations
            </Badge>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {brief.warnings.map(
                (warning) => (
                  <div
                    key={
                      warning
                    }
                    className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.05] p-4 text-xs font-semibold leading-5 text-amber-100"
                  >
                    {warning}
                  </div>
                ),
              )}
            </div>
          </section>
        ) : null}
    </>
  );
}