"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BellRing,
  Building2,
  CheckCircle2,
  Clock3,
  Command,
  Cpu,
  LogIn,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserPlus,
  UsersRound,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRealtimeMarket,
  type RealtimeAssetSnapshot,
} from "@/hooks/useRealtimeMarket";
import {
  WORKSPACE_MARKET_SYMBOLS,
  WORKSPACE_TOOLS,
  money,
  signedPercent,
  type FirmWorkspaceSummary,
  type SentTeamInvite,
  type WorkspaceBriefSummary,
  type WorkspaceIdentity,
} from "@/lib/workspace-green-core";
import WorkspaceCommandPalette from "@/components/workspace/core/workspace-command-palette";
import WorkspaceRightRail from "@/components/workspace/core/workspace-right-rail";
import WorkspaceSidebar from "@/components/workspace/core/workspace-sidebar";
import {
  GreenSliceLogo,
  MarketStatePill,
  SectionEyebrow,
  WorkspaceIcon,
  WorkspacePill,
  WorkspaceSurface,
  cx,
  toneClasses,
} from "@/components/workspace/core/workspace-ui";

type AuthResponse = {
  user: WorkspaceIdentity | null;
};

type ApiError = {
  error?: string;
  detail?: string;
};

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });
  const body = (await response.json().catch(() => ({}))) as T & ApiError;

  if (!response.ok) {
    throw new Error(
      body.detail ||
        body.error ||
        `Request failed with HTTP ${response.status}.`,
    );
  }

  return body;
}

function BetaAccessGate({
  loading,
  error,
}: {
  loading: boolean;
  error: string;
}) {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#010604] p-4 text-white sm:p-6">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-18%] top-[-18%] h-[42rem] w-[42rem] rounded-full bg-emerald-600/24 blur-3xl" />
        <div className="absolute right-[-16%] top-[8%] h-[38rem] w-[38rem] rounded-full bg-cyan-600/10 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[32%] h-[34rem] w-[34rem] rounded-full bg-lime-500/8 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(52,211,153,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.03)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <section className="relative mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl place-items-center sm:min-h-[calc(100dvh-3rem)]">
        <div className="grid w-full gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <WorkspaceSurface className="p-6 sm:p-8">
            <GreenSliceLogo />

            <div className="mt-8 flex flex-wrap gap-2">
              <WorkspacePill tone="emerald">
                <ShieldCheck className="h-3 w-3" />
                Beta access
              </WorkspacePill>
              <WorkspacePill tone="cyan">
                <Activity className="h-3 w-3" />
                Real accounts only
              </WorkspacePill>
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[0.96] tracking-[-0.055em] text-white sm:text-6xl">
              Enter the green-market operating system for modern advisors.
            </h1>

            <p className="mt-5 max-w-3xl text-sm font-semibold leading-7 text-slate-400 sm:text-base">
              Demo credentials have been removed. Sign in with a real firm account,
              create a beta firm workspace, or use the secure invitation sent by a
              firm owner.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Market core",
                  helper: "Alpha Vantage evidence",
                  icon: Activity,
                },
                {
                  label: "Firm access",
                  helper: "Database-backed roles",
                  icon: UsersRound,
                },
                {
                  label: "Advisor control",
                  helper: "Review before delivery",
                  icon: ShieldCheck,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"
                  >
                    <Icon className="h-5 w-5 text-emerald-300" />
                    <p className="mt-3 text-sm font-black text-white">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      {item.helper}
                    </p>
                  </div>
                );
              })}
            </div>
          </WorkspaceSurface>

          <WorkspaceSurface className="grid content-center p-6 sm:p-8">
            <div className="mx-auto w-full max-w-md">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-500/[0.08] text-emerald-200 shadow-xl shadow-emerald-950/30">
                {loading ? (
                  <RefreshCw className="h-7 w-7 animate-spin" />
                ) : (
                  <LogIn className="h-7 w-7" />
                )}
              </div>

              <SectionEyebrow>
                {loading ? "Checking session" : "Secure beta entry"}
              </SectionEyebrow>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
                {loading ? "Verifying access…" : "Choose your access path."}
              </h2>

              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                {error ||
                  "Firm owners can create accounts directly. Invited advisors use the secure link delivered by email."}
              </p>

              <div className="mt-6 grid gap-3">
                <Link
                  href="/founder-login"
                  className="group relative inline-flex min-h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-950 px-5 text-sm font-black text-white shadow-lg shadow-emerald-950/40 transition hover:brightness-110"
                >
                  <span className="absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/16 to-transparent transition duration-700 group-hover:translate-x-[120%]" />
                  <LogIn className="relative h-4 w-4" />
                  <span className="relative">Sign in to Slice</span>
                </Link>

                <Link
                  href="/advisor-signup"
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-emerald-300/18 bg-emerald-500/[0.065] px-5 text-sm font-black text-emerald-100 transition hover:bg-emerald-500/10"
                >
                  <UserPlus className="h-4 w-4" />
                  Create a beta firm account
                </Link>

                <Link
                  href="/"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-5 text-xs font-black text-slate-400 transition hover:text-white"
                >
                  Return to public site
                </Link>
              </div>
            </div>
          </WorkspaceSurface>
        </div>
      </section>
    </main>
  );
}


