export type Tone =
  | "red"
  | "green"
  | "amber"
  | "purple"
  | "cyan"
  | "blue"
  | "slate";

export type ConstraintCondition =
  | "above"
  | "below"
  | "between"
  | "moves-by"
  | "crosses-above"
  | "crosses-below"
  | "news-at-least";

export type ConstraintJoin =
  | "AND"
  | "OR";

export type Priority =
  | "Monitor"
  | "Important"
  | "Critical";

export type MetricId =
  | "last-price"
  | "change-pct"
  | "volume"
  | "avg-volume"
  | "rsi-14"
  | "macd"
  | "sma-50"
  | "atr-14"
  | "market-cap"
  | "pe-ratio"
  | "dividend-yield"
  | "news-score"
  | "regulatory-risk"
  | "halt-risk"
  | "intelligence-score";

export type ScanIntervalMinutes =
  | 0
  | 1
  | 5
  | 15
  | 30
  | 60
  | 240
  | 1440;

export type ListScanStatus =
  | "never"
  | "success"
  | "error";

export type SecurityItem = {
  id: string;
  symbol: string;
  tvSymbol: string;
  label: string;
  assetType:
    | "Stock"
    | "ETF"
    | "Index"
    | "Crypto"
    | "Futures"
    | "Other";
  note: string;
  addedAt: string;
};

export type WatchConstraint = {
  id: string;
  metricId: MetricId;
  condition: ConstraintCondition;
  value: string;
  upperValue: string;
  priority: Priority;
  enabled: boolean;
};

