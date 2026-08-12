"use client";

import {
  Activity,
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  Clock3,
  CopyPlus,
  Database,
  Gauge,
  Layers3,
  ListChecks,
  Loader2,
  PauseCircle,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { PublicBackgroundJob } from "@/lib/background-jobs/queue";
import type { WatchlistWorkspaceState } from "@/lib/watchlists/service";
import {
  CUSTOM_BOARD_ALERTS_KEY,
  MAX_LIST_CONSTRAINTS,
  MAX_LIST_SECURITIES,
  SHARED_WATCHLIST_KEY,
  WATCHLISTS_KEY,
  WATCHLIST_EVENTS_KEY,
  WATCHLIST_SCHEDULER_KEY,
  buildCustomBoardList,
  createId,
  defaultCustomBoardList,
  defaultLists,
  guessAssetType,
  metricOptions,
  nowLabel,
  parseTradingViewSymbol,
  scanIntervalOptions,
  type AdvisorWatchlist,
  type ConstraintCondition,
  type Priority,
  type QualificationEvent,
  type ScanIntervalMinutes,
  type Tone,
  type WatchConstraint,
} from "@/lib/workspace-watchlists";
import {
  WorkspaceAlert,
  WorkspaceButton,
  WorkspaceEmptyState,
  WorkspaceField,
  WorkspaceInput,
  WorkspaceMetric,
  WorkspacePageHeader,
  WorkspacePill,
  WorkspaceSelect,
  WorkspaceSkeleton,
  WorkspaceSurface,
  WorkspaceTabs,
  cx,
} from "@/components/workspace/core/workspace-ui";

const MIGRATION_KEY = "slice-watchlists-server-migrated-v3";

type WatchlistApiPayload = {
  ok: true;
  state: WatchlistWorkspaceState;
  jobs: PublicBackgroundJob[];
  metrics: {
    listCount: number;
    enabledCount: number;
    readyCount: number;
    securityCount: number;
    ruleCount: number;
    eventCount: number;
    criticalEventCount: number;
    activeJobCount: number;
  };
  nextScans: Record<string, string | null>;
  generatedAt: string;
  queued?: Array<{ listId: string; jobId: string; duplicate: boolean }>;
  message?: string;
};

type View = "overview" | "securities" | "rules" | "delivery";
type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";
type Notice = { tone: "success" | "error" | "info"; text: string } | null;

type Template = {
  name: string;
  description: string;
  tone: Tone;
  interval: ScanIntervalMinutes;
  constraint: Omit<WatchConstraint, "id">;
};

const TEMPLATES: Template[] = [
  {
    name: "Price Movement",
    description: "Review securities after a meaningful daily move.",
    tone: "cyan",
    interval: 15,
    constraint: {
      metricId: "change-pct",
      condition: "moves-by",
      value: "3",
      upperValue: "",
      priority: "Important",
      enabled: true,
    },
  },
  {
    name: "Technical Review",
    description: "Surface oversold or overextended technical conditions.",
    tone: "purple",
    interval: 30,
    constraint: {
      metricId: "rsi-14",
      condition: "below",
      value: "35",
      upperValue: "",
      priority: "Monitor",
      enabled: true,
    },
  },
  {
    name: "News & Regulatory",
    description: "Escalate material news and regulatory evidence quickly.",
    tone: "red",
    interval: 5,
    constraint: {
      metricId: "regulatory-risk",
      condition: "above",
      value: "50",
      upperValue: "",
      priority: "Critical",
      enabled: true,
    },
  },
];

const CONDITIONS: Array<{ value: ConstraintCondition; label: string }> = [
  { value: "above", label: "Above" },
  { value: "below", label: "Below" },
  { value: "between", label: "Between" },
  { value: "moves-by", label: "Moves by ±" },
  { value: "crosses-above", label: "Crosses above" },
  { value: "crosses-below", label: "Crosses below" },
  { value: "news-at-least", label: "News at least" },
];

const PRIORITIES: Priority[] = ["Monitor", "Important", "Critical"];

function formatDate(value: string | null | undefined) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not yet"
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function relativeDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Not scheduled";
  const difference = parsed - Date.now();
  if (difference <= 0) return "Due now";
  const minutes = Math.max(1, Math.round(difference / 60_000));
  if (minutes < 60) return `In ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `In ${hours} hr`;
  return `In ${Math.round(hours / 24)} day`;
}

function errorText(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.message === "string") return nested.message;
  }
  return fallback;
}

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function legacySchedulerEnabled() {
  const raw = window.localStorage.getItem(WATCHLIST_SCHEDULER_KEY);
  if (!raw) return true;
  if (raw === "false") return false;
  if (raw === "true") return true;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null && "enabled" in parsed
      ? (parsed as { enabled?: unknown }).enabled !== false
      : true;
  } catch {
    return true;
  }
}

function legacyState(): WatchlistWorkspaceState | null {
  const lists = readLocalJson<AdvisorWatchlist[]>(WATCHLISTS_KEY, []);
  const events = readLocalJson<QualificationEvent[]>(WATCHLIST_EVENTS_KEY, []);
  const shared = readLocalJson<unknown[]>(SHARED_WATCHLIST_KEY, []);
  const customBoardAlerts = readLocalJson<unknown[]>(CUSTOM_BOARD_ALERTS_KEY, []);

  if (!lists.length && !events.length && !shared.length && !customBoardAlerts.length) {
    return null;
  }

  return {
    schemaVersion: "slice-watchlist-workspace-3.0.0",
    lists: lists.length ? lists : defaultLists,
    customBoardList: buildCustomBoardList(),
    events,
    schedulerEnabled: legacySchedulerEnabled(),
    lastSchedulerTick: null,
    updatedAt: new Date().toISOString(),
  };
}

function newWatchlist(template?: Template): AdvisorWatchlist {
  const now = new Date().toISOString();
  return {
    id: createId("watchlist"),
    name: template?.name ?? "New Watchlist",
    description: template?.description ?? "Custom advisor watchlist.",
    tone: template?.tone ?? "cyan",
    notificationEmail: "",
    enabled: true,
    constraintJoin: "OR",
    constraints: [
      {
        id: createId("constraint"),
        ...(template?.constraint ?? {
          metricId: "change-pct",
          condition: "moves-by",
          value: "3",
          upperValue: "",
          priority: "Important",
          enabled: true,
        }),
      },
    ],
    items: [],
    scanIntervalMinutes: template?.interval ?? 15,
    lastScannedAt: null,
    lastScanStatus: "never",
    lastScanMessage: "Not scanned yet.",
    createdAt: now,
    updatedAt: now,
  };
}

function jobTone(status: string) {
  const value = status.toLowerCase();
  if (value.includes("complete")) return "emerald" as const;
  if (value.includes("process") || value.includes("queue") || value.includes("retry")) {
    return "cyan" as const;
  }
  if (value.includes("fail") || value.includes("dead")) return "amber" as const;
  return "slate" as const;
}

function ruleSummary(rule: WatchConstraint) {
  const metric = metricOptions.find((item) => item.id === rule.metricId)?.label ?? rule.metricId;
  const condition = CONDITIONS.find((item) => item.value === rule.condition)?.label ?? rule.condition;
  return `${metric} ${condition.toLowerCase()} ${rule.value || "—"}${
    rule.condition === "between" ? ` and ${rule.upperValue || "—"}` : ""
  }`;
}

export default function WatchlistsPage() {
  const [payload, setPayload] = useState<WatchlistApiPayload | null>(null);
  const [activeListId, setActiveListId] = useState("");
  const [view, setView] = useState<View>("overview");
  const [search, setSearch] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [newListOpen, setNewListOpen] = useState(false);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [notice, setNotice] = useState<Notice>(null);
  const dirtyRef = useRef(false);
  const stateRef = useRef<WatchlistWorkspaceState | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setBooting(true);
    try {
      const response = await fetch("/api/workspace/watchlists", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as WatchlistApiPayload;
      if (!response.ok) throw new Error(errorText(data, "Unable to load watchlists."));
      if (!mountedRef.current) return;
      stateRef.current = data.state;
      setPayload(data);
      setActiveListId((current) =>
        current && [...data.state.lists, data.state.customBoardList].some((list) => list.id === current)
          ? current
          : data.state.lists[0]?.id ?? data.state.customBoardList.id,
      );
    } catch (caught) {
      if (!silent) {
        setNotice({
          tone: "error",
          text: caught instanceof Error ? caught.message : "Unable to load watchlists.",
        });
      }
    } finally {
      if (!silent) setBooting(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      const migrationPending = !window.localStorage.getItem(MIGRATION_KEY);
      const legacy = migrationPending ? legacyState() : null;

      if (legacy) {
        try {
          const response = await fetch("/api/workspace/watchlists", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "syncLegacyState", state: legacy }),
          });
          const data = (await response.json().catch(() => ({}))) as WatchlistApiPayload;
          if (!response.ok) throw new Error(errorText(data, "Unable to migrate browser watchlists."));
          setNotice({
            tone: "success",
            text: data.message || "Browser watchlists were moved into durable Slice storage.",
          });
        } catch (caught) {
          setNotice({
            tone: "error",
            text: caught instanceof Error ? caught.message : "Unable to migrate browser watchlists.",
          });
        } finally {
          window.localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
        }
      } else if (migrationPending) {
        window.localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
      }

      await load();
    })();

    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [load]);

  const activeJob = payload?.jobs.find((job) =>
    ["Queued", "Retrying", "Processing"].includes(job.status),
  );

  useEffect(() => {
    if (!activeJob) return;
    const interval = window.setInterval(() => {
      if (!dirtyRef.current) void load(true);
    }, 2_500);
    return () => window.clearInterval(interval);
  }, [activeJob, load]);

  const allLists = useMemo(
    () => (payload ? [...payload.state.lists, payload.state.customBoardList] : []),
    [payload],
  );
  const activeList = allLists.find((list) => list.id === activeListId) ?? allLists[0] ?? null;
  const filteredLists = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allLists.filter((list) =>
      !query
        ? true
        : [list.name, list.description, ...list.items.map((item) => item.symbol)]
            .join(" ")
            .toLowerCase()
            .includes(query),
    );
  }, [allLists, search]);
  const activeEvents = useMemo(
    () =>
      (payload?.state.events ?? [])
        .filter((event) => event.listId === activeList?.id)
        .slice(0, 100),
    [activeList?.id, payload?.state.events],
  );
  const activeListJob = payload?.jobs.find(
    (job) =>
      job.payload?.listId === activeList?.id ||
      (job.output && String(job.output.listId ?? "") === activeList?.id),
  );

  function setState(updater: (state: WatchlistWorkspaceState) => WatchlistWorkspaceState) {
    setPayload((current) => {
      if (!current) return current;
      const nextState = updater(current.state);
      stateRef.current = nextState;
      return { ...current, state: nextState };
    });
    dirtyRef.current = true;
    setSaveState("unsaved");
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void saveWorkspace(), 700);
  }

  function updateActiveList(patch: Partial<AdvisorWatchlist>) {
    if (!activeList) return;
    const updatedAt = new Date().toISOString();
    setState((state) => ({
      ...state,
      lists: state.lists.map((list) =>
        list.id === activeList.id ? { ...list, ...patch, updatedAt } : list,
      ),
      customBoardList:
        state.customBoardList.id === activeList.id
          ? { ...state.customBoardList, ...patch, updatedAt }
          : state.customBoardList,
      updatedAt,
    }));
  }

  async function saveWorkspace() {
    const state = stateRef.current ?? payload?.state;
    if (!state || !dirtyRef.current) return;
    setSaveState("saving");
    try {
      const response = await fetch("/api/workspace/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveState", state }),
      });
      const data = (await response.json().catch(() => ({}))) as WatchlistApiPayload;
      if (!response.ok) throw new Error(errorText(data, "Unable to save watchlists."));
      dirtyRef.current = false;
      stateRef.current = data.state;
      setPayload(data);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1_800);
    } catch (caught) {
      setSaveState("error");
      setNotice({
        tone: "error",
        text: caught instanceof Error ? caught.message : "Unable to save watchlists.",
      });
    }
  }

  async function postAction(action: string, extra: Record<string, unknown> = {}) {
    if (!payload || !stateRef.current) return null;
    setBusy(action);
    try {
      const response = await fetch("/api/workspace/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, state: stateRef.current, ...extra }),
      });
      const data = (await response.json().catch(() => ({}))) as WatchlistApiPayload;
      if (!response.ok) throw new Error(errorText(data, "Watchlist action failed."));
      dirtyRef.current = false;
      stateRef.current = data.state;
      setPayload(data);
      setSaveState("saved");
      setNotice({ tone: "success", text: data.message || "Watchlist action completed." });
      return data;
    } catch (caught) {
      setNotice({
        tone: "error",
        text: caught instanceof Error ? caught.message : "Watchlist action failed.",
      });
      return null;
    } finally {
      setBusy(null);
    }
  }

  function addList(template?: Template) {
    const list = newWatchlist(template);
    setState((state) => ({
      ...state,
      lists: [list, ...state.lists],
      updatedAt: new Date().toISOString(),
    }));
    setActiveListId(list.id);
    setNewListOpen(false);
    setView("overview");
    setNotice({
      tone: "success",
      text: `${list.name} created. Add securities, then review its rule and delivery settings.`,
    });
  }

  function duplicateActiveList() {
    if (!activeList || activeList.id === defaultCustomBoardList.id) return;
    const now = new Date().toISOString();
    const duplicate: AdvisorWatchlist = {
      ...activeList,
      id: createId("watchlist"),
      name: `${activeList.name} Copy`,
      items: activeList.items.map((item) => ({ ...item, id: createId("security") })),
      constraints: activeList.constraints.map((rule) => ({ ...rule, id: createId("constraint") })),
      lastScannedAt: null,
      lastScanStatus: "never",
      lastScanMessage: "Not scanned yet.",
      createdAt: now,
      updatedAt: now,
    };
    setState((state) => ({ ...state, lists: [duplicate, ...state.lists], updatedAt: now }));
    setActiveListId(duplicate.id);
    setNotice({ tone: "success", text: `${activeList.name} duplicated.` });
  }

  function deleteActiveList() {
    if (!activeList || activeList.id === defaultCustomBoardList.id) return;
    if (!window.confirm(`Delete ${activeList.name}?`)) return;
    setState((state) => ({
      ...state,
      lists: state.lists.filter((list) => list.id !== activeList.id),
      events: state.events.filter((event) => event.listId !== activeList.id),
      updatedAt: new Date().toISOString(),
    }));
    const next = payload?.state.lists.find((list) => list.id !== activeList.id);
    setActiveListId(next?.id ?? defaultCustomBoardList.id);
  }

  function addSecurity() {
    if (!activeList || activeList.id === defaultCustomBoardList.id) return;
    if (activeList.items.length >= MAX_LIST_SECURITIES) {
      setNotice({ tone: "error", text: `A list can contain up to ${MAX_LIST_SECURITIES} securities.` });
      return;
    }
    const parsed = parseTradingViewSymbol(newSymbol);
    if (!parsed.symbol || !parsed.tvSymbol) {
      setNotice({ tone: "error", text: "Enter a valid symbol such as AAPL, NASDAQ:AAPL, or AMEX:SPY." });
      return;
    }
    if (activeList.items.some((item) => item.tvSymbol === parsed.tvSymbol)) {
      setNotice({ tone: "info", text: `${parsed.tvSymbol} is already in ${activeList.name}.` });
      return;
    }
    updateActiveList({
      items: [
        ...activeList.items,
        {
          id: createId("security"),
          symbol: parsed.symbol,
          tvSymbol: parsed.tvSymbol,
          label: parsed.label,
          assetType: guessAssetType(parsed.tvSymbol),
          note: "Added by advisor",
          addedAt: nowLabel(),
        },
      ],
    });
    setNewSymbol("");
  }

  function removeSecurity(id: string) {
    if (!activeList || activeList.id === defaultCustomBoardList.id) return;
    updateActiveList({ items: activeList.items.filter((item) => item.id !== id) });
  }

  function updateRule(id: string, patch: Partial<WatchConstraint>) {
    if (!activeList || activeList.id === defaultCustomBoardList.id) return;
    updateActiveList({
      constraints: activeList.constraints.map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule,
      ),
    });
  }

  function addRule() {
    if (!activeList || activeList.id === defaultCustomBoardList.id) return;
    if (activeList.constraints.length >= MAX_LIST_CONSTRAINTS) {
      setNotice({
        tone: "info",
        text: `Each list supports up to ${MAX_LIST_CONSTRAINTS} focused rules to keep scans understandable.`,
      });
      return;
    }
    updateActiveList({
      constraints: [
        ...activeList.constraints,
        {
          id: createId("constraint"),
          metricId: "news-score",
          condition: "above",
          value: "75",
          upperValue: "",
          priority: "Important",
          enabled: true,
        },
      ],
    });
  }

  function removeRule(id: string) {
    if (!activeList || activeList.id === defaultCustomBoardList.id) return;
    updateActiveList({ constraints: activeList.constraints.filter((rule) => rule.id !== id) });
  }

  function refreshCustomBoard() {
    const refreshed = buildCustomBoardList();
    setState((state) => ({
      ...state,
      customBoardList: {
        ...refreshed,
        notificationEmail: state.customBoardList.notificationEmail,
        enabled: state.customBoardList.enabled,
        scanIntervalMinutes: state.customBoardList.scanIntervalMinutes,
        lastScannedAt: state.customBoardList.lastScannedAt,
        lastScanStatus: state.customBoardList.lastScanStatus,
        lastScanMessage: state.customBoardList.lastScanMessage,
      },
      updatedAt: new Date().toISOString(),
    }));
    setNotice({ tone: "success", text: "Custom Board securities and rules refreshed." });
  }

  if (booting || !payload) {
    return (
      <main className="min-h-full p-4 sm:p-6">
        <WorkspaceSurface className="mx-auto max-w-[1700px] p-6">
          <WorkspaceSkeleton lines={10} />
        </WorkspaceSurface>
      </main>
    );
  }

  const customBoard = activeList?.id === defaultCustomBoardList.id;
  const emailValid = !activeList?.notificationEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(activeList.notificationEmail);
  const scanReady = Boolean(
    activeList?.enabled &&
      activeList.items.length &&
      activeList.constraints.some((rule) => rule.enabled),
  );
  const nextScan = activeList ? payload.nextScans[activeList.id] : null;

  return (
    <main className="min-h-full px-3 py-4 text-white sm:px-5 sm:py-6 lg:px-6">
      <div className="mx-auto max-w-[1880px] space-y-4">
        <WorkspaceSurface className="overflow-visible p-5 sm:p-7">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <div className="absolute -left-24 -top-32 h-80 w-80 rounded-full bg-[var(--slice-accent-glow)] blur-3xl" />
            <div className="absolute right-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-cyan-500/[0.06] blur-3xl" />
          </div>
          <div className="relative">
            <WorkspacePageHeader
              eyebrow="Always-On Market Monitoring"
              title="Watchlists that remain simple while the engine stays powerful."
              description="Build focused security lists, keep the same market, technical, valuation, and intelligence rules, then let Slice scan them continuously through durable background jobs—even after you close the browser."
              badges={
                <>
                  <WorkspacePill tone={payload.state.schedulerEnabled ? "emerald" : "amber"}>
                    {payload.state.schedulerEnabled ? <CheckCircle2 className="h-3 w-3" /> : <PauseCircle className="h-3 w-3" />}
                    {payload.state.schedulerEnabled ? "Server scanning enabled" : "Server scanning paused"}
                  </WorkspacePill>
                  <WorkspacePill tone="cyan">
                    <Database className="h-3 w-3" />
                    Durable firm-scoped storage
                  </WorkspacePill>
                  <WorkspacePill tone="slate">
                    <ShieldCheck className="h-3 w-3" />
                    Advisor review before action
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
                  >
                    Refresh
                  </WorkspaceButton>
                  <WorkspaceButton
                    variant="secondary"
                    tone="cyan"
                    icon={<Zap className="h-4 w-4" />}
                    onClick={() => void postAction("scanAll")}
                    loading={busy === "scanAll"}
                  >
                    Scan all ready lists
                  </WorkspaceButton>
                  <WorkspaceButton
                    variant="primary"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() => setNewListOpen(true)}
                  >
                    New watchlist
                  </WorkspaceButton>
                </>
              }
            />

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <WorkspaceMetric label="Watchlists" value={payload.metrics.listCount} helper={`${payload.metrics.enabledCount} enabled`} icon={<Layers3 className="h-5 w-5" />} />
              <WorkspaceMetric label="Ready to scan" value={payload.metrics.readyCount} helper="Securities + active rules" tone="emerald" icon={<ListChecks className="h-5 w-5" />} />
              <WorkspaceMetric label="Securities" value={payload.metrics.securityCount} helper={`Maximum ${MAX_LIST_SECURITIES} per list`} tone="cyan" icon={<Gauge className="h-5 w-5" />} />
              <WorkspaceMetric label="Active rules" value={payload.metrics.ruleCount} helper={`Maximum ${MAX_LIST_CONSTRAINTS} per list`} tone="violet" icon={<Sparkles className="h-5 w-5" />} />
              <WorkspaceMetric label="Qualification events" value={payload.metrics.eventCount} helper={`${payload.metrics.criticalEventCount} critical`} tone={payload.metrics.criticalEventCount ? "amber" : "slate"} icon={<BellRing className="h-5 w-5" />} />
              <WorkspaceMetric label="Active jobs" value={payload.metrics.activeJobCount} helper="Background scans" tone={payload.metrics.activeJobCount ? "cyan" : "slate"} icon={<Activity className="h-5 w-5" />} />
            </div>
          </div>
        </WorkspaceSurface>

        {notice ? (
          <WorkspaceAlert
            tone={notice.tone === "success" ? "success" : notice.tone === "error" ? "error" : "info"}
            action={
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className="rounded-lg p-1 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            }
          >
            {notice.text}
          </WorkspaceAlert>
        ) : null}

        {activeJob ? (
          <WorkspaceSurface className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <WorkspacePill tone={jobTone(activeJob.status)}>{activeJob.status}</WorkspacePill>
                  <span className="text-sm font-black text-white">Market scan in progress</span>
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                  {activeJob.progress.message || "Slice is evaluating watchlist rules."}
                </p>
              </div>
              <span className="text-2xl font-black text-cyan-100">{activeJob.progress.value}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/35">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-300 transition-all" style={{ width: `${Math.max(2, activeJob.progress.value)}%` }} />
            </div>
          </WorkspaceSurface>
        ) : null}

        <section className="grid min-w-0 gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
          <WorkspaceSurface className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--slice-accent)]">Your lists</p>
                <h2 className="mt-1 text-xl font-black text-white">Monitoring workspace</h2>
              </div>
              <WorkspacePill tone="slate">{allLists.length}</WorkspacePill>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <WorkspaceInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search lists or symbols" className="pl-9" />
            </div>

            <div className="mt-4 max-h-[610px] space-y-2 overflow-y-auto pr-1">
              {filteredLists.map((list) => {
                const active = list.id === activeList?.id;
                const listJob = payload.jobs.find((job) => job.payload?.listId === list.id && ["Queued", "Retrying", "Processing"].includes(job.status));
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => {
                      setActiveListId(list.id);
                      setView("overview");
                    }}
                    className={cx(
                      "w-full rounded-2xl border p-4 text-left transition",
                      active
                        ? "border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)]"
                        : "border-white/8 bg-white/[0.025] hover:border-white/14 hover:bg-white/[0.05]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">{list.name}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 text-slate-500">{list.description}</p>
                      </div>
                      <span className={cx("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", list.enabled ? "bg-emerald-300" : "bg-slate-700")} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <WorkspacePill tone="slate">{list.items.length} securities</WorkspacePill>
                      <WorkspacePill tone="slate">{list.constraints.filter((rule) => rule.enabled).length} rules</WorkspacePill>
                      {listJob ? <WorkspacePill tone="cyan">Scanning</WorkspacePill> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-black/25 p-4">
              <p className="text-xs font-black text-white">Quick templates</p>
              <div className="mt-3 grid gap-2">
                {TEMPLATES.map((template) => (
                  <button key={template.name} type="button" onClick={() => addList(template)} className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-left transition hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)]">
                    <p className="text-xs font-black text-white">{template.name}</p>
                    <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </WorkspaceSurface>

          {activeList ? (
            <WorkspaceSurface className="overflow-visible">
              <div className="border-b border-white/8 p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <WorkspacePill tone={activeList.enabled ? "emerald" : "amber"}>{activeList.enabled ? "Enabled" : "Paused"}</WorkspacePill>
                      {customBoard ? <WorkspacePill tone="violet">Derived from Custom Board</WorkspacePill> : null}
                      <WorkspacePill tone={scanReady ? "cyan" : "slate"}>{scanReady ? "Scan ready" : "Setup incomplete"}</WorkspacePill>
                    </div>
                    <h2 className="mt-3 truncate text-3xl font-black tracking-[-0.04em] text-white">{activeList.name}</h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{activeList.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {customBoard ? (
                      <WorkspaceButton variant="secondary" tone="violet" icon={<RefreshCw className="h-4 w-4" />} onClick={refreshCustomBoard}>
                        Refresh board list
                      </WorkspaceButton>
                    ) : (
                      <>
                        <WorkspaceButton variant="quiet" icon={<CopyPlus className="h-4 w-4" />} onClick={duplicateActiveList}>
                          Duplicate
                        </WorkspaceButton>
                        <WorkspaceButton variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={deleteActiveList}>
                          Delete
                        </WorkspaceButton>
                      </>
                    )}
                    <WorkspaceButton
                      variant="primary"
                      icon={<Play className="h-4 w-4" />}
                      onClick={() => void postAction("scanNow", { listId: activeList.id })}
                      loading={busy === "scanNow"}
                      disabled={!scanReady}
                    >
                      Scan now
                    </WorkspaceButton>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">Last scan</p>
                    <p className="mt-1 text-xs font-black text-white">{formatDate(activeList.lastScannedAt)}</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">Next scan</p>
                    <p className="mt-1 text-xs font-black text-white">{relativeDate(nextScan)}</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">Cadence</p>
                    <p className="mt-1 text-xs font-black text-white">{scanIntervalOptions.find((option) => option.value === activeList.scanIntervalMinutes)?.label || "Custom"}</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">Alert events</p>
                    <p className="mt-1 text-xs font-black text-white">{activeEvents.length}</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">Autosave</p>
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-black text-white">
                      {saveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" /> : saveState === "saved" ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : saveState === "error" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-300" /> : <Clock3 className="h-3.5 w-3.5 text-slate-500" />}
                      {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : saveState === "unsaved" ? "Unsaved" : "Ready"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <WorkspaceTabs<View>
                  value={view}
                  onChange={setView}
                  label="Watchlist sections"
                  options={[
                    { value: "overview", label: "Overview" },
                    { value: "securities", label: "Securities", count: activeList.items.length },
                    { value: "rules", label: "Rules", count: activeList.constraints.length },
                    { value: "delivery", label: "Alerts & Delivery", count: activeEvents.length },
                  ]}
                />

                {view === "overview" ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="space-y-4">
                      <WorkspaceField label="List name">
                        <WorkspaceInput value={activeList.name} disabled={customBoard} onChange={(event) => updateActiveList({ name: event.target.value })} />
                      </WorkspaceField>
                      <WorkspaceField label="Purpose and description">
                        <WorkspaceInput value={activeList.description} disabled={customBoard} onChange={(event) => updateActiveList({ description: event.target.value })} />
                      </WorkspaceField>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <WorkspaceField label="Scan cadence">
                          <WorkspaceSelect value={activeList.scanIntervalMinutes} onChange={(event) => updateActiveList({ scanIntervalMinutes: Number(event.target.value) as ScanIntervalMinutes })}>
                            {scanIntervalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </WorkspaceSelect>
                        </WorkspaceField>
                        <WorkspaceField label="Rule logic">
                          <WorkspaceSelect value={activeList.constraintJoin} disabled={customBoard} onChange={(event) => updateActiveList({ constraintJoin: event.target.value === "AND" ? "AND" : "OR" })}>
                            <option value="OR">Trigger when any rule passes</option>
                            <option value="AND">Trigger only when all rules pass</option>
                          </WorkspaceSelect>
                        </WorkspaceField>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activeList.enabled}
                        onClick={() => updateActiveList({ enabled: !activeList.enabled })}
                        className={cx("flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left", activeList.enabled ? "border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)]" : "border-white/8 bg-white/[0.025]")}
                      >
                        <span><span className="block text-sm font-black text-white">Enable this watchlist</span><span className="mt-1 block text-xs font-semibold text-slate-500">Paused lists remain saved but do not scan.</span></span>
                        <span className={cx("relative h-7 w-12 rounded-full border", activeList.enabled ? "border-[var(--slice-accent-border)] bg-[var(--slice-accent-strong)]" : "border-white/10 bg-white/[0.05]")}><span className={cx("absolute top-1 h-5 w-5 rounded-full bg-white transition", activeList.enabled ? "left-6" : "left-1")} /></span>
                      </button>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={payload.state.schedulerEnabled}
                        onClick={() => setState((state) => ({ ...state, schedulerEnabled: !state.schedulerEnabled, updatedAt: new Date().toISOString() }))}
                        className={cx("flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left", payload.state.schedulerEnabled ? "border-cyan-400/22 bg-cyan-500/[0.07]" : "border-white/8 bg-white/[0.025]")}
                      >
                        <span><span className="block text-sm font-black text-white">Always-on server scheduler</span><span className="mt-1 block text-xs font-semibold text-slate-500">Scans continue when this page and browser are closed.</span></span>
                        <span className={cx("relative h-7 w-12 rounded-full border", payload.state.schedulerEnabled ? "border-cyan-400/28 bg-cyan-600" : "border-white/10 bg-white/[0.05]")}><span className={cx("absolute top-1 h-5 w-5 rounded-full bg-white transition", payload.state.schedulerEnabled ? "left-6" : "left-1")} /></span>
                      </button>
                      <WorkspaceAlert tone={scanReady ? "success" : "warning"} title={scanReady ? "Ready for automatic monitoring" : "Finish setup to begin scanning"}>
                        {scanReady
                          ? `${activeList.items.length} securities will be evaluated against ${activeList.constraints.filter((rule) => rule.enabled).length} active rule(s).`
                          : "Enable the list, add at least one security, and enable at least one rule."}
                      </WorkspaceAlert>
                    </div>
                  </div>
                ) : null}

                {view === "securities" ? (
                  <div className="mt-5">
                    {!customBoard ? (
                      <div className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-black/25 p-4 sm:flex-row">
                        <WorkspaceInput
                          value={newSymbol}
                          onChange={(event) => setNewSymbol(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addSecurity();
                            }
                          }}
                          placeholder="Add AAPL, NASDAQ:AAPL, AMEX:SPY…"
                          className="flex-1"
                        />
                        <WorkspaceButton variant="primary" icon={<Plus className="h-4 w-4" />} onClick={addSecurity} disabled={!newSymbol.trim()}>
                          Add security
                        </WorkspaceButton>
                      </div>
                    ) : (
                      <WorkspaceAlert tone="info">Custom Board securities are managed on the board and synchronized here with the Refresh button.</WorkspaceAlert>
                    )}

                    {activeList.items.length ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                        {activeList.items.map((item) => (
                          <article key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xl font-black text-white">{item.symbol}</p>
                                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.13em] text-cyan-300">{item.tvSymbol}</p>
                              </div>
                              {!customBoard ? (
                                <button type="button" onClick={() => removeSecurity(item.id)} className="rounded-lg p-2 text-slate-600 transition hover:bg-white/[0.06] hover:text-amber-200" aria-label={`Remove ${item.symbol}`}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : null}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <WorkspacePill tone="slate">{item.assetType}</WorkspacePill>
                              <WorkspacePill tone="slate">Added {item.addedAt}</WorkspacePill>
                            </div>
                            <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{item.note || "No advisor note."}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <WorkspaceEmptyState title="No securities in this list" description="Add up to 20 securities. The scanner evaluates only the metrics required by the active rules." icon={<Gauge className="h-5 w-5" />} />
                    )}
                  </div>
                ) : null}

                {view === "rules" ? (
                  <div className="mt-5 space-y-4">
                    {customBoard ? (
                      <WorkspaceAlert tone="info">Custom Board rules remain controlled by the board. Refresh the derived list after changing board alerts.</WorkspaceAlert>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-slate-500">Use one or two focused rules. Keeping the list narrow makes every alert understandable.</p>
                        <WorkspaceButton variant="secondary" tone="violet" icon={<Plus className="h-4 w-4" />} onClick={addRule} disabled={activeList.constraints.length >= MAX_LIST_CONSTRAINTS}>
                          Add rule
                        </WorkspaceButton>
                      </div>
                    )}

                    {activeList.constraints.length ? activeList.constraints.map((rule, index) => (
                      <article key={rule.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-white">Rule {index + 1}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{ruleSummary(rule)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" disabled={customBoard} onClick={() => updateRule(rule.id, { enabled: !rule.enabled })} className={cx("rounded-full border px-3 py-1 text-[10px] font-black uppercase", rule.enabled ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-500")}>{rule.enabled ? "Enabled" : "Paused"}</button>
                            {!customBoard ? <button type="button" onClick={() => removeRule(rule.id)} className="rounded-lg p-2 text-slate-600 hover:bg-white/[0.06] hover:text-amber-200" aria-label={`Delete rule ${index + 1}`}><Trash2 className="h-4 w-4" /></button> : null}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                          <WorkspaceField label="Metric">
                            <WorkspaceSelect value={rule.metricId} disabled={customBoard} onChange={(event) => updateRule(rule.id, { metricId: event.target.value as WatchConstraint["metricId"] })}>
                              {metricOptions.map((metric) => <option key={metric.id} value={metric.id}>{metric.group} · {metric.label}</option>)}
                            </WorkspaceSelect>
                          </WorkspaceField>
                          <WorkspaceField label="Condition">
                            <WorkspaceSelect value={rule.condition} disabled={customBoard} onChange={(event) => updateRule(rule.id, { condition: event.target.value as ConstraintCondition })}>
                              {CONDITIONS.map((condition) => <option key={condition.value} value={condition.value}>{condition.label}</option>)}
                            </WorkspaceSelect>
                          </WorkspaceField>
                          <WorkspaceField label="Threshold">
                            <WorkspaceInput value={rule.value} disabled={customBoard} onChange={(event) => updateRule(rule.id, { value: event.target.value })} placeholder="75" />
                          </WorkspaceField>
                          {rule.condition === "between" ? (
                            <WorkspaceField label="Upper threshold">
                              <WorkspaceInput value={rule.upperValue} disabled={customBoard} onChange={(event) => updateRule(rule.id, { upperValue: event.target.value })} placeholder="90" />
                            </WorkspaceField>
                          ) : (
                            <WorkspaceField label="Priority">
                              <WorkspaceSelect value={rule.priority} disabled={customBoard} onChange={(event) => updateRule(rule.id, { priority: event.target.value as Priority })}>
                                {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                              </WorkspaceSelect>
                            </WorkspaceField>
                          )}
                          {rule.condition === "between" ? (
                            <WorkspaceField label="Priority">
                              <WorkspaceSelect value={rule.priority} disabled={customBoard} onChange={(event) => updateRule(rule.id, { priority: event.target.value as Priority })}>
                                {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                              </WorkspaceSelect>
                            </WorkspaceField>
                          ) : null}
                        </div>
                      </article>
                    )) : (
                      <WorkspaceEmptyState title="No rules configured" description="Add a rule to turn the securities list into an actionable monitoring workflow." icon={<Sparkles className="h-5 w-5" />} />
                    )}
                  </div>
                ) : null}

                {view === "delivery" ? (
                  <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                    <div className="space-y-4">
                      <WorkspaceField label="Alert email" description="Leave blank for dashboard-only events.">
                        <WorkspaceInput type="email" value={activeList.notificationEmail} onChange={(event) => updateActiveList({ notificationEmail: event.target.value })} placeholder="advisor@firm.com" />
                      </WorkspaceField>
                      {!emailValid ? <WorkspaceAlert tone="warning">Enter a valid email address or clear the field to use dashboard-only alerts.</WorkspaceAlert> : null}
                      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                        <p className="text-xs font-black text-white">Delivery behavior</p>
                        <ul className="mt-3 space-y-2 text-xs font-semibold leading-5 text-slate-500">
                          <li>• Each qualification event is deduplicated for four hours.</li>
                          <li>• Email delivery uses a durable provider idempotency key.</li>
                          <li>• The scanner continues through the server cron when this page is closed.</li>
                          <li>• Alerts are monitoring evidence, not autonomous trade instructions.</li>
                        </ul>
                      </div>
                      {activeListJob ? (
                        <div className="rounded-2xl border border-cyan-400/22 bg-cyan-500/[0.07] p-4">
                          <div className="flex items-center justify-between gap-3"><WorkspacePill tone={jobTone(activeListJob.status)}>{activeListJob.status}</WorkspacePill><span className="text-xl font-black text-cyan-100">{activeListJob.progress.value}%</span></div>
                          <p className="mt-2 text-xs font-semibold text-slate-400">{activeListJob.progress.message || activeListJob.error || "Background scan status"}</p>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <WorkspaceButton variant="secondary" tone="slate" icon={<Save className="h-4 w-4" />} onClick={() => void saveWorkspace()} loading={saveState === "saving"} disabled={!dirtyRef.current || !emailValid}>Save now</WorkspaceButton>
                        <WorkspaceButton variant="secondary" tone="cyan" icon={<Play className="h-4 w-4" />} onClick={() => void postAction("scanNow", { listId: activeList.id })} loading={busy === "scanNow"} disabled={!scanReady}>Run test scan</WorkspaceButton>
                        <WorkspaceButton variant="quiet" icon={<Trash2 className="h-4 w-4" />} onClick={() => void postAction("clearEvents", { listId: activeList.id })} disabled={!activeEvents.length}>Clear events</WorkspaceButton>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div><p className="text-xs font-black text-white">Recent qualification events</p><p className="mt-1 text-[10px] font-semibold text-slate-500">Latest 100 events for this list</p></div>
                        <WorkspacePill tone={activeEvents.some((event) => event.priority === "Critical") ? "amber" : "slate"}>{activeEvents.length}</WorkspacePill>
                      </div>
                      {activeEvents.length ? (
                        <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1">
                          {activeEvents.map((event) => (
                            <article key={event.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-white">{event.symbol}</p><WorkspacePill tone={event.priority === "Critical" ? "amber" : event.priority === "Important" ? "cyan" : "slate"}>{event.priority}</WorkspacePill><WorkspacePill tone={event.emailSent ? "emerald" : "slate"}>{event.emailSent ? "Email sent" : "Dashboard event"}</WorkspacePill></div><p className="mt-2 text-xs font-semibold leading-5 text-slate-400">{event.message}</p></div>
                                <time className="shrink-0 text-[9px] font-bold text-slate-600">{formatDate(event.createdAt)}</time>
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-lg border border-white/8 bg-black/25 p-2"><p className="text-[8px] uppercase text-slate-600">Metric</p><p className="mt-1 text-[10px] font-black text-white">{event.metricLabel}</p></div><div className="rounded-lg border border-white/8 bg-black/25 p-2"><p className="text-[8px] uppercase text-slate-600">Observed</p><p className="mt-1 text-[10px] font-black text-white">{event.observedDisplay}</p></div><div className="rounded-lg border border-white/8 bg-black/25 p-2"><p className="text-[8px] uppercase text-slate-600">Threshold</p><p className="mt-1 text-[10px] font-black text-white">{event.thresholdDisplay}</p></div></div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3"><WorkspaceEmptyState compact title="No events for this list" description="Events appear after a rule qualifies during a manual or automatic scan." icon={<BellRing className="h-5 w-5" />} /></div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </WorkspaceSurface>
          ) : (
            <WorkspaceSurface className="p-6">
              <WorkspaceEmptyState title="Create the first watchlist" description="Start from a focused template, then add securities and choose the monitoring rule that matters." icon={<Plus className="h-5 w-5" />} action={<WorkspaceButton variant="primary" onClick={() => setNewListOpen(true)}>New watchlist</WorkspaceButton>} />
            </WorkspaceSurface>
          )}
        </section>
      </div>

      {newListOpen ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="new-watchlist-title">
          <button type="button" className="absolute inset-0" onClick={() => setNewListOpen(false)} aria-label="Close new watchlist dialog" />
          <WorkspaceSurface className="relative z-10 w-full max-w-3xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><WorkspacePill tone="emerald">New watchlist</WorkspacePill><h2 id="new-watchlist-title" className="mt-3 text-2xl font-black text-white">Start simple, then refine.</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Choose a template or create a blank list. Every parameter remains editable afterward.</p></div><button type="button" onClick={() => setNewListOpen(false)} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-400 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {TEMPLATES.map((template) => <button key={template.name} type="button" onClick={() => addList(template)} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)]"><div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-[var(--slice-accent)]"><Zap className="h-4 w-4" /></div><p className="mt-4 text-sm font-black text-white">{template.name}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{template.description}</p></button>)}
              <button type="button" onClick={() => addList()} className="rounded-2xl border border-dashed border-white/14 bg-black/25 p-4 text-left transition hover:border-[var(--slice-accent-border)]"><div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300"><Plus className="h-4 w-4" /></div><p className="mt-4 text-sm font-black text-white">Blank watchlist</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Start with the standard 3% movement rule.</p></button>
            </div>
          </WorkspaceSurface>
        </div>
      ) : null}
    </main>
  );
}