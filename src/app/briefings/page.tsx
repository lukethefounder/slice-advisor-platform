"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type ClientProfile = {
  id: string;
  fullName: string;
  householdName: string | null;
  portfolioValue: string | null;
  riskProfile: string;
};

type BriefingReport = {
  id: string;
  title: string;
  audience: string;
  briefType: string;
  executiveSummary: string;
  marketSummary: string;
  alertSummary: string;
  portfolioSummary: string;
  alternativeSummary: string;
  riskSummary: string;
  actionItemsJson: string;
  sourceItemsJson: string;
  status: string;
  createdAt: string;
  client: ClientProfile | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseJsonList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[2rem] border border-white/10 bg-zinc-950/70 shadow-xl shadow-emerald-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "red",
}: {
  children: ReactNode;
  tone?: "red" | "green" | "amber" | "slate" | "purple";
}) {
  const tones = {
    red: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-950 via-zinc-950 to-emerald-700 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-emerald-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-emerald-700" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">
          Briefing Center
        </div>
      </div>
    </div>
  );
}

function reportToText(report: BriefingReport) {
  const actionItems = parseJsonList(report.actionItemsJson);
  const sourceItems = parseJsonList(report.sourceItemsJson);

  return [
    report.title,
    "",
    `Audience: ${report.audience}`,
    `Brief Type: ${report.briefType}`,
    `Created: ${new Date(report.createdAt).toLocaleString()}`,
    report.client ? `Client: ${report.client.fullName}` : "",
    "",
    "EXECUTIVE SUMMARY",
    report.executiveSummary,
    "",
    "MARKET SUMMARY",
    report.marketSummary,
    "",
    "ALERT SUMMARY",
    report.alertSummary,
    "",
    "PORTFOLIO SUMMARY",
    report.portfolioSummary,
    "",
    "ALTERNATIVE INVESTMENTS",
    report.alternativeSummary,
    "",
    "RISK SUMMARY",
    report.riskSummary,
    "",
    "ACTION ITEMS",
    ...actionItems.map((item, index) => `${index + 1}. ${String(item)}`),
    "",
    "SOURCE ITEMS",
    ...sourceItems.map((item, index) => {
      if (typeof item === "object" && item !== null) {
        return `${index + 1}. ${JSON.stringify(item)}`;
      }

      return `${index + 1}. ${String(item)}`;
    }),
    "",
    "DISCLOSURE",
    "This briefing is market intelligence and workflow support. It is not a buy/sell recommendation.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export default function BriefingsPage() {
  const [reports, setReports] = useState<BriefingReport[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    audience: "Investor",
    briefType: "Daily",
    clientId: "",
  });

  const selectedReport = useMemo(() => {
    return reports.find((report) => report.id === selectedReportId) ?? reports[0];
  }, [reports, selectedReportId]);

  async function loadData() {
    const [briefingsResponse, clientsResponse] = await Promise.all([
      fetch("/api/briefings", { cache: "no-store" }),
      fetch("/api/clients", { cache: "no-store" }),
    ]);

    if (briefingsResponse.ok) {
      const data = await briefingsResponse.json();
      setReports(data.reports ?? []);

      if (!selectedReportId && data.reports?.[0]) {
        setSelectedReportId(data.reports[0].id);
      }
    }

    if (clientsResponse.ok) {
      const data = await clientsResponse.json();
      setClients(data.clients ?? []);
    }
  }

  async function generateBriefing() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/briefings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audience: form.audience,
          briefType: form.briefType,
          clientId: form.clientId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Could not generate briefing.");
        return;
      }

      setMessage("Briefing generated.");
      await loadData();
      setSelectedReportId(data.report.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not generate briefing."
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteReport(reportId: string) {
    await fetch(`/api/briefings/${reportId}`, {
      method: "DELETE",
    });

    await loadData();
  }

  async function copyReport(report: BriefingReport) {
    await navigator.clipboard.writeText(reportToText(report));
    setMessage("Briefing copied to clipboard.");
  }

  function downloadReport(report: BriefingReport) {
    const text = reportToText(report);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${report.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const actionItems = selectedReport
    ? parseJsonList(selectedReport.actionItemsJson)
    : [];

  const sourceItems = selectedReport
    ? parseJsonList(selectedReport.sourceItemsJson)
    : [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(4,120,87,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-xl shadow-emerald-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <Logo />

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/"
              className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
            >
              Main App
            </a>

            <a
              href="/investor"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Investor
            </a>

            <a
              href="/wealth"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Wealth
            </a>

            <a
              href="/triage"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Triage
            </a>
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">
            {message}
          </div>
        ) : null}

        <section className="mt-6 grid gap-5 md:grid-cols-4">
          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Reports</div>
            <div className="mt-1 text-4xl font-black">{reports.length}</div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Clients</div>
            <div className="mt-1 text-4xl font-black">{clients.length}</div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Selected Type</div>
            <div className="mt-1 text-2xl font-black">{form.briefType}</div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Audience</div>
            <div className="mt-1 text-2xl font-black">{form.audience}</div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <Card className="p-6">
              <h1 className="text-3xl font-black">Generate Briefing</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Generate a local, deterministic briefing using alerts, triage,
                research notes, goals, watchlists, clients, holdings, and risk
                reviews.
              </p>

              <div className="mt-5 grid gap-4">
                <label>
                  <span className="text-xs font-black uppercase text-slate-500">
                    Audience
                  </span>
                  <select
                    value={form.audience}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        audience: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                  >
                    <option>Investor</option>
                    <option>Advisor</option>
                    <option>Client</option>
                  </select>
                </label>

                <label>
                  <span className="text-xs font-black uppercase text-slate-500">
                    Brief Type
                  </span>
                  <select
                    value={form.briefType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        briefType: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                  >
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Client Meeting</option>
                    <option>Portfolio Review</option>
                  </select>
                </label>

                <label>
                  <span className="text-xs font-black uppercase text-slate-500">
                    Client, optional
                  </span>
                  <select
                    value={form.clientId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        clientId: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                  >
                    <option value="">No specific client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.fullName}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  onClick={generateBriefing}
                  disabled={loading}
                  className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-5 py-4 font-black text-white shadow-lg shadow-emerald-950/40 disabled:opacity-60"
                >
                  {loading ? "Generating..." : "Generate Briefing"}
                </button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-black">Report History</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Saved briefing reports.
              </p>

              <div className="mt-5 space-y-3">
                {reports.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                    No briefing reports yet.
                  </div>
                ) : (
                  reports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReportId(report.id)}
                      className={cx(
                        "w-full rounded-3xl border p-4 text-left transition",
                        selectedReport?.id === report.id
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className="font-black">{report.title}</div>
                      <div className="mt-1 text-xs font-bold text-slate-500">
                        {report.audience} · {report.briefType} ·{" "}
                        {new Date(report.createdAt).toLocaleString()}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>

          <Card className="p-6">
            {selectedReport ? (
              <>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Pill tone="red">{selectedReport.audience}</Pill>
                      <Pill tone="amber">{selectedReport.briefType}</Pill>
                      {selectedReport.client ? (
                        <Pill tone="green">{selectedReport.client.fullName}</Pill>
                      ) : null}
                    </div>

                    <h1 className="mt-4 text-3xl font-black">
                      {selectedReport.title}
                    </h1>

                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      Generated {new Date(selectedReport.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => copyReport(selectedReport)}
                      className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
                    >
                      Copy
                    </button>

                    <button
                      onClick={() => downloadReport(selectedReport)}
                      className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
                    >
                      Download TXT
                    </button>

                    <button
                      onClick={() => deleteReport(selectedReport.id)}
                      className="rounded-2xl bg-emerald-500/10 px-4 py-3 font-black text-emerald-300 ring-1 ring-emerald-500/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-6 space-y-5">
                  {[
                    ["Executive Summary", selectedReport.executiveSummary],
                    ["Market Summary", selectedReport.marketSummary],
                    ["Alert Summary", selectedReport.alertSummary],
                    ["Portfolio Summary", selectedReport.portfolioSummary],
                    ["Alternative Investments", selectedReport.alternativeSummary],
                    ["Risk Summary", selectedReport.riskSummary],
                  ].map(([title, body]) => (
                    <section
                      key={title}
                      className="rounded-3xl border border-white/10 bg-white/5 p-5"
                    >
                      <h2 className="text-xl font-black">{title}</h2>
                      <p className="mt-3 text-sm leading-7 text-slate-400">
                        {body}
                      </p>
                    </section>
                  ))}

                  <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-black">Action Items</h2>

                    <div className="mt-3 space-y-2">
                      {actionItems.length ? (
                        actionItems.map((item, index) => (
                          <div
                            key={`${String(item)}-${index}`}
                            className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm font-semibold text-slate-300"
                          >
                            {index + 1}. {String(item)}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">
                          No action items stored.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-black">Source Items</h2>

                    <div className="mt-3 space-y-2">
                      {sourceItems.length ? (
                        sourceItems.map((item, index) => (
                          <div
                            key={`${JSON.stringify(item)}-${index}`}
                            className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm font-semibold text-slate-300"
                          >
                            {typeof item === "object" && item !== null
                              ? JSON.stringify(item)
                              : String(item)}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">
                          No source items stored.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5">
                    <h2 className="text-xl font-black text-amber-200">
                      Disclosure
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-amber-100/80">
                      This briefing is market intelligence and workflow support.
                      It is not a buy/sell recommendation. Suitability, risk
                      tolerance, liquidity needs, tax considerations, and legal
                      obligations should be reviewed before making decisions.
                    </p>
                  </section>
                </div>
              </>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
                No report selected. Generate a briefing first.
              </div>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}