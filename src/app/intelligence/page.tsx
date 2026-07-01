"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRealtimeMarket, type RealtimeAssetSnapshot } from "@/hooks/useRealtimeMarket";

type ScoredNewsItem = {
  id: string;
  sourceName: string;
  title: string;
  summary: string;
  link: string;
  publishedAt: string;
  score: number;
  urgency: "Critical" | "High" | "Medium" | "Low" | "Suppressed";
  matchedTickers: string[];
  matchedCompanies: string[];
  matchedThemes: string[];
  reasons: string[];
  shouldAlert: boolean;
  channels: Array<"SMS" | "Email" | "Dashboard" | "Digest">;
  complianceLabel: string;
  alertCopy: string;
};

type ScanResponse = {
  scannedAt: string;
  sources: Array<{
    id: string;
    name: string;
    ok: boolean;
    fetched: number;
    paid: boolean;
    error?: string;
  }>;
  items: ScoredNewsItem[];
  alertCandidates: ScoredNewsItem[];
  digestCandidates: ScoredNewsItem[];
  suppressed: ScoredNewsItem[];
};

type AdvisorSource = {
  id: string;
  name: string;
  platformType: string;
  sourceKind: string;
  sourceUrl: string;
  enabled: boolean;
  termsAcknowledged: boolean;
  hasSecret: boolean;
  minScoreToRetain: number;
  minScoreToAlert: number;
  maxItemsPerRun: number;
  lastStatus: string;
  lastError?: string | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatNumber(value: number | null | undefined, options?: Intl.NumberFormatOptions) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", options).format(value);
}

function formatPrice(snapshot: RealtimeAssetSnapshot) {
  return formatNumber(snapshot.price, {
    style: "currency",
    currency: snapshot.currency || "USD",
    maximumFractionDigits: snapshot.price > 100 ? 2 : 4,
  });
}

function urgencyClass(urgency: ScoredNewsItem["urgency"]) {
  if (urgency === "Critical") return "border-red-400/40 bg-red-500/15 text-red-100";
  if (urgency === "High") return "border-purple-400/40 bg-purple-500/15 text-purple-100";
  if (urgency === "Medium") return "border-amber-400/40 bg-amber-500/15 text-amber-100";
  if (urgency === "Suppressed") return "border-zinc-400/20 bg-zinc-500/10 text-zinc-300";

  return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
}

function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
        className || "border-white/10 bg-white/10 text-white"
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
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function PriceCard({ snapshot }: { snapshot: RealtimeAssetSnapshot }) {
  const positive = (snapshot.changePercent ?? 0) >= 0;

  return (
    <Card className="min-h-[250px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-black text-white">{snapshot.symbol}</div>
          <div className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
            {snapshot.provider} · {snapshot.marketState}
          </div>
        </div>
        <Pill
          className={
            snapshot.isRealtime
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-amber-400/30 bg-amber-500/10 text-amber-200"
          }
        >
          {snapshot.isRealtime ? "Provider" : "Fallback"}
        </Pill>
      </div>

      <div className="mt-5 text-4xl font-black tracking-tight text-white">
        {formatPrice(snapshot)}
      </div>

      <div
        className={cx(
          "mt-2 text-sm font-black",
          positive ? "text-emerald-300" : "text-red-300"
        )}
      >
        {positive ? "+" : ""}
        {formatNumber(snapshot.change, { maximumFractionDigits: 4 })} ·{" "}
        {positive ? "+" : ""}
        {formatNumber(snapshot.changePercent, { maximumFractionDigits: 2 })}%
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
            Quality
          </div>
          <div className="mt-1 text-xl font-black text-white">
            {snapshot.qualityScore}/100
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
            Volume
          </div>
          <div className="mt-1 text-xl font-black text-white">
            {formatNumber(snapshot.volume, { notation: "compact" })}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs font-bold leading-5 text-cyan-100">
        {snapshot.technicals.technicalSummary}
      </div>

      {snapshot.warnings.length ? (
        <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs font-bold leading-5 text-amber-100">
          {snapshot.warnings[0]}
        </div>
      ) : null}
    </Card>
  );
}

