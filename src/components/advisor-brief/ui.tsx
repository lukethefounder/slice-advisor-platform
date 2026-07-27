"use client";

import {
  ExternalLink,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type {
  ReactNode,
} from "react";

import type {
  AdvisorBriefIndustry,
  AdvisorBriefPreference,
  AdvisorBriefSecurity,
  AdvisorBriefSource,
} from "@/lib/advisor-briefing/types";

export const panelClass =
  "rounded-[1.75rem] border border-white/10 bg-black/58 shadow-2xl shadow-black/40 backdrop-blur-xl";

export function cx(
  ...values: Array<string | false | null | undefined>
) {
  return values.filter(Boolean).join(" ");
}

export function number(
  value: number | null | undefined,
  decimals = 1,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function compact(
  value: number | null | undefined,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

export function currency(
  value: number | null | undefined,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits:
      value >= 100 ? 2 : 4,
  });
}

export function signedPercent(
  value: number | null | undefined,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return `${value > 0 ? "+" : ""}${number(
    value,
    2,
  )}%`;
}

export function dateTime(
  value?: string | null,
) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  return Number.isFinite(
    parsed.getTime(),
  )
    ? parsed.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : value;
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?:
    | "green"
    | "red"
    | "amber"
    | "cyan"
    | "purple"
    | "slate";
}) {
  const colors = {
    green:
      "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    red:
      "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    amber:
      "border-amber-400/25 bg-amber-500/10 text-amber-100",
    cyan:
      "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
    purple:
      "border-purple-400/25 bg-purple-500/10 text-purple-100",
    slate:
      "border-white/10 bg-white/[0.05] text-slate-300",
  } as const;

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em]",
        colors[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Progress({
  value,
  tone = "red",
}: {
  value: number;
  tone?:
    | "red"
    | "green"
    | "amber"
    | "cyan"
    | "purple";
}) {
  const colors = {
    red: "from-emerald-500 to-emerald-800",
    green:
      "from-emerald-400 to-emerald-700",
    amber:
      "from-amber-300 to-amber-700",
    cyan:
      "from-cyan-400 to-cyan-700",
    purple:
      "from-purple-400 to-purple-700",
  } as const;

  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={cx(
          "h-full rounded-full bg-gradient-to-r",
          colors[tone],
        )}
        style={{
          width: `${Math.max(
            0,
            Math.min(100, value),
          )}%`,
        }}
      />
    </div>
  );
}

export function Metric({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className={cx(panelClass, "p-4")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {value}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.06] text-emerald-300">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        {helper}
      </p>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onChange(!checked)
      }
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-left"
    >
      <span className="text-xs font-black text-white">
        {label}
      </span>
      <span
        className={cx(
          "relative h-7 w-12 rounded-full border transition",
          checked
            ? "border-emerald-400/30 bg-emerald-500/20"
            : "border-white/10 bg-white/[0.05]",
        )}
      >
        <span
          className={cx(
            "absolute top-1 h-5 w-5 rounded-full bg-white transition",
            checked
              ? "left-6"
              : "left-1",
          )}
        />
      </span>
    </button>
  );
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });
  const body = (await response.json()) as T & {
    error?: string;
    detail?: string;
  };

  if (
    !response.ok ||
    body.error
  ) {
    throw new Error(
      body.detail ||
        body.error ||
        `Request failed with HTTP ${response.status}.`,
    );
  }

  return body;
}

export function defaultAdvisorBriefPreference(): AdvisorBriefPreference {
  return {
    schemaVersion:
      "slice-advisor-brief-preference-1.0.0",
    enabled: false,
    scheduleMode: "Weekdays",
    intervalMinutes: 360,
    localTime: "07:00",
    weeklyDay: 1,
    timezone:
      "America/Phoenix",
    emailEnabled: false,
    emailAddress: "",
    weekdaysOnly: true,
    minimumDataQuality: 65,
    lastGeneratedAt: null,
    lastScheduledRunAt: null,
    lastSentAt: null,
    lastDeliveryStatus: null,
    updatedAt:
      new Date().toISOString(),
  };
}

