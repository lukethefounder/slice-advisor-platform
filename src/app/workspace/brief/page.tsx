"use client";

import {
  Activity,
  BellRing,
  Building2,
  CalendarClock,
  Clock3,
  Database,
  Gauge,
  Mail,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AdvisorBriefApiPayload,
  AdvisorBriefPreference,
  AdvisorMarketBriefRecord,
} from "@/lib/advisor-briefing/types";
import {
  IndustryCard,
  defaultAdvisorBriefPreference,
  fetchJson,
} from "@/components/advisor-brief/ui";
import BriefSchedulePanel from "@/components/advisor-brief/schedule-panel";
import BriefResultsPanel from "@/components/advisor-brief/results-panel";
import {
  WorkspaceAlert,
  WorkspaceButton,
  WorkspaceEmptyState,
  WorkspaceMetric,
  WorkspacePageHeader,
  WorkspacePill,
  WorkspaceSkeleton,
  WorkspaceSurface,
  cx,
} from "@/components/workspace/core/workspace-ui";

function activeJob(payload: AdvisorBriefApiPayload | null) {
  return (
    payload?.jobs.find((job) =>
      ["Queued", "Retrying", "Processing"].includes(job.status),
    ) ?? null
  );
}

function dateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Not available"
    : parsed.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function statusTone(value: string | null | undefined) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("deliver") || normalized.includes("sent") || normalized.includes("complete")) {
    return "emerald" as const;
  }
  if (normalized.includes("process") || normalized.includes("queue") || normalized.includes("generat")) {
    return "cyan" as const;
  }
  if (normalized.includes("fail") || normalized.includes("withheld")) {
    return "amber" as const;
  }
  return "slate" as const;
}

