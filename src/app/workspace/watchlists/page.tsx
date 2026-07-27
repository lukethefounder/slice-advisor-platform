"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Layers3,
  ListFilter,
  Plus,
  Radar,
  RefreshCw,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import WatchlistActivity from "@/components/workspace/watchlists/watchlist-activity";
import WatchlistDetail from "@/components/workspace/watchlists/watchlist-detail";
import WatchlistRail from "@/components/workspace/watchlists/watchlist-rail";
import {
  WatchlistPill,
} from "@/components/workspace/watchlists/watchlist-ui";
import {
  CUSTOM_BOARD_SETTINGS_KEY,
  INTELLIGENCE_SCAN_CACHE_KEY,
  MAX_LIST_CONSTRAINTS,
  MAX_LIST_SECURITIES,
  WATCHLIST_EVENTS_KEY,
  WATCHLIST_SCHEDULER_KEY,
  WATCHLISTS_KEY,
  buildCustomBoardList,
  createId,
  cx,
  defaultCustomBoardList,
  defaultLists,
  guessAssetType,
  listIsDue,
  loadJson,
  normalizeWatchlists,
  nowIso,
  nowLabel,
  parseTradingViewSymbol,
  saveJson,
  scanIntervalOptions,
  type AdvisorWatchlist,
  type CheckResponse,
  type IntelligenceScan,
  type QualificationEvent,
  type ScanIntervalMinutes,
  type ScanState,
  type WatchConstraint,
} from "@/lib/workspace-watchlists";

type MobilePane =
  | "lists"
  | "editor"
  | "activity";

function eligibleForScan(
  list:
    AdvisorWatchlist,
) {
  return (
    list.enabled &&
    list.items.length >
      0 &&
    list.constraints.some(
      (constraint) =>
        constraint.enabled,
    )
  );
}

function NewListModal({
  open,
  name,
  email,
  interval,
  onNameChange,
  onEmailChange,
  onIntervalChange,
  onClose,
  onCreate,
}: {
  open:
    boolean;
  name:
    string;
  email:
    string;
  interval:
    ScanIntervalMinutes;
  onNameChange:
    (value: string) =>
      void;
  onEmailChange:
    (value: string) =>
      void;
  onIntervalChange:
    (
      value:
        ScanIntervalMinutes,
    ) => void;
  onClose:
    () => void;
  onCreate:
    () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md">
      <button
        type="button"
        aria-label="Close new list dialog"
        onClick={
          onClose
        }
        className="absolute inset-0"
      />

      <section className="relative z-10 w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-black/70">
        <div className="flex items-start justify-between gap-4">
          <div>
            <WatchlistPill tone="red">
              New watchlist
            </WatchlistPill>
            <h2 className="mt-3 text-2xl font-black text-white">
              Create an advisor list
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
              Name the list, assign its alert email, and choose its initial scan cadence.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              List name
            </span>
            <input
              autoFocus
              value={
                name
              }
              onChange={(
                event: ChangeEvent<HTMLInputElement>,
              ) =>
                onNameChange(
                  event.target
                    .value,
                )
              }
              onKeyDown={(
                event: KeyboardEvent<HTMLInputElement>,
              ) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  onCreate();
                }
              }}
              placeholder="Earnings Watch"
              className="rounded-xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              Alert email
            </span>
            <input
              type="email"
              value={
                email
              }
              onChange={(
                event: ChangeEvent<HTMLInputElement>,
              ) =>
                onEmailChange(
                  event.target
                    .value,
                )
              }
              placeholder="advisor@firm.com"
              className="rounded-xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              Scan interval
            </span>
            <select
              value={
                interval
              }
              onChange={(
                event: ChangeEvent<HTMLSelectElement>,
              ) =>
                onIntervalChange(
                  Number(
                    event.target
                      .value,
                  ) as ScanIntervalMinutes,
                )
              }
              className="rounded-xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-emerald-500 focus:ring-2"
            >
              {scanIntervalOptions.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={
              onCreate
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/35"
          >
            <Plus className="h-4 w-4" />
            Create list
          </button>
        </div>
      </section>
    </div>
  );
}