export function sourceLinks(
  sourceIds: string[],
  sourceMap: Map<
    string,
    AdvisorBriefSource
  >,
) {
  return sourceIds
    .map((id) => sourceMap.get(id))
    .filter(
      (
        source,
      ): source is AdvisorBriefSource =>
        Boolean(source),
    );
}

export function SecurityCard({
  security,
  sourceMap,
}: {
  security: AdvisorBriefSecurity;
  sourceMap: Map<
    string,
    AdvisorBriefSource
  >;
}) {
  const positive =
    security.quote.changePercent >= 0;
  const sources = sourceLinks(
    security.sourceIds,
    sourceMap,
  );

  return (
    <article className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition hover:border-emerald-400/25 hover:bg-emerald-500/[0.035]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="red">
              #{security.overallRank} overall
            </Badge>
            <Badge tone="slate">
              #{security.industryRank} in industry
            </Badge>
            <Badge
              tone={
                positive
                  ? "green"
                  : "red"
              }
            >
              {positive ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {signedPercent(
                security.quote.changePercent,
              )}
            </Badge>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
            <div>
              <h3 className="text-xl font-black text-white">
                {security.symbol}
              </h3>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {security.name}
              </p>
            </div>
            <p className="text-2xl font-black text-white">
              {currency(
                security.quote.price,
              )}
            </p>
          </div>

          <p className="mt-4 text-sm font-semibold leading-6 text-slate-300">
            {security.explanation}
          </p>
        </div>

        <div className="grid min-w-[19rem] grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-white/8 bg-black/25 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-700">
              Score
            </p>
            <p className="mt-1 text-xl font-black text-white">
              {number(
                security.score,
                1,
              )}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/25 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-700">
              Confidence
            </p>
            <p className="mt-1 text-xl font-black text-white">
              {number(
                security.confidence,
                0,
              )}
              %
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/25 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-700">
              Volume
            </p>
            <p className="mt-1 text-xl font-black text-white">
              {compact(
                security.quote.volume,
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.05] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-300">
            Positive evidence
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-emerald-50/75">
            {security.positiveDrivers.join(
              " · ",
            )}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.05] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-300">
            Monitoring risks
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-emerald-50/75">
            {security.riskFlags.join(
              " · ",
            )}
          </p>
        </div>
        <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.05] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-cyan-300">
            Research sources
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sources
              .slice(0, 5)
              .map((source) => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-black text-cyan-100 hover:text-white"
                >
                  {source.publisher ||
                    source.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export function IndustryCard({
  industry,
  active,
  onClick,
}: {
  industry: AdvisorBriefIndustry;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "w-full rounded-[1.5rem] border p-5 text-left transition",
        active
          ? "border-emerald-400/30 bg-emerald-500/[0.1] shadow-lg shadow-emerald-950/20"
          : "border-white/8 bg-white/[0.025] hover:border-emerald-400/20 hover:bg-emerald-500/[0.04]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge tone="red">
            Industry #{industry.rank}
          </Badge>
          <h3 className="mt-3 text-xl font-black text-white">
            {industry.name}
          </h3>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.13em] text-slate-600">
            {industry.etfSymbol}
          </p>
        </div>
        <p className="text-4xl font-black text-white">
          {number(
            industry.score,
            1,
          )}
        </p>
      </div>

      <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">
        {industry.thesis}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-white/8 bg-black/25 p-2.5">
          <p className="text-[9px] uppercase tracking-[0.12em] text-slate-700">
            Breadth
          </p>
          <p className="mt-1 font-black text-white">
            {number(
              industry.advancingSharePercent,
              0,
            )}
            %
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-black/25 p-2.5">
          <p className="text-[9px] uppercase tracking-[0.12em] text-slate-700">
            News
          </p>
          <p className="mt-1 font-black text-white">
            {number(
              industry.newsScore,
              0,
            )}
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-black/25 p-2.5">
          <p className="text-[9px] uppercase tracking-[0.12em] text-slate-700">
            Macro
          </p>
          <p className="mt-1 font-black text-white">
            {number(
              industry.macroScore,
              0,
            )}
          </p>
        </div>
      </div>
    </button>
  );
}