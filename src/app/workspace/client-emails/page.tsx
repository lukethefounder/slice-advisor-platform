"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
  FilePenLine,
  FileText,
  Inbox,
  Layers3,
  Loader2,
  Plus,
  Radar,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WandSparkles,
  X,
} from "lucide-react";

type Holding = {
  id: string;
  symbol: string;
  assetName: string;
  assetClass: string;
  value: string | null;
  allocationPct: string | null;
  riskLevel: string;
};

type Client = {
  id: string;
  fullName: string;
  householdName: string | null;
  email: string | null;
  emailMissing: boolean;
  clientType: string;
  riskProfile: string;
  status: string;
  holdings: Holding[];
};

type Draft = {
  id: string;
  clientName: string | null;
  title: string;
  body: string;
  status: string;
  tone: string;
  createdAt: string;
  updatedAt: string;
  sourceSummary?: {
    scratchDraft?: boolean;
    clientId?: string | null;
    clientName?: string;
    manualDraft?: boolean;
    holdings?: Array<{
      symbol: string;
      assetName: string;
      assetClass: string;
      value: string | null;
      allocationPct: string | null;
      riskLevel: string;
    }>;
    ai?: {
      polished?: boolean;
      strategy?: string;
      researchSummary?: string;
      error?: string | null;
    };
  };
  complianceNotes?: string[];
};

type Approval = {
  id: string;
  title: string;
  summary: string;
  status: string;
  approvedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  payload?: {
    draftIds?: string[];
  };
};

type Payload = {
  clients: Client[];
  drafts: Draft[];
  archivedDrafts?: Draft[];
  approvals: Approval[];
  metrics: {
    clientsWithEmail: number;
    draftCount: number;
    pendingApprovalCount: number;
    sentCount?: number;
  };
  aiRuntime?: {
    configured: boolean;
    model: string;
  };
};

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
} | null;

type View = "compose" | "drafts" | "queue";
type AudienceMode = "portfolio" | "clients" | "all" | "scratch";
type DraftFilter = "working" | "approval" | "sent" | "all";
type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

const EMPTY: Payload = {
  clients: [],
  drafts: [],
  archivedDrafts: [],
  approvals: [],
  metrics: {
    clientsWithEmail: 0,
    draftCount: 0,
    pendingApprovalCount: 0,
    sentCount: 0,
  },
};

const INPUT =
  "w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2 disabled:opacity-50";

const SOFT =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-black text-white transition hover:bg-white/10 disabled:opacity-40";

const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500 disabled:opacity-40";

const STARTERS = [
  [
    "Market volatility",
    "Draft a calm, proactive email about recent market volatility, what we are monitoring, and why the client's long-term plan remains the primary decision framework.",
    "Reassure clients and reduce reactive decisions",
  ],
  [
    "Holding update",
    "Draft a personalized update for clients who hold the selected securities. Explain the relevant development, portfolio context, and what the advisory team is monitoring without making guarantees.",
    "Provide timely portfolio-specific context",
  ],
  [
    "Review invitation",
    "Draft a polished email inviting the client to schedule a portfolio and planning review. Make the value and next action obvious.",
    "Increase client review engagement",
  ],
  [
    "Planning reminder",
    "Draft a concise planning reminder covering upcoming deadlines, documents to prepare, and the next action the client should take.",
    "Make the next planning step obvious",
  ],
] as const;

function cx(
  ...values: Array<string | false | null | undefined>
) {
  return values.filter(Boolean).join(" ");
}

function sortDrafts(drafts: Draft[]) {
  return [...drafts].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() -
      new Date(a.updatedAt).getTime()
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function paragraphList(value: string) {
  return value
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function recipientName(draft: Draft | null) {
  if (!draft) {
    return "No recipient";
  }

  if (draft.sourceSummary?.scratchDraft) {
    return "Unassigned draft";
  }

  return (
    draft.clientName ||
    draft.sourceSummary?.clientName ||
    "Client"
  );
}

function editable(draft: Draft | null) {
  return Boolean(
    draft &&
      !["Sent", "Simulated", "Archived"].includes(
        draft.status
      )
  );
}

function sendable(draft: Draft) {
  return (
    !draft.sourceSummary?.scratchDraft &&
    ["Draft", "Edited", "Delivery Failed"].includes(
      draft.status
    )
  );
}

function statusClass(status: string) {
  const value = status.toLowerCase();

  if (
    value.includes("sent") ||
    value.includes("approved")
  ) {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  }

  if (value.includes("failed")) {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  }

  if (
    value.includes("approval") ||
    value.includes("pending")
  ) {
    return "border-amber-400/25 bg-amber-400/10 text-amber-200";
  }

  if (value.includes("simulated")) {
    return "border-violet-400/25 bg-violet-400/10 text-violet-200";
  }

  return "border-white/10 bg-white/[0.055] text-slate-300";
}

function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em]",
        className
      )}
    >
      {children}
    </span>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-zinc-950/82 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: number;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-4">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-600/10 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.17em] text-slate-500">
            {label}
          </div>

          <div className="mt-2 text-3xl font-black">
            {value}
          </div>

          <div className="mt-1 text-xs font-semibold text-slate-500">
            {helper}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-300">
          {icon}
        </div>
      </div>
    </div>
  );
}

function NoticeBar({
  notice,
  close,
}: {
  notice: Notice;
  close: () => void;
}) {
  if (!notice) {
    return null;
  }

  const style =
    notice.tone === "success"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
      : notice.tone === "error"
        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
        : "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";

  return (
    <div
      className={cx(
        "flex items-start justify-between gap-3 rounded-2xl border p-4",
        style
      )}
    >
      <div className="flex items-start gap-3 text-sm font-bold leading-6">
        {notice.tone === "success" ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
        )}

        {notice.text}
      </div>

      <button
        type="button"
        onClick={close}
        className="rounded-lg p-1 hover:bg-white/10"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SaveLabel({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving
      </span>
    );
  }

  if (state === "unsaved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-200">
        <Clock3 className="h-3.5 w-3.5" />
        Unsaved
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-200">
        <CircleAlert className="h-3.5 w-3.5" />
        Save failed
      </span>
    );
  }

  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-200">
        <Check className="h-3.5 w-3.5" />
        Saved
      </span>
    );
  }

  return null;
}

async function post(
  body: Record<string, unknown>,
  sensitiveAction: string
) {
  const response = await fetch("/api/client-emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-slice-sensitive-action": sensitiveAction,
    },
    body: JSON.stringify(body),
  });

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ?? "The email action failed."
    );
  }

  return data;
}

function replaceDraft(
  payload: Payload,
  draft: Draft
): Payload {
  return {
    ...payload,
    drafts: sortDrafts([
      ...payload.drafts.filter(
        (item) => item.id !== draft.id
      ),
      ...(draft.status === "Archived" ? [] : [draft]),
    ]),
    archivedDrafts: sortDrafts([
      ...(payload.archivedDrafts ?? []).filter(
        (item) => item.id !== draft.id
      ),
      ...(draft.status === "Archived" ? [draft] : []),
    ]),
  };
}