export default function WorkspaceWatchlistsPage() {
  const [
    lists,
    setLists,
  ] =
    useState<
      AdvisorWatchlist[]
    >(
      defaultLists,
    );
  const [
    activeListId,
    setActiveListId,
  ] =
    useState(
      defaultLists[0]?.id ??
        "",
    );
  const [
    customBoardList,
    setCustomBoardList,
  ] =
    useState<
      AdvisorWatchlist
    >(
      defaultCustomBoardList,
    );
  const [
    newListOpen,
    setNewListOpen,
  ] =
    useState(
      false,
    );
  const [
    newListName,
    setNewListName,
  ] =
    useState(
      "",
    );
  const [
    newListEmail,
    setNewListEmail,
  ] =
    useState(
      "",
    );
  const [
    newListInterval,
    setNewListInterval,
  ] =
    useState<ScanIntervalMinutes>(
      15,
    );
  const [
    newSymbol,
    setNewSymbol,
  ] =
    useState(
      "",
    );
  const [
    events,
    setEvents,
  ] =
    useState<
      QualificationEvent[]
    >([]);
  const [
    intelligence,
    setIntelligence,
  ] =
    useState<IntelligenceScan | null>(
      null,
    );
  const [
    scanStatus,
    setScanStatus,
  ] =
    useState<ScanState>(
      "idle",
    );
  const [
    scanStateByList,
    setScanStateByList,
  ] =
    useState<
      Record<
        string,
        ScanState
      >
    >({});
  const [
    schedulerEnabled,
    setSchedulerEnabled,
  ] =
    useState(
      false,
    );
  const [
    schedulerRunning,
    setSchedulerRunning,
  ] =
    useState(
      false,
    );
  const [
    lastSchedulerTick,
    setLastSchedulerTick,
  ] =
    useState<string | null>(
      null,
    );
  const [
    message,
    setMessage,
  ] =
    useState(
      "Watchlists ready.",
    );
  const [
    mobilePane,
    setMobilePane,
  ] =
    useState<MobilePane>(
      "editor",
    );
  const [
    clock,
    setClock,
  ] =
    useState(
      0,
    );
  const [
    hydrated,
    setHydrated,
  ] =
    useState(
      false,
    );

  const listsRef =
    useRef(
      lists,
    );
  const eventsRef =
    useRef(
      events,
    );
  const intelligenceRef =
    useRef(
      intelligence,
    );
  const customBoardRef =
    useRef(
      customBoardList,
    );
  const schedulerEnabledRef =
    useRef(
      schedulerEnabled,
    );
  const scanningIdsRef =
    useRef(
      new Set<string>(),
    );
  const schedulerCycleRef =
    useRef(
      false,
    );

  useEffect(() => {
    const storedLists =
      normalizeWatchlists(
        loadJson(
          WATCHLISTS_KEY,
          defaultLists,
        ),
      );
    const storedEvents =
      loadJson<
        QualificationEvent[]
      >(
        WATCHLIST_EVENTS_KEY,
        [],
      );
    const storedIntelligence =
      loadJson<IntelligenceScan | null>(
        INTELLIGENCE_SCAN_CACHE_KEY,
        null,
      );
    const storedScheduler =
      loadJson<boolean>(
        WATCHLIST_SCHEDULER_KEY,
        false,
      );

    setLists(
      storedLists.length
        ? storedLists
        : defaultLists,
    );
    setActiveListId(
      storedLists[0]?.id ??
        defaultLists[0]?.id ??
        "",
    );
    setEvents(
      Array.isArray(
        storedEvents,
      )
        ? storedEvents.slice(
            0,
            100,
          )
        : [],
    );
    setIntelligence(
      storedIntelligence,
    );
    setCustomBoardList(
      buildCustomBoardList(),
    );
    setSchedulerEnabled(
      storedScheduler,
    );
    setClock(
      Date.now(),
    );
    setHydrated(
      true,
    );
  }, []);

  useEffect(() => {
    listsRef.current =
      lists;

    if (
      hydrated
    ) {
      saveJson(
        WATCHLISTS_KEY,
        lists,
      );
    }
  }, [
    hydrated,
    lists,
  ]);

  useEffect(() => {
    eventsRef.current =
      events;

    if (
      hydrated
    ) {
      saveJson(
        WATCHLIST_EVENTS_KEY,
        events.slice(
          0,
          100,
        ),
      );
    }
  }, [
    events,
    hydrated,
  ]);

  useEffect(() => {
    intelligenceRef.current =
      intelligence;
  }, [
    intelligence,
  ]);

  useEffect(() => {
    customBoardRef.current =
      customBoardList;

    if (
      hydrated
    ) {
      saveJson(
        CUSTOM_BOARD_SETTINGS_KEY,
        {
          notificationEmail:
            customBoardList.notificationEmail,
          enabled:
            customBoardList.enabled,
          scanIntervalMinutes:
            customBoardList.scanIntervalMinutes,
          lastScannedAt:
            customBoardList.lastScannedAt,
          lastScanStatus:
            customBoardList.lastScanStatus,
          lastScanMessage:
            customBoardList.lastScanMessage,
        },
      );
    }
  }, [
    customBoardList,
    hydrated,
  ]);

  useEffect(() => {
    schedulerEnabledRef.current =
      schedulerEnabled;

    if (
      hydrated
    ) {
      saveJson(
        WATCHLIST_SCHEDULER_KEY,
        schedulerEnabled,
      );
    }
  }, [
    hydrated,
    schedulerEnabled,
  ]);

  useEffect(() => {
    const interval =
      window.setInterval(
        () =>
          setClock(
            Date.now(),
          ),
        15_000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, []);

  const activeList =
    useMemo(
      () =>
        activeListId ===
        customBoardList.id
          ? customBoardList
          : lists.find(
              (list) =>
                list.id ===
                activeListId,
            ) ??
            lists[0] ??
            null,
      [
        activeListId,
        customBoardList,
        lists,
      ],
    );

  const activeEvents =
    useMemo(
      () =>
        events
          .filter(
            (event) =>
              event.listId ===
              activeList?.id,
          )
          .slice(
            0,
            30,
          ),
      [
        activeList?.id,
        events,
      ],
    );

  const intelligenceAlerts =
    useMemo(
      () =>
        intelligence?.alertCandidates?.slice(
          0,
          30,
        ) ??
        [],
      [
        intelligence,
      ],
    );

  const updateList =
    useCallback(
      (
        listId:
          string,
        patch:
          Partial<AdvisorWatchlist>,
      ) => {
        setLists(
          (current) =>
            current.map(
              (list) =>
                list.id ===
                listId
                  ? {
                      ...list,
                      ...patch,
                      updatedAt:
                        nowLabel(),
                    }
                  : list,
            ),
        );
      },
      [],
    );

  const commitScanMetadata =
    useCallback(
      (
        listId:
          string,
        patch:
          Pick<
            AdvisorWatchlist,
            | "lastScannedAt"
            | "lastScanStatus"
            | "lastScanMessage"
          >,
      ) => {
        if (
          listId ===
          "custom-board-alerts"
        ) {
          setCustomBoardList(
            (current) => ({
              ...current,
              ...patch,
              updatedAt:
                nowLabel(),
            }),
          );
          return;
        }

        setLists(
          (current) =>
            current.map(
              (list) =>
                list.id ===
                listId
                  ? {
                      ...list,
                      ...patch,
                      updatedAt:
                        nowLabel(),
                    }
                  : list,
            ),
        );
      },
      [],
    );

  const refreshCustomBoard =
    useCallback(
      () => {
        setCustomBoardList(
          (current) => {
            const next =
              buildCustomBoardList();

            return {
              ...next,
              notificationEmail:
                current.notificationEmail,
              enabled:
                current.enabled,
              scanIntervalMinutes:
                current.scanIntervalMinutes,
              lastScannedAt:
                current.lastScannedAt,
              lastScanStatus:
                current.lastScanStatus,
              lastScanMessage:
                current.lastScanMessage,
            };
          },
        );
      },
      [],
    );

  const runListCheck =
    useCallback(
      async (
        list:
          AdvisorWatchlist,
        source:
          "manual" |
          "auto",
      ) => {
        if (
          scanningIdsRef.current.has(
            list.id,
          )
        ) {
          return null;
        }

        if (
          !eligibleForScan(
            list,
          )
        ) {
          const reason =
            `${list.name} needs an enabled list, at least one security, and at least one active rule.`;

          commitScanMetadata(
            list.id,
            {
              lastScannedAt:
                nowIso(),
              lastScanStatus:
                "error",
              lastScanMessage:
                reason,
            },
          );
          setMessage(
            reason,
          );

          return null;
        }

        scanningIdsRef.current.add(
          list.id,
        );
        setScanStateByList(
          (current) => ({
            ...current,
            [list.id]:
              "checking",
          }),
        );
        setScanStatus(
          "checking",
        );

        try {
          const response =
            await fetch(
              "/api/workspace/watchlists/check",
              {
                method:
                  "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    list,
                    intelligence:
                      intelligenceRef.current,
                    recentEvents:
                      eventsRef.current.slice(
                        0,
                        80,
                      ),
                    source,
                  }),
              },
            );

          const payload =
            (await response.json()) as CheckResponse & {
              error?:
                string;
            };

          if (
            !response.ok ||
            !payload.ok
          ) {
            throw new Error(
              payload.error ||
                payload.message ||
                "Watchlist check failed.",
            );
          }

          if (
            payload.triggered.length
          ) {
            setEvents(
              (current) => [
                ...payload.triggered,
                ...current,
              ].slice(
                0,
                100,
              ),
            );
          }

          commitScanMetadata(
            list.id,
            {
              lastScannedAt:
                payload.checkedAt,
              lastScanStatus:
                "success",
              lastScanMessage:
                payload.message,
            },
          );
          setScanStateByList(
            (current) => ({
              ...current,
              [list.id]:
                "synced",
            }),
          );
          setScanStatus(
            "synced",
          );
          setMessage(
            payload.message,
          );

          return payload;
        } catch (error) {
          const detail =
            error instanceof Error
              ? error.message
              : "Could not check watchlist.";

          commitScanMetadata(
            list.id,
            {
              lastScannedAt:
                nowIso(),
              lastScanStatus:
                "error",
              lastScanMessage:
                detail,
            },
          );
          setScanStateByList(
            (current) => ({
              ...current,
              [list.id]:
                "error",
            }),
          );
          setScanStatus(
            "error",
          );
          setMessage(
            detail,
          );

          return null;
        } finally {
          scanningIdsRef.current.delete(
            list.id,
          );
        }
      },
      [
        commitScanMetadata,
      ],
    );

  const runAllChecks =
    useCallback(
      async (
        source:
          "manual" |
          "auto",
      ) => {
        const candidates = [
          ...listsRef.current,
          customBoardRef.current,
        ].filter(
          eligibleForScan,
        );

        if (
          !candidates.length
        ) {
          setMessage(
            "No enabled lists with securities and active rules are ready to scan.",
          );
          setScanStatus(
            "idle",
          );
          return;
        }

        setScanStatus(
          "checking",
        );

        for (
          const list of
          candidates
        ) {
          await runListCheck(
            list,
            source,
          );
        }
      },
      [
        runListCheck,
      ],
    );

  const runScheduledCycle =
    useCallback(
      async () => {
        if (
          schedulerCycleRef.current ||
          !schedulerEnabledRef.current ||
          document.visibilityState !==
            "visible" ||
          !navigator.onLine
        ) {
          return;
        }

        const dueLists = [
          ...listsRef.current,
          customBoardRef.current,
        ].filter(
          (list) =>
            eligibleForScan(
              list,
            ) &&
            listIsDue(
              list,
            ),
        );

        setLastSchedulerTick(
          nowIso(),
        );

        if (
          !dueLists.length
        ) {
          return;
        }

        schedulerCycleRef.current =
          true;
        setSchedulerRunning(
          true,
        );

        try {
          for (
            const list of
            dueLists
          ) {
            await runListCheck(
              list,
              "auto",
            );
          }
        } finally {
          schedulerCycleRef.current =
            false;
          setSchedulerRunning(
            false,
          );
        }
      },
      [
        runListCheck,
      ],
    );

  useEffect(() => {
    if (
      !hydrated ||
      !schedulerEnabled
    ) {
      return;
    }

    const tick =
      () => {
        void runScheduledCycle();
      };

    const interval =
      window.setInterval(
        tick,
        15_000,
      );

    document.addEventListener(
      "visibilitychange",
      tick,
    );
    window.addEventListener(
      "online",
      tick,
    );

    tick();

    return () => {
      window.clearInterval(
        interval,
      );
      document.removeEventListener(
        "visibilitychange",
        tick,
      );
      window.removeEventListener(
        "online",
        tick,
      );
    };
  }, [
    hydrated,
    runScheduledCycle,
    schedulerEnabled,
  ]);

  const syncIntelligence =
    useCallback(
      async () => {
        setScanStatus(
          "checking",
        );

        try {
          const response =
            await fetch(
              "/api/intelligence/scan",
              {
                cache:
                  "no-store",
              },
            );

          if (
            !response.ok
          ) {
            throw new Error(
              "Intelligence scan failed.",
            );
          }

          const payload =
            (await response.json()) as IntelligenceScan;

          setIntelligence(
            payload,
          );
          saveJson(
            INTELLIGENCE_SCAN_CACHE_KEY,
            payload,
          );
          setScanStatus(
            "synced",
          );
          setMessage(
            "Intelligence evidence synced into the watchlist engine.",
          );
        } catch (error) {
          setScanStatus(
            "error",
          );
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not sync Intelligence.",
          );
        }
      },
      [],
    );

  function createList() {
    const name =
      newListName.trim();

    if (!name) {
      setMessage(
        "Name the list before creating it.",
      );
      return;
    }

    const next: AdvisorWatchlist = {
      id:
        createId(
          "watchlist",
        ),
      name,
      description:
        "Custom advisor watchlist.",
      tone:
        "cyan",
      notificationEmail:
        newListEmail.trim(),
      enabled:
        true,
      constraintJoin:
        "OR",
      constraints: [
        {
          id:
            createId(
              "constraint",
            ),
          metricId:
            "change-pct",
          condition:
            "above",
          value:
            "3",
          upperValue:
            "",
          priority:
            "Important",
          enabled:
            true,
        },
      ],
      items:
        [],
      scanIntervalMinutes:
        newListInterval,
      lastScannedAt:
        null,
      lastScanStatus:
        "never",
      lastScanMessage:
        "Not scanned yet.",
      createdAt:
        nowLabel(),
      updatedAt:
        nowLabel(),
    };

    setLists(
      (current) => [
        next,
        ...current,
      ],
    );
    setActiveListId(
      next.id,
    );
    setNewListName(
      "",
    );
    setNewListEmail(
      "",
    );
    setNewListInterval(
      15,
    );
    setNewListOpen(
      false,
    );
    setMobilePane(
      "editor",
    );
    setMessage(
      `Created ${name}.`,
    );
  }

  function deleteList(
    listId:
      string,
  ) {
    const remaining =
      lists.filter(
        (list) =>
          list.id !==
          listId,
      );

    setLists(
      remaining,
    );

    if (
      activeListId ===
      listId
    ) {
      setActiveListId(
        remaining[0]?.id ??
          customBoardList.id,
      );
    }

    setMessage(
      "Watchlist deleted.",
    );
  }

  function addSecurityToActiveList() {
    if (
      !activeList ||
      activeList.id ===
        customBoardList.id
    ) {
      return;
    }

    if (
      activeList.items.length >=
      MAX_LIST_SECURITIES
    ) {
      setMessage(
        "This list already has 20 securities.",
      );
      return;
    }

    const parsed =
      parseTradingViewSymbol(
        newSymbol,
      );

    if (
      !parsed.symbol ||
      !parsed.tvSymbol
    ) {
      setMessage(
        "Enter a valid symbol, such as NASDAQ:AAPL or AMEX:SPY.",
      );
      return;
    }

    if (
      activeList.items.some(
        (item) =>
          item.tvSymbol ===
          parsed.tvSymbol,
      )
    ) {
      setMessage(
        `${parsed.tvSymbol} is already in this list.`,
      );
      return;
    }

    updateList(
      activeList.id,
      {
        items: [
          {
            id:
              createId(
                "security",
              ),
            symbol:
              parsed.symbol,
            tvSymbol:
              parsed.tvSymbol,
            label:
              parsed.label,
            assetType:
              guessAssetType(
                parsed.tvSymbol,
              ),
            note:
              "Added manually",
            addedAt:
              nowLabel(),
          },
          ...activeList.items,
        ],
      },
    );
    setNewSymbol(
      "",
    );
    setMessage(
      `Added ${parsed.tvSymbol}.`,
    );
  }

  function removeSecurity(
    listId:
      string,
    securityId:
      string,
  ) {
    const list =
      lists.find(
        (item) =>
          item.id ===
          listId,
      );

    if (!list) {
      return;
    }

    updateList(
      listId,
      {
        items:
          list.items.filter(
            (item) =>
              item.id !==
              securityId,
          ),
      },
    );
  }

  function addConstraint(
    listId:
      string,
  ) {
    const list =
      lists.find(
        (item) =>
          item.id ===
          listId,
      );

    if (!list) {
      return;
    }

    if (
      list.constraints.length >=
      MAX_LIST_CONSTRAINTS
    ) {
      setMessage(
        "Each list can have up to two qualification rules.",
      );
      return;
    }

    updateList(
      listId,
      {
        constraints: [
          ...list.constraints,
          {
            id:
              createId(
                "constraint",
              ),
            metricId:
              "rsi-14",
            condition:
              "below",
            value:
              "35",
            upperValue:
              "",
            priority:
              "Monitor",
            enabled:
              true,
          },
        ],
      },
    );
  }

  function updateConstraint(
    listId:
      string,
    constraintId:
      string,
    patch:
      Partial<WatchConstraint>,
  ) {
    const list =
      lists.find(
        (item) =>
          item.id ===
          listId,
      );

    if (!list) {
      return;
    }

    updateList(
      listId,
      {
        constraints:
          list.constraints.map(
            (constraint) =>
              constraint.id ===
              constraintId
                ? {
                    ...constraint,
                    ...patch,
                  }
                : constraint,
          ),
      },
    );
  }

  function removeConstraint(
    listId:
      string,
    constraintId:
      string,
  ) {
    const list =
      lists.find(
        (item) =>
          item.id ===
          listId,
      );

    if (!list) {
      return;
    }

    updateList(
      listId,
      {
        constraints:
          list.constraints.filter(
            (constraint) =>
              constraint.id !==
              constraintId,
          ),
      },
    );
  }

  function selectList(
    listId:
      string,
  ) {
    setActiveListId(
      listId,
    );
    setMobilePane(
      "editor",
    );
  }

  const listPane = (
    <WatchlistRail
      lists={
        lists
      }
      customBoardList={
        customBoardList
      }
      activeListId={
        activeListId
      }
      clock={
        clock
      }
      schedulerEnabled={
        schedulerEnabled
      }
      scanStateByList={
        scanStateByList
      }
      onSelect={
        selectList
      }
      onOpenCreate={() =>
        setNewListOpen(
          true,
        )
      }
      onRefreshCustomBoard={
        refreshCustomBoard
      }
    />
  );

  const editorPane =
    activeList ? (
      <WatchlistDetail
        list={
          activeList
        }
        readOnly={
          activeList.id ===
          customBoardList.id
        }
        clock={
          clock
        }
        schedulerEnabled={
          schedulerEnabled
        }
        isScanning={
          scanStateByList[
            activeList.id
          ] ===
          "checking"
        }
        newSymbol={
          newSymbol
        }
        setNewSymbol={
          setNewSymbol
        }
        onUpdate={(
          patch,
        ) => {
          if (
            activeList.id ===
            customBoardList.id
          ) {
            setCustomBoardList(
              (current) => ({
                ...current,
                ...patch,
                updatedAt:
                  nowLabel(),
              }),
            );
            return;
          }

          updateList(
            activeList.id,
            patch,
          );
        }}
        onDelete={() =>
          deleteList(
            activeList.id,
          )
        }
        onAddSecurity={
          addSecurityToActiveList
        }
        onRemoveSecurity={(
          securityId,
        ) =>
          removeSecurity(
            activeList.id,
            securityId,
          )
        }
        onAddConstraint={() =>
          addConstraint(
            activeList.id,
          )
        }
        onUpdateConstraint={(
          constraintId,
          patch,
        ) =>
          updateConstraint(
            activeList.id,
            constraintId,
            patch,
          )
        }
        onRemoveConstraint={(
          constraintId,
        ) =>
          removeConstraint(
            activeList.id,
            constraintId,
          )
        }
        onRunCheck={() =>
          void runListCheck(
            activeList,
            "manual",
          )
        }
      />
    ) : (
      <div className="grid h-full place-items-center rounded-[1.45rem] border border-dashed border-white/10 bg-black/25 p-6 text-center">
        <div>
          <Layers3 className="mx-auto h-9 w-9 text-emerald-300" />
          <p className="mt-3 text-lg font-black text-white">
            Create a watchlist
          </p>
        </div>
      </div>
    );

  const activityPane = (
    <WatchlistActivity
      events={
        events
      }
      activeEvents={
        activeEvents
      }
      intelligence={
        intelligence
      }
      intelligenceAlerts={
        intelligenceAlerts
      }
      scanStatus={
        scanStatus
      }
      schedulerEnabled={
        schedulerEnabled
      }
      schedulerRunning={
        schedulerRunning
      }
      lastSchedulerTick={
        lastSchedulerTick
      }
      onToggleScheduler={() =>
        setSchedulerEnabled(
          (current) =>
            !current,
        )
      }
      onSyncIntelligence={() =>
        void syncIntelligence()
      }
      onRunAll={() =>
        void runAllChecks(
          "manual",
        )
      }
    />
  );

  const mobileTabs: Array<{
    id:
      MobilePane;
    label:
      string;
    icon:
      typeof Layers3;
  }> = [
    {
      id: "lists",
      label: "Lists",
      icon: Layers3,
    },
    {
      id: "editor",
      label: "Editor",
      icon: ListFilter,
    },
    {
      id: "activity",
      label: "Activity",
      icon: BellRing,
    },
  ];

  return (
    <main className="h-[100dvh] min-h-0 overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_28%),radial-gradient(circle_at_bottom,_rgba(168,85,247,0.1),_transparent_34%),linear-gradient(135deg,_#030712,_#050505,_#111827)] text-white">
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2.5 p-2.5 sm:p-3.5">
        <header className="min-w-0 rounded-[1.45rem] border border-white/10 bg-black/70 p-3.5 shadow-2xl shadow-emerald-950/25 backdrop-blur-xl">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <WatchlistPill tone="red">
                  <Radar className="h-3 w-3" />
                  Watchlist command
                </WatchlistPill>
                <WatchlistPill tone="cyan">
                  <BrainCircuit className="h-3 w-3" />
                  Intelligence connected
                </WatchlistPill>
                <WatchlistPill
                  tone={
                    schedulerEnabled
                      ? "green"
                      : "slate"
                  }
                >
                  <Clock3 className="h-3 w-3" />
                  {schedulerEnabled
                    ? "Per-list cadence active"
                    : "Scheduler paused"}
                </WatchlistPill>
              </div>

              <div className="mt-2 flex min-w-0 items-baseline gap-3">
                <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">
                  Advisor watchlists
                </h1>
                <span className="hidden truncate text-xs font-semibold text-slate-500 md:block">
                  Responsive monitoring with independent scan intervals.
                </span>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
              <Link
                href="/workspace"
                className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-slate-200"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  Workspace
                </span>
              </Link>

              <button
                type="button"
                onClick={() =>
                  setNewListOpen(
                    true,
                  )
                }
                className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-black text-emerald-100"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  New list
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  void syncIntelligence()
                }
                disabled={
                  scanStatus ===
                  "checking"
                }
                className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 text-xs font-black text-cyan-100 disabled:opacity-50"
              >
                {scanStatus ===
                "checking" ? (
                  <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <BrainCircuit className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">
                  Sync intel
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setSchedulerEnabled(
                    (current) =>
                      !current,
                  )
                }
                className={cx(
                  "inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black",
                  schedulerEnabled
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-white/[0.04] text-slate-300",
                )}
              >
                {schedulerRunning ? (
                  <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                ) : schedulerEnabled ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <Clock3 className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">
                  {schedulerEnabled
                    ? "Scheduler on"
                    : "Scheduler off"}
                </span>
              </button>
            </div>
          </div>

          <div className="mt-2 flex min-w-0 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2">
            <span
              className={cx(
                "h-2 w-2 shrink-0 rounded-full",
                scanStatus ===
                  "error"
                  ? "bg-emerald-400"
                  : scanStatus ===
                      "checking"
                    ? "animate-pulse bg-amber-300"
                    : scanStatus ===
                        "synced"
                      ? "bg-emerald-400"
                      : "bg-slate-500",
              )}
            />
            <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-300">
              {message}
            </p>
          </div>
        </header>

        <section className="min-h-0">
          <div className="hidden h-full min-h-0 grid-cols-[270px_minmax(0,1fr)_340px] gap-3 xl:grid">
            {listPane}
            {editorPane}
            {activityPane}
          </div>

          <div className="flex h-full min-h-0 flex-col xl:hidden">
            <div className="mb-2 grid shrink-0 grid-cols-3 rounded-xl border border-white/10 bg-black/55 p-1">
              {mobileTabs.map(
                (tab) => {
                  const Icon =
                    tab.icon;

                  return (
                    <button
                      key={
                        tab.id
                      }
                      type="button"
                      onClick={() =>
                        setMobilePane(
                          tab.id,
                        )
                      }
                      className={cx(
                        "inline-flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-xs font-black transition",
                        mobilePane ===
                          tab.id
                          ? "bg-white text-slate-950"
                          : "text-slate-400 hover:bg-white/[0.06] hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {tab.label}
                      </span>
                    </button>
                  );
                },
              )}
            </div>

            <div className="min-h-0 flex-1">
              {mobilePane ===
              "lists"
                ? listPane
                : mobilePane ===
                    "activity"
                  ? activityPane
                  : editorPane}
            </div>
          </div>
        </section>
      </div>

      <NewListModal
        open={
          newListOpen
        }
        name={
          newListName
        }
        email={
          newListEmail
        }
        interval={
          newListInterval
        }
        onNameChange={
          setNewListName
        }
        onEmailChange={
          setNewListEmail
        }
        onIntervalChange={
          setNewListInterval
        }
        onClose={() =>
          setNewListOpen(
            false,
          )
        }
        onCreate={
          createList
        }
      />
    </main>
  );
}