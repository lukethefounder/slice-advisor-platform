"use client";

import { useState } from "react";

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
    error?: string;
  }>;
  items: ScoredNewsItem[];
  alertCandidates: ScoredNewsItem[];
  digestCandidates: ScoredNewsItem[];
  suppressed: ScoredNewsItem[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 via-white to-purple-100 shadow-lg shadow-rose-200/60 ring-1 ring-rose-200">
        <div className="absolute inset-1 rounded-[1rem] border border-white/80" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-600 to-purple-800 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-rose-300" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-purple-300" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-slate-950">
          Slice
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-rose-500">
          Intelligence Scanner
        </div>
      </div>
    </div>
  );
}

function Pill({
  children,
  color = "rose",
}: {
  children: React.ReactNode;
  color?: "rose" | "purple" | "green" | "amber" | "slate" | "dark";
}) {
  const colors = {
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    purple: "bg-purple-50 text-purple-700 ring-purple-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    dark: "bg-slate-950 text-white ring-slate-800",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-black ring-1",
        colors[color]
      )}
    >
      {children}
    </span>
  );
}

function urgencyColor(urgency: ScoredNewsItem["urgency"]) {
  if (urgency === "Critical") return "rose";
  if (urgency === "High") return "purple";
  if (urgency === "Medium") return "amber";
  if (urgency === "Suppressed") return "slate";
  return "green";
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-purple-100">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#e11d48 ${score * 3.6}deg, #ffe4e6 0deg)`,
        }}
      />
      <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-black text-slate-950">
        {score}
      </div>
    </div>
  );
}