type KineticQuoteShape = "diamond" | "hex" | "capsule" | "ring";

const KINETIC_QUOTE_LAYOUT: Array<{
  angle: number;
  shape: KineticQuoteShape;
  scale: number;
}> = [
  { angle: 0, shape: "hex", scale: 1.02 },
  { angle: 45, shape: "diamond", scale: 0.94 },
  { angle: 90, shape: "capsule", scale: 1 },
  { angle: 135, shape: "ring", scale: 0.92 },
  { angle: 180, shape: "hex", scale: 1 },
  { angle: 225, shape: "diamond", scale: 0.92 },
  { angle: 270, shape: "capsule", scale: 1.02 },
  { angle: 315, shape: "ring", scale: 0.94 },
];

const KINETIC_TOOL_IDS = [
  "brief",
  "intelligence",
  "watchlists",
  "client-profiles",
  "email-center",
  "team-board",
] as const;

const KINETIC_NETWORK_PATHS = [
  "M500 310 C410 220 280 132 140 110",
  "M500 310 C590 215 730 130 870 100",
  "M500 310 C690 290 815 286 955 210",
  "M500 310 C698 380 820 455 932 530",
  "M500 310 C600 455 680 540 748 600",
  "M500 310 C405 470 310 545 230 590",
  "M500 310 C300 400 178 460 55 505",
  "M500 310 C286 296 172 245 35 185",
  "M500 310 C445 160 445 80 500 18",
  "M500 310 C535 445 530 520 500 608",
] as const;

function quoteVisualTone(snapshot: RealtimeAssetSnapshot | undefined) {
  const change = snapshot?.changePercent ?? 0;

  if (change > 0) {
    return {
      border: "border-emerald-300/30",
      background:
        "bg-gradient-to-br from-emerald-500/18 via-emerald-950/72 to-black/88",
      text: "text-emerald-200",
      glow: "shadow-[0_0_34px_rgba(16,185,129,0.22)]",
      dot: "bg-emerald-300",
      icon: TrendingUp,
    };
  }

  if (change < 0) {
    return {
      border: "border-amber-300/28",
      background:
        "bg-gradient-to-br from-amber-500/14 via-amber-950/62 to-black/88",
      text: "text-amber-100",
      glow: "shadow-[0_0_30px_rgba(245,158,11,0.18)]",
      dot: "bg-amber-300",
      icon: TrendingDown,
    };
  }

  return {
    border: "border-cyan-300/24",
    background:
      "bg-gradient-to-br from-cyan-500/12 via-cyan-950/55 to-black/88",
    text: "text-cyan-100",
    glow: "shadow-[0_0_26px_rgba(34,211,238,0.15)]",
    dot: "bg-cyan-300",
    icon: Activity,
  };
}

function KineticQuoteNode({
  symbol,
  snapshot,
  shape,
  scale,
}: {
  symbol: string;
  snapshot: RealtimeAssetSnapshot | undefined;
  shape: KineticQuoteShape;
  scale: number;
}) {
  const tone = quoteVisualTone(snapshot);
  const DirectionIcon = tone.icon;
  const shellClass =
    shape === "diamond"
      ? "kinetic-diamond h-[84px] w-[84px] rounded-[1.15rem]"
      : shape === "hex"
        ? "kinetic-hex min-h-[78px] min-w-[106px] px-4"
        : shape === "ring"
          ? "h-[92px] w-[92px] rounded-full"
          : "min-h-[72px] min-w-[116px] rounded-full px-4";

  const content = (
    <div className="min-w-0 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <span className={cx("h-1.5 w-1.5 rounded-full shadow-[0_0_12px_currentColor]", tone.dot)} />
        <p className="truncate text-[11px] font-black tracking-[0.02em] text-white">
          {symbol}
        </p>
      </div>
      <p className="mt-1 truncate text-xs font-black text-white">
        {snapshot ? money(snapshot.price, snapshot.currency) : "Connecting"}
      </p>
      <div className={cx("mt-0.5 flex items-center justify-center gap-1 text-[9px] font-black", tone.text)}>
        <DirectionIcon className="h-3 w-3" />
        {snapshot ? signedPercent(snapshot.changePercent) : "Alpha Vantage"}
      </div>
    </div>
  );

  return (
    <div
      className={cx(
        "grid place-items-center border backdrop-blur-xl",
        shellClass,
        tone.border,
        tone.background,
        tone.glow,
      )}
      style={{
        transform:
          shape === "diamond"
            ? `rotate(45deg) scale(${scale})`
            : `scale(${scale})`,
      }}
    >
      {shape === "diamond" ? (
        <div className="-rotate-45">{content}</div>
      ) : shape === "ring" ? (
        <div className="grid h-[76px] w-[76px] place-items-center rounded-full border border-white/10 bg-black/24">
          {content}
        </div>
      ) : (
        content
      )}
    </div>
  );
}

