import "server-only";

import { ApiError } from "@/lib/api-route";
import { decryptSensitiveText, encryptSensitiveText } from "@/lib/data-vault";
import { prisma } from "@/lib/prisma";
import {
  defaultCustomBoardList,
  defaultLists,
  MAX_LIST_CONSTRAINTS,
  MAX_LIST_SECURITIES,
  metricOptions,
  type AdvisorWatchlist,
  type ConstraintCondition,
  type MetricId,
  type Priority,
  type QualificationEvent,
  type ScanIntervalMinutes,
  type SecurityItem,
  type Tone,
  type WatchConstraint,
} from "@/lib/workspace-watchlists";

const SUBJECT_TYPE = "WorkspaceWatchlists";
const SUBJECT_NAME = "Advisor Watchlists";
const MEMORY_KEY_PREFIX = "workspace-state-v3:";

function memoryKeyForFirm(firmId: string) {
  return `${MEMORY_KEY_PREFIX}${firmId}`.slice(0, 240);
}
const MAX_EVENTS = 200;
const ALLOWED_CONDITIONS = new Set<ConstraintCondition>([
  "above",
  "below",
  "between",
  "moves-by",
  "crosses-above",
  "crosses-below",
  "news-at-least",
]);
const ALLOWED_PRIORITIES = new Set<Priority>(["Monitor", "Important", "Critical"]);
const ALLOWED_TONES = new Set<Tone>([
  "red",
  "green",
  "amber",
  "purple",
  "cyan",
  "blue",
  "slate",
]);
const ALLOWED_INTERVALS = new Set<ScanIntervalMinutes>([
  0,
  1,
  5,
  15,
  30,
  60,
  240,
  1440,
]);
const ALLOWED_METRICS = new Set<MetricId>(metricOptions.map((metric) => metric.id));

export type WatchlistWorkspaceState = {
  schemaVersion: "slice-watchlist-workspace-3.0.0";
  lists: AdvisorWatchlist[];
  customBoardList: AdvisorWatchlist;
  events: QualificationEvent[];
  schedulerEnabled: boolean;
  lastSchedulerTick: string | null;
  updatedAt: string;
};

function clean(value: unknown, maximum = 500) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringDate(value: unknown) {
  const text = clean(value, 80);
  return Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : null;
}

function normalizedInterval(value: unknown): ScanIntervalMinutes {
  const numeric = Number(value) as ScanIntervalMinutes;
  return ALLOWED_INTERVALS.has(numeric) ? numeric : 15;
}

function normalizedSecurity(value: unknown, index: number): SecurityItem | null {
  const row = objectValue(value);
  const raw = clean(row.tvSymbol || row.symbol, 48).toUpperCase();
  const symbol = clean(row.symbol || raw.split(":").pop(), 32)
    .toUpperCase()
    .replace(/[^A-Z0-9._/!\-$]/g, "");
  const tvSymbol = raw.includes(":")
    ? raw.replace(/[^A-Z0-9:._/!\-$]/g, "")
    : `NASDAQ:${symbol}`;

  if (!symbol) return null;

  const assetType = ["Stock", "ETF", "Index", "Crypto", "Futures", "Other"].includes(
    clean(row.assetType, 30),
  )
    ? (clean(row.assetType, 30) as SecurityItem["assetType"])
    : "Stock";

  return {
    id: clean(row.id, 160) || `security-${symbol}-${index}`,
    symbol,
    tvSymbol,
    label: clean(row.label, 120) || symbol,
    assetType,
    note: clean(row.note, 500),
    addedAt: clean(row.addedAt, 100) || new Date().toISOString(),
  };
}

function normalizedConstraint(value: unknown, index: number): WatchConstraint | null {
  const row = objectValue(value);
  const metricId = clean(row.metricId, 80) as MetricId;
  if (!ALLOWED_METRICS.has(metricId)) return null;

  const condition = clean(row.condition, 80) as ConstraintCondition;
  const priority = clean(row.priority, 40) as Priority;

  return {
    id: clean(row.id, 160) || `constraint-${metricId}-${index}`,
    metricId,
    condition: ALLOWED_CONDITIONS.has(condition) ? condition : "above",
    value: clean(row.value, 80),
    upperValue: clean(row.upperValue, 80),
    priority: ALLOWED_PRIORITIES.has(priority) ? priority : "Monitor",
    enabled: row.enabled !== false,
  };
}