export default function AdvisorBriefPage() {
  const [payload, setPayload] = useState<AdvisorBriefApiPayload | null>(null);
  const [preference, setPreference] = useState<AdvisorBriefPreference>(
    defaultAdvisorBriefPreference(),
  );
  const [activeIndustryId, setActiveIndustryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [message, setMessage] = useState("Loading the advisor briefing center.");
  const [error, setError] = useState("");
  const [view, setView] = useState<"brief" | "schedule">("brief");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const next = await fetchJson<AdvisorBriefApiPayload>("/api/advisor-brief");
      setPayload(next);
      setPreference(next.preference);
      setError("");
      setActiveIndustryId(
        (current) => current || next.latest?.brief.topIndustries[0]?.id || "",
      );

      if (!silent) {
        const running = activeJob(next);
        setMessage(
          running
            ? running.progress.message || "The advisor briefing is running in the background."
            : next.latest
              ? `Latest briefing loaded from ${dateTime(next.latest.createdAt)}.`
              : "No briefing exists yet. Generate the first source-backed market brief.",
        );
      }
    } catch (caught) {
      const detail =
        caught instanceof Error
          ? caught.message
          : "Unable to load the advisor briefing center.";
      setError(detail);
      if (!silent) setMessage(detail);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runningJob = activeJob(payload);

  useEffect(() => {
    if (!runningJob) return;
    const interval = window.setInterval(() => void load(true), 2_500);
    return () => window.clearInterval(interval);
  }, [load, runningJob]);

  async function post(body: Record<string, unknown>) {
    return fetchJson<{
      ok: boolean;
      message?: string;
      preference?: AdvisorBriefPreference;
      payload?: AdvisorBriefApiPayload;
    }>("/api/advisor-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function savePreference() {
    setAction("save");
    setError("");
    try {
      const result = await post({ action: "save-preference", preference });
      if (result.preference) setPreference(result.preference);
      if (result.payload) setPayload(result.payload);
      setMessage("Automatic briefing schedule saved. The five-minute scheduler is active.");
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "Unable to save the schedule.";
      setError(detail);
      setMessage(detail);
    } finally {
      setAction(null);
    }
  }

  async function queueBrief(
    mode: "generate" | "generate-and-send" | "send-latest" | "run-scheduled-now",
  ) {
    const actionName =
      mode === "generate"
        ? "generate"
        : mode === "send-latest"
          ? "send"
          : mode === "run-scheduled-now"
            ? "run-now"
            : "generate-send";
    setAction(actionName);
    setError("");
    setMessage("Adding the briefing to Slice’s durable background queue.");

    try {
      const result = await post({
        action: mode,
        force: true,
        destination: preference.emailAddress,
        preference,
      });
      setMessage(result.message || "Briefing job queued.");
      await load(true);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "Unable to queue the briefing.";
      setError(detail);
      setMessage(detail);
    } finally {
      setAction(null);
    }
  }

  async function retryJob(jobId: string) {
    setAction("retry-job");
    setError("");
    try {
      await post({ action: "retry-job", jobId });
      setMessage("The failed briefing job was returned to the queue.");
      await load(true);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "Unable to retry the job.";
      setError(detail);
    } finally {
      setAction(null);
    }
  }

  async function saveAndRunNow() {
    setAction("run-now");
    setError("");
    try {
      await post({ action: "save-preference", preference });
      await queueBrief("run-scheduled-now");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to run the schedule.");
    } finally {
      setAction(null);
    }
  }

  const latest: AdvisorMarketBriefRecord | null = payload?.latest ?? null;
  const brief = latest?.brief ?? null;
  const activeIndustry = useMemo(
    () =>
      brief?.topIndustries.find((industry) => industry.id === activeIndustryId) ??
      brief?.topIndustries[0] ??
      null,
    [activeIndustryId, brief],
  );
  const sourceMap = useMemo(
    () => new Map((brief?.sources ?? []).map((source) => [source.id, source])),
    [brief],
  );
  const busy = Boolean(action);
  const deliveryReady = Boolean(
    preference.enabled && preference.emailEnabled && preference.emailAddress,
  );

  return (
    <main className="min-h-full px-3 py-4 text-white sm:px-5 sm:py-6 lg:px-6">
      <div className="mx-auto max-w-[1880px] space-y-4">
        <WorkspaceSurface className="overflow-visible p-5 sm:p-7">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <div className="absolute -left-24 -top-32 h-80 w-80 rounded-full bg-[var(--slice-accent-glow)] blur-3xl" />
            <div className="absolute right-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-cyan-500/[0.07] blur-3xl" />
          </div>

          <div className="relative">
            <WorkspacePageHeader
              eyebrow="Autonomous Advisor Brief"
              title="Your market intelligence, already ranked and ready."
              description="Slice continuously gathers provider evidence, ranks industries and securities, stores every source, and can deliver the finished advisor brief on your schedule—even when nobody is logged in."
              badges={
                <>
                  <WorkspacePill tone={brief?.realTimeConfirmed ? "emerald" : "amber"}>
                    {brief?.realTimeConfirmed ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {brief?.providerMode || "Provider pending"}
                  </WorkspacePill>
                  <WorkspacePill tone={deliveryReady ? "emerald" : "slate"}>
                    <BellRing className="h-3 w-3" />
                    {deliveryReady ? "Automatic delivery ready" : "Delivery not fully configured"}
                  </WorkspacePill>
                  <WorkspacePill tone="cyan">
                    <ShieldCheck className="h-3 w-3" />
                    Advisor-only email
                  </WorkspacePill>
                </>
              }
              actions={
                <>
                  <WorkspaceButton
                    variant="secondary"
                    tone="slate"
                    icon={<RefreshCw className="h-4 w-4" />}
                    onClick={() => void load()}
                    loading={loading}
                  >
                    Refresh
                  </WorkspaceButton>
                  <WorkspaceButton
                    variant="secondary"
                    tone="cyan"
                    icon={<Play className="h-4 w-4" />}
                    onClick={() => void queueBrief("generate")}
                    loading={action === "generate"}
                    disabled={busy}
                  >
                    Generate brief
                  </WorkspaceButton>
                  <WorkspaceButton
                    variant="primary"
                    icon={<Send className="h-4 w-4" />}
                    onClick={() => void queueBrief("generate-and-send")}
                    loading={action === "generate-send"}
                    disabled={busy || !preference.emailAddress}
                  >
                    Generate and email
                  </WorkspaceButton>
                </>
              }
            />

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <WorkspaceMetric
                label="Data quality"
                value={brief ? `${Math.round(brief.dataQuality)}/100` : "Pending"}
                helper={`Delivery threshold ${preference.minimumDataQuality}/100`}
                tone={brief && brief.dataQuality >= preference.minimumDataQuality ? "emerald" : "amber"}
                icon={<Gauge className="h-5 w-5" />}
              />
              <WorkspaceMetric
                label="Top industries"
                value={brief?.topIndustries.length ?? 0}
                helper="Ranked monitor groups"
                tone="cyan"
                icon={<Building2 className="h-5 w-5" />}
              />
              <WorkspaceMetric
                label="Ranked securities"
                value={brief?.overallRankedSecurities.length ?? 0}
                helper="Cross-industry ranking"
                tone="violet"
                icon={<Target className="h-5 w-5" />}
              />
              <WorkspaceMetric
                label="Evidence sources"
                value={brief?.sources.length ?? 0}
                helper="Visible source records"
                tone="sky"
                icon={<Database className="h-5 w-5" />}
              />
              <WorkspaceMetric
                label="Next automatic run"
                value={payload?.schedule.nextRunAt ? dateTime(payload.schedule.nextRunAt) : "Paused"}
                helper={payload?.schedule.label || "No schedule saved"}
                tone={preference.enabled ? "emerald" : "slate"}
                icon={<CalendarClock className="h-5 w-5" />}
              />
              <WorkspaceMetric
                label="Email status"
                value={payload?.delivery?.status || "Not sent"}
                helper={payload?.delivery?.destination || "Advisor destination pending"}
                tone={statusTone(payload?.delivery?.status)}
                icon={<Mail className="h-5 w-5" />}
              />
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <WorkspaceAlert
                tone={error ? "error" : runningJob ? "info" : brief ? "success" : "warning"}
                title={
                  error
                    ? "Briefing action needs attention"
                    : runningJob
                      ? `Background briefing ${runningJob.status.toLowerCase()}`
                      : brief
                        ? "Latest briefing ready"
                        : "Generate the first briefing"
                }
              >
                {runningJob
                  ? `${runningJob.progress.message || "Slice is building the briefing."} · ${runningJob.progress.value}%`
                  : message}
              </WorkspaceAlert>

              <div className="flex rounded-xl border border-white/8 bg-black/25 p-1" role="tablist" aria-label="Briefing workspace">
                {(["brief", "schedule"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={view === item}
                    onClick={() => setView(item)}
                    className={cx(
                      "min-h-10 rounded-lg px-4 text-xs font-black transition",
                      view === item
                        ? "bg-[var(--slice-accent-strong)] text-white"
                        : "text-slate-500 hover:bg-white/[0.05] hover:text-white",
                    )}
                  >
                    {item === "brief" ? "Current Brief" : "Automatic Schedule"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </WorkspaceSurface>

        {view === "schedule" ? (
          <BriefSchedulePanel
            preference={preference}
            setPreference={setPreference}
            busy={busy}
            action={action}
            scheduleLabel={payload?.schedule.label ?? "Automatic briefing paused"}
            nextRunAt={payload?.schedule.nextRunAt ?? null}
            lastDeliveryStatus={payload?.delivery?.status ?? null}
            jobs={payload?.jobs ?? []}
            onSave={savePreference}
            onRunNow={saveAndRunNow}
            onRetryJob={retryJob}
          />
        ) : (
          <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <WorkspaceSurface className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--slice-accent)]">
                    Monitor groups
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">Industries requiring attention</h2>
                </div>
                <WorkspacePill tone="slate">{brief?.topIndustries.length ?? 0}</WorkspacePill>
              </div>

              {loading ? (
                <WorkspaceSkeleton className="mt-5" lines={8} />
              ) : brief?.topIndustries.length ? (
                <div className="mt-5 space-y-3">
                  {brief.topIndustries.map((industry) => (
                    <IndustryCard
                      key={industry.id}
                      industry={industry}
                      active={activeIndustry?.id === industry.id}
                      onClick={() => setActiveIndustryId(industry.id)}
                    />
                  ))}
                </div>
              ) : (
                <WorkspaceEmptyState
                  title="No current briefing yet"
                  description="Queue a source-backed briefing and Slice will populate the industry ranking when the background job completes."
                  icon={<Sparkles className="h-5 w-5" />}
                  action={
                    <WorkspaceButton
                      variant="primary"
                      icon={<Play className="h-4 w-4" />}
                      onClick={() => void queueBrief("generate")}
                    >
                      Generate current brief
                    </WorkspaceButton>
                  }
                />
              )}

              {brief ? (
                <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">Market as of</p>
                    <p className="mt-1 text-xs font-black text-white">{dateTime(brief.marketAsOf)}</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">Quote coverage</p>
                    <p className="mt-1 text-xs font-black text-white">{Math.round(brief.quoteCoveragePercent)}%</p>
                  </div>
                </div>
              ) : null}
            </WorkspaceSurface>

            <div className="min-w-0">
              {brief ? (
                <BriefResultsPanel
                  payload={payload}
                  brief={brief}
                  activeIndustry={activeIndustry}
                  sourceMap={sourceMap}
                  preference={preference}
                />
              ) : (
                <WorkspaceSurface className="p-6">
                  <WorkspaceEmptyState
                    title="Decision-ready results appear here"
                    description="The completed brief will include ranked securities, technical and fundamental context, market and economic evidence, methodology, warnings, and source links."
                    icon={<Activity className="h-5 w-5" />}
                  />
                </WorkspaceSurface>
              )}
            </div>
          </section>
        )}

        {view === "brief" && brief ? (
          <WorkspaceSurface className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-[var(--slice-accent)]">
                <Clock3 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Need a fresh delivery without recalculating?</p>
                <p className="text-xs font-semibold text-slate-500">Send the latest stored brief to the configured advisor email.</p>
              </div>
            </div>
            <WorkspaceButton
              variant="secondary"
              tone="emerald"
              icon={<Mail className="h-4 w-4" />}
              onClick={() => void queueBrief("send-latest")}
              loading={action === "send"}
              disabled={!preference.emailAddress || busy}
            >
              Email latest brief
            </WorkspaceButton>
          </WorkspaceSurface>
        ) : null}
      </div>
    </main>
  );
}