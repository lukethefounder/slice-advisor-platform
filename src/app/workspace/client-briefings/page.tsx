"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";
type ConsoleView = "builder" | "approval" | "drafts" | "quality";

type Draft = {
  id: string;
  clientName: string | null;
  channel: string;
  audience: string;
  title: string;
  body: string;
  status: string;
  tone: string;
  createdAt: string;
  updatedAt: string;
  sourceSummary?: {
    symbols?: string[];
    sourceEvidence?: Array<{
      type: string;
      title: string;
      sourceName: string;
      sourceUrl: string | null;
      score: number;
      summary: string;
    }>;
    investmentGrade?: {
      grade: string;
      label: string;
      explanation: string;
    };
    ai?: {
      polished?: boolean;
      provider?: string;
      status?: string;
      error?: string | null;
    };
  };
  complianceNotes?: string[];
};

type Approval = {
  id: string;
  title: string;
  actionType: string;
  riskLevel: string;
  summary: string;
  status: string;
  requestedBy: string | null;
  approvedBy: string | null;
  approvalNotes: string | null;
  decidedAt: string | null;
  createdAt: string;
  payload?: {
    draftIds?: string[];
    symbols?: string[];
    sourceTitle?: string;
    sourceUrl?: string | null;
  };
};

type ConsoleData = {
  drafts: Draft[];
  approvals: Approval[];
};