function NewsCard({ item }: { item: ScoredNewsItem }) {
  return (
    <article className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill className={urgencyClass(item.urgency)}>{item.urgency}</Pill>
            {item.shouldAlert ? (
              <Pill className="border-red-400/40 bg-red-500/15 text-red-100">
                Notify investor
              </Pill>
            ) : (
              <Pill className="border-white/10 bg-white/10 text-zinc-300">
                Digest only
              </Pill>
            )}
            <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              {item.sourceName}
            </span>
          </div>

          <h2 className="mt-4 text-2xl font-black leading-tight text-white">
            {item.title}
          </h2>

          <p className="mt-3 text-sm font-semibold leading-7 text-zinc-400">
            {item.summary || "No source summary was included."}
          </p>
        </div>

        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border border-red-400/30 bg-red-500/10 text-2xl font-black text-white">
          {item.score}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
            Tickers
          </div>
          <div className="mt-2 font-black text-white">
            {item.matchedTickers.length ? item.matchedTickers.join(", ") : "None"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
            Themes
          </div>
          <div className="mt-2 font-black text-white">
            {item.matchedThemes.length ? item.matchedThemes.slice(0, 4).join(", ") : "None"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
            Channels
          </div>
          <div className="mt-2 font-black text-white">
            {item.channels.length ? item.channels.join(", ") : "Suppressed"}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
          Why Slice ranked it this way
        </div>
        <ul className="mt-3 space-y-2">
          {item.reasons.map((reason) => (
            <li key={reason} className="text-sm font-semibold leading-6 text-cyan-50">
              • {reason}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm font-semibold leading-6 text-amber-100">
        {item.complianceLabel}
      </div>

      {item.link ? (
        <a
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-black text-zinc-950"
        >
          Open source item
        </a>
      ) : null}
    </article>
  );
}

export default function IntelligenceScannerPage() {
  const [symbolsInput, setSymbolsInput] = useState("SPY, QQQ, AAPL, MSFT, NVDA, TLT, GLD, BTCUSD");
  const symbols = useMemo(
    () =>
      symbolsInput
        .split(/[,\s]+/g)
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean),
    [symbolsInput]
  );

  const market = useRealtimeMarket(symbols, { persist: true });

  const [loadingScan, setLoadingScan] = useState(false);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [scanError, setScanError] = useState("");

  const [sources, setSources] = useState<AdvisorSource[]>([]);
  const [sourcesError, setSourcesError] = useState("");

  const [sourceForm, setSourceForm] = useState({
    name: "",
    platformType: "Paid Research",
    sourceKind: "RSS",
    sourceUrl: "",
    authHeaderName: "",
    authHeaderValue: "",
    minScoreToRetain: "55",
    minScoreToAlert: "88",
    termsAcknowledged: false,
  });

  async function loadSources() {
    setSourcesError("");

    try {
      const response = await fetch("/api/advisor-sources", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Log in as an advisor to manage paid research sources.");
      }

      const data = (await response.json()) as { sources: AdvisorSource[] };
      setSources(data.sources);
    } catch (error) {
      setSourcesError(error instanceof Error ? error.message : "Unable to load advisor sources.");
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  async function runScan() {
    setLoadingScan(true);
    setScanError("");

    try {
      const response = await fetch("/api/intelligence/scan", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Scan failed with HTTP ${response.status}.`);
      }

      const data = (await response.json()) as ScanResponse;
      setScan(data);
      await loadSources();
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "The intelligence scan failed.");
    } finally {
      setLoadingScan(false);
    }
  }

  async function createSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSourcesError("");

    try {
      const response = await fetch("/api/advisor-sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...sourceForm,
          minScoreToRetain: Number(sourceForm.minScoreToRetain),
          minScoreToAlert: Number(sourceForm.minScoreToAlert),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Unable to create source.");
      }

      setSourceForm({
        name: "",
        platformType: "Paid Research",
        sourceKind: "RSS",
        sourceUrl: "",
        authHeaderName: "",
        authHeaderValue: "",
        minScoreToRetain: "55",
        minScoreToAlert: "88",
        termsAcknowledged: false,
      });

      await loadSources();
    } catch (error) {
      setSourcesError(error instanceof Error ? error.message : "Unable to create source.");
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] px-5 py-8 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-14%] top-[-10%] h-[32rem] w-[32rem] rounded-full bg-red-700/25 blur-3xl" />
        <div className="absolute right-[-12%] top-[12%] h-[34rem] w-[34rem] rounded-full bg-purple-700/12 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[24%] h-[30rem] w-[30rem] rounded-full bg-red-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-red-400">
              Slice real-time intelligence
            </div>
            <h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">
              Live prices, technicals, and paid-source headlines.
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-zinc-400">
              Slice now polls live market providers, stores timestamped price snapshots,
              scans public and advisor-authorized paid sources, scores relevance, and queues
              investor notifications for advisor review.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/workspace"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white"
            >
              Workspace
            </a>
            <button
              onClick={runScan}
              disabled={loadingScan}
              className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
            >
              {loadingScan ? "Scanning..." : "Run intelligence scan"}
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <Pill className="border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
                  Real-time price layer
                </Pill>
                <h2 className="mt-3 text-3xl font-black">Immediate market updates</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-zinc-400">
                  Polls provider APIs on a short interval, validates provider freshness,
                  computes technical context, and labels delayed/demo data clearly.
                </p>
              </div>

              <button
                onClick={market.refresh}
                disabled={market.loading}
                className="rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-black text-zinc-950 disabled:opacity-60"
              >
                {market.loading ? "Refreshing..." : "Refresh now"}
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                Symbols
              </label>
              <input
                value={symbolsInput}
                onChange={(event) => setSymbolsInput(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-400"
                placeholder="SPY, QQQ, AAPL, MSFT, NVDA"
              />
            </div>

            {market.error ? (
              <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                {market.error}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {market.snapshots.map((snapshot) => (
                <PriceCard key={snapshot.symbol} snapshot={snapshot} />
              ))}
            </div>
          </Card>

          <Card>
            <Pill className="border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
              Paid source manager
            </Pill>
            <h2 className="mt-3 text-3xl font-black">Advisor-authorized platforms</h2>
            <p className="mt-2 text-sm font-semibold leading-7 text-zinc-400">
              Add licensed RSS/API/export feeds from paid platforms. Do not add browser
              cookies, raw passwords, or paywall bypasses.
            </p>

            <form onSubmit={createSource} className="mt-5 grid gap-3">
              <input
                value={sourceForm.name}
                onChange={(event) =>
                  setSourceForm((current) => ({ ...current, name: event.target.value }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-400"
                placeholder="Source name, e.g. Paid Research Feed"
              />

              <input
                value={sourceForm.sourceUrl}
                onChange={(event) =>
                  setSourceForm((current) => ({ ...current, sourceUrl: event.target.value }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-400"
                placeholder="https:// paid RSS/API/export endpoint"
              />

              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={sourceForm.sourceKind}
                  onChange={(event) =>
                    setSourceForm((current) => ({ ...current, sourceKind: event.target.value }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-400"
                >
                  <option value="RSS">RSS</option>
                  <option value="JSON_API">JSON API</option>
                  <option value="HEADLINE_API">Headline API</option>
                </select>

                <input
                  value={sourceForm.platformType}
                  onChange={(event) =>
                    setSourceForm((current) => ({ ...current, platformType: event.target.value }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-400"
                  placeholder="Platform type"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={sourceForm.authHeaderName}
                  onChange={(event) =>
                    setSourceForm((current) => ({ ...current, authHeaderName: event.target.value }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-400"
                  placeholder="Auth header, e.g. Authorization"
                />

                <input
                  type="password"
                  value={sourceForm.authHeaderValue}
                  onChange={(event) =>
                    setSourceForm((current) => ({ ...current, authHeaderValue: event.target.value }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-400"
                  placeholder="Bearer/API token"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={sourceForm.minScoreToRetain}
                  onChange={(event) =>
                    setSourceForm((current) => ({
                      ...current,
                      minScoreToRetain: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-400"
                  placeholder="Retain score"
                />

                <input
                  value={sourceForm.minScoreToAlert}
                  onChange={(event) =>
                    setSourceForm((current) => ({
                      ...current,
                      minScoreToAlert: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-400"
                  placeholder="Alert score"
                />
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-xs font-bold leading-5 text-amber-100">
                <input
                  type="checkbox"
                  checked={sourceForm.termsAcknowledged}
                  onChange={(event) =>
                    setSourceForm((current) => ({
                      ...current,
                      termsAcknowledged: event.target.checked,
                    }))
                  }
                  className="mt-1"
                />
                I confirm this is a paid, licensed, API/RSS/export, or otherwise authorized
                source and that Slice is not being used to bypass a paywall or scrape logged-in pages.
              </label>

              <button className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950">
                Add source
              </button>
            </form>

            {sourcesError ? (
              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
                {sourcesError}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-black text-white">{source.name}</div>
                    <Pill
                      className={
                        source.enabled
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                          : "border-zinc-400/20 bg-zinc-500/10 text-zinc-300"
                      }
                    >
                      {source.enabled ? "Enabled" : "Off"}
                    </Pill>
                  </div>
                  <div className="mt-1 break-all text-xs font-bold text-zinc-500">
                    {source.sourceUrl}
                  </div>
                  <div className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-400">
                    {source.sourceKind} · Alert {source.minScoreToAlert}+ ·{" "}
                    {source.hasSecret ? "Credential connected" : "No credential"}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {scanError ? (
          <div className="mt-6 rounded-[2rem] border border-red-400/30 bg-red-500/10 p-5 font-bold text-red-100">
            {scanError}
          </div>
        ) : null}

        {scan ? (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-4">
              {[
                ["Alerts", scan.alertCandidates.length],
                ["Digest", scan.digestCandidates.length],
                ["Suppressed", scan.suppressed.length],
                ["Sources", scan.sources.length],
              ].map(([label, value]) => (
                <Card key={label as string}>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                    {label}
                  </div>
                  <div className="mt-2 text-4xl font-black text-white">{value}</div>
                </Card>
              ))}
            </section>

            <section className="mt-6">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <Pill className="border-red-400/30 bg-red-500/10 text-red-200">
                    Investor notifications
                  </Pill>
                  <h2 className="mt-3 text-4xl font-black">Alert Candidates</h2>
                  <p className="mt-2 text-sm font-semibold text-zinc-400">
                    Last scan: {new Date(scan.scannedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid gap-5">
                {scan.alertCandidates.length ? (
                  scan.alertCandidates.map((item) => <NewsCard key={item.id} item={item} />)
                ) : (
                  <Card>
                    <div className="text-center text-lg font-black text-zinc-400">
                      No stories cleared the investor notification threshold this scan.
                    </div>
                  </Card>
                )}
              </div>
            </section>

            <section className="mt-6">
              <h2 className="text-4xl font-black">Digest Candidates</h2>
              <div className="mt-4 grid gap-5 lg:grid-cols-2">
                {scan.digestCandidates.slice(0, 10).map((item) => (
                  <NewsCard key={item.id} item={item} />
                ))}
              </div>
            </section>

            <section className="mt-6">
              <h2 className="text-4xl font-black">Source Health</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {scan.sources.map((source) => (
                  <Card key={source.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black text-white">{source.name}</div>
                      <Pill
                        className={
                          source.ok
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                            : "border-red-400/30 bg-red-500/10 text-red-200"
                        }
                      >
                        {source.ok ? "Online" : "Issue"}
                      </Pill>
                    </div>
                    <div className="mt-3 text-sm font-bold text-zinc-400">
                      {source.ok ? `${source.fetched} items fetched` : source.error}
                    </div>
                    {source.paid ? (
                      <div className="mt-3">
                        <Pill className="border-purple-400/30 bg-purple-500/10 text-purple-200">
                          Advisor paid source
                        </Pill>
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            </section>
          </>
        ) : (
          <Card className="mt-6 text-center">
            <div className="text-5xl">🛰️</div>
            <h2 className="mt-4 text-3xl font-black">Run the first real-time scan.</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-7 text-zinc-400">
              Slice will scan public sources plus advisor-authorized paid feeds, rank
              materiality, and queue relevant investor notifications for advisor review.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}