export type AdvisorWatchlist = {
  id: string;
  name: string;
  description: string;
  tone: Tone;
  notificationEmail: string;
  enabled: boolean;
  constraintJoin: ConstraintJoin;
  constraints: WatchConstraint[];
  items: SecurityItem[];
  scanIntervalMinutes: ScanIntervalMinutes;
  lastScannedAt: string | null;
  lastScanStatus: ListScanStatus;
  lastScanMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type SharedWorkspaceWatchItem = {
  id: string;
  symbol: string;
  name: string;
  constraint: string;
  targetValue: string;
  note: string;
  source:
    | "Manual"
    | "Custom Board";
};

export type CustomBoardAlert = {
  id: string;
  symbol: string;
  tvSymbol: string;
  metricId: string;
  metricLabel: string;
  condition: string;
  threshold: string;
  upperThreshold?: string;
  note: string;
  priority?: Priority;
  createdAt: string;
  watchlistId: string;
};

export type IntelligenceScan = {
  scannedAt: string;
  items?: IntelligenceItem[];
  alertCandidates?: IntelligenceItem[];
  sources?: Array<{
    id: string;
    name: string;
    ok: boolean;
    fetched: number;
  }>;
};

export type IntelligenceItem = {
  id: string;
  title: string;
  summary: string;
  urgency:
    | "Critical"
    | "High"
    | "Medium"
    | "Low"
    | "Suppressed";
  score: number;
  matchedTickers: string[];
  shouldAlert: boolean;
  sourceName: string;
  link: string;
};

export type QualificationEvent = {
  id: string;
  key: string;
  listId: string;
  listName: string;
  symbol: string;
  tvSymbol: string;
  metricId: MetricId;
  metricLabel: string;
  observedDisplay: string;
  condition: string;
  thresholdDisplay: string;
  priority: Priority;
  emailSent: boolean;
  emailSkippedReason?: string;
  message: string;
  createdAt: string;
};

export type CheckResponse = {
  ok: boolean;
  checkedAt: string;
  checkedSymbols: number;
  triggered: QualificationEvent[];
  message: string;
};

export type ScanState =
  | "idle"
  | "checking"
  | "synced"
  | "error";

export const WATCHLISTS_KEY =
  "slice-workspace-watchlists-v1";
export const WATCHLIST_EVENTS_KEY =
  "slice-workspace-watchlist-events-v1";
export const SHARED_WATCHLIST_KEY =
  "slice-shared-watchlist-v1";
export const CUSTOM_BOARD_ALERTS_KEY =
  "slice-custom-board-alerts-v1";
export const CUSTOM_BOARD_SETTINGS_KEY =
  "slice-custom-board-watchlist-settings-v2";
export const INTELLIGENCE_SCAN_CACHE_KEY =
  "slice-workspace-intelligence-scan-v1";
export const WATCHLIST_SCHEDULER_KEY =
  "slice-workspace-watchlist-scheduler-v2";

export const MAX_LIST_SECURITIES = 20;
export const MAX_LIST_CONSTRAINTS = 2;

export const scanIntervalOptions: Array<{
  value: ScanIntervalMinutes;
  label: string;
  shortLabel: string;
}> = [
  {
    value: 0,
    label: "Manual only",
    shortLabel: "Manual",
  },
  {
    value: 1,
    label: "Every minute",
    shortLabel: "1 min",
  },
  {
    value: 5,
    label: "Every 5 minutes",
    shortLabel: "5 min",
  },
  {
    value: 15,
    label: "Every 15 minutes",
    shortLabel: "15 min",
  },
  {
    value: 30,
    label: "Every 30 minutes",
    shortLabel: "30 min",
  },
  {
    value: 60,
    label: "Every hour",
    shortLabel: "1 hr",
  },
  {
    value: 240,
    label: "Every 4 hours",
    shortLabel: "4 hr",
  },
  {
    value: 1440,
    label: "Once per day",
    shortLabel: "Daily",
  },
];

export const metricOptions: Array<{
  id: MetricId;
  label: string;
  short: string;
  group: string;
  tone: Tone;
}> = [
  {
    id: "last-price",
    label: "Last Price",
    short: "Price",
    group: "Market",
    tone: "cyan",
  },
  {
    id: "change-pct",
    label: "Change %",
    short: "Move",
    group: "Market",
    tone: "cyan",
  },
  {
    id: "volume",
    label: "Volume",
    short: "Vol",
    group: "Liquidity",
    tone: "blue",
  },
  {
    id: "avg-volume",
    label: "Average Volume",
    short: "Avg Vol",
    group: "Liquidity",
    tone: "blue",
  },
  {
    id: "rsi-14",
    label: "RSI 14",
    short: "RSI",
    group: "Technical",
    tone: "purple",
  },
  {
    id: "macd",
    label: "MACD",
    short: "MACD",
    group: "Technical",
    tone: "purple",
  },
  {
    id: "sma-50",
    label: "50 SMA",
    short: "SMA50",
    group: "Technical",
    tone: "purple",
  },
  {
    id: "atr-14",
    label: "ATR 14",
    short: "ATR",
    group: "Risk",
    tone: "red",
  },
  {
    id: "market-cap",
    label: "Market Cap",
    short: "Mkt Cap",
    group: "Valuation",
    tone: "amber",
  },
  {
    id: "pe-ratio",
    label: "P/E Ratio",
    short: "P/E",
    group: "Valuation",
    tone: "amber",
  },
  {
    id: "dividend-yield",
    label: "Dividend Yield",
    short: "Yield",
    group: "Income",
    tone: "green",
  },
  {
    id: "news-score",
    label: "News Score",
    short: "News",
    group: "Intelligence",
    tone: "red",
  },
  {
    id: "regulatory-risk",
    label: "Regulatory Risk",
    short: "Reg",
    group: "Intelligence",
    tone: "red",
  },
  {
    id: "halt-risk",
    label: "Halt Risk",
    short: "Halt",
    group: "Intelligence",
    tone: "red",
  },
  {
    id: "intelligence-score",
    label: "Intelligence Score",
    short: "Intel",
    group: "Intelligence",
    tone: "cyan",
  },
];

export const toneOptions: Tone[] = [
  "red",
  "green",
  "amber",
  "purple",
  "cyan",
  "blue",
  "slate",
];

const defaultGrowthItems: SecurityItem[] = [
  {
    id: "growth-nvda",
    symbol: "NVDA",
    tvSymbol: "NASDAQ:NVDA",
    label: "NVDA",
    assetType: "Stock",
    note: "AI concentration",
    addedAt: "Default",
  },
  {
    id: "growth-msft",
    symbol: "MSFT",
    tvSymbol: "NASDAQ:MSFT",
    label: "MSFT",
    assetType: "Stock",
    note: "Cloud and AI",
    addedAt: "Default",
  },
  {
    id: "growth-aapl",
    symbol: "AAPL",
    tvSymbol: "NASDAQ:AAPL",
    label: "AAPL",
    assetType: "Stock",
    note: "Mega-cap quality",
    addedAt: "Default",
  },
];

const defaultRiskItems: SecurityItem[] = [
  {
    id: "risk-spy",
    symbol: "SPY",
    tvSymbol: "AMEX:SPY",
    label: "SPY",
    assetType: "ETF",
    note: "Market benchmark",
    addedAt: "Default",
  },
  {
    id: "risk-tlt",
    symbol: "TLT",
    tvSymbol: "AMEX:TLT",
    label: "TLT",
    assetType: "ETF",
    note: "Rates / duration",
    addedAt: "Default",
  },
  {
    id: "risk-tsla",
    symbol: "TSLA",
    tvSymbol: "NASDAQ:TSLA",
    label: "TSLA",
    assetType: "Stock",
    note: "High beta",
    addedAt: "Default",
  },
];

export const defaultCustomBoardList: AdvisorWatchlist = {
  id: "custom-board-alerts",
  name: "Custom Board Alerts",
  description:
    "Derived from active alert rules created on the Custom Board.",
  tone: "purple",
  notificationEmail: "",
  enabled: true,
  constraintJoin: "OR",
  constraints: [
    {
      id: "constraint-custom-placeholder",
      metricId: "last-price",
      condition: "above",
      value: "",
      upperValue: "",
      priority: "Monitor",
      enabled: false,
    },
  ],
  items: [],
  scanIntervalMinutes: 15,
  lastScannedAt: null,
  lastScanStatus: "never",
  lastScanMessage:
    "Derived list has not been scanned.",
  createdAt: "Custom Board",
  updatedAt: "Custom Board",
};

export const defaultLists: AdvisorWatchlist[] = [
  {
    id: "growth-watch",
    name: "Growth Watch",
    description:
      "High-priority growth names where movement, liquidity, or momentum deserves immediate advisor review.",
    tone: "cyan",
    notificationEmail: "",
    enabled: true,
    constraintJoin: "OR",
    constraints: [
      {
        id: "constraint-growth-move",
        metricId: "change-pct",
        condition: "above",
        value: "3",
        upperValue: "",
        priority: "Important",
        enabled: true,
      },
      {
        id: "constraint-growth-rsi",
        metricId: "rsi-14",
        condition: "below",
        value: "35",
        upperValue: "",
        priority: "Monitor",
        enabled: true,
      },
    ],
    items: defaultGrowthItems,
    scanIntervalMinutes: 15,
    lastScannedAt: null,
    lastScanStatus: "never",
    lastScanMessage: "Not scanned yet.",
    createdAt: "Default",
    updatedAt: "Default",
  },
  {
    id: "risk-watch",
    name: "Risk Watch",
    description:
      "Names that should trigger review when market stress, news, or regulatory events appear.",
    tone: "red",
    notificationEmail: "",
    enabled: true,
    constraintJoin: "OR",
    constraints: [
      {
        id: "constraint-risk-news",
        metricId: "news-score",
        condition: "above",
        value: "75",
        upperValue: "",
        priority: "Critical",
        enabled: true,
      },
      {
        id: "constraint-risk-reg",
        metricId: "regulatory-risk",
        condition: "above",
        value: "50",
        upperValue: "",
        priority: "Critical",
        enabled: true,
      },
    ],
    items: defaultRiskItems,
    scanIntervalMinutes: 5,
    lastScannedAt: null,
    lastScanStatus: "never",
    lastScanMessage: "Not scanned yet.",
    createdAt: "Default",
    updatedAt: "Default",
  },
];

export function cx(
  ...classes: Array<
    string | false | null | undefined
  >
) {
  return classes
    .filter(Boolean)
    .join(" ");
}

export function createId(
  prefix: string,
) {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function nowLabel() {
  return new Date().toLocaleString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
}

export function nowIso() {
  return new Date().toISOString();
}

export function guessAssetType(
  tvSymbol: string,
): SecurityItem["assetType"] {
  const symbol =
    tvSymbol.toUpperCase();

  if (
    symbol.includes("BINANCE:") ||
    symbol.includes("BTC") ||
    symbol.includes("ETH")
  ) {
    return "Crypto";
  }

  if (
    symbol.includes("CME") ||
    symbol.endsWith("1!")
  ) {
    return "Futures";
  }

  if (
    symbol.includes("SP:") ||
    symbol.includes("TVC:")
  ) {
    return "Index";
  }

  if (
    symbol.includes("AMEX:")
  ) {
    return "ETF";
  }

  return "Stock";
}

export function parseTradingViewSymbol(
  raw: string,
) {
  const cleaned =
    raw
      .trim()
      .replace(
        /\s+/g,
        "",
      )
      .toUpperCase();

  if (!cleaned) {
    return {
      symbol: "",
      tvSymbol: "",
      label: "",
    };
  }

  if (
    cleaned.includes(":")
  ) {
    const [
      exchange,
      ...rest
    ] = cleaned.split(":");
    const symbol =
      rest
        .join(":")
        .replace(
          /[^A-Z0-9._/!\-$]/g,
          "",
        );
    const cleanExchange =
      exchange.replace(
        /[^A-Z0-9._-]/g,
        "",
      );

    return {
      symbol,
      tvSymbol:
        `${cleanExchange}:${symbol}`,
      label: symbol,
    };
  }

  const symbol =
    cleaned.replace(
      /[^A-Z0-9._/!\-$]/g,
      "",
    );

  return {
    symbol,
    tvSymbol:
      `NASDAQ:${symbol}`,
    label: symbol,
  };
}

export function loadJson<T>(
  key: string,
  fallback: T,
): T {
  if (
    typeof window ===
    "undefined"
  ) {
    return fallback;
  }

  try {
    const raw =
      window.localStorage.getItem(
        key,
      );

    if (!raw) {
      return fallback;
    }

    return JSON.parse(
      raw,
    ) as T;
  } catch {
    return fallback;
  }
}

export function saveJson<T>(
  key: string,
  value: T,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.localStorage.setItem(
    key,
    JSON.stringify(value),
  );
}

function validScanInterval(
  value: unknown,
): ScanIntervalMinutes {
  const parsed =
    Number(value);
  const valid =
    scanIntervalOptions.some(
      (option) =>
        option.value === parsed,
    );

  return valid
    ? (parsed as ScanIntervalMinutes)
    : 15;
}

export function normalizeWatchlist(
  candidate:
    Partial<AdvisorWatchlist>,
  fallback:
    AdvisorWatchlist,
) {
  return {
    ...fallback,
    ...candidate,
    tone:
      toneOptions.includes(
        candidate.tone as Tone,
      )
        ? (candidate.tone as Tone)
        : fallback.tone,
    enabled:
      candidate.enabled !==
      false,
    constraintJoin:
      candidate.constraintJoin ===
      "AND"
        ? "AND"
        : "OR",
    constraints:
      Array.isArray(
        candidate.constraints,
      )
        ? candidate.constraints
            .slice(
              0,
              MAX_LIST_CONSTRAINTS,
            )
            .map(
              (
                constraint,
                index,
              ) => ({
                id:
                  constraint.id ||
                  `${fallback.id}-constraint-${index}`,
                metricId:
                  metricOptions.some(
                    (metric) =>
                      metric.id ===
                      constraint.metricId,
                  )
                    ? constraint.metricId
                    : "change-pct",
                condition:
                  [
                    "above",
                    "below",
                    "between",
                    "moves-by",
                    "crosses-above",
                    "crosses-below",
                    "news-at-least",
                  ].includes(
                    constraint.condition,
                  )
                    ? constraint.condition
                    : "above",
                value:
                  String(
                    constraint.value ??
                    "",
                  ),
                upperValue:
                  String(
                    constraint.upperValue ??
                    "",
                  ),
                priority:
                  [
                    "Monitor",
                    "Important",
                    "Critical",
                  ].includes(
                    constraint.priority,
                  )
                    ? constraint.priority
                    : "Monitor",
                enabled:
                  constraint.enabled !==
                  false,
              }),
            )
        : fallback.constraints,
    items:
      Array.isArray(
        candidate.items,
      )
        ? candidate.items
            .slice(
              0,
              MAX_LIST_SECURITIES,
            )
            .map(
              (
                item,
                index,
              ) => ({
                id:
                  item.id ||
                  `${fallback.id}-security-${index}`,
                symbol:
                  String(
                    item.symbol ??
                    "",
                  ).toUpperCase(),
                tvSymbol:
                  String(
                    item.tvSymbol ??
                    "",
                  ).toUpperCase(),
                label:
                  String(
                    item.label ??
                    item.symbol ??
                    "",
                  ).toUpperCase(),
                assetType:
                  item.assetType ||
                  guessAssetType(
                    String(
                      item.tvSymbol ??
                      item.symbol ??
                      "",
                    ),
                  ),
                note:
                  String(
                    item.note ??
                    "",
                  ),
                addedAt:
                  String(
                    item.addedAt ??
                    "Imported",
                  ),
              }),
            )
        : fallback.items,
    scanIntervalMinutes:
      validScanInterval(
        candidate.scanIntervalMinutes,
      ),
    lastScannedAt:
      typeof candidate.lastScannedAt ===
        "string"
        ? candidate.lastScannedAt
        : null,
    lastScanStatus:
      [
        "never",
        "success",
        "error",
      ].includes(
        String(
          candidate.lastScanStatus,
        ),
      )
        ? (candidate.lastScanStatus as ListScanStatus)
        : "never",
    lastScanMessage:
      String(
        candidate.lastScanMessage ??
        "Not scanned yet.",
      ),
    createdAt:
      String(
        candidate.createdAt ??
        fallback.createdAt,
      ),
    updatedAt:
      String(
        candidate.updatedAt ??
        fallback.updatedAt,
      ),
  } satisfies AdvisorWatchlist;
}

export function normalizeWatchlists(
  value: unknown,
) {
  if (
    !Array.isArray(value)
  ) {
    return defaultLists;
  }

  return value
    .filter(
      (
        item,
      ): item is Partial<AdvisorWatchlist> =>
        Boolean(
          item &&
          typeof item ===
            "object",
        ),
    )
    .map(
      (
        item,
        index,
      ) => {
        const fallback =
          defaultLists.find(
            (list) =>
              list.id === item.id,
          ) ??
          {
            ...defaultLists[0],
            id:
              String(
                item.id ??
                `imported-${index}`,
              ),
            name:
              String(
                item.name ??
                `Watchlist ${index + 1}`,
              ),
            items: [],
            constraints: [],
          };

        return normalizeWatchlist(
          item,
          fallback,
        );
      },
    );
}

export function normalizeMetricId(
  value: string,
): MetricId {
  const candidate =
    value as MetricId;

  if (
    metricOptions.some(
      (metric) =>
        metric.id === candidate,
    )
  ) {
    return candidate;
  }

  if (
    value.includes("rsi")
  ) {
    return "rsi-14";
  }

  if (
    value.includes("macd")
  ) {
    return "macd";
  }

  if (
    value.includes("volume")
  ) {
    return "volume";
  }

  if (
    value.includes("price")
  ) {
    return "last-price";
  }

  return "last-price";
}

export function normalizeCondition(
  value: string,
): ConstraintCondition {
  const candidate =
    value as ConstraintCondition;

  if (
    [
      "above",
      "below",
      "between",
      "moves-by",
      "crosses-above",
      "crosses-below",
      "news-at-least",
    ].includes(candidate)
  ) {
    return candidate;
  }

  if (
    value.includes("below")
  ) {
    return "below";
  }

  if (
    value.includes("between")
  ) {
    return "between";
  }

  if (
    value.includes("cross")
  ) {
    return "crosses-above";
  }

  return "above";
}

export function buildCustomBoardList() {
  const shared =
    loadJson<
      SharedWorkspaceWatchItem[]
    >(
      SHARED_WATCHLIST_KEY,
      [],
    );
  const alerts =
    loadJson<
      CustomBoardAlert[]
    >(
      CUSTOM_BOARD_ALERTS_KEY,
      [],
    );
  const settings =
    loadJson<
      Partial<AdvisorWatchlist>
    >(
      CUSTOM_BOARD_SETTINGS_KEY,
      {},
    );

  const alertItems =
    shared
      .filter(
        (item) =>
          item.source ===
          "Custom Board",
      )
      .slice(
        0,
        MAX_LIST_SECURITIES,
      )
      .map(
        (
          item,
          index,
        ): SecurityItem => {
          const parsed =
            parseTradingViewSymbol(
              item.name ||
              `NASDAQ:${item.symbol}`,
            );

          return {
            id:
              item.id ||
              `custom-security-${index}`,
            symbol:
              parsed.symbol ||
              item.symbol.toUpperCase(),
            tvSymbol:
              parsed.tvSymbol ||
              `NASDAQ:${item.symbol.toUpperCase()}`,
            label:
              parsed.label ||
              item.symbol.toUpperCase(),
            assetType:
              guessAssetType(
                parsed.tvSymbol,
              ),
            note:
              item.constraint ||
              item.note ||
              "Custom Board",
            addedAt:
              "Custom Board",
          };
        },
      );

  const alertConstraints:
    WatchConstraint[] =
      alerts
        .slice(
          0,
          MAX_LIST_CONSTRAINTS,
        )
        .map(
          (alert) => ({
            id:
              `constraint-custom-${alert.id}`,
            metricId:
              normalizeMetricId(
                alert.metricId,
              ),
            condition:
              normalizeCondition(
                alert.condition,
              ),
            value:
              alert.threshold ||
              "",
            upperValue:
              alert.upperThreshold ||
              "",
            priority:
              alert.priority ||
              "Important",
            enabled:
              true,
          }),
        );

  return {
    ...defaultCustomBoardList,
    notificationEmail:
      typeof settings.notificationEmail ===
        "string"
        ? settings.notificationEmail
        : defaultCustomBoardList.notificationEmail,
    enabled:
      settings.enabled !==
      false,
    scanIntervalMinutes:
      validScanInterval(
        settings.scanIntervalMinutes,
      ),
    lastScannedAt:
      typeof settings.lastScannedAt ===
        "string"
        ? settings.lastScannedAt
        : null,
    lastScanStatus:
      [
        "never",
        "success",
        "error",
      ].includes(
        String(
          settings.lastScanStatus,
        ),
      )
        ? (settings.lastScanStatus as ListScanStatus)
        : "never",
    lastScanMessage:
      typeof settings.lastScanMessage ===
        "string"
        ? settings.lastScanMessage
        : defaultCustomBoardList.lastScanMessage,
    constraints:
      alertConstraints.length
        ? alertConstraints
        : defaultCustomBoardList.constraints,
    items:
      alertItems,
    updatedAt:
      typeof window ===
        "undefined"
        ? "Custom Board"
        : nowLabel(),
  };
}

export function metricLabel(
  metricId: MetricId,
) {
  return (
    metricOptions.find(
      (metric) =>
        metric.id === metricId,
    )?.label ??
    metricId
  );
}

export function priorityTone(
  priority: Priority,
): Tone {
  if (
    priority ===
    "Critical"
  ) {
    return "red";
  }

  if (
    priority ===
    "Important"
  ) {
    return "amber";
  }

  return "blue";
}

export function constraintSentence(
  constraint: WatchConstraint,
) {
  const metric =
    metricLabel(
      constraint.metricId,
    );

  if (
    constraint.condition ===
    "between"
  ) {
    return `${metric} between ${constraint.value || "—"} and ${constraint.upperValue || "—"}`;
  }

  if (
    constraint.condition ===
    "moves-by"
  ) {
    return `${metric} moves by ${constraint.value || "—"}`;
  }

  if (
    constraint.condition ===
    "news-at-least"
  ) {
    return `${metric} at least ${constraint.value || "High"}`;
  }

  return `${metric} ${constraint.condition.replace("-", " ")} ${constraint.value || "—"}`;
}

export function toneClass(
  tone: Tone,
) {
  const tones: Record<
    Tone,
    string
  > = {
    red:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/20",
    green:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/20",
    amber:
      "border-amber-500/25 bg-amber-500/10 text-amber-100 shadow-amber-950/20",
    purple:
      "border-purple-500/25 bg-purple-500/10 text-purple-100 shadow-purple-950/20",
    cyan:
      "border-cyan-500/25 bg-cyan-500/10 text-cyan-100 shadow-cyan-950/20",
    blue:
      "border-blue-500/25 bg-blue-500/10 text-blue-100 shadow-blue-950/20",
    slate:
      "border-slate-500/20 bg-slate-500/10 text-slate-100 shadow-slate-950/20",
  };

  return tones[tone];
}

export function dotClass(
  tone: Tone,
) {
  const tones: Record<
    Tone,
    string
  > = {
    red:
      "bg-emerald-400 shadow-emerald-400/50",
    green:
      "bg-emerald-400 shadow-emerald-400/50",
    amber:
      "bg-amber-400 shadow-amber-400/50",
    purple:
      "bg-purple-400 shadow-purple-400/50",
    cyan:
      "bg-cyan-400 shadow-cyan-400/50",
    blue:
      "bg-blue-400 shadow-blue-400/50",
    slate:
      "bg-slate-400 shadow-slate-400/50",
  };

  return tones[tone];
}

export function scanIntervalLabel(
  minutes:
    ScanIntervalMinutes,
) {
  return (
    scanIntervalOptions.find(
      (option) =>
        option.value === minutes,
    )?.shortLabel ??
    "Manual"
  );
}

export function nextScanTimestamp(
  list:
    AdvisorWatchlist,
) {
  if (
    !list.enabled ||
    list.scanIntervalMinutes ===
      0
  ) {
    return null;
  }

  if (
    !list.lastScannedAt
  ) {
    return 0;
  }

  const last =
    Date.parse(
      list.lastScannedAt,
    );

  if (
    !Number.isFinite(last)
  ) {
    return 0;
  }

  return (
    last +
    list.scanIntervalMinutes *
      60_000
  );
}

export function listIsDue(
  list:
    AdvisorWatchlist,
  now = Date.now(),
) {
  const next =
    nextScanTimestamp(
      list,
    );

  return (
    next !== null &&
    next <= now
  );
}

export function relativeScanTime(
  timestamp:
    number | null,
  now = Date.now(),
) {
  if (
    timestamp === null
  ) {
    return "Manual";
  }

  const delta =
    timestamp - now;

  if (
    delta <= 0
  ) {
    return "Due now";
  }

  const minutes =
    Math.ceil(
      delta / 60_000,
    );

  if (
    minutes < 60
  ) {
    return `in ${minutes}m`;
  }

  const hours =
    Math.ceil(
      minutes / 60,
    );

  if (
    hours < 24
  ) {
    return `in ${hours}h`;
  }

  return `in ${Math.ceil(
    hours / 24,
  )}d`;
}

export function formatScanTime(
  value:
    string | null,
) {
  if (!value) {
    return "Never";
  }

  const date =
    new Date(value);

  if (
    !Number.isFinite(
      date.getTime(),
    )
  ) {
    return "Unknown";
  }

  return date.toLocaleString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
}