function KineticOperatingCore({
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
  const snapshotMap = useMemo(
    () =>
      new Map(
        snapshots.map((snapshot) => [snapshot.symbol.toUpperCase(), snapshot]),
      ),
    [snapshots],
  );
  const quoteNodes = KINETIC_QUOTE_LAYOUT.map((layout, index) => {
    const symbol = WORKSPACE_MARKET_SYMBOLS[index] ?? `MKT${index + 1}`;

    return {
      ...layout,
      symbol,
      snapshot: snapshotMap.get(symbol.toUpperCase()),
    };
  });
  const toolNodes = KINETIC_TOOL_IDS.flatMap((id) => {
    const tool = WORKSPACE_TOOLS.find((candidate) => candidate.id === id);
    return tool ? [tool] : [];
  });
  const realtimeCount = snapshots.filter((snapshot) => snapshot.isRealtime).length;
  const quality = snapshots.length
    ? Math.round(
        snapshots.reduce(
          (sum, snapshot) => sum + Number(snapshot.qualityScore || 0),
          0,
        ) / snapshots.length,
      )
    : 0;
  const latency = snapshots.length
    ? Math.round(
        snapshots.reduce(
          (sum, snapshot) => sum + Number(snapshot.latencyMs || 0),
          0,
        ) / snapshots.length,
      )
    : 0;
  const providerState = error
    ? "Provider degraded"
    : isStale
      ? "Refresh required"
      : realtimeCount
        ? "Market feed live"
        : "Connecting feed";

  return (
    <WorkspaceSurface className="grid min-h-[680px] grid-rows-[auto_minmax(0,1fr)_auto] p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <WorkspacePill tone="emerald">
              <Cpu className="h-3 w-3" />
              Advisor operating intelligence
            </WorkspacePill>
            <WorkspacePill tone={error || isStale ? "amber" : "cyan"}>
              {error ? (
                <WifiOff className="h-3 w-3" />
              ) : (
                <Wifi className="h-3 w-3" />
              )}
              {providerState}
            </WorkspacePill>
          </div>

          <h2 className="mt-3 text-2xl font-black tracking-[-0.045em] text-white sm:text-4xl">
            Slice operating core
          </h2>
          <p className="mt-2 max-w-4xl text-xs font-semibold leading-5 text-slate-500 sm:text-sm">
            Real-time securities, advisor tools, client context, research pathways,
            briefings, and firm execution orbit a beating market-intelligence core.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-400/24 bg-emerald-500/[0.08] px-4 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 shadow-lg shadow-emerald-950/25 transition hover:bg-emerald-500/12 disabled:opacity-45"
        >
          <RefreshCw className={cx("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh live core
        </button>
      </div>

      <div className="kinetic-stage relative mt-3 min-h-0 overflow-hidden rounded-[2rem] border border-emerald-200/10 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18),transparent_27%),radial-gradient(circle_at_50%_52%,rgba(34,211,238,0.07),transparent_46%),linear-gradient(180deg,rgba(255,255,255,0.025),rgba(0,0,0,0.24))]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(52,211,153,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.03)_1px,transparent_1px)] bg-[size:34px_34px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0,rgba(1,6,4,0.02)_38%,rgba(1,6,4,0.72)_100%)]" />

        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1000 620"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="kineticPath" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(34,211,238,0.02)" />
              <stop offset="44%" stopColor="rgba(52,211,153,0.65)" />
              <stop offset="72%" stopColor="rgba(132,204,22,0.26)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0.04)" />
            </linearGradient>
            <radialGradient id="kineticNodeGlow">
              <stop offset="0%" stopColor="rgba(236,253,245,0.95)" />
              <stop offset="35%" stopColor="rgba(52,211,153,0.72)" />
              <stop offset="100%" stopColor="rgba(52,211,153,0)" />
            </radialGradient>
            <filter id="kineticGlow">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {KINETIC_NETWORK_PATHS.map((path, index) => (
            <path
              key={path}
              d={path}
              fill="none"
              stroke="url(#kineticPath)"
              strokeWidth={index % 3 === 0 ? 2.25 : 1.2}
              strokeDasharray={index % 2 === 0 ? "9 10" : "3 11"}
              filter="url(#kineticGlow)"
              className="kinetic-network-line"
              style={{ animationDelay: `${index * -0.8}s` }}
            />
          ))}

          {[
            [500, 62],
            [805, 154],
            [935, 370],
            [720, 565],
            [258, 560],
            [72, 372],
            [174, 136],
          ].map(([cxValue, cyValue], index) => (
            <circle
              key={`${cxValue}-${cyValue}`}
              cx={cxValue}
              cy={cyValue}
              r={index % 2 === 0 ? 6 : 4}
              fill="url(#kineticNodeGlow)"
              className="kinetic-signal-node"
              style={{ animationDelay: `${index * -0.55}s` }}
            />
          ))}
        </svg>

        <div className="kinetic-float kinetic-float-a" />
        <div className="kinetic-float kinetic-float-b" />
        <div className="kinetic-float kinetic-float-c" />
        <div className="kinetic-comet kinetic-comet-a">
          <span />
        </div>
        <div className="kinetic-comet kinetic-comet-b">
          <span />
        </div>

        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "min(92%, 760px)",
            aspectRatio: "1 / 1",
          }}
        >
          <div className="kinetic-ring kinetic-ring-outer absolute inset-0 rounded-full border border-emerald-300/10" />
          <div className="kinetic-ring kinetic-ring-middle absolute inset-[10%] rounded-full border border-cyan-300/10" />
          <div className="kinetic-ring kinetic-ring-inner absolute inset-[22%] rounded-full border border-lime-300/10" />

          <div className="kinetic-quote-orbit absolute inset-[2%] hidden rounded-full sm:block">
            {quoteNodes.map((node, index) => (
              <div
                key={node.symbol}
                className={cx(
                  "absolute inset-0",
                  index >= 4 && "hidden lg:block",
                )}
                style={{ transform: `rotate(${node.angle}deg)` }}
              >
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                  <div style={{ transform: `rotate(${-node.angle}deg)` }}>
                    <div className="kinetic-quote-counter">
                      <KineticQuoteNode
                        symbol={node.symbol}
                        snapshot={node.snapshot}
                        shape={node.shape}
                        scale={node.scale}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="kinetic-tool-orbit absolute inset-[20%] hidden rounded-full md:block">
            {toolNodes.map((tool, index) => {
              const angle = index * (360 / Math.max(toolNodes.length, 1));

              return (
                <div
                  key={tool.id}
                  className="absolute inset-0"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                    <div style={{ transform: `rotate(${-angle}deg)` }}>
                      <div className="kinetic-tool-counter">
                        <Link
                          href={tool.href}
                          prefetch={false}
                          className={cx(
                            "group flex min-w-[104px] items-center gap-2 rounded-xl border px-2.5 py-2 shadow-xl backdrop-blur-xl transition hover:scale-105",
                            toneClasses(tool.tone),
                            index % 3 === 1 && "kinetic-tool-hex",
                            index % 3 === 2 && "rounded-full",
                          )}
                        >
                          <WorkspaceIcon
                            name={tool.icon}
                            className="h-3.5 w-3.5 shrink-0"
                          />
                          <span className="min-w-0 flex-1 truncate text-[9px] font-black text-white">
                            {tool.shortLabel}
                          </span>
                          <ArrowUpRight className="h-3 w-3 text-white/35 transition group-hover:text-white" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2">
          <div className="kinetic-core-shell grid h-44 w-44 place-items-center rounded-full border border-emerald-300/28 bg-[radial-gradient(circle_at_35%_25%,rgba(236,253,245,0.28),transparent_18%),conic-gradient(from_90deg,#010604,#059669,#22d3ee,#84cc16,#010604)] shadow-[0_0_100px_rgba(16,185,129,0.35)] sm:h-52 sm:w-52">
            <div className="absolute inset-2 rounded-full border border-white/10 bg-black/48 backdrop-blur-xl" />
            <div className="absolute inset-5 rounded-full border border-emerald-300/16 bg-gradient-to-br from-emerald-500/20 via-black/88 to-cyan-950/78" />

            <div className="relative text-center">
              <div className="mx-auto w-fit kinetic-logo-beat">
                <GreenSliceLogo compact />
              </div>
              <p className="mt-3 text-lg font-black tracking-[-0.04em] text-white">
                Slice Core
              </p>
              <p className="mt-1 text-[8px] font-black uppercase tracking-[0.22em] text-emerald-300">
                Live advisor OS
              </p>

              <div className="mt-3 flex items-center justify-center gap-1.5">
                <span className="kinetic-heart-dot h-1.5 w-1.5 rounded-full bg-emerald-300" />
                <Radio className="h-3.5 w-3.5 text-cyan-200" />
                <span className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-500">
                  {realtimeCount || 0} live channels
                </span>
              </div>
            </div>
          </div>

          <div className="kinetic-ecg absolute left-1/2 top-[calc(100%+13px)] h-5 w-44 -translate-x-1/2 overflow-hidden opacity-70">
            <div className="kinetic-ecg-line" />
          </div>
        </div>

        <div className="absolute inset-x-3 bottom-3 z-40 overflow-hidden rounded-xl border border-emerald-300/12 bg-black/58 backdrop-blur-xl">
          <div className="kinetic-market-tape flex min-w-max items-center gap-2 py-2">
            {[...quoteNodes, ...quoteNodes].map((node, index) => (
              <div
                key={`${node.symbol}-${index}`}
                className="flex min-w-[144px] items-center gap-2 border-r border-white/8 px-3"
              >
                <Zap className="h-3 w-3 shrink-0 text-emerald-300" />
                <span className="text-[9px] font-black text-white">
                  {node.symbol}
                </span>
                <span className="text-[9px] font-bold text-slate-400">
                  {node.snapshot
                    ? money(node.snapshot.price, node.snapshot.currency)
                    : "Connecting"}
                </span>
                <span
                  className={cx(
                    "text-[9px] font-black",
                    (node.snapshot?.changePercent ?? 0) >= 0
                      ? "text-emerald-200"
                      : "text-amber-100",
                  )}
                >
                  {node.snapshot
                    ? signedPercent(node.snapshot.changePercent)
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <style jsx>{`
          @keyframes networkFlow {
            to {
              stroke-dashoffset: -120;
            }
          }

          @keyframes quoteOrbit {
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes quoteCounter {
            to {
              transform: rotate(-360deg);
            }
          }

          @keyframes toolOrbit {
            to {
              transform: rotate(-360deg);
            }
          }

          @keyframes toolCounter {
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes coreHeartbeat {
            0%,
            100% {
              transform: scale(1);
              filter: brightness(0.96);
            }
            8% {
              transform: scale(1.035);
              filter: brightness(1.18);
            }
            16% {
              transform: scale(0.99);
            }
            24% {
              transform: scale(1.06);
              filter: brightness(1.28);
            }
            36% {
              transform: scale(1);
              filter: brightness(1);
            }
          }

          @keyframes logoBeat {
            0%,
            100% {
              transform: scale(1);
            }
            12% {
              transform: scale(1.08);
            }
            22% {
              transform: scale(0.98);
            }
            30% {
              transform: scale(1.12);
            }
            44% {
              transform: scale(1);
            }
          }

          @keyframes ringBreath {
            0%,
            100% {
              opacity: 0.28;
              transform: scale(0.985);
            }
            50% {
              opacity: 0.92;
              transform: scale(1.025);
            }
          }

          @keyframes signalPulse {
            0%,
            100% {
              opacity: 0.35;
              r: 3px;
            }
            50% {
              opacity: 1;
              r: 8px;
            }
          }

          @keyframes floatA {
            0%,
            100% {
              transform: translate3d(0, 0, 0) rotate(0deg);
            }
            50% {
              transform: translate3d(34px, -24px, 0) rotate(145deg);
            }
          }

          @keyframes floatB {
            0%,
            100% {
              transform: translate3d(0, 0, 0) rotate(45deg);
            }
            50% {
              transform: translate3d(-28px, 31px, 0) rotate(220deg);
            }
          }

          @keyframes cometA {
            0% {
              transform: translateX(-28%) translateY(-50%) rotate(-7deg);
              opacity: 0;
            }
            12%,
            48% {
              opacity: 1;
            }
            64%,
            100% {
              transform: translateX(88%) translateY(-50%) rotate(-7deg);
              opacity: 0;
            }
          }

          @keyframes cometB {
            0% {
              transform: translateX(88%) translateY(-50%) rotate(173deg);
              opacity: 0;
            }
            18%,
            52% {
              opacity: 0.8;
            }
            70%,
            100% {
              transform: translateX(-28%) translateY(-50%) rotate(173deg);
              opacity: 0;
            }
          }

          @keyframes tapeMove {
            to {
              transform: translateX(-50%);
            }
          }

          @keyframes ecgMove {
            to {
              transform: translateX(42px);
            }
          }

          .kinetic-stage {
            min-height: 590px;
          }

          .kinetic-network-line {
            animation: networkFlow 8s linear infinite;
          }

          .kinetic-signal-node {
            transform-box: fill-box;
            transform-origin: center;
            animation: signalPulse 3.6s ease-in-out infinite;
          }

          .kinetic-quote-orbit {
            animation: quoteOrbit 34s linear infinite;
          }

          .kinetic-quote-counter {
            animation: quoteCounter 34s linear infinite;
          }

          .kinetic-tool-orbit {
            animation: toolOrbit 25s linear infinite;
          }

          .kinetic-tool-counter {
            animation: toolCounter 25s linear infinite;
          }

          .kinetic-core-shell {
            animation: coreHeartbeat 3.1s ease-in-out infinite;
          }

          .kinetic-logo-beat {
            animation: logoBeat 3.1s ease-in-out infinite;
          }

          .kinetic-heart-dot {
            box-shadow:
              0 0 8px rgba(110, 231, 183, 0.9),
              0 0 22px rgba(16, 185, 129, 0.65);
            animation: signalPulse 1.55s ease-in-out infinite;
          }

          .kinetic-ring {
            transform-origin: center;
            animation: ringBreath 5.4s ease-in-out infinite;
          }

          .kinetic-ring-middle {
            animation-delay: -1.8s;
          }

          .kinetic-ring-inner {
            animation-delay: -3.6s;
          }

          .kinetic-diamond {
            transform: rotate(45deg);
          }

          .kinetic-hex,
          .kinetic-tool-hex {
            clip-path: polygon(
              12% 0,
              88% 0,
              100% 50%,
              88% 100%,
              12% 100%,
              0 50%
            );
          }

          .kinetic-float {
            position: absolute;
            z-index: 8;
            border: 1px solid rgba(52, 211, 153, 0.22);
            background: linear-gradient(
              145deg,
              rgba(16, 185, 129, 0.16),
              rgba(34, 211, 238, 0.06)
            );
            box-shadow: 0 0 28px rgba(16, 185, 129, 0.12);
            backdrop-filter: blur(12px);
          }

          .kinetic-float-a {
            left: 8%;
            top: 18%;
            height: 42px;
            width: 42px;
            border-radius: 12px;
            animation: floatA 8.2s ease-in-out infinite;
          }

          .kinetic-float-b {
            right: 10%;
            top: 24%;
            height: 34px;
            width: 34px;
            clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
            animation: floatB 9.4s ease-in-out infinite;
          }

          .kinetic-float-c {
            bottom: 16%;
            left: 18%;
            height: 28px;
            width: 72px;
            border-radius: 999px;
            animation: floatA 10.2s ease-in-out infinite reverse;
          }

          .kinetic-comet {
            position: absolute;
            left: -20%;
            top: 48%;
            z-index: 12;
            height: 28px;
            width: 145%;
            pointer-events: none;
          }

          .kinetic-comet span {
            position: absolute;
            left: 0;
            top: 50%;
            height: 2px;
            width: 230px;
            border-radius: 999px;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(16, 185, 129, 0.16),
              rgba(236, 253, 245, 0.95)
            );
            box-shadow:
              0 0 16px rgba(52, 211, 153, 0.8),
              0 0 34px rgba(16, 185, 129, 0.45);
          }

          .kinetic-comet span::after {
            content: "";
            position: absolute;
            right: -5px;
            top: 50%;
            height: 10px;
            width: 10px;
            transform: translateY(-50%);
            border-radius: 999px;
            background: #ecfdf5;
            box-shadow:
              0 0 10px rgba(236, 253, 245, 1),
              0 0 26px rgba(52, 211, 153, 0.9),
              0 0 52px rgba(34, 211, 238, 0.45);
          }

          .kinetic-comet-a {
            animation: cometA 7.2s cubic-bezier(0.2, 0.7, 0.18, 1) infinite;
          }

          .kinetic-comet-b {
            top: 61%;
            animation: cometB 9.1s cubic-bezier(0.2, 0.7, 0.18, 1) infinite;
            animation-delay: -3.8s;
          }

          .kinetic-market-tape {
            width: max-content;
            animation: tapeMove 28s linear infinite;
          }

          .kinetic-ecg-line {
            height: 100%;
            width: calc(100% + 42px);
            background:
              linear-gradient(
                135deg,
                transparent 0 40%,
                rgba(52, 211, 153, 0.9) 41% 43%,
                transparent 44% 48%,
                rgba(52, 211, 153, 0.95) 49% 51%,
                transparent 52% 56%,
                rgba(34, 211, 238, 0.75) 57% 59%,
                transparent 60%
              );
            background-size: 42px 100%;
            animation: ecgMove 1.5s linear infinite;
          }

          @media (max-width: 639px) {
            .kinetic-stage {
              min-height: 520px;
            }

            .kinetic-core-shell {
              height: 10.5rem;
              width: 10.5rem;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .kinetic-network-line,
            .kinetic-signal-node,
            .kinetic-quote-orbit,
            .kinetic-quote-counter,
            .kinetic-tool-orbit,
            .kinetic-tool-counter,
            .kinetic-core-shell,
            .kinetic-logo-beat,
            .kinetic-heart-dot,
            .kinetic-ring,
            .kinetic-float,
            .kinetic-comet,
            .kinetic-market-tape,
            .kinetic-ecg-line {
              animation: none !important;
            }
          }
        `}</style>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
          <SectionEyebrow>Provider</SectionEyebrow>
          <p className="mt-1 truncate text-xs font-black text-white">
            Alpha Vantage strict
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
          <SectionEyebrow>Live channels</SectionEyebrow>
          <p className="mt-1 truncate text-xs font-black text-white">
            {realtimeCount}/{snapshots.length || 0}
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
          <SectionEyebrow>Quality</SectionEyebrow>
          <p className="mt-1 truncate text-xs font-black text-white">
            {quality}/100
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
          <SectionEyebrow>Latency</SectionEyebrow>
          <p className="mt-1 truncate text-xs font-black text-white">
            {latency ? `${latency}ms` : "Pending"}
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

function QuickLaunch() {
  const tools = WORKSPACE_TOOLS.filter((tool) =>
    ["brief", "intelligence", "watchlists", "client-portal-inbox"].includes(
      tool.id,
    ),
  );

  return (
    <WorkspaceSurface className="p-3 sm:p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <SectionEyebrow>Quick launch</SectionEyebrow>
          <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-white">
            High-value advisor workflows
          </h2>
        </div>
        <WorkspacePill tone="emerald">{WORKSPACE_TOOLS.length} tools</WorkspacePill>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {tools.map((tool) => (
          <Link
            key={tool.id}
            href={tool.href}
            prefetch={false}
            className="group flex min-w-0 items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3 transition hover:-translate-y-0.5 hover:border-emerald-300/18 hover:bg-emerald-500/[0.055]"
          >
            <span
              className={cx(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
                toneClasses(tool.tone),
              )}
            >
              <WorkspaceIcon name={tool.icon} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-black text-white">
                {tool.label}
              </span>
              <span className="mt-1 block line-clamp-2 text-[10px] font-semibold leading-4 text-slate-600">
                {tool.outcome}
              </span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-700 transition group-hover:text-emerald-300" />
          </Link>
        ))}
      </div>
    </WorkspaceSurface>
  );
}

export default function WorkspacePage() {
  const [identity, setIdentity] = useState<WorkspaceIdentity | null>(null);
  const [firm, setFirm] = useState<FirmWorkspaceSummary | null>(null);
  const [brief, setBrief] = useState<WorkspaceBriefSummary | null>(null);
  const [sentInvites, setSentInvites] = useState<SentTeamInvite[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);

  const market = useRealtimeMarket([...WORKSPACE_MARKET_SYMBOLS], {
    intervalMs: 30_000,
    enabled: Boolean(identity),
    persist: false,
    provider: "alphavantage",
    strictProvider: true,
  });

  const loadWorkspace = useCallback(async () => {
    setLoadingAccess(true);
    setAccessError("");

    try {
      const auth = await fetchJson<AuthResponse>("/api/auth/me");

      if (!auth.user) {
        setIdentity(null);
        setFirm(null);
        setBrief(null);
        return;
      }

      setIdentity(auth.user);

      const [firmResult, briefResult] = await Promise.allSettled([
        fetchJson<FirmWorkspaceSummary>("/api/firm-workspace"),
        fetchJson<WorkspaceBriefSummary>("/api/advisor-brief"),
      ]);

      if (firmResult.status === "fulfilled") {
        setFirm(firmResult.value);

        const origin = window.location.origin;
        setSentInvites((current) => {
          const currentById = new Map(
            current.map((invite) => [invite.id, invite] as const),
          );

          return firmResult.value.invites
            .filter((invite) => invite.status === "Pending")
            .slice(0, 5)
            .map((invite) => {
              const existing = currentById.get(invite.id);

              return {
                id: invite.id,
                email: invite.email,
                role: invite.role,
                firmName:
                  firmResult.value.firm?.name ?? "Slice Advisory Group",
                inviteCode: invite.inviteCode,
                inviteLink: `${origin}/workspace/team-invite?code=${encodeURIComponent(
                  invite.inviteCode,
                )}`,
                expiresAt:
                  invite.expiresAt ??
                  new Date(
                    Date.parse(invite.createdAt) + 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                deliveryStatus: existing?.deliveryStatus ?? "sent",
                createdAt: invite.createdAt,
              };
            });
        });
      } else {
        setFirm(null);
      }

      if (briefResult.status === "fulfilled") {
        setBrief(briefResult.value);
      } else {
        setBrief(null);
      }
    } catch (error) {
      setIdentity(null);
      setFirm(null);
      setBrief(null);
      setAccessError(
        error instanceof Error
          ? error.message
          : "The workspace session could not be verified.",
      );
    } finally {
      setLoadingAccess(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const canInvite = useMemo(() => {
    const membership = firm?.membership;
    const roleName = membership?.role?.trim().toLowerCase() ?? "";
    const invitationRoles = new Set([
      "owner",
      "founder",
      "principal",
      "principal advisor",
      "lead advisor",
      "admin",
      "firm admin",
      "manager",
      "chief compliance officer",
    ]);

    // The server route remains authoritative. This client value prevents stale
    // or legacy role labels from incorrectly disabling a valid firm owner.
    return Boolean(
      identity &&
        (!membership ||
          invitationRoles.has(roleName) ||
          membership.canInviteMembers ||
          membership.canManageFirm),
    );
  }, [firm?.membership, identity]);

  const role = firm?.membership?.role ?? "Advisor";
  const firmName = firm?.firm?.name ?? "Slice Beta Workspace";
  const memberCount =
    firm?.members.filter((member) => member.status === "Active").length ?? 0;
  const pendingInvites =
    firm?.invites.filter((invite) => invite.status === "Pending").length ?? 0;

  async function signOut() {
    await fetch("/api/auth/logout", {
      method: "POST",
    }).catch(() => undefined);
    window.location.href = "/founder-login";
  }

  function handleInviteCreated(invite: SentTeamInvite) {
    setSentInvites((current) => [
      invite,
      ...current.filter((item) => item.id !== invite.id),
    ]);

    setFirm((current) => {
      if (!current) {
        return current;
      }

      const pendingInvite = {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: "Pending",
        inviteCode: invite.inviteCode,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      };

      return {
        ...current,
        invites: [
          pendingInvite,
          ...current.invites.filter((item) => item.id !== invite.id),
        ],
      };
    });

    // Refresh firm permissions and database state after the local UI has preserved
    // the actual delivery status returned by the invitation endpoint.
    window.setTimeout(() => {
      void loadWorkspace();
    }, 350);
  }

  if (!identity) {
    return <BetaAccessGate loading={loadingAccess} error={accessError} />;
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#010604] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-15%] top-[-18%] h-[40rem] w-[40rem] rounded-full bg-emerald-600/23 blur-3xl" />
        <div className="absolute right-[-14%] top-[6%] h-[36rem] w-[36rem] rounded-full bg-cyan-600/9 blur-3xl" />
        <div className="absolute bottom-[-24%] left-[32%] h-[38rem] w-[38rem] rounded-full bg-lime-500/7 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.09),transparent_38%),linear-gradient(rgba(52,211,153,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.025)_1px,transparent_1px)] bg-[size:100%_100%,42px_42px,42px_42px]" />
      </div>

      <div className="relative grid h-full min-h-0 grid-cols-1 lg:grid-cols-[268px_minmax(0,1fr)]">
        <WorkspaceSidebar
          onOpenSearch={() => setPaletteOpen(true)}
          onSignOut={() => void signOut()}
          role={role}
          firmName={firmName}
        />

        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 p-2 sm:gap-3 sm:p-3">
          <header className="ml-12 rounded-[1.45rem] border border-emerald-200/10 bg-black/55 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl lg:ml-0">
            <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <WorkspacePill tone="emerald">
                    <CheckCircle2 className="h-3 w-3" />
                    Authenticated beta
                  </WorkspacePill>
                  <WorkspacePill tone="cyan">
                    <Building2 className="h-3 w-3" />
                    {firm?.firm?.platformStatus ?? "Active"}
                  </WorkspacePill>
                </div>
                <h1 className="mt-2 truncate text-2xl font-black tracking-[-0.045em] text-white sm:text-3xl">
                  Welcome, {identity.name}.
                </h1>
                <p className="mt-1 truncate text-xs font-semibold text-slate-600">
                  {firmName} · {role} · green-market operating core
                </p>
              </div>

              <div className="grid min-w-0 gap-2 sm:grid-cols-4 xl:w-[670px]">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                  <p className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-700">
                    Team
                  </p>
                  <p className="mt-1 truncate text-xs font-black text-white">
                    {memberCount} active
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                  <p className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-700">
                    Invites
                  </p>
                  <p className="mt-1 truncate text-xs font-black text-white">
                    {pendingInvites} pending
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                  <p className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-700">
                    Market
                  </p>
                  <p className="mt-1 truncate text-xs font-black text-white">
                    {market.data?.realtimeCount ?? 0} live
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-500/[0.055] px-3 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-500/10"
                >
                  <Search className="h-4 w-4 shrink-0" />
                  <span className="truncate">Command search</span>
                  <Command className="hidden h-3.5 w-3.5 text-emerald-300 sm:block" />
                </button>
              </div>
            </div>
          </header>

          <div className="min-h-0 overflow-y-auto pr-0.5">
            <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_350px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="grid min-w-0 content-start gap-3">
                <KineticOperatingCore
                  snapshots={market.snapshots}
                  loading={market.loading}
                  error={market.error}
                  isStale={market.isStale}
                  onRefresh={() => void market.refresh()}
                  generatedAt={market.data?.generatedAt ?? null}
                />
                <QuickLaunch />
              </div>

              <WorkspaceRightRail
                firm={firm}
                brief={brief}
                canInvite={canInvite}
                sentInvites={sentInvites}
                onInviteCreated={handleInviteCreated}
              />
            </div>

            <div className="h-3" />
          </div>
        </section>
      </div>

      <WorkspaceCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </main>
  );
}