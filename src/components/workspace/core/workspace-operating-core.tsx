"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  ChartNoAxesCombined,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";

import type {
  RealtimeAssetSnapshot,
} from "@/hooks/useRealtimeMarket";
import {
  WORKSPACE_TOOLS,
  money,
  signedPercent,
} from "@/lib/workspace-green-core";
import {
  GreenSliceLogo,
  MarketStatePill,
  OperatingIcon,
  SectionEyebrow,
  WorkspaceIcon,
  WorkspacePill,
  WorkspaceSurface,
  cx,
  dotClasses,
  toneClasses,
} from "@/components/workspace/core/workspace-ui";

function marketTone(snapshot: RealtimeAssetSnapshot) {
  if ((snapshot.changePercent ?? 0) > 0) {
    return "emerald" as const;
  }

  if ((snapshot.changePercent ?? 0) < 0) {
    return "amber" as const;
  }

  return "slate" as const;
}

function MarketCard({
  snapshot,
}: {
  snapshot: RealtimeAssetSnapshot;
}) {
  const tone = marketTone(snapshot);

  return (
    <div
      className={cx(
        "min-w-0 rounded-xl border px-2.5 py-2 shadow-lg backdrop-blur-xl",
        toneClasses(tone),
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-black text-white">
          {snapshot.symbol}
        </p>
        <span className={cx("h-1.5 w-1.5 rounded-full", dotClasses(tone))} />
      </div>
      <p className="mt-1 truncate text-xs font-black text-white">
        {money(snapshot.price, snapshot.currency)}
      </p>
      <p
        className={cx(
          "mt-0.5 text-[9px] font-black",
          tone === "emerald" ? "text-emerald-200" : tone === "amber" ? "text-amber-100" : "text-slate-400",
        )}
      >
        {signedPercent(snapshot.changePercent)}
      </p>
    </div>
  );
}

export default function WorkspaceOperatingCore({
  snapshots,
  loading,
  error,
  isStale,
  onRefresh,
  generatedAt,
}: {
  snapshots: RealtimeAssetSnapshot[];
  loading: boolean;
  error: string;
  isStale: boolean;
  onRefresh: () => void;
  generatedAt: string | null;
}) {
  const visibleTools = WORKSPACE_TOOLS.slice(0, 10);
  const liveCount = snapshots.filter((snapshot) => snapshot.isRealtime).length;
  const averageQuality = snapshots.length
    ? Math.round(
        snapshots.reduce(
          (total, snapshot) => total + Number(snapshot.qualityScore || 0),
          0,
        ) / snapshots.length,
      )
    : 0;

  return (
    <WorkspaceSurface className="grid min-h-[520px] grid-rows-[auto_minmax(0,1fr)_auto] p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <WorkspacePill tone="emerald">
              <Activity className="h-3 w-3" />
              Slice Operating Core
            </WorkspacePill>
            <WorkspacePill tone={error ? "amber" : isStale ? "amber" : "cyan"}>
              {error ? (
                <WifiOff className="h-3 w-3" />
              ) : (
                <Wifi className="h-3 w-3" />
              )}
              {error ? "Provider degraded" : isStale ? "Refresh due" : "Alpha Vantage connected"}
            </WorkspacePill>
          </div>

          <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
            Market evidence flows into every advisor decision.
          </h2>
          <p className="mt-2 max-w-4xl text-xs font-semibold leading-5 text-slate-500 sm:text-sm">
            Live market observations, client context, AI research, autonomous briefings,
            communication, compliance, and team execution converge on one operating layer.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-400/22 bg-emerald-500/[0.08] px-3 text-[10px] font-black uppercase tracking-[0.11em] text-emerald-100 disabled:opacity-50"
        >
          <RefreshCw className={cx("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh core
        </button>
      </div>

      <div className="relative mt-3 min-h-0 overflow-hidden rounded-[1.7rem] border border-emerald-200/10 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15),transparent_28%),radial-gradient(circle_at_50%_55%,rgba(34,211,238,0.07),transparent_46%),linear-gradient(180deg,rgba(255,255,255,0.025),rgba(0,0,0,0.14))]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(52,211,153,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.035)_1px,transparent_1px)] bg-[size:34px_34px]" />

        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1000 620"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="coreLine" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(52,211,153,0.04)" />
              <stop offset="48%" stopColor="rgba(52,211,153,0.52)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0.08)" />
            </linearGradient>
            <filter id="coreGlow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {visibleTools.map((tool, index) => (
            <g key={tool.id}>
              <path
                d={`M 500 310 Q ${500 + (tool.orbit.x - 50) * 3.2} ${
                  310 + (tool.orbit.y - 50) * 1.35
                } ${tool.orbit.x * 10} ${tool.orbit.y * 6.2}`}
                fill="none"
                stroke="url(#coreLine)"
                strokeWidth={index % 3 === 0 ? 2.2 : 1.25}
                strokeDasharray={index % 2 === 0 ? "8 8" : "3 9"}
                filter="url(#coreGlow)"
                className="core-flow-line"
                style={{ animationDelay: `${index * -0.65}s` }}
              />
            </g>
          ))}

          <circle
            cx="500"
            cy="310"
            r="112"
            fill="none"
            stroke="rgba(52,211,153,0.18)"
            strokeWidth="1.5"
            className="core-ring core-ring-a"
          />
          <circle
            cx="500"
            cy="310"
            r="167"
            fill="none"
            stroke="rgba(34,211,238,0.10)"
            strokeWidth="1"
            className="core-ring core-ring-b"
          />
          <circle
            cx="500"
            cy="310"
            r="222"
            fill="none"
            stroke="rgba(132,204,22,0.08)"
            strokeWidth="1"
            className="core-ring core-ring-c"
          />
        </svg>

        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="core-halo grid h-44 w-44 place-items-center rounded-full border border-emerald-300/24 bg-emerald-950/45 shadow-[0_0_90px_rgba(16,185,129,0.30)] backdrop-blur-xl sm:h-52 sm:w-52">
            <div className="grid h-[78%] w-[78%] place-items-center rounded-full border border-white/10 bg-gradient-to-br from-emerald-500/24 via-black/78 to-cyan-950/70">
              <div className="text-center">
                <div className="mx-auto w-fit">
                  <GreenSliceLogo compact />
                </div>
                <p className="mt-3 text-sm font-black text-white">Slice Core</p>
                <p className="mt-1 text-[8px] font-black uppercase tracking-[0.2em] text-emerald-300">
                  Advisor OS
                </p>
                <div className="mt-3 flex justify-center gap-1">
                  {["market", "client", "ai", "team"].map((type) => (
                    <span
                      key={type}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-emerald-300/12 bg-emerald-500/[0.055] text-emerald-200"
                    >
                      <OperatingIcon
                        type={type as "market" | "client" | "ai" | "team"}
                      />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {visibleTools.map((tool, index) => (
          <Link
            key={tool.id}
            href={tool.href}
            prefetch={false}
            className={cx(
              "group absolute z-30 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl border px-2.5 py-2 shadow-xl backdrop-blur-xl transition hover:scale-105 md:flex",
              toneClasses(tool.tone),
              index > 7 && "xl:flex",
            )}
            style={{
              left: `${tool.orbit.x}%`,
              top: `${tool.orbit.y}%`,
            }}
          >
            <WorkspaceIcon name={tool.icon} className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-24 truncate text-[9px] font-black text-white">
              {tool.shortLabel}
            </span>
            <ArrowUpRight className="h-3 w-3 text-white/40 transition group-hover:text-white" />
          </Link>
        ))}

        <div className="absolute inset-x-2 bottom-2 z-30 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {snapshots.slice(0, 8).map((snapshot) => (
            <MarketCard key={snapshot.symbol} snapshot={snapshot} />
          ))}

          {!snapshots.length
            ? ["SPY", "QQQ", "NVDA", "MSFT"].map((symbol) => (
                <div
                  key={symbol}
                  className="rounded-xl border border-dashed border-white/10 bg-black/25 px-2.5 py-2"
                >
                  <p className="text-[10px] font-black text-white">{symbol}</p>
                  <p className="mt-1 text-[9px] font-semibold text-slate-600">
                    Waiting for Alpha Vantage
                  </p>
                </div>
              ))
            : null}
        </div>

        <style jsx>{`
          @keyframes coreDash {
            to {
              stroke-dashoffset: -92;
            }
          }

          @keyframes corePulse {
            0%,
            100% {
              transform: scale(1);
              opacity: 0.62;
            }
            50% {
              transform: scale(1.035);
              opacity: 1;
            }
          }

          @keyframes coreRing {
            0%,
            100% {
              opacity: 0.35;
            }
            50% {
              opacity: 0.9;
            }
          }

          .core-flow-line {
            animation: coreDash 8s linear infinite;
          }

          .core-halo {
            animation: corePulse 4s ease-in-out infinite;
          }

          .core-ring {
            transform-origin: 500px 310px;
            animation: coreRing 5s ease-in-out infinite;
          }

          .core-ring-b {
            animation-delay: -1.6s;
          }

          .core-ring-c {
            animation-delay: -3.2s;
          }

          @media (prefers-reduced-motion: reduce) {
            .core-flow-line,
            .core-halo,
            .core-ring {
              animation: none !important;
            }
          }
        `}</style>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
          <SectionEyebrow>Provider</SectionEyebrow>
          <p className="mt-1 truncate text-xs font-black text-white">
            Alpha Vantage strict
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
          <SectionEyebrow>Realtime</SectionEyebrow>
          <p className="mt-1 truncate text-xs font-black text-white">
            {liveCount}/{snapshots.length || 0} live
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
          <SectionEyebrow>Quality</SectionEyebrow>
          <p className="mt-1 truncate text-xs font-black text-white">
            {averageQuality}/100 average
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
          <SectionEyebrow>Generated</SectionEyebrow>
          <div className="mt-1 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-xs font-black text-white">
              {generatedAt
                ? new Date(generatedAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "Pending"}
            </p>
            {snapshots[0] ? (
              <MarketStatePill state={snapshots[0].marketState} />
            ) : null}
          </div>
        </div>
      </div>
    </WorkspaceSurface>
  );
}