export default function ClientEmailsPage() {
  const [payload, setPayload] =
    useState<Payload>(EMPTY);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState<string | null>(
    null
  );
  const [notice, setNotice] =
    useState<Notice>(null);
  const [view, setView] =
    useState<View>("compose");

  const [composeMode, setComposeMode] = useState<
    "ai" | "manual"
  >("ai");

  const [audienceMode, setAudienceMode] =
    useState<AudienceMode>("portfolio");

  const [selectedSymbols, setSelectedSymbols] =
    useState<string[]>([]);

  const [selectedClientIds, setSelectedClientIds] =
    useState<string[]>([]);

  const [holdingSearch, setHoldingSearch] =
    useState("");

  const [clientSearch, setClientSearch] =
    useState("");

  const [riskFilter, setRiskFilter] = useState(
    "All risk profiles"
  );

  const [clientTypeFilter, setClientTypeFilter] =
    useState("All client types");

  const [aiForm, setAiForm] = useState({
    topic: "",
    objective:
      "Provide a clear, useful, and reassuring advisor update",
    tone:
      "Professional, calm, polished, and reassuring",
    instructions: "",
    callToAction: "",
    useResearch: false,
  });

  const [manualForm, setManualForm] = useState({
    subject: "",
    body: "",
  });

  const [draftSearch, setDraftSearch] =
    useState("");

  const [draftFilter, setDraftFilter] =
    useState<DraftFilter>("working");

  const [activeDraftId, setActiveDraftId] =
    useState("");

  const [selectedDraftIds, setSelectedDraftIds] =
    useState<string[]>([]);

  const [editor, setEditor] = useState({
    subject: "",
    body: "",
  });

  const [saveState, setSaveState] =
    useState<SaveState>("idle");

  const [polishOpen, setPolishOpen] =
    useState(false);

  const [polishMode, setPolishMode] = useState(
    "Professional polish"
  );

  const [
    polishInstructions,
    setPolishInstructions,
  ] = useState("");

  const [approvalFilter, setApprovalFilter] =
    useState<"pending" | "history">("pending");

  const [
    selectedApprovalId,
    setSelectedApprovalId,
  ] = useState("");

  const [approvalNote, setApprovalNote] = useState(
    "Reviewed and approved by the advisor for client delivery."
  );

  const [sendConfirmed, setSendConfirmed] =
    useState(false);

  const timerRef = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  const savedRef = useRef({
    id: "",
    subject: "",
    body: "",
  });

  const activeIdRef = useRef("");
  const editorRef = useRef(editor);

  const allDrafts = useMemo(
    () =>
      sortDrafts([
        ...payload.drafts,
        ...(payload.archivedDrafts ?? []),
      ]),
    [payload.drafts, payload.archivedDrafts]
  );

  const draftMap = useMemo(
    () =>
      new Map(
        allDrafts.map((draft) => [
          draft.id,
          draft,
        ])
      ),
    [allDrafts]
  );

  const clientMap = useMemo(
    () =>
      new Map(
        payload.clients.map((client) => [
          client.id,
          client,
        ])
      ),
    [payload.clients]
  );

  const activeDraft = useMemo(
    () =>
      allDrafts.find(
        (draft) => draft.id === activeDraftId
      ) ?? null,
    [allDrafts, activeDraftId]
  );

  const activeClient =
    activeDraft?.sourceSummary?.clientId
      ? clientMap.get(
          activeDraft.sourceSummary.clientId
        )
      : null;

  const emailClients = useMemo(
    () =>
      payload.clients.filter((client) =>
        Boolean(client.email)
      ),
    [payload.clients]
  );

  const holdingUniverse = useMemo(() => {
    const map = new Map<
      string,
      {
        symbol: string;
        assetName: string;
        assetClass: string;
        count: number;
      }
    >();

    for (const client of emailClients) {
      const seen = new Set<string>();

      for (const holding of client.holdings) {
        const symbol = holding.symbol
          .trim()
          .toUpperCase();

        if (!symbol || seen.has(symbol)) {
          continue;
        }

        seen.add(symbol);

        const current = map.get(symbol);

        map.set(symbol, {
          symbol,
          assetName: holding.assetName,
          assetClass: holding.assetClass,
          count: (current?.count ?? 0) + 1,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        b.count - a.count ||
        a.symbol.localeCompare(b.symbol)
    );
  }, [emailClients]);

  const riskProfiles = useMemo(
    () =>
      Array.from(
        new Set(
          payload.clients
            .map((client) => client.riskProfile)
            .filter(Boolean)
        )
      ).sort(),
    [payload.clients]
  );

  const clientTypes = useMemo(
    () =>
      Array.from(
        new Set(
          payload.clients
            .map((client) => client.clientType)
            .filter(Boolean)
        )
      ).sort(),
    [payload.clients]
  );

  const filteredHoldings = useMemo(() => {
    const search = holdingSearch
      .trim()
      .toLowerCase();

    return holdingUniverse
      .filter(
        (holding) =>
          !search ||
          [
            holding.symbol,
            holding.assetName,
            holding.assetClass,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search)
      )
      .slice(0, 40);
  }, [holdingSearch, holdingUniverse]);

  const portfolioMatchedClients = useMemo(
    () =>
      emailClients.filter((client) => {
        if (
          riskFilter !== "All risk profiles" &&
          client.riskProfile !== riskFilter
        ) {
          return false;
        }

        if (
          clientTypeFilter !==
            "All client types" &&
          client.clientType !== clientTypeFilter
        ) {
          return false;
        }

        if (!selectedSymbols.length) {
          return false;
        }

        const symbols = new Set(
          client.holdings.map((holding) =>
            holding.symbol.trim().toUpperCase()
          )
        );

        return selectedSymbols.some((symbol) =>
          symbols.has(symbol)
        );
      }),
    [
      clientTypeFilter,
      emailClients,
      riskFilter,
      selectedSymbols,
    ]
  );

  const filteredClients = useMemo(() => {
    const search = clientSearch
      .trim()
      .toLowerCase();

    return emailClients.filter((client) => {
      if (!search) {
        return true;
      }

      const holdings = client.holdings
        .map(
          (holding) =>
            `${holding.symbol} ${holding.assetName} ${holding.assetClass}`
        )
        .join(" ");

      return [
        client.fullName,
        client.householdName,
        client.email,
        client.clientType,
        client.riskProfile,
        holdings,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [clientSearch, emailClients]);

  const audienceClients = useMemo(() => {
    if (audienceMode === "portfolio") {
      return portfolioMatchedClients;
    }

    if (audienceMode === "clients") {
      return emailClients.filter((client) =>
        selectedClientIds.includes(client.id)
      );
    }

    if (audienceMode === "all") {
      return emailClients;
    }

    return [];
  }, [
    audienceMode,
    emailClients,
    portfolioMatchedClients,
    selectedClientIds,
  ]);

  const filteredDrafts = useMemo(() => {
    const search = draftSearch
      .trim()
      .toLowerCase();

    return allDrafts.filter((draft) => {
      if (
        draftFilter === "working" &&
        [
          "Sent",
          "Simulated",
          "Archived",
          "Needs Advisor Approval",
        ].includes(draft.status)
      ) {
        return false;
      }

      if (
        draftFilter === "approval" &&
        draft.status !== "Needs Advisor Approval"
      ) {
        return false;
      }

      if (
        draftFilter === "sent" &&
        ![
          "Sent",
          "Simulated",
          "Delivery Failed",
        ].includes(draft.status)
      ) {
        return false;
      }

      return (
        !search ||
        [
          draft.title,
          draft.body,
          draft.clientName,
          draft.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search)
      );
    });
  }, [allDrafts, draftFilter, draftSearch]);

  const visibleApprovals = useMemo(
    () =>
      payload.approvals.filter((approval) =>
        approvalFilter === "pending"
          ? approval.status === "Pending"
          : approval.status !== "Pending"
      ),
    [approvalFilter, payload.approvals]
  );

  const selectedApproval = useMemo(
    () =>
      visibleApprovals.find(
        (approval) =>
          approval.id === selectedApprovalId
      ) ??
      visibleApprovals[0] ??
      null,
    [selectedApprovalId, visibleApprovals]
  );

  const approvalDrafts = useMemo(
    () =>
      (selectedApproval?.payload?.draftIds ?? [])
        .map((id) => draftMap.get(id))
        .filter(
          (draft): draft is Draft =>
            Boolean(draft)
        ),
    [draftMap, selectedApproval]
  );

  const approvalRecipients = useMemo(
    () =>
      approvalDrafts.map((draft) => {
        const client =
          draft.sourceSummary?.clientId
            ? clientMap.get(
                draft.sourceSummary.clientId
              )
            : null;

        return {
          draft,
          client,
          name:
            client?.fullName ||
            recipientName(draft),
          email: client?.email || null,
          blocked: Boolean(
            draft.sourceSummary?.scratchDraft ||
              !client?.email
          ),
        };
      }),
    [approvalDrafts, clientMap]
  );

  const blockedCount =
    approvalRecipients.filter(
      (item) => item.blocked
    ).length;

  function syncDraft(draft: Draft | null) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const next = {
      subject: draft?.title ?? "",
      body: draft?.body ?? "",
    };

    setActiveDraftId(draft?.id ?? "");
    activeIdRef.current = draft?.id ?? "";

    setEditor(next);
    editorRef.current = next;

    savedRef.current = {
      id: draft?.id ?? "",
      ...next,
    };

    setSaveState("idle");
    setPolishOpen(false);
  }

  async function load(preferredId?: string) {
    try {
      const response = await fetch(
        "/api/client-emails",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to load the email center."
        );
      }

      setPayload(data);

      const drafts = sortDrafts([
        ...(data.drafts ?? []),
        ...(data.archivedDrafts ?? []),
      ]);

      const next =
        drafts.find(
          (draft: Draft) =>
            draft.id ===
            (preferredId ||
              activeIdRef.current)
        ) ??
        drafts.find(
          (draft: Draft) =>
            ![
              "Sent",
              "Simulated",
              "Archived",
            ].includes(draft.status)
        ) ??
        drafts[0] ??
        null;

      syncDraft(next);
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to load the email center.",
      });
    } finally {
      setBooting(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    setSendConfirmed(false);

    if (selectedApproval) {
      setSelectedApprovalId(
        selectedApproval.id
      );
    }
  }, [selectedApproval?.id]);

  useEffect(() => {
    if (
      !activeDraft ||
      !editable(activeDraft)
    ) {
      return;
    }

    const saved = savedRef.current;

    if (
      saved.id === activeDraft.id &&
      saved.subject === editor.subject &&
      saved.body === editor.body
    ) {
      return;
    }

    if (
      !editor.subject.trim() ||
      !editor.body.trim()
    ) {
      setSaveState("unsaved");
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setSaveState("unsaved");

    const draftId = activeDraft.id;
    const captured = {
      subject: editor.subject,
      body: editor.body,
    };

    const status =
      activeDraft.status === "Draft"
        ? "Edited"
        : activeDraft.status;

    timerRef.current = setTimeout(() => {
      void (async () => {
        setSaveState("saving");

        try {
          const data = await post(
            {
              action: "updateDraft",
              draftId,
              ...captured,
              status,
            },
            "autosave-client-email-draft"
          );

          if (data.draft) {
            setPayload((current) =>
              replaceDraft(
                current,
                data.draft
              )
            );
          }

          savedRef.current = {
            id: draftId,
            ...captured,
          };

          if (
            activeIdRef.current === draftId
          ) {
            const current =
              editorRef.current;

            setSaveState(
              current.subject ===
                captured.subject &&
                current.body === captured.body
                ? "saved"
                : "unsaved"
            );
          }
        } catch {
          if (
            activeIdRef.current === draftId
          ) {
            setSaveState("error");
          }
        }
      })();
    }, 900);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [
    activeDraft,
    editor.body,
    editor.subject,
  ]);

  async function saveNow(silent = false) {
    if (
      !activeDraft ||
      !editable(activeDraft)
    ) {
      return true;
    }

    if (
      !editor.subject.trim() ||
      !editor.body.trim()
    ) {
      if (!silent) {
        setNotice({
          tone: "error",
          text: "Subject and body are required.",
        });
      }

      return false;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setSaveState("saving");

    try {
      const data = await post(
        {
          action: "updateDraft",
          draftId: activeDraft.id,
          subject: editor.subject,
          body: editor.body,
          status:
            activeDraft.status === "Draft"
              ? "Edited"
              : activeDraft.status,
        },
        "save-client-email-draft"
      );

      if (data.draft) {
        setPayload((current) =>
          replaceDraft(current, data.draft)
        );
      }

      savedRef.current = {
        id: activeDraft.id,
        ...editor,
      };

      setSaveState("saved");

      if (!silent) {
        setNotice({
          tone: "success",
          text: "Draft saved.",
        });
      }

      return true;
    } catch (error) {
      setSaveState("error");

      if (!silent) {
        setNotice({
          tone: "error",
          text:
            error instanceof Error
              ? error.message
              : "Unable to save the draft.",
        });
      }

      return false;
    }
  }

  async function chooseDraft(draft: Draft) {
    if (
      (saveState === "unsaved" ||
        saveState === "error") &&
      !(await saveNow(true))
    ) {
      return;
    }

    syncDraft(draft);
  }

  function toggleSymbol(symbol: string) {
    setSelectedSymbols((current) =>
      current.includes(symbol)
        ? current.filter(
            (item) => item !== symbol
          )
        : [...current, symbol]
    );
  }

  function toggleClient(id: string) {
    setSelectedClientIds((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id
          )
        : [...current, id]
    );
  }

  function toggleDraft(id: string) {
    setSelectedDraftIds((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id
          )
        : [...current, id]
    );
  }

  async function createDrafts(
    event: FormEvent
  ) {
    event.preventDefault();

    if (
      composeMode === "ai" &&
      !aiForm.topic.trim()
    ) {
      setNotice({
        tone: "error",
        text:
          "Describe the communication you want AI to create.",
      });

      return;
    }

    if (
      composeMode === "manual" &&
      (!manualForm.subject.trim() ||
        !manualForm.body.trim())
    ) {
      setNotice({
        tone: "error",
        text: "Subject and body are required.",
      });

      return;
    }

    if (
      audienceMode !== "scratch" &&
      !audienceClients.length
    ) {
      setNotice({
        tone: "error",
        text:
          audienceMode === "portfolio"
            ? "Choose at least one holding with matching clients."
            : "Choose at least one client recipient.",
      });

      return;
    }

    setBusy("create");
    setNotice(null);

    try {
      const clientIds = audienceClients.map(
        (client) => client.id
      );

      const includeAllClients =
        audienceMode === "all" &&
        composeMode === "ai";

      const audienceContext =
        audienceMode === "portfolio"
          ? `Portfolio audience selected by holdings: ${selectedSymbols.join(
              ", "
            )}. Personalize the message using each client's relevant holdings and broader profile.`
          : audienceMode === "clients"
            ? "Personalize the communication for each specifically selected client."
            : audienceMode === "all"
              ? "Personalize the communication for every email-ready client."
              : "Create a reusable scratch draft that can later be assigned to a client.";

      const data =
        composeMode === "ai"
          ? await post(
              {
                action: "createAiDrafts",
                clientIds: includeAllClients
                  ? []
                  : clientIds,
                includeAllClients,
                topic: aiForm.topic,
                purpose: aiForm.objective,
                tone: aiForm.tone,
                advisorInstructions: [
                  audienceContext,
                  aiForm.instructions,
                ]
                  .filter(Boolean)
                  .join("\n\n"),
                callToAction:
                  aiForm.callToAction,
                researchContext: "",
                draftDepth:
                  "Thorough researched advisor draft",
                useOpenAiResearch:
                  aiForm.useResearch,
                queueForApproval: false,
              },
              "create-ai-client-email-drafts"
            )
          : await post(
              {
                action: "createManualDrafts",
                clientIds,
                subject:
                  manualForm.subject,
                body: manualForm.body,
                tone: "Professional",
                queueForApproval: false,
              },
              "create-manual-client-email-drafts"
            );

      const ids: string[] = (
        data.drafts ?? []
      ).map(
        (draft: { id: string }) =>
          draft.id
      );

      setSelectedDraftIds(ids);

      await load(ids[0]);

      setView("drafts");

      setAiForm((current) => ({
        ...current,
        topic: "",
        instructions: "",
        callToAction: "",
      }));

      setManualForm({
        subject: "",
        body: "",
      });

      setNotice({
        tone: "success",
        text:
          data.message ??
          `${ids.length} draft(s) created.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to create drafts.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function polish() {
    if (
      !activeDraft ||
      !(await saveNow(true))
    ) {
      return;
    }

    setBusy("polish");

    try {
      const data = await post(
        {
          action: "polishDraft",
          draftId: activeDraft.id,
          polishMode,
          advisorInstructions:
            polishInstructions,
        },
        "polish-client-email-draft"
      );

      if (data.draft) {
        setPayload((current) =>
          replaceDraft(current, data.draft)
        );

        syncDraft(data.draft);
      }

      setNotice({
        tone: "success",
        text:
          data.message ?? "Draft polished.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to polish the draft.",
      });
    } finally {
      setBusy(null);
      setPolishOpen(false);
    }
  }

  async function queue(ids: string[]) {
    const drafts = ids
      .map((id) => draftMap.get(id))
      .filter(
        (draft): draft is Draft =>
          Boolean(draft)
      )
      .filter(sendable);

    if (!drafts.length) {
      setNotice({
        tone: "error",
        text:
          "Choose at least one editable client-specific draft.",
      });

      return;
    }

    if (
      activeDraft &&
      drafts.some(
        (draft) =>
          draft.id === activeDraft.id
      ) &&
      !(await saveNow(true))
    ) {
      return;
    }

    setBusy("queue");

    try {
      const data = await post(
        {
          action:
            "queueDraftsForApproval",
          draftIds: drafts.map(
            (draft) => draft.id
          ),
          approvalTitle:
            drafts.length === 1
              ? `Approve email to ${recipientName(
                  drafts[0]
                )}`
              : `Approve ${drafts.length} client emails`,
        },
        "queue-client-email-drafts"
      );

      await load(activeDraft?.id);

      setSelectedApprovalId(
        data.approval?.id ?? ""
      );

      setSelectedDraftIds([]);
      setApprovalFilter("pending");
      setView("queue");

      setNotice({
        tone: "success",
        text:
          data.message ??
          "Drafts added to the send queue.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to queue drafts.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function approveAndSend() {
    if (
      !selectedApproval ||
      !sendConfirmed ||
      blockedCount
    ) {
      return;
    }

    setBusy("send");

    try {
      const data = await post(
        {
          action: "approveAndSend",
          approvalId:
            selectedApproval.id,
          approvalNotes: approvalNote,
        },
        "approve-client-email-drafts-and-send"
      );

      await load(activeDraft?.id);

      setSendConfirmed(false);

      setNotice({
        tone: data.failed
          ? "info"
          : "success",
        text: `Send complete. Delivered: ${data.delivered}. Simulated: ${data.simulated}. Failed: ${data.failed}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to approve and send.",
      });
    } finally {
      setBusy(null);
    }
  }

  if (booting) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 text-white">
        <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em] text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          Loading communication OS
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-5 text-white md:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(6,95,70,0.42),transparent_31%),radial-gradient(circle_at_82%_8%,rgba(16,185,129,0.13),transparent_25%),linear-gradient(145deg,#030303,#09090b_48%,#111827)]" />

      <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:46px_46px]" />

      <div className="relative mx-auto grid max-w-[1900px] gap-5">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-2xl shadow-emerald-950/25 backdrop-blur-xl md:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-400">
                <Radar className="h-4 w-4" />
                Slice Communication OS
              </div>

              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
                Intelligent client communication,
                organized.
              </h1>

              <p className="mt-3 max-w-4xl text-sm font-medium leading-7 text-slate-400 md:text-base">
                Build AI-personalized campaigns,
                target clients by portfolio holdings
                or direct selection, edit with live
                preview, and send through an
                approval-safe delivery queue.
              </p>
            </div>

            <a
              href="/workspace"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 hover:bg-emerald-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to workspace
            </a>
          </div>
        </header>

        <NoticeBar
          notice={notice}
          close={() => setNotice(null)}
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Reachable clients"
            value={
              payload.metrics
                .clientsWithEmail
            }
            helper="Available for campaigns"
            icon={
              <Users className="h-5 w-5" />
            }
          />

          <Metric
            label="Portfolio signals"
            value={holdingUniverse.length}
            helper="Unique tracked holdings"
            icon={
              <TrendingUp className="h-5 w-5" />
            }
          />

          <Metric
            label="Working drafts"
            value={payload.metrics.draftCount}
            helper="Editable communications"
            icon={
              <FilePenLine className="h-5 w-5" />
            }
          />

          <Metric
            label="Awaiting approval"
            value={
              payload.metrics
                .pendingApprovalCount
            }
            helper="Ready for final review"
            icon={
              <ShieldCheck className="h-5 w-5" />
            }
          />
        </section>

        <div className="grid gap-2 rounded-[1.6rem] border border-white/10 bg-black/55 p-2 md:grid-cols-3">
          {(
            [
              [
                "compose",
                "Campaign Studio",
                "AI creation and smart audiences",
                WandSparkles,
              ],
              [
                "drafts",
                "Draft Workspace",
                "Edit, compare, polish, and queue",
                FileText,
              ],
              [
                "queue",
                "Send Queue",
                "Confirm recipients and deliver",
                Inbox,
              ],
            ] as const
          ).map(
            ([
              key,
              label,
              helper,
              Icon,
            ]) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setView(key)
                }
                className={cx(
                  "rounded-2xl px-4 py-3 text-left transition",
                  view === key
                    ? "bg-white text-zinc-950"
                    : "text-slate-300 hover:bg-white/[0.06]"
                )}
              >
                <div className="flex items-center gap-2 text-sm font-black">
                  <Icon className="h-4 w-4" />

                  {label}

                  {key === "queue" &&
                  payload.metrics
                    .pendingApprovalCount ? (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white">
                      {
                        payload.metrics
                          .pendingApprovalCount
                      }
                    </span>
                  ) : null}
                </div>

                <div
                  className={cx(
                    "mt-1 text-xs",
                    view === key
                      ? "text-slate-600"
                      : "text-slate-500"
                  )}
                >
                  {helper}
                </div>
              </button>
            )
          )}
        </div>

        {view === "compose" ? (
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_460px]">
            <Panel>
              <div className="border-b border-white/10 bg-gradient-to-r from-emerald-950/50 via-zinc-950 to-zinc-950 p-5 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                      Campaign intelligence
                    </div>

                    <h2 className="mt-2 text-3xl font-black">
                      Create the right message
                      for the right clients
                    </h2>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                      Generate individualized
                      emails using each
                      client&apos;s holdings,
                      profile, and selected
                      campaign goal.
                    </p>
                  </div>

                  <Badge className="border-cyan-400/25 bg-cyan-400/10 text-cyan-100">
                    {payload.aiRuntime
                      ?.configured
                      ? `AI ready · ${payload.aiRuntime.model}`
                      : "AI fallback mode"}
                  </Badge>
                </div>
              </div>

              <form
                onSubmit={createDrafts}
                className="grid gap-6 p-5 md:p-6"
              >
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/35 p-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setComposeMode("ai")
                    }
                    className={cx(
                      "flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black",
                      composeMode === "ai"
                        ? "bg-emerald-600 text-white"
                        : "text-slate-400 hover:bg-white/[0.06]"
                    )}
                  >
                    <Sparkles className="h-4 w-4" />
                    AI generated
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setComposeMode(
                        "manual"
                      )
                    }
                    className={cx(
                      "flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black",
                      composeMode ===
                        "manual"
                        ? "bg-white text-zinc-950"
                        : "text-slate-400 hover:bg-white/[0.06]"
                    )}
                  >
                    <FileText className="h-4 w-4" />
                    Write manually
                  </button>
                </div>

                {composeMode === "ai" ? (
                  <>
                    <div>
                      <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                        Fast-start campaigns
                      </div>

                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        {STARTERS.map(
                          ([
                            label,
                            topic,
                            objective,
                          ]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() =>
                                setAiForm(
                                  (current) => ({
                                    ...current,
                                    topic,
                                    objective,
                                  })
                                )
                              }
                              className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left text-xs font-black transition hover:border-emerald-400/30 hover:bg-emerald-500/10"
                            >
                              {label}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <textarea
                      value={aiForm.topic}
                      onChange={(event) =>
                        setAiForm(
                          (current) => ({
                            ...current,
                            topic:
                              event.target
                                .value,
                          })
                        )
                      }
                      placeholder="Describe the communication AI should create..."
                      className={cx(
                        INPUT,
                        "min-h-[150px] leading-7"
                      )}
                    />

                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={
                          aiForm.objective
                        }
                        onChange={(event) =>
                          setAiForm(
                            (current) => ({
                              ...current,
                              objective:
                                event.target
                                  .value,
                            })
                          )
                        }
                        placeholder="Campaign objective"
                        className={INPUT}
                      />

                      <select
                        value={aiForm.tone}
                        onChange={(event) =>
                          setAiForm(
                            (current) => ({
                              ...current,
                              tone:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className={INPUT}
                      >
                        <option>
                          Professional, calm,
                          polished, and
                          reassuring
                        </option>
                        <option>
                          Warm and conversational
                        </option>
                        <option>
                          Concise and executive
                        </option>
                        <option>
                          Educational and detailed
                        </option>
                        <option>
                          Premium private-wealth
                          tone
                        </option>
                      </select>
                    </div>

                    <details className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                      <summary className="cursor-pointer text-sm font-black text-slate-300">
                        Advanced AI controls
                      </summary>

                      <div className="mt-4 grid gap-3">
                        <textarea
                          value={
                            aiForm.instructions
                          }
                          onChange={(event) =>
                            setAiForm(
                              (current) => ({
                                ...current,
                                instructions:
                                  event.target
                                    .value,
                              })
                            )
                          }
                          placeholder="Facts to emphasize, language to avoid, compliance guidance, or personalization instructions..."
                          className={cx(
                            INPUT,
                            "min-h-[90px]"
                          )}
                        />

                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            value={
                              aiForm.callToAction
                            }
                            onChange={(event) =>
                              setAiForm(
                                (current) => ({
                                  ...current,
                                  callToAction:
                                    event.target
                                      .value,
                                })
                              )
                            }
                            placeholder="Optional call to action"
                            className={INPUT}
                          />

                          <label className="flex items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-100">
                            <input
                              type="checkbox"
                              checked={
                                aiForm.useResearch
                              }
                              onChange={(
                                event
                              ) =>
                                setAiForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,
                                    useResearch:
                                      event
                                        .target
                                        .checked,
                                  })
                                )
                              }
                              className="h-4 w-4 accent-cyan-400"
                            />

                            Use connected research
                            mode
                          </label>
                        </div>
                      </div>
                    </details>
                  </>
                ) : (
                  <>
                    <input
                      value={
                        manualForm.subject
                      }
                      onChange={(event) =>
                        setManualForm(
                          (current) => ({
                            ...current,
                            subject:
                              event.target
                                .value,
                          })
                        )
                      }
                      placeholder="Subject"
                      className={INPUT}
                    />

                    <textarea
                      value={manualForm.body}
                      onChange={(event) =>
                        setManualForm(
                          (current) => ({
                            ...current,
                            body:
                              event.target
                                .value,
                          })
                        )
                      }
                      placeholder="Write the email body..."
                      className={cx(
                        INPUT,
                        "min-h-[290px] leading-7"
                      )}
                    />
                  </>
                )}

                <button
                  disabled={busy === "create"}
                  className={cx(
                    PRIMARY,
                    "py-4 text-sm"
                  )}
                >
                  {busy === "create" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : composeMode ===
                    "ai" ? (
                    <Bot className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}

                  {composeMode === "ai"
                    ? `Generate ${
                        audienceMode ===
                        "scratch"
                          ? "scratch draft"
                          : `${audienceClients.length} personalized draft${
                              audienceClients.length ===
                              1
                                ? ""
                                : "s"
                            }`
                      }`
                    : `Create ${
                        audienceMode ===
                        "scratch"
                          ? "scratch draft"
                          : `${audienceClients.length} draft${
                              audienceClients.length ===
                              1
                                ? ""
                                : "s"
                            }`
                      }`}
                </button>
              </form>
            </Panel>

            <Panel className="h-fit 2xl:sticky 2xl:top-5">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">
                  <Target className="h-3.5 w-3.5" />
                  Smart audience builder
                </div>

                <h2 className="mt-2 text-2xl font-black">
                  Who should receive this?
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Target by stocks held,
                  manually choose clients, reach
                  all clients, or create a
                  reusable draft.
                </p>
              </div>

              <div className="grid gap-4 p-5">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      [
                        "portfolio",
                        "By holdings",
                        TrendingUp,
                      ],
                      [
                        "clients",
                        "Choose clients",
                        Users,
                      ],
                      [
                        "all",
                        "All clients",
                        Layers3,
                      ],
                      [
                        "scratch",
                        "Scratch draft",
                        FileText,
                      ],
                    ] as const
                  ).map(
                    ([
                      key,
                      label,
                      Icon,
                    ]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setAudienceMode(
                            key
                          )
                        }
                        className={cx(
                          "rounded-2xl border p-3 text-left transition",
                          audienceMode ===
                            key
                            ? "border-emerald-400/40 bg-emerald-500/10"
                            : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                        )}
                      >
                        <div className="flex items-center gap-2 text-xs font-black">
                          <Icon className="h-4 w-4" />
                          {label}
                        </div>
                      </button>
                    )
                  )}
                </div>

                {audienceMode ===
                "portfolio" ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-600" />

                      <input
                        value={
                          holdingSearch
                        }
                        onChange={(event) =>
                          setHoldingSearch(
                            event.target
                              .value
                          )
                        }
                        placeholder="Search ticker, fund, or asset class"
                        className={cx(
                          INPUT,
                          "pl-10"
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={riskFilter}
                        onChange={(event) =>
                          setRiskFilter(
                            event.target
                              .value
                          )
                        }
                        className={INPUT}
                      >
                        <option>
                          All risk profiles
                        </option>

                        {riskProfiles.map(
                          (profile) => (
                            <option
                              key={
                                profile
                              }
                            >
                              {profile}
                            </option>
                          )
                        )}
                      </select>

                      <select
                        value={
                          clientTypeFilter
                        }
                        onChange={(event) =>
                          setClientTypeFilter(
                            event.target
                              .value
                          )
                        }
                        className={INPUT}
                      >
                        <option>
                          All client types
                        </option>

                        {clientTypes.map(
                          (type) => (
                            <option
                              key={type}
                            >
                              {type}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="max-h-[330px] space-y-2 overflow-y-auto pr-1">
                      {filteredHoldings.map(
                        (holding) => {
                          const selected =
                            selectedSymbols.includes(
                              holding.symbol
                            );

                          return (
                            <button
                              key={
                                holding.symbol
                              }
                              type="button"
                              onClick={() =>
                                toggleSymbol(
                                  holding.symbol
                                )
                              }
                              className={cx(
                                "flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left",
                                selected
                                  ? "border-cyan-400/35 bg-cyan-400/10"
                                  : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                              )}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black">
                                    {
                                      holding.symbol
                                    }
                                  </span>

                                  <Badge className="border-white/10 bg-white/[0.045] text-slate-400">
                                    {
                                      holding.count
                                    }{" "}
                                    client
                                    {holding.count ===
                                    1
                                      ? ""
                                      : "s"}
                                  </Badge>
                                </div>

                                <div className="mt-1 truncate text-xs text-slate-500">
                                  {
                                    holding.assetName
                                  }{" "}
                                  ·{" "}
                                  {
                                    holding.assetClass
                                  }
                                </div>
                              </div>

                              <div
                                className={cx(
                                  "grid h-6 w-6 shrink-0 place-items-center rounded-lg border",
                                  selected
                                    ? "border-cyan-300 bg-cyan-300 text-cyan-950"
                                    : "border-white/15 text-transparent"
                                )}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </>
                ) : null}

                {audienceMode ===
                "clients" ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-600" />

                      <input
                        value={clientSearch}
                        onChange={(event) =>
                          setClientSearch(
                            event.target
                              .value
                          )
                        }
                        placeholder="Search clients, email, or holding"
                        className={cx(
                          INPUT,
                          "pl-10"
                        )}
                      />
                    </div>

                    <div className="max-h-[390px] space-y-2 overflow-y-auto pr-1">
                      {filteredClients.map(
                        (client) => {
                          const selected =
                            selectedClientIds.includes(
                              client.id
                            );

                          return (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() =>
                                toggleClient(
                                  client.id
                                )
                              }
                              className={cx(
                                "flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left",
                                selected
                                  ? "border-emerald-400/35 bg-emerald-500/10"
                                  : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                              )}
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-black">
                                  {
                                    client.fullName
                                  }
                                </div>

                                <div className="mt-1 truncate text-xs text-slate-500">
                                  {
                                    client.email
                                  }
                                </div>

                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {client.holdings
                                    .slice(
                                      0,
                                      4
                                    )
                                    .map(
                                      (
                                        holding
                                      ) => (
                                        <span
                                          key={
                                            holding.id
                                          }
                                          className="rounded-md bg-white/[0.055] px-1.5 py-0.5 text-[9px] font-black text-slate-400"
                                        >
                                          {
                                            holding.symbol
                                          }
                                        </span>
                                      )
                                    )}
                                </div>
                              </div>

                              <div
                                className={cx(
                                  "grid h-6 w-6 shrink-0 place-items-center rounded-lg border",
                                  selected
                                    ? "border-emerald-400 bg-emerald-500 text-white"
                                    : "border-white/15 text-transparent"
                                )}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </>
                ) : null}

                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-300">
                        Live reach
                      </div>

                      <div className="mt-1 text-3xl font-black">
                        {audienceMode ===
                        "scratch"
                          ? 1
                          : audienceClients.length}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-200">
                      <Radar className="h-5 w-5" />
                    </div>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-cyan-50/70">
                    {audienceMode ===
                    "portfolio"
                      ? selectedSymbols.length
                        ? `${selectedSymbols.join(
                            ", "
                          )} currently matches ${
                            audienceClients.length
                          } email-ready client${
                            audienceClients.length ===
                            1
                              ? ""
                              : "s"
                          }.`
                        : "Select one or more holdings to build the audience."
                      : audienceMode ===
                          "clients"
                        ? `${
                            selectedClientIds.length
                          } client${
                            selectedClientIds.length ===
                            1
                              ? ""
                              : "s"
                          } selected manually.`
                        : audienceMode ===
                            "all"
                          ? "Every email-ready client will receive a personalized draft."
                          : "One reusable, unassigned draft will be created."}
                  </p>
                </div>

                {audienceClients.length ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
                      Audience preview
                    </div>

                    <div className="mt-3 max-h-32 overflow-y-auto text-xs leading-6 text-slate-300">
                      {audienceClients
                        .slice(0, 20)
                        .map(
                          (client) =>
                            client.fullName
                        )
                        .join(", ")}

                      {audienceClients.length >
                      20
                        ? ` and ${
                            audienceClients.length -
                            20
                          } more`
                        : ""}
                    </div>
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>
        ) : null}

        {view === "drafts" ? (
          <div className="grid gap-5 2xl:grid-cols-[330px_minmax(0,1fr)]">
            <Panel className="overflow-hidden 2xl:sticky 2xl:top-5 2xl:h-[calc(100vh-2.5rem)]">
              <div className="border-b border-white/10 p-4">
                <button
                  type="button"
                  onClick={() =>
                    setView("compose")
                  }
                  className={cx(
                    PRIMARY,
                    "w-full py-3.5 text-sm"
                  )}
                >
                  <Plus className="h-4 w-4" />
                  New campaign
                </button>

                <div className="relative mt-3">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-600" />

                  <input
                    value={draftSearch}
                    onChange={(event) =>
                      setDraftSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search drafts"
                    className={cx(
                      INPUT,
                      "pl-10"
                    )}
                  />
                </div>

                <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-black/35 p-1">
                  {(
                    [
                      [
                        "working",
                        "Work",
                      ],
                      [
                        "approval",
                        "Queue",
                      ],
                      ["sent", "Sent"],
                      ["all", "All"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setDraftFilter(key)
                      }
                      className={cx(
                        "rounded-lg px-2 py-2 text-[10px] font-black uppercase",
                        draftFilter === key
                          ? "bg-white text-zinc-950"
                          : "text-slate-500"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[560px] space-y-2 overflow-y-auto p-3 2xl:max-h-none">
                {filteredDrafts.map(
                  (draft) => {
                    const active =
                      activeDraft?.id ===
                      draft.id;

                    const selected =
                      selectedDraftIds.includes(
                        draft.id
                      );

                    return (
                      <div
                        key={draft.id}
                        className={cx(
                          "flex items-start gap-2 rounded-2xl border p-3",
                          active
                            ? "border-emerald-400/45 bg-emerald-500/10"
                            : "border-white/10 bg-white/[0.035]"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            toggleDraft(
                              draft.id
                            )
                          }
                          className={cx(
                            "mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-md border",
                            selected
                              ? "border-emerald-400 bg-emerald-500 text-white"
                              : "border-white/15 text-transparent"
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void chooseDraft(
                              draft
                            )
                          }
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-sm font-black">
                            {draft.title}
                          </div>

                          <div className="mt-1 truncate text-xs text-slate-500">
                            {recipientName(
                              draft
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <Badge
                              className={statusClass(
                                draft.status
                              )}
                            >
                              {draft.status}
                            </Badge>

                            <span className="text-[10px] font-bold text-slate-600">
                              {formatDate(
                                draft.updatedAt
                              )}
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  }
                )}

                {!filteredDrafts.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                    No drafts match this view.
                  </div>
                ) : null}
              </div>

              {selectedDraftIds.length ? (
                <div className="border-t border-white/10 p-3">
                  <button
                    type="button"
                    onClick={() =>
                      void queue(
                        selectedDraftIds
                      )
                    }
                    disabled={
                      busy === "queue"
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-zinc-950 disabled:opacity-40"
                  >
                    {busy === "queue" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}

                    Queue{" "}
                    {
                      selectedDraftIds.length
                    }{" "}
                    selected
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDraftIds(
                        []
                      )
                    }
                    className="mt-2 w-full py-2 text-xs font-black text-slate-500"
                  >
                    Clear selection
                  </button>
                </div>
              ) : null}
            </Panel>

            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(390px,0.92fr)]">
              <Panel className="min-w-0">
                {activeDraft ? (
                  <>
                    <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                          Smart editor
                        </div>

                        <h2 className="mt-2 truncate text-2xl font-black">
                          {recipientName(
                            activeDraft
                          )}
                        </h2>

                        <div className="mt-1 truncate text-xs text-slate-500">
                          {activeClient?.email ||
                            "No recipient assigned"}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <SaveLabel
                          state={saveState}
                        />

                        <Badge
                          className={statusClass(
                            activeDraft.status
                          )}
                        >
                          {activeDraft.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-4 p-5">
                      <input
                        value={editor.subject}
                        onChange={(event) =>
                          setEditor(
                            (current) => ({
                              ...current,
                              subject:
                                event.target
                                  .value,
                            })
                          )
                        }
                        disabled={
                          !editable(
                            activeDraft
                          )
                        }
                        placeholder="Subject"
                        className={INPUT}
                      />

                      <textarea
                        value={editor.body}
                        onChange={(event) =>
                          setEditor(
                            (current) => ({
                              ...current,
                              body:
                                event.target
                                  .value,
                            })
                          )
                        }
                        disabled={
                          !editable(
                            activeDraft
                          )
                        }
                        placeholder="Email body"
                        className={cx(
                          INPUT,
                          "min-h-[430px] resize-y leading-7"
                        )}
                      />

                      {activeDraft
                        .sourceSummary
                        ?.holdings?.length ? (
                        <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4">
                          <div className="text-xs font-black uppercase tracking-[0.15em] text-violet-200">
                            Portfolio context
                            used
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {activeDraft.sourceSummary.holdings
                              .slice(0, 12)
                              .map(
                                (
                                  holding
                                ) => (
                                  <Badge
                                    key={`${holding.symbol}-${holding.assetName}`}
                                    className="border-violet-300/20 bg-violet-300/10 text-violet-100"
                                  >
                                    {
                                      holding.symbol
                                    }
                                  </Badge>
                                )
                              )}
                          </div>
                        </div>
                      ) : null}

                      {polishOpen ? (
                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-black text-cyan-100">
                              <Sparkles className="h-4 w-4" />
                              AI rewrite studio
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setPolishOpen(
                                  false
                                )
                              }
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 grid gap-3">
                            <select
                              value={
                                polishMode
                              }
                              onChange={(
                                event
                              ) =>
                                setPolishMode(
                                  event.target
                                    .value
                                )
                              }
                              className={INPUT}
                            >
                              <option>
                                Professional
                                polish
                              </option>
                              <option>
                                Shorter and
                                cleaner
                              </option>
                              <option>
                                More reassuring
                              </option>
                              <option>
                                Warmer client
                                tone
                              </option>
                              <option>
                                Premium advisor
                                tone
                              </option>
                              <option>
                                Compliance-safe
                                rewrite
                              </option>
                            </select>

                            <textarea
                              value={
                                polishInstructions
                              }
                              onChange={(
                                event
                              ) =>
                                setPolishInstructions(
                                  event.target
                                    .value
                                )
                              }
                              placeholder="Optional rewrite instructions"
                              className={cx(
                                INPUT,
                                "min-h-[80px]"
                              )}
                            />

                            <button
                              type="button"
                              onClick={() =>
                                void polish()
                              }
                              disabled={
                                busy ===
                                "polish"
                              }
                              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-cyan-950 disabled:opacity-40"
                            >
                              {busy ===
                              "polish" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}

                              Apply AI rewrite
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="grid gap-2 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() =>
                            void saveNow(false)
                          }
                          disabled={
                            !editable(
                              activeDraft
                            )
                          }
                          className={SOFT}
                        >
                          <Save className="h-4 w-4" />
                          Save now
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setPolishOpen(
                              (current) =>
                                !current
                            )
                          }
                          disabled={
                            !editable(
                              activeDraft
                            )
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-black text-cyan-100 disabled:opacity-40"
                        >
                          <Sparkles className="h-4 w-4" />
                          AI rewrite
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void queue([
                              activeDraft.id,
                            ])
                          }
                          disabled={
                            !sendable(
                              activeDraft
                            ) ||
                            busy === "queue"
                          }
                          className={PRIMARY}
                        >
                          {busy === "queue" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}

                          Add to send queue
                        </button>
                      </div>

                      {activeDraft
                        .sourceSummary
                        ?.scratchDraft ? (
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm font-semibold leading-6 text-amber-100">
                          This is a reusable
                          scratch draft. Create a
                          client-specific version
                          before sending.
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="grid min-h-[650px] place-items-center p-8 text-center text-sm font-bold text-slate-600">
                    Choose a draft or create a
                    new campaign.
                  </div>
                )}
              </Panel>

              <Panel className="min-w-0 xl:sticky xl:top-5 xl:h-fit">
                <div className="border-b border-white/10 p-5">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">
                    <Eye className="h-3.5 w-3.5" />
                    Live client preview
                  </div>

                  <h2 className="mt-2 text-xl font-black">
                    Exactly what the client sees
                  </h2>
                </div>

                {activeDraft ? (
                  <div className="p-4 md:p-5">
                    <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-50 text-slate-950 shadow-2xl shadow-black/25">
                      <div className="border-b border-slate-200 bg-white px-5 py-4 text-xs text-slate-500">
                        <div>
                          <span className="mr-3 font-bold">
                            To
                          </span>

                          <span className="font-semibold text-slate-700">
                            {activeClient?.fullName ||
                              recipientName(
                                activeDraft
                              )}

                            {activeClient?.email
                              ? ` <${activeClient.email}>`
                              : ""}
                          </span>
                        </div>

                        <div className="mt-2">
                          <span className="mr-3 font-bold">
                            Subject
                          </span>

                          <span className="font-semibold text-slate-900">
                            {editor.subject ||
                              "Untitled email"}
                          </span>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-emerald-950 via-emerald-800 to-zinc-950 px-6 py-7">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                          Advisor communication
                        </div>

                        <h3 className="mt-2 text-2xl font-black text-white">
                          {editor.subject ||
                            "Untitled email"}
                        </h3>

                        <div className="mt-3 text-xs font-semibold text-emerald-100">
                          Prepared for{" "}
                          {recipientName(
                            activeDraft
                          )}
                        </div>
                      </div>

                      <div className="min-h-[400px] space-y-4 px-6 py-7">
                        {editor.body ? (
                          paragraphList(
                            editor.body
                          ).map(
                            (
                              paragraph,
                              index
                            ) => (
                              <p
                                key={`${index}-${paragraph.slice(
                                  0,
                                  20
                                )}`}
                                className="whitespace-pre-wrap text-sm leading-7 text-slate-700"
                              >
                                {paragraph}
                              </p>
                            )
                          )
                        ) : (
                          <p className="text-sm italic text-slate-400">
                            Start writing to see
                            the preview.
                          </p>
                        )}

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
                            Important note
                          </div>

                          <p className="mt-2 text-xs leading-6 text-amber-800">
                            This message is
                            intended for
                            informational
                            advisor-client
                            communication. It is
                            not a guarantee, trade
                            instruction, or
                            standalone
                            recommendation.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid min-h-[560px] place-items-center p-8 text-center text-sm font-bold text-slate-600">
                    Select a draft to preview it.
                  </div>
                )}
              </Panel>
            </div>
          </div>
        ) : null}

        {view === "queue" ? (
          <div className="grid gap-5 2xl:grid-cols-[390px_minmax(0,1fr)]">
            <Panel className="h-fit 2xl:sticky 2xl:top-5">
              <div className="border-b border-white/10 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                  Approval batches
                </div>

                <h2 className="mt-2 text-2xl font-black">
                  Send queue
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Verify every client, address,
                  and subject before delivery.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-black/35 p-1">
                  <button
                    type="button"
                    onClick={() =>
                      setApprovalFilter(
                        "pending"
                      )
                    }
                    className={cx(
                      "rounded-lg px-3 py-2.5 text-xs font-black",
                      approvalFilter ===
                        "pending"
                        ? "bg-white text-zinc-950"
                        : "text-slate-500"
                    )}
                  >
                    Pending
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setApprovalFilter(
                        "history"
                      )
                    }
                    className={cx(
                      "rounded-lg px-3 py-2.5 text-xs font-black",
                      approvalFilter ===
                        "history"
                        ? "bg-white text-zinc-950"
                        : "text-slate-500"
                    )}
                  >
                    History
                  </button>
                </div>
              </div>

              <div className="max-h-[650px] space-y-2 overflow-y-auto p-3">
                {visibleApprovals.map(
                  (approval) => {
                    const active =
                      selectedApproval?.id ===
                      approval.id;

                    const count =
                      approval.payload
                        ?.draftIds?.length ??
                      0;

                    return (
                      <button
                        key={approval.id}
                        type="button"
                        onClick={() => {
                          setSelectedApprovalId(
                            approval.id
                          );

                          setSendConfirmed(
                            false
                          );
                        }}
                        className={cx(
                          "w-full rounded-2xl border p-4 text-left",
                          active
                            ? "border-emerald-400/45 bg-emerald-500/10"
                            : "border-white/10 bg-white/[0.035]"
                        )}
                      >
                        <div className="text-sm font-black">
                          {approval.title}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {count} email
                          {count === 1
                            ? ""
                            : "s"}{" "}
                          ·{" "}
                          {formatDate(
                            approval.createdAt
                          )}
                        </div>

                        <div className="mt-3">
                          <Badge
                            className={statusClass(
                              approval.status
                            )}
                          >
                            {approval.status}
                          </Badge>
                        </div>
                      </button>
                    );
                  }
                )}

                {!visibleApprovals.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm font-bold text-slate-500">
                    {approvalFilter ===
                    "pending"
                      ? "Nothing is waiting for approval."
                      : "No send history yet."}
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel>
              {selectedApproval ? (
                <>
                  <div className="border-b border-white/10 bg-gradient-to-r from-emerald-950/45 via-zinc-950 to-zinc-950 p-5 md:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                          Final send review
                        </div>

                        <h2 className="mt-2 text-2xl font-black md:text-3xl">
                          {
                            selectedApproval.title
                          }
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {
                            selectedApproval.summary
                          }
                        </p>
                      </div>

                      <Badge
                        className={statusClass(
                          selectedApproval.status
                        )}
                      >
                        {
                          selectedApproval.status
                        }
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-6 p-5 md:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                            Exact recipients
                          </div>

                          <h3 className="mt-1 text-xl font-black">
                            {
                              approvalRecipients.length
                            }{" "}
                            email
                            {approvalRecipients.length ===
                            1
                              ? ""
                              : "s"}
                          </h3>
                        </div>

                        <Badge
                          className={
                            blockedCount
                              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                              : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                          }
                        >
                          {blockedCount
                            ? `${blockedCount} blocked`
                            : "All verified"}
                        </Badge>
                      </div>

                      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                        {approvalRecipients.map(
                          (
                            {
                              draft,
                              name,
                              email,
                              blocked,
                            },
                            index
                          ) => (
                            <div
                              key={draft.id}
                              className={cx(
                                "grid gap-3 p-4 md:grid-cols-[32px_minmax(0,1fr)_auto] md:items-center",
                                index > 0 &&
                                  "border-t border-white/10",
                                blocked
                                  ? "bg-emerald-500/[0.07]"
                                  : "bg-white/[0.025]"
                              )}
                            >
                              <div
                                className={cx(
                                  "grid h-8 w-8 place-items-center rounded-full border text-xs font-black",
                                  blocked
                                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                                    : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                                )}
                              >
                                {blocked ? (
                                  <CircleAlert className="h-4 w-4" />
                                ) : (
                                  index + 1
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-black">
                                  {name}
                                </div>

                                <div className="mt-1 truncate text-xs text-slate-500">
                                  {email ||
                                    "No deliverable email"}
                                </div>

                                <div className="mt-2 text-xs text-slate-400">
                                  <span className="font-black text-slate-500">
                                    Subject:
                                  </span>{" "}
                                  {draft.title}
                                </div>
                              </div>

                              <Badge
                                className={statusClass(
                                  draft.status
                                )}
                              >
                                {draft.status}
                              </Badge>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="grid content-start gap-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                        <div className="flex items-center gap-2 text-sm font-black">
                          <ShieldCheck className="h-4 w-4 text-emerald-300" />
                          Approval confirmation
                        </div>

                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          Live delivery is used
                          when configured;
                          otherwise SLICE safely
                          records a simulated send.
                        </p>

                        {selectedApproval.status ===
                        "Pending" ? (
                          <>
                            <textarea
                              value={
                                approvalNote
                              }
                              onChange={(event) =>
                                setApprovalNote(
                                  event.target
                                    .value
                                )
                              }
                              className={cx(
                                INPUT,
                                "mt-4 min-h-[95px] text-xs"
                              )}
                            />

                            <label
                              className={cx(
                                "mt-4 flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                                sendConfirmed
                                  ? "border-emerald-400/30 bg-emerald-400/10"
                                  : "border-white/10 bg-black/30"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  sendConfirmed
                                }
                                onChange={(
                                  event
                                ) =>
                                  setSendConfirmed(
                                    event
                                      .target
                                      .checked
                                  )
                                }
                                disabled={Boolean(
                                  blockedCount
                                )}
                                className="mt-0.5 h-4 w-4 accent-emerald-400"
                              />

                              <span className="text-xs font-bold leading-5 text-slate-300">
                                I reviewed the
                                names, addresses,
                                and subjects above
                                and confirm this
                                exact recipient
                                list.
                              </span>
                            </label>

                            <button
                              type="button"
                              onClick={() =>
                                void approveAndSend()
                              }
                              disabled={
                                !sendConfirmed ||
                                Boolean(
                                  blockedCount
                                ) ||
                                busy === "send"
                              }
                              className={cx(
                                PRIMARY,
                                "mt-4 w-full py-4 text-sm"
                              )}
                            >
                              {busy ===
                              "send" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}

                              Approve and send{" "}
                              {
                                approvalRecipients.length
                              }
                            </button>
                          </>
                        ) : (
                          <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs font-bold leading-5 text-emerald-100">
                            This batch was{" "}
                            {selectedApproval.status.toLowerCase()}
                            {selectedApproval.approvedBy
                              ? ` by ${selectedApproval.approvedBy}`
                              : ""}
                            {selectedApproval.decidedAt
                              ? ` on ${formatDate(
                                  selectedApproval.decidedAt
                                )}`
                              : ""}
                            .
                          </div>
                        )}
                      </div>

                      {blockedCount ? (
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-semibold leading-6 text-emerald-100">
                          Every draft must be
                          assigned to a client with
                          a valid email before this
                          batch can send.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid min-h-[620px] place-items-center p-8 text-center text-sm font-bold text-slate-600">
                  Select a send batch to review
                  exact recipients.
                </div>
              )}
            </Panel>
          </div>
        ) : null}

        <footer className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-semibold text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Drafts autosave after typing.
            Portfolio targeting uses current
            client holdings returned by the
            secured email API.
          </span>

          <button
            type="button"
            onClick={() =>
              void load(activeDraft?.id)
            }
            className="inline-flex items-center gap-2 font-black text-slate-400 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh communication OS
          </button>
        </footer>
      </div>
    </main>
  );
}