type BriefingForm = {
  symbols: string;
  holdingQuery: string;
  briefingTitle: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceName: string;
  researchSummary: string;
  advisorMessage: string;
  tone: string;
  includeAllMatchingClients: boolean;
  objective: string;
  urgency: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneFor(value: string | null | undefined): Tone {
  const lower = String(value ?? "").toLowerCase();

  if (
    lower.includes("failed") ||
    lower.includes("high") ||
    lower.includes("critical") ||
    lower.includes("rejected") ||
    lower.includes("risk")
  ) {
    return "red";
  }

  if (
    lower.includes("sent") ||
    lower.includes("approved") ||
    lower.includes("delivered") ||
    lower.includes("complete") ||
    lower.includes("polished")
  ) {
    return "green";
  }

  if (
    lower.includes("pending") ||
    lower.includes("draft") ||
    lower.includes("approval") ||
    lower.includes("simulated") ||
    lower.includes("review")
  ) {
    return "amber";
  }

  if (lower.includes("client") || lower.includes("briefing") || lower.includes("advisor")) return "purple";
  if (lower.includes("ai") || lower.includes("email") || lower.includes("source")) return "cyan";

  return "slate";
}

function scoreTone(score: number): Tone {
  if (score >= 85) return "green";
  if (score >= 70) return "cyan";
  if (score >= 55) return "amber";
  return "red";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const minutes = Math.round((Date.now() - date.getTime()) / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

function uniqueSymbolsFromDrafts(drafts: Draft[]) {
  const symbols = new Set<string>();

  drafts.forEach((draft) => {
    draft.sourceSummary?.symbols?.forEach((symbol) => symbols.add(symbol));
  });

  return Array.from(symbols);
}

function draftQualityScore(form: BriefingForm) {
  let score = 25;

  const symbols = form.symbols.split(/[,;\s]+/).filter(Boolean);
  if (symbols.length) score += 12;
  if (symbols.length > 1) score += 6;
  if (form.sourceTitle.trim()) score += 12;
  if (form.sourceUrl.trim()) score += 12;
  if (form.sourceName.trim()) score += 6;
  if (form.researchSummary.trim().length >= 80) score += 18;
  if (form.advisorMessage.trim().length >= 40) score += 8;
  if (form.briefingTitle.trim()) score += 5;
  if (form.includeAllMatchingClients) score += 4;
  if (form.objective.trim()) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function draftQualityIssues(form: BriefingForm) {
  const issues: string[] = [];
  const symbols = form.symbols.split(/[,;\s]+/).filter(Boolean);

  if (!symbols.length) issues.push("Add at least one stock, ETF, fund, or security symbol.");
  if (!form.sourceTitle.trim()) issues.push("Add a source title so the briefing has clear evidence context.");
  if (!form.sourceUrl.trim()) issues.push("Add a source URL so the advisor can verify the information.");
  if (!form.sourceName.trim()) issues.push("Add a source name for credibility review.");
  if (form.researchSummary.trim().length < 80) {
    issues.push("Add a deeper research summary explaining what happened, why it matters, and what clients should know.");
  }
  if (!form.advisorMessage.trim()) {
    issues.push("Add a personal advisor message to make the briefing feel human and client-specific.");
  }

  return issues;
}

function bodyWordCount(body: string) {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

function readableStatusScore(drafts: Draft[], approvals: Approval[]) {
  const total = drafts.length;
  if (!total) return 0;

  const sent = drafts.filter((draft) => toneFor(draft.status) === "green").length;
  const pending = approvals.filter((approval) => approval.status === "Pending").length;
  const sourced = drafts.filter((draft) => (draft.sourceSummary?.sourceEvidence?.length ?? 0) > 0).length;
  const withCompliance = drafts.filter((draft) => (draft.complianceNotes?.length ?? 0) > 0).length;

  return Math.min(
    100,
    Math.round(
      (sent / total) * 25 +
        (sourced / total) * 25 +
        (withCompliance / total) * 25 +
        (pending ? 10 : 25)
    )
  );
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const tones: Record<Tone, string> = {
    red: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/82 p-5 shadow-xl shadow-emerald-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Panel({
  children,
  className = "",
  tone = "slate",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  const glows: Record<Tone, string> = {
    red: "from-emerald-500/16",
    green: "from-emerald-500/16",
    amber: "from-amber-500/16",
    purple: "from-purple-500/16",
    cyan: "from-cyan-500/16",
    slate: "from-slate-400/8",
  };

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.052] p-4 shadow-lg shadow-black/10",
        className
      )}
    >
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">{children}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: Tone;
}) {
  const glows: Record<Tone, string> = {
    red: "from-emerald-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative min-h-[112px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function ScoreBar({ value, tone = "cyan" }: { value: number; tone?: Tone }) {
  const fills: Record<Tone, string> = {
    red: "from-emerald-700 to-emerald-400",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    purple: "from-purple-700 to-purple-300",
    slate: "from-slate-700 to-slate-300",
    cyan: "from-cyan-700 to-cyan-300",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/50">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r", fills[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function SourceEvidencePanel({ draft }: { draft: Draft }) {
  const evidence = draft.sourceSummary?.sourceEvidence ?? [];
  const symbols = draft.sourceSummary?.symbols ?? [];
  const grade = draft.sourceSummary?.investmentGrade;
  const ai = draft.sourceSummary?.ai;

  return (
    <div className="grid gap-3 xl:grid-cols-3">
      <Panel tone="cyan" className="bg-black/35">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
          Source evidence
        </div>
        <div className="mt-2 text-2xl font-black text-white">{evidence.length}</div>
        <div className="mt-1 text-xs text-slate-500">Attached source item(s)</div>

        <div className="mt-3 grid gap-2">
          {evidence.slice(0, 3).map((item, index) => (
            <div key={`${draft.id}-source-${index}`} className="rounded-2xl border border-white/10 bg-black/35 p-3">
              <div className="line-clamp-2 text-xs font-black text-white">{item.title}</div>
              <div className="mt-1 flex flex-wrap gap-2">
                <Pill tone="cyan">{item.sourceName || "Source"}</Pill>
                <Pill tone={scoreTone(item.score || 0)}>Score {item.score || 0}</Pill>
              </div>
              {item.sourceUrl ? (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-xs font-black text-cyan-200 hover:text-cyan-100"
                >
                  Open source →
                </a>
              ) : null}
            </div>
          ))}

          {!evidence.length ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-4 text-xs font-bold text-slate-500">
              No evidence stored.
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel tone="purple" className="bg-black/35">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-purple-300">
          Security coverage
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {symbols.length ? (
            symbols.map((symbol) => (
              <Pill key={`${draft.id}-${symbol}`} tone="purple">
                {symbol}
              </Pill>
            ))
          ) : (
            <Pill tone="slate">No symbols</Pill>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Investment grade
          </div>
          <div className="mt-1 text-xl font-black text-white">
            {grade?.grade ? `Grade ${grade.grade}` : "Not graded"}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {grade?.explanation || "No grading explanation stored."}
          </p>
        </div>
      </Panel>

      <Panel tone={ai?.status === "success" || ai?.polished ? "green" : "amber"} className="bg-black/35">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
          AI polish
        </div>
        <div className="mt-2 text-2xl font-black text-white">
          {ai?.polished ? "Polished" : "Review"}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {ai?.provider || "AI provider not stored"}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Status
          </div>
          <div className="mt-1 text-sm font-black text-white">
            {ai?.status || "Unknown"}
          </div>
          {ai?.error ? (
            <p className="mt-2 text-xs leading-5 text-emerald-200">{ai.error}</p>
          ) : (
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Draft still requires advisor approval before delivery.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function ApprovalCard({
  approval,
  loading,
  onApprove,
}: {
  approval: Approval;
  loading: boolean;
  onApprove: (approvalId: string) => void;
}) {
  return (
    <Panel tone={toneFor(approval.riskLevel)} className="bg-black/35">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Pill tone={toneFor(approval.status)}>{approval.status}</Pill>
            <Pill tone={toneFor(approval.riskLevel)}>{approval.riskLevel}</Pill>
            <Pill tone="cyan">{approval.actionType}</Pill>
            <Pill tone="slate">{relativeTime(approval.createdAt)}</Pill>
          </div>

          <h3 className="mt-3 text-2xl font-black text-white">{approval.title}</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{approval.summary}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {approval.payload?.symbols?.length ? (
              <Pill tone="purple">{approval.payload.symbols.join(", ")}</Pill>
            ) : null}
            {approval.payload?.draftIds?.length ? (
              <Pill tone="cyan">{approval.payload.draftIds.length} draft(s)</Pill>
            ) : null}
            {approval.payload?.sourceTitle ? (
              <Pill tone="amber">{approval.payload.sourceTitle}</Pill>
            ) : null}
          </div>
        </div>

        <div className="grid min-w-[250px] gap-3">
          <MetricCard
            label="Risk Level"
            value={approval.riskLevel}
            helper="Advisor gate"
            tone={toneFor(approval.riskLevel)}
          />
          <button
            type="button"
            onClick={() => onApprove(approval.id)}
            disabled={loading}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20 disabled:opacity-50"
          >
            Approve & Send
          </button>
        </div>
      </div>
    </Panel>
  );
}

function DraftCard({ draft }: { draft: Draft }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyDraft() {
    await navigator.clipboard.writeText(draft.body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Pill tone={toneFor(draft.status)}>{draft.status}</Pill>
            <Pill tone="purple">{draft.clientName || "Client"}</Pill>
            <Pill tone="cyan">{draft.channel}</Pill>
            <Pill tone="slate">{relativeTime(draft.createdAt)}</Pill>
            {draft.sourceSummary?.investmentGrade?.grade ? (
              <Pill tone="amber">Grade {draft.sourceSummary.investmentGrade.grade}</Pill>
            ) : null}
          </div>

          <h3 className="mt-3 text-xl font-black text-white">{draft.title}</h3>
          <div className="mt-1 text-xs font-bold text-slate-500">
            {formatDate(draft.createdAt)} · {bodyWordCount(draft.body)} words · Tone: {draft.tone || "Default"}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={copyDraft}
            className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-white hover:bg-white/10"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      <div
        className={cx(
          "mt-4 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-slate-300",
          expanded ? "max-h-[760px]" : "max-h-[220px]"
        )}
      >
        {draft.body}
      </div>

      {expanded ? (
        <div className="mt-4">
          <SourceEvidencePanel draft={draft} />
        </div>
      ) : null}

      {draft.complianceNotes?.length ? (
        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
            Compliance Notes
          </div>
          <ul className="mt-2 grid gap-1 text-xs leading-5 text-amber-100/80">
            {draft.complianceNotes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function QualityPanel({
  form,
  drafts,
  approvals,
}: {
  form: BriefingForm;
  drafts: Draft[];
  approvals: Approval[];
}) {
  const qualityScore = draftQualityScore(form);
  const issues = draftQualityIssues(form);
  const statusScore = readableStatusScore(drafts, approvals);

  return (
    <div className="grid gap-5">
      <Panel tone={scoreTone(qualityScore)} className="bg-black/35">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Draft builder readiness
            </div>
            <h2 className="mt-2 text-3xl font-black text-white">{qualityScore}/100</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              This score estimates whether the draft pack has enough context, source evidence, symbols, and advisor language to produce high-quality client-ready communication.
            </p>
          </div>

          <div className="grid min-w-[260px] gap-3">
            <MetricCard label="Drafts" value={drafts.length} helper="Recent" tone="purple" />
            <MetricCard label="Console Health" value={`${statusScore}/100`} helper="Sources + approval flow" tone={scoreTone(statusScore)} />
          </div>
        </div>

        <div className="mt-4">
          <ScoreBar value={qualityScore} tone={scoreTone(qualityScore)} />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel tone="green" className="bg-black/35">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
            What is strong
          </div>
          <div className="mt-3 grid gap-2">
            {[
              form.symbols.trim() ? "Security symbols are defined." : null,
              form.sourceTitle.trim() ? "Source title gives the advisor clear context." : null,
              form.sourceUrl.trim() ? "Source URL supports verification." : null,
              form.researchSummary.trim().length >= 80 ? "Research summary is substantive." : null,
              form.advisorMessage.trim() ? "Advisor message adds a human layer." : null,
              form.includeAllMatchingClients ? "Matching-client generation is enabled." : null,
            ]
              .filter(Boolean)
              .map((item) => (
                <div key={String(item)} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-sm leading-6 text-slate-300">
                  {item}
                </div>
              ))}
          </div>
        </Panel>

        <Panel tone="red" className="bg-black/35">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
            Improve before generation
          </div>
          <div className="mt-3 grid gap-2">
            {issues.length ? (
              issues.map((issue) => (
                <div key={issue} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-50/80">
                  {issue}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-50/80">
                No major gaps detected. Draft pack is ready to generate.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default function ClientBriefingsPage() {
  const [data, setData] = useState<ConsoleData>({ drafts: [], approvals: [] });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeView, setActiveView] = useState<ConsoleView>("builder");

  const [form, setForm] = useState<BriefingForm>({
    symbols: "NVDA",
    holdingQuery: "",
    briefingTitle: "",
    sourceTitle: "",
    sourceUrl: "",
    sourceName: "",
    researchSummary: "",
    advisorMessage: "",
    tone: "Calm, polished, professional, reassuring, and easy for a client to understand",
    includeAllMatchingClients: true,
    objective: "Reassure clients, explain what happened, and provide balanced advisor context without making a recommendation.",
    urgency: "Normal",
  });

  const pendingApprovals = useMemo(
    () => data.approvals.filter((approval) => approval.status === "Pending"),
    [data.approvals]
  );

  const recentDrafts = useMemo(
    () => data.drafts.slice(0, 40),
    [data.drafts]
  );

  const approvedApprovals = useMemo(
    () => data.approvals.filter((approval) => approval.status === "Approved"),
    [data.approvals]
  );

  const failedApprovals = useMemo(
    () => data.approvals.filter((approval) => toneFor(approval.status) === "red"),
    [data.approvals]
  );

  const uniqueSymbols = useMemo(() => uniqueSymbolsFromDrafts(data.drafts), [data.drafts]);

  const qualityScore = draftQualityScore(form);
  const consoleHealth = readableStatusScore(data.drafts, data.approvals);

  async function loadConsole() {
    const response = await fetch("/api/client-briefings", {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to load client briefing console.");
      return;
    }

    setData(payload);
  }

  async function createDrafts(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/client-briefings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "create-client-briefing-drafts",
        },
        body: JSON.stringify({
          action: "createDrafts",
          ...form,
          symbols: form.symbols.split(/[,;\s]+/).filter(Boolean),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to create client briefing drafts.");
        return;
      }

      setMessage(payload.message ?? "Client briefing drafts created.");
      setActiveView("approval");
      await loadConsole();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create client briefing drafts.");
    } finally {
      setLoading(false);
    }
  }

  async function approveAndSend(approvalId: string) {
    const notes = window.prompt(
      "Approval note for compliance trail:",
      "Reviewed source context, suitability language, and client-facing tone. Approved by advisor for delivery."
    );

    if (notes === null) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/client-briefings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "approve-client-briefing-email",
        },
        body: JSON.stringify({
          action: "approveAndSend",
          approvalId,
          approvalNotes: notes,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to approve and send briefing.");
        return;
      }

      setMessage(
        `Approval processed. Delivered: ${payload.delivered}. Simulated: ${payload.simulated}. Failed: ${payload.failed}.`
      );

      await loadConsole();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to approve and send briefing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConsole();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_30%),linear-gradient(135deg,_#030712,_#050505,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-zinc-950/78 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.26),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.16),transparent_26%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="red">Reports</Pill>
                <Pill tone="purple">Client Briefings</Pill>
                <Pill tone="cyan">Source-backed</Pill>
                <Pill tone="green">Advisor approval required</Pill>
              </div>

              <h1 className="mt-5 max-w-6xl text-4xl font-black tracking-tight md:text-6xl">
                Client briefing command center.
              </h1>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
                Generate client-specific briefing packs from holdings, symbols, source evidence, and advisor context. Slice drafts polished client emails, attaches source and compliance context, and queues everything for advisor approval before delivery.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <a href="/workspace?tab=briefings" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20">
                ← Reports
              </a>
              <a href="/workspace" className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white hover:bg-white/10">
                Workspace
              </a>
              <a href="/workspace/personal-bot" className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20">
                AI Studio
              </a>
              <a href="/security" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-500/20">
                Security
              </a>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <MetricCard label="Drafts" value={data.drafts.length} helper="Recent generated" tone="purple" />
            <MetricCard label="Pending" value={pendingApprovals.length} helper="Awaiting advisor" tone={pendingApprovals.length ? "amber" : "green"} />
            <MetricCard label="Approved" value={approvedApprovals.length} helper="Processed approvals" tone="green" />
            <MetricCard label="Failures" value={failedApprovals.length} helper="Needs review" tone={failedApprovals.length ? "red" : "slate"} />
            <MetricCard label="Symbols" value={uniqueSymbols.length} helper={uniqueSymbols.slice(0, 3).join(", ") || "No symbols"} tone="cyan" />
            <MetricCard label="Builder Score" value={`${qualityScore}/100`} helper="Current form" tone={scoreTone(qualityScore)} />
            <MetricCard label="Console Health" value={`${consoleHealth}/100`} helper="Sources + approvals" tone={scoreTone(consoleHealth)} />
            <MetricCard label="Last Draft" value={relativeTime(data.drafts[0]?.createdAt)} helper={data.drafts[0]?.clientName || "No draft"} tone="slate" />
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
            {message}
          </div>
        ) : null}

        <Card className="p-3">
          <div className="grid gap-2 md:grid-cols-4">
            {[
              ["builder", "Briefing Builder", "Create drafts", "cyan"],
              ["approval", "Approval Queue", "Approve/send", "amber"],
              ["drafts", "Draft Library", "Review output", "purple"],
              ["quality", "Quality Control", "Source + compliance", "green"],
            ].map(([key, label, helper, tone]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveView(key as ConsoleView)}
                className={cx(
                  "rounded-2xl px-4 py-3 text-left transition",
                  activeView === key
                    ? "bg-white text-slate-950 shadow-lg shadow-black/20"
                    : "border border-white/10 bg-white/[0.045] text-white hover:bg-white/10"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-black">{label}</div>
                  <span
                    className={cx(
                      "h-2 w-2 rounded-full",
                      tone === "red"
                        ? "bg-emerald-400"
                        : tone === "cyan"
                          ? "bg-cyan-400"
                          : tone === "purple"
                            ? "bg-purple-400"
                            : tone === "green"
                              ? "bg-emerald-400"
                              : "bg-amber-400"
                    )}
                  />
                </div>
                <div className="mt-1 text-[10px] font-bold text-slate-500">{helper}</div>
              </button>
            ))}
          </div>
        </Card>

        {activeView === "builder" ? (
          <section className="grid gap-5 xl:grid-cols-[520px_minmax(0,1fr)]">
            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                Generate Drafts
              </div>
              <h2 className="mt-2 text-2xl font-black">Create a client briefing pack</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Match clients by holdings, generate polished briefings, attach source evidence, and create an approval item before any email is delivered.
              </p>

              <form onSubmit={createDrafts} className="mt-5 grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Stock or fund symbols
                    </span>
                    <input
                      value={form.symbols}
                      onChange={(event) => setForm((current) => ({ ...current, symbols: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
                      placeholder="NVDA, AAPL, SPY"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Optional holding search
                    </span>
                    <input
                      value={form.holdingQuery}
                      onChange={(event) => setForm((current) => ({ ...current, holdingQuery: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
                      placeholder="technology fund, growth ETF, semiconductor"
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Briefing title
                  </span>
                  <input
                    value={form.briefingTitle}
                    onChange={(event) => setForm((current) => ({ ...current, briefingTitle: event.target.value }))}
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
                    placeholder="Example: Market update for semiconductor exposure"
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Source title
                    </span>
                    <input
                      value={form.sourceTitle}
                      onChange={(event) => setForm((current) => ({ ...current, sourceTitle: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
                      placeholder="Company guidance update, earnings report, SEC filing..."
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Source name
                    </span>
                    <input
                      value={form.sourceName}
                      onChange={(event) => setForm((current) => ({ ...current, sourceName: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
                      placeholder="SEC, Reuters, Company IR, CNBC..."
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Source URL
                  </span>
                  <input
                    value={form.sourceUrl}
                    onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))}
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
                    placeholder="https://..."
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Research backing / advisor context
                  </span>
                  <textarea
                    value={form.researchSummary}
                    onChange={(event) => setForm((current) => ({ ...current, researchSummary: event.target.value }))}
                    className="min-h-[140px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
                    placeholder="Summarize what happened, why it matters, what is uncertain, and how clients should think about it..."
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Advisor message
                  </span>
                  <textarea
                    value={form.advisorMessage}
                    onChange={(event) => setForm((current) => ({ ...current, advisorMessage: event.target.value }))}
                    className="min-h-[110px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
                    placeholder="Optional personal note from the advisor..."
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Communication objective
                  </span>
                  <textarea
                    value={form.objective}
                    onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))}
                    className="min-h-[90px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
                    placeholder="What should this message accomplish?"
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Tone
                    </span>
                    <input
                      value={form.tone}
                      onChange={(event) => setForm((current) => ({ ...current, tone: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Urgency
                    </span>
                    <select
                      value={form.urgency}
                      onChange={(event) => setForm((current) => ({ ...current, urgency: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 focus:ring-2"
                    >
                      <option>Low</option>
                      <option>Normal</option>
                      <option>High</option>
                      <option>Critical</option>
                    </select>
                  </label>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-slate-300">
                  Include all matching clients
                  <input
                    type="checkbox"
                    checked={form.includeAllMatchingClients}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        includeAllMatchingClients: event.target.checked,
                      }))
                    }
                  />
                </label>

                <button
                  disabled={loading}
                  className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/40 disabled:opacity-50"
                >
                  {loading ? "Working..." : "Generate Advisor-Approval Drafts"}
                </button>
              </form>
            </Card>

            <div className="grid gap-5">
              <QualityPanel form={form} drafts={data.drafts} approvals={data.approvals} />

              <Panel tone="purple" className="bg-black/35">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-300">
                  Client communication standard
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">What this briefing center enforces</h2>

                <div className="mt-4 grid gap-3">
                  {[
                    "Client-specific: drafts are created around known holdings or a holding query.",
                    "Source-backed: source title, URL, source name, and research summary are stored with the draft context.",
                    "Advisor-approved: nothing is sent until an advisor explicitly approves the queued action.",
                    "Compliance-minded: every generated pack stores review notes and approval trail context.",
                    "Human tone: the advisor message layer keeps the briefing from sounding robotic.",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-sm leading-6 text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </section>
        ) : null}

        {activeView === "approval" ? (
          <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                Advisor Approval Queue
              </div>
              <h2 className="mt-2 text-2xl font-black">Approve and send</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                This is the final delivery gate. Review source context, suitability language, risk wording, and client-facing tone before approving.
              </p>

              <div className="mt-5 grid gap-3">
                <MetricCard label="Pending" value={pendingApprovals.length} helper="Needs advisor action" tone={pendingApprovals.length ? "amber" : "green"} />
                <MetricCard label="Approved" value={approvedApprovals.length} helper="Processed" tone="green" />
                <MetricCard label="Failed / Blocked" value={failedApprovals.length} helper="Needs review" tone={failedApprovals.length ? "red" : "slate"} />
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                  Approval checklist
                </div>
                <div className="mt-3 grid gap-2 text-sm leading-6 text-emerald-50/80">
                  <div>• Confirm the client actually holds or is relevant to the security.</div>
                  <div>• Confirm source credibility and recency.</div>
                  <div>• Confirm no recommendation or performance guarantee is implied.</div>
                  <div>• Confirm the message fits the client’s risk profile.</div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                    Pending Review
                  </div>
                  <h2 className="mt-2 text-2xl font-black">Approval queue</h2>
                </div>
                <Pill tone="amber">{pendingApprovals.length} pending</Pill>
              </div>

              <div className="grid gap-4">
                {pendingApprovals.map((approval) => (
                  <ApprovalCard
                    key={approval.id}
                    approval={approval}
                    loading={loading}
                    onApprove={approveAndSend}
                  />
                ))}

                {!pendingApprovals.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                    No pending briefing approvals.
                  </div>
                ) : null}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "drafts" ? (
          <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
                Draft Library
              </div>
              <h2 className="mt-2 text-2xl font-black">Client-ready email drafts</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Review generated drafts, copy text, inspect sources, check grades, and view compliance notes.
              </p>

              <div className="mt-5 grid gap-3">
                <MetricCard label="Drafts" value={recentDrafts.length} helper="Visible" tone="purple" />
                <MetricCard label="Unique Symbols" value={uniqueSymbols.length} helper={uniqueSymbols.slice(0, 5).join(", ") || "No symbols"} tone="cyan" />
                <MetricCard label="With Evidence" value={recentDrafts.filter((draft) => (draft.sourceSummary?.sourceEvidence?.length ?? 0) > 0).length} helper="Source-backed" tone="green" />
                <MetricCard label="With Notes" value={recentDrafts.filter((draft) => (draft.complianceNotes?.length ?? 0) > 0).length} helper="Compliance context" tone="amber" />
              </div>
            </Card>

            <Card>
              <div className="mb-4">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                  Recent Drafts
                </div>
                <h2 className="mt-2 text-2xl font-black">Draft review workspace</h2>
              </div>

              <div className="grid max-h-[1100px] gap-4 overflow-y-auto pr-2">
                {recentDrafts.map((draft) => (
                  <DraftCard key={draft.id} draft={draft} />
                ))}

                {!recentDrafts.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                    No drafts generated yet.
                  </div>
                ) : null}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "quality" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card>
              <QualityPanel form={form} drafts={data.drafts} approvals={data.approvals} />
            </Card>

            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-green-400">
                Delivery Controls
              </div>
              <h2 className="mt-2 text-2xl font-black">Production-grade client communication rules</h2>

              <div className="mt-5 grid gap-3">
                {[
                  "Every client briefing should cite the source or explain the information backing the update.",
                  "Every message should avoid guarantees, promises, or language that sounds like a direct recommendation.",
                  "Every approval should include a short advisor note for the audit trail.",
                  "Drafts should be checked for client-specific relevance before sending.",
                  "Market uncertainty should be stated plainly, especially around volatile holdings.",
                  "Use the source evidence panel before approving any delivery.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm leading-6 text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}