function NewsCard({ item }: { item: ScoredNewsItem }) {
  return (
    <article className="rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-xl shadow-rose-200/40 backdrop-blur-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill color={urgencyColor(item.urgency)}>{item.urgency}</Pill>
            {item.shouldAlert ? (
              <Pill color="dark">Instant alert candidate</Pill>
            ) : (
              <Pill color="slate">No instant alert</Pill>
            )}
            <span className="text-xs font-black uppercase tracking-wide text-slate-400">
              {item.sourceName}
            </span>
          </div>

          <h2 className="mt-4 text-xl font-black leading-tight text-slate-950">
            {item.title}
          </h2>

          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            {item.summary || "No summary was included in this RSS item."}
          </p>
        </div>

        <ScoreRing score={item.score} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-rose-50/80 p-4">
          <div className="text-xs font-black uppercase text-slate-400">
            Tickers
          </div>
          <div className="mt-2 font-black text-slate-950">
            {item.matchedTickers.length ? item.matchedTickers.join(", ") : "None"}
          </div>
        </div>

        <div className="rounded-2xl bg-purple-50/80 p-4">
          <div className="text-xs font-black uppercase text-slate-400">
            Themes
          </div>
          <div className="mt-2 font-black text-slate-950">
            {item.matchedThemes.length
              ? item.matchedThemes.slice(0, 3).join(", ")
              : "None"}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-rose-100">
          <div className="text-xs font-black uppercase text-slate-400">
            Channels
          </div>
          <div className="mt-2 font-black text-slate-950">
            {item.channels.length ? item.channels.join(", ") : "Suppressed"}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-gradient-to-r from-rose-50 to-purple-50 p-4">
        <div className="text-xs font-black uppercase text-slate-400">
          Why Slice ranked it this way
        </div>
        <ul className="mt-3 space-y-2">
          {item.reasons.map((reason) => (
            <li key={reason} className="text-sm font-semibold text-slate-600">
              • {reason}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
        {item.complianceLabel}
      </div>

      {item.link ? (
        <a
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white"
        >
          Open source item
        </a>
      ) : null}
    </article>
  );
}

export default function IntelligenceScannerPage() {
  const [loading, setLoading] = useState(false);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [error, setError] = useState("");

  async function runScan() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/intelligence/scan", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Scan failed with HTTP ${response.status}`);
      }

      const data = (await response.json()) as ScanResponse;
      setScan(data);
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "The intelligence scan failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ffe4e6,_transparent_32%),radial-gradient(circle_at_top_right,_#fbcfe8,_transparent_26%),radial-gradient(circle_at_bottom_left,_#fecaca,_transparent_24%),linear-gradient(135deg,_#fff7f8,_#fff1f2,_#ffe4e6,_#fff5f6)] px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/80 bg-white/75 p-5 shadow-xl shadow-rose-200/40 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <Logo />

          <div className="flex flex-wrap gap-3">
            <a
              href="/"
              className="rounded-2xl bg-white px-4 py-3 font-black text-slate-900 ring-1 ring-rose-100 shadow-sm"
            >
              Back to Slice
            </a>
            <button
              onClick={runScan}
              disabled={loading}
              className="rounded-2xl bg-gradient-to-r from-rose-500 via-rose-600 to-purple-800 px-5 py-3 font-black text-white shadow-lg shadow-purple-200 disabled:opacity-60"
            >
              {loading ? "Scanning free sources..." : "Run Intelligence Scan"}
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-xl shadow-rose-200/40 backdrop-blur-xl">
            <Pill color="rose">Free-source intelligence layer</Pill>
            <h1 className="mt-4 max-w-4xl text-5xl font-black leading-tight tracking-tight">
              Slice now scores headlines before bothering the user.
            </h1>
            <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-600">
              This scanner pulls from permitted free/public RSS sources, removes
              duplicates, checks relevance against the user profile, scores
              materiality, and only marks high-scoring stories as alert candidates.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl bg-gradient-to-br from-white to-rose-50 p-5 ring-1 ring-rose-100">
                <div className="text-sm font-black uppercase text-rose-500">
                  Alerts
                </div>
                <div className="mt-2 text-3xl font-black">
                  {scan?.alertCandidates.length ?? "—"}
                </div>
              </div>
              <div className="rounded-3xl bg-gradient-to-br from-white to-rose-50 p-5 ring-1 ring-rose-100">
                <div className="text-sm font-black uppercase text-rose-500">
                  Digest
                </div>
                <div className="mt-2 text-3xl font-black">
                  {scan?.digestCandidates.length ?? "—"}
                </div>
              </div>
              <div className="rounded-3xl bg-gradient-to-br from-white to-rose-50 p-5 ring-1 ring-rose-100">
                <div className="text-sm font-black uppercase text-rose-500">
                  Suppressed
                </div>
                <div className="mt-2 text-3xl font-black">
                  {scan?.suppressed.length ?? "—"}
                </div>
              </div>
              <div className="rounded-3xl bg-gradient-to-br from-white to-rose-50 p-5 ring-1 ring-rose-100">
                <div className="text-sm font-black uppercase text-rose-500">
                  Sources
                </div>
                <div className="mt-2 text-3xl font-black">
                  {scan?.sources.length ?? "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-purple-100 bg-gradient-to-br from-slate-950 via-purple-900 to-rose-700 p-6 text-white shadow-2xl shadow-purple-200">
            <Pill color="purple">Algorithm guardrails</Pill>
            <h2 className="mt-4 text-3xl font-black">The alert gate</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/80">
              Slice should never blast users for every headline. It should alert
              only when relevance, source trust, recency, materiality, and user
              profile matching are strong enough.
            </p>

            <div className="mt-5 space-y-3">
              {[
                "Trusted source scoring",
                "Watchlist and company-name matching",
                "Materiality keyword detection",
                "Recency weighting",
                "Noise and sponsored-content penalty",
                "Compliance-safe alert copy",
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-white/10 p-4 text-sm font-black">
                  ✓ {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-[2rem] border border-rose-200 bg-rose-50 p-5 font-bold text-rose-700">
            {error}
          </div>
        ) : null}

        {scan ? (
          <>
            <section className="mt-6 rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-xl shadow-rose-200/40 backdrop-blur-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Source Health</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Last scan: {new Date(scan.scannedAt).toLocaleString()}
                  </p>
                </div>
                <Pill color="dark">
                  {scan.sources.filter((source) => source.ok).length} /{" "}
                  {scan.sources.length} sources online
                </Pill>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {scan.sources.map((source) => (
                  <div
                    key={source.id}
                    className="rounded-3xl bg-gradient-to-br from-white to-rose-50 p-4 ring-1 ring-rose-100"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black">{source.name}</div>
                      <Pill color={source.ok ? "green" : "rose"}>
                        {source.ok ? "Online" : "Issue"}
                      </Pill>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-500">
                      {source.ok
                        ? `${source.fetched} items fetched`
                        : source.error ?? "Unavailable"}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black">Alert Candidates</h2>
                  <p className="text-sm font-semibold text-slate-500">
                    These cleared Slice’s strict alert threshold.
                  </p>
                </div>
                <Pill color="rose">{scan.alertCandidates.length} alerts</Pill>
              </div>

              <div className="grid gap-5">
                {scan.alertCandidates.length ? (
                  scan.alertCandidates.map((item) => (
                    <NewsCard key={item.id} item={item} />
                  ))
                ) : (
                  <div className="rounded-[2rem] border border-white/80 bg-white/80 p-8 text-center font-bold text-slate-500 shadow-xl shadow-rose-200/40">
                    No stories cleared the instant-alert threshold this scan.
                    That is a good thing: Slice should avoid noisy alerts.
                  </div>
                )}
              </div>
            </section>

            <section className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black">Digest Candidates</h2>
                  <p className="text-sm font-semibold text-slate-500">
                    Worth seeing later, but not urgent enough for SMS.
                  </p>
                </div>
                <Pill color="purple">{scan.digestCandidates.length} digest</Pill>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {scan.digestCandidates.slice(0, 8).map((item) => (
                  <NewsCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="mt-6 rounded-[2rem] border border-white/80 bg-white/80 p-8 text-center shadow-xl shadow-rose-200/40">
            <div className="text-4xl">🛰️</div>
            <h2 className="mt-4 text-2xl font-black">
              Run the first Slice intelligence scan.
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
              This will scan the free-source adapters, rank the items, and show
              which ones deserve alerts.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}