export function normalizeAdvisorWatchlist(
  value: unknown,
  fallbackId = "watchlist",
): AdvisorWatchlist {
  const row = objectValue(value);
  const constraints = Array.isArray(row.constraints)
    ? row.constraints
        .map(normalizedConstraint)
        .filter((item): item is WatchConstraint => Boolean(item))
        .slice(0, MAX_LIST_CONSTRAINTS)
    : [];
  const items = Array.isArray(row.items)
    ? row.items
        .map(normalizedSecurity)
        .filter((item): item is SecurityItem => Boolean(item))
        .filter(
          (item, index, values) =>
            values.findIndex((candidate) => candidate.tvSymbol === item.tvSymbol) === index,
        )
        .slice(0, MAX_LIST_SECURITIES)
    : [];
  const tone = clean(row.tone, 30) as Tone;
  const status = clean(row.lastScanStatus, 30);

  return {
    id: clean(row.id, 160) || fallbackId,
    name: clean(row.name, 180) || "Advisor Watchlist",
    description: clean(row.description, 1_000),
    tone: ALLOWED_TONES.has(tone) ? tone : "cyan",
    notificationEmail: clean(row.notificationEmail, 320).toLowerCase(),
    enabled: row.enabled !== false,
    constraintJoin: row.constraintJoin === "AND" ? "AND" : "OR",
    constraints,
    items,
    scanIntervalMinutes: normalizedInterval(row.scanIntervalMinutes),
    lastScannedAt: stringDate(row.lastScannedAt),
    lastScanStatus:
      status === "success" || status === "error" ? status : "never",
    lastScanMessage: clean(row.lastScanMessage, 1_000) || "Not scanned yet.",
    createdAt: clean(row.createdAt, 100) || new Date().toISOString(),
    updatedAt: clean(row.updatedAt, 100) || new Date().toISOString(),
  };
}

function normalizeEvent(value: unknown): QualificationEvent | null {
  const row = objectValue(value);
  const id = clean(row.id, 180);
  const key = clean(row.key, 300);
  const listId = clean(row.listId, 160);
  const symbol = clean(row.symbol, 32).toUpperCase();
  const metricId = clean(row.metricId, 80) as MetricId;

  if (!id || !key || !listId || !symbol || !ALLOWED_METRICS.has(metricId)) {
    return null;
  }

  const priority = clean(row.priority, 40) as Priority;

  return {
    id,
    key,
    listId,
    listName: clean(row.listName, 180),
    symbol,
    tvSymbol: clean(row.tvSymbol, 48).toUpperCase(),
    metricId,
    metricLabel: clean(row.metricLabel, 120),
    observedDisplay: clean(row.observedDisplay, 120),
    condition: clean(row.condition, 120),
    thresholdDisplay: clean(row.thresholdDisplay, 120),
    priority: ALLOWED_PRIORITIES.has(priority) ? priority : "Monitor",
    emailSent: row.emailSent === true,
    emailSkippedReason: clean(row.emailSkippedReason, 500) || undefined,
    message: clean(row.message, 1_000),
    createdAt: stringDate(row.createdAt) || new Date().toISOString(),
  };
}

export function defaultWatchlistWorkspace(): WatchlistWorkspaceState {
  return {
    schemaVersion: "slice-watchlist-workspace-3.0.0",
    lists: defaultLists.map((list) => normalizeAdvisorWatchlist(list, list.id)),
    customBoardList: normalizeAdvisorWatchlist(
      defaultCustomBoardList,
      defaultCustomBoardList.id,
    ),
    events: [],
    schedulerEnabled: true,
    lastSchedulerTick: null,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeWatchlistWorkspace(value: unknown): WatchlistWorkspaceState {
  const row = objectValue(value);
  const defaults = defaultWatchlistWorkspace();
  const lists = Array.isArray(row.lists)
    ? row.lists
        .map((list, index) => normalizeAdvisorWatchlist(list, `watchlist-${index + 1}`))
        .filter(
          (list, index, values) =>
            list.id !== defaultCustomBoardList.id &&
            values.findIndex((candidate) => candidate.id === list.id) === index,
        )
        .slice(0, 50)
    : defaults.lists;
  const events = Array.isArray(row.events)
    ? row.events
        .map(normalizeEvent)
        .filter((item): item is QualificationEvent => Boolean(item))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
        .slice(0, MAX_EVENTS)
    : [];

  return {
    schemaVersion: "slice-watchlist-workspace-3.0.0",
    lists: lists.length ? lists : defaults.lists,
    customBoardList: normalizeAdvisorWatchlist(
      row.customBoardList || defaults.customBoardList,
      defaultCustomBoardList.id,
    ),
    events,
    schedulerEnabled: row.schedulerEnabled !== false,
    lastSchedulerTick: stringDate(row.lastSchedulerTick),
    updatedAt: new Date().toISOString(),
  };
}

export async function loadWatchlistWorkspace(input: {
  userId: string;
  firmId: string;
}) {
  const record = await prisma.advisorAdaptiveMemory.findUnique({
    where: {
      userId_subjectType_subjectName_memoryKey: {
        userId: input.userId,
        subjectType: SUBJECT_TYPE,
        subjectName: SUBJECT_NAME,
        memoryKey: memoryKeyForFirm(input.firmId),
      },
    },
    select: {
      memoryValue: true,
      updatedAt: true,
    },
  });

  if (!record) {
    return saveWatchlistWorkspace({
      userId: input.userId,
      firmId: input.firmId,
      state: defaultWatchlistWorkspace(),
    });
  }

  try {
    const decrypted = decryptSensitiveText(record.memoryValue);
    return normalizeWatchlistWorkspace(
      JSON.parse(typeof decrypted === "string" ? decrypted : "{}") as unknown,
    );
  } catch {
    return defaultWatchlistWorkspace();
  }
}

export async function watchlistWorkspaceExists(input: {
  userId: string;
  firmId: string;
}) {
  const record = await prisma.advisorAdaptiveMemory.findUnique({
    where: {
      userId_subjectType_subjectName_memoryKey: {
        userId: input.userId,
        subjectType: SUBJECT_TYPE,
        subjectName: SUBJECT_NAME,
        memoryKey: memoryKeyForFirm(input.firmId),
      },
    },
    select: { id: true },
  });

  return Boolean(record);
}

function newerRuntimeList(
  incoming: AdvisorWatchlist,
  current: AdvisorWatchlist | null,
) {
  if (!current) return incoming;

  const incomingTime = Date.parse(incoming.lastScannedAt ?? "");
  const currentTime = Date.parse(current.lastScannedAt ?? "");

  if (Number.isFinite(currentTime) && (!Number.isFinite(incomingTime) || currentTime > incomingTime)) {
    return {
      ...incoming,
      lastScannedAt: current.lastScannedAt,
      lastScanStatus: current.lastScanStatus,
      lastScanMessage: current.lastScanMessage,
      updatedAt: current.updatedAt,
    };
  }

  return incoming;
}

export async function saveWatchlistEditorState(input: {
  userId: string;
  firmId: string;
  state: unknown;
}) {
  const [current, incoming] = await Promise.all([
    loadWatchlistWorkspace(input),
    Promise.resolve(normalizeWatchlistWorkspace(input.state)),
  ]);
  const currentById = new Map(
    [...current.lists, current.customBoardList].map((list) => [list.id, list] as const),
  );
  const events = [...current.events, ...incoming.events]
    .filter(
      (event, index, values) =>
        values.findIndex((candidate) => candidate.key === event.key) === index,
    )
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, MAX_EVENTS);
  const schedulerTimes = [current.lastSchedulerTick, incoming.lastSchedulerTick]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left));
  const merged: WatchlistWorkspaceState = {
    ...incoming,
    lists: incoming.lists.map((list) =>
      newerRuntimeList(list, currentById.get(list.id) ?? null),
    ),
    customBoardList: newerRuntimeList(
      incoming.customBoardList,
      currentById.get(incoming.customBoardList.id) ?? null,
    ),
    events,
    lastSchedulerTick: schedulerTimes[0] ?? null,
    updatedAt: new Date().toISOString(),
  };

  return saveWatchlistWorkspace({ ...input, state: merged });
}

export async function saveWatchlistWorkspace(input: {
  userId: string;
  firmId: string;
  state: unknown;
}) {
  const state = normalizeWatchlistWorkspace(input.state);
  state.updatedAt = new Date().toISOString();

  const serialized = JSON.stringify(state);
  const storedValue = encryptSensitiveText(serialized) ?? serialized;

  await prisma.advisorAdaptiveMemory.upsert({
    where: {
      userId_subjectType_subjectName_memoryKey: {
        userId: input.userId,
        subjectType: SUBJECT_TYPE,
        subjectName: SUBJECT_NAME,
        memoryKey: memoryKeyForFirm(input.firmId),
      },
    },
    update: {
      firmId: input.firmId,
      memoryValue: storedValue,
      confidenceScore: 100,
      evidenceJson: JSON.stringify([
        "Advisor-configured watchlists, rules, scan cadence, and alert history",
      ]),
      lastAppliedAt: new Date(),
    },
    create: {
      userId: input.userId,
      firmId: input.firmId,
      subjectType: SUBJECT_TYPE,
      subjectName: SUBJECT_NAME,
      memoryKey: memoryKeyForFirm(input.firmId),
      memoryValue: storedValue,
      confidenceScore: 100,
      evidenceJson: JSON.stringify([
        "Advisor-configured watchlists, rules, scan cadence, and alert history",
      ]),
      lastAppliedAt: new Date(),
    },
  });

  return state;
}

export async function updateWatchlistScanResult(input: {
  userId: string;
  firmId: string;
  listId: string;
  checkedAt: string;
  status: "success" | "error";
  message: string;
  events?: QualificationEvent[];
}) {
  const state = await loadWatchlistWorkspace(input);
  const patch = (list: AdvisorWatchlist): AdvisorWatchlist =>
    list.id === input.listId
      ? {
          ...list,
          lastScannedAt: input.checkedAt,
          lastScanStatus: input.status,
          lastScanMessage: clean(input.message, 1_000),
          updatedAt: input.checkedAt,
        }
      : list;
  const next = {
    ...state,
    lists: state.lists.map(patch),
    customBoardList: patch(state.customBoardList),
    events: [
      ...(input.events ?? []),
      ...state.events,
    ]
      .filter(
        (event, index, values) =>
          values.findIndex((candidate) => candidate.key === event.key) === index,
      )
      .slice(0, MAX_EVENTS),
    lastSchedulerTick: input.checkedAt,
    updatedAt: input.checkedAt,
  } satisfies WatchlistWorkspaceState;

  return saveWatchlistWorkspace({ ...input, state: next });
}

export function eligibleWatchlist(list: AdvisorWatchlist) {
  return Boolean(
    list.enabled &&
      list.items.length > 0 &&
      list.constraints.some((constraint) => constraint.enabled),
  );
}

export function watchlistIsDue(list: AdvisorWatchlist, now = new Date()) {
  if (!eligibleWatchlist(list) || list.scanIntervalMinutes === 0) return false;
  if (!list.lastScannedAt) return true;

  const last = Date.parse(list.lastScannedAt);
  return (
    !Number.isFinite(last) ||
    now.getTime() - last >= list.scanIntervalMinutes * 60_000
  );
}

export function nextWatchlistScanAt(list: AdvisorWatchlist, now = new Date()) {
  if (!eligibleWatchlist(list) || list.scanIntervalMinutes === 0) return null;
  if (!list.lastScannedAt) return now.toISOString();

  const last = Date.parse(list.lastScannedAt);
  if (!Number.isFinite(last)) return now.toISOString();

  return new Date(last + list.scanIntervalMinutes * 60_000).toISOString();
}

export function findWatchlist(
  state: WatchlistWorkspaceState,
  listId: string,
) {
  return listId === state.customBoardList.id
    ? state.customBoardList
    : state.lists.find((list) => list.id === listId) ?? null;
}

export async function requireStoredWatchlist(input: {
  userId: string;
  firmId: string;
  listId: string;
}) {
  const state = await loadWatchlistWorkspace(input);
  const list = findWatchlist(state, input.listId);

  if (!list) {
    throw new ApiError({
      status: 404,
      code: "WATCHLIST_NOT_FOUND",
      message: "Watchlist not found.",
      expose: true,
    });
  }

  return { state, list };
}

export const WATCHLIST_WORKSPACE_IDENTITY = {
  subjectType: SUBJECT_TYPE,
  subjectName: SUBJECT_NAME,
  memoryKeyPrefix: MEMORY_KEY_PREFIX,
} as const;