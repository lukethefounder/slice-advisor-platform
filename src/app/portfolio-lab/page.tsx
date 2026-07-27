"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";
type View = "clients" | "symbols" | "email" | "models" | "reports" | "voice" | "privacy";

type Account = {
  id: string;
  name: string;
  accountType: string;
  custodian: string | null;
  notes: string | null;
  clientEmail?: string | null;
  emailOptIn?: boolean;
  preferredGreeting?: string | null;
  deliveryPreference?: string;
  voiceAlias?: string | null;
  createdAt: string;
  holdings: Holding[];
};

type Holding = {
  id: string;
  accountId: string | null;
  clientName?: string;
  clientEmail?: string | null;
  emailOptIn?: boolean;
  preferredGreeting?: string | null;
  deliveryPreference?: string;
  accountType?: string;
  custodian?: string | null;
  symbol: string;
  assetName: string;
  assetClass: string;
  valueNumber?: number | null;
  value?: number | null;
  costBasis?: number | null;
  targetRole: string;
  riskLevel: string;
  thesis: string | null;
  createdAt: string;
  updatedAt?: string;
};

type ClientExposure = {
  id: string;
  clientName: string;
  clientEmail: string | null;
  emailOptIn: boolean;
  emailStatus: string;
  preferredGreeting: string | null;
  deliveryPreference: string;
  voiceAlias: string | null;
  accountType: string;
  custodian: string | null;
  notes: string | null;
  createdAt: string;
  holdingsCount: number;
  symbols: string[];
  assetClasses: string[];
  riskMix: Record<string, number>;
};

type SymbolExposure = {
  symbol: string;
  assetName: string;
  assetClass: string;
  clientCount: number;
  clientNames: string[];
  accountTypes: string[];
  riskLevels: string[];
  roles: string[];
  thesisItems: string[];
  emailReadyCount: number;
  emailRecipients?: Array<{ name: string; email: string; greeting: string | null }>;
  missingEmailClients?: string[];
  optedOutClients?: string[];
};

type Allocation = {
  assetClass: string;
  count?: number;
  value?: number;
  pct: number;
};

type AllocationTarget = {
  id: string;
  modelId: string;
  assetClass: string;
  targetPct: number;
};

type AllocationModel = {
  id: string;
  name: string;
  description: string | null;
  riskLevel: string;
  targets: AllocationTarget[];
};

type RebalanceReport = {
  id: string;
  title: string;
  summary: string;
  status: string;
  createdAt: string;
  currentAllocationsJson: string;
  targetAllocationsJson: string;
  driftJson: string;
  recommendationsJson: string;
  privacyMode: boolean;
};

type ScenarioReport = {
  id: string;
  title: string;
  scenarioType: string;
  summary: string;
  actionsJson: string;
  afterJson: string;
  createdAt: string;
  privacyMode: boolean;
};

type EmailDraft = {
  symbol: string;
  subject: string;
  body: string;
  recipients: Array<{ name: string; email: string; greeting: string | null }>;
  recipientEmails: string[];
  recipientCount: number;
  missingEmailClients: string[];
  optedOutClients: string[];
  mailtoUrl: string;
  complianceNotes: string[];
};

type PrivacySummary = {
  privacyMode: boolean;
  dataPolicy: string;
  holdingsCount: number;
  uniqueSymbolCount: number;
  clientCount: number;
  highRiskCount: number;
  emailReadyExposureCount: number;
  amountFieldsSuppressed: boolean;
  compliancePosture: string[];
};

type PortfolioResponse = {
  privacyMode: boolean;
  accounts: Account[];
  holdings: Holding[];
  clientExposures: ClientExposure[];
  symbolExposures: SymbolExposure[];
  allocations: Allocation[];
  models: AllocationModel[];
  rebalanceReports: RebalanceReport[];
  scenarioReports: ScenarioReport[];
  privacySummary: PrivacySummary;
  emailDraft?: EmailDraft;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
  confidence?: number;
};

type SpeechRecognitionResultLike = {
  0?: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
  message?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const DEFAULT_DATA: PortfolioResponse = {
  privacyMode: true,
  accounts: [],
  holdings: [],
  clientExposures: [],
  symbolExposures: [],
  allocations: [],
  models: [],
  rebalanceReports: [],
  scenarioReports: [],
  privacySummary: {
    privacyMode: true,
    dataPolicy: "Portfolio Lab is privacy-first and can operate without storing account values.",
    holdingsCount: 0,
    uniqueSymbolCount: 0,
    clientCount: 0,
    highRiskCount: 0,
    emailReadyExposureCount: 0,
    amountFieldsSuppressed: true,
    compliancePosture: [
      "Advisor review required before client delivery.",
      "No automatic trading or recommendations.",
      "Client-facing language should be reviewed and retained.",
    ],
  },
};

const viewTabs: Array<{ id: View; label: string; tone: Tone }> = [
  { id: "clients", label: "Clients", tone: "purple" },
  { id: "symbols", label: "Symbols", tone: "cyan" },
  { id: "email", label: "Email", tone: "green" },
  { id: "models", label: "Models", tone: "amber" },
  { id: "reports", label: "Reports", tone: "blue" },
  { id: "voice", label: "Voice", tone: "red" },
  { id: "privacy", label: "Privacy", tone: "slate" },
];

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-500/20";

const selectClass =
  "w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-500/20";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseJsonList<T = unknown>(value: string | null | undefined): T[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function shortDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function money(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[$,%\s,]/g, ""))
        : Number.NaN;

  if (!Number.isFinite(parsed)) return "Private";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsed);
}

function riskTone(value: string | number | null | undefined): Tone {
  const lower = String(value ?? "").toLowerCase();
  const numeric = typeof value === "number" ? value : Number.NaN;

  if (lower.includes("high") || lower.includes("aggressive") || lower.includes("speculative") || (!Number.isNaN(numeric) && numeric >= 80)) {
    return "red";
  }

  if (lower.includes("medium") || lower.includes("balanced") || lower.includes("review") || (!Number.isNaN(numeric) && numeric >= 55)) {
    return "amber";
  }

  if (lower.includes("low") || lower.includes("conservative") || lower.includes("ready") || lower.includes("aligned")) {
    return "green";
  }

  if (lower.includes("core") || lower.includes("growth")) return "purple";
  if (lower.includes("stock") || lower.includes("etf") || lower.includes("symbol") || lower.includes("email")) return "cyan";

  return "slate";
}

function toneClass(tone: Tone) {
  const tones: Record<Tone, string> = {
    red: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/20",
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/20",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-100 shadow-amber-950/20",
    purple: "border-purple-500/25 bg-purple-500/10 text-purple-100 shadow-purple-950/20",
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100 shadow-cyan-950/20",
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-100 shadow-blue-950/20",
    slate: "border-slate-500/20 bg-slate-500/10 text-slate-100 shadow-slate-950/20",
  };

  return tones[tone];
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cx("inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]", toneClass(tone))}>
      {children}
    </span>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/76 p-5 shadow-xl shadow-emerald-950/20 backdrop-blur-xl", className)}>
      {children}
    </div>
  );
}

function SoftCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4", className)}>
      {children}
    </div>
  );
}

function Metric({
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
    blue: "from-blue-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-3xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-950 via-zinc-950 to-emerald-700 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-emerald-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-emerald-700" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-2xl font-black tracking-tight text-white">Slice</div>
        <div className="truncate text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">
          Portfolio Lab
        </div>
      </div>
    </div>
  );
}

function cleanSymbols(value: string) {
  return Array.from(
    new Set(
      value
        .split(/,|\n|\s|\t/)
        .map((item) => item.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, ""))
        .filter(Boolean),
    ),
  ).slice(0, 60);
}

function buildMailtoUrl(draft: EmailDraft | null) {
  if (!draft) return "#";

  const emails = draft.recipientEmails?.join(",") || "";
  const subject = encodeURIComponent(draft.subject || "");
  const body = encodeURIComponent(draft.body || "");

  return `mailto:${emails}?subject=${subject}&body=${body}`;
}

export default function PortfolioLabPage() {
  const [data, setData] = useState<PortfolioResponse>(DEFAULT_DATA);
  const [activeView, setActiveView] = useState<View>("clients");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [scenarioType, setScenarioType] = useState("Market Drawdown");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [voiceCommand, setVoiceCommand] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [accountForm, setAccountForm] = useState({
    name: "",
    accountType: "Client Household",
    custodian: "",
    clientEmail: "",
    emailOptIn: true,
    preferredGreeting: "",
    deliveryPreference: "Advisor Review",
    voiceAlias: "",
    notes: "",
  });

  const [editClientId, setEditClientId] = useState("");
  const [editClientForm, setEditClientForm] = useState({
    name: "",
    accountType: "Client Household",
    custodian: "",
    clientEmail: "",
    emailOptIn: true,
    preferredGreeting: "",
    deliveryPreference: "Advisor Review",
    voiceAlias: "",
    notes: "",
  });

  const [holdingForm, setHoldingForm] = useState({
    accountId: "",
    symbol: "",
    assetName: "",
    assetClass: "Stock",
    valueNumber: "",
    costBasis: "",
    targetRole: "Core",
    riskLevel: "Medium",
    thesis: "",
  });

  const [bulkForm, setBulkForm] = useState({
    accountId: "",
    symbols: "",
    assetClass: "Stock",
    targetRole: "Core",
    riskLevel: "Medium",
    thesis: "",
  });

  const [modelForm, setModelForm] = useState({
    name: "",
    description: "",
    riskLevel: "Balanced",
  });

  const [targetForm, setTargetForm] = useState({
    modelId: "",
    assetClass: "Stocks",
    targetPct: "",
  });

  const [emailForm, setEmailForm] = useState({
    symbol: "",
    subject: "",
    customMessage: "",
  });

  const accounts = data.accounts ?? [];
  const holdings = data.holdings ?? [];
  const clientExposures = data.clientExposures ?? [];
  const symbolExposures = data.symbolExposures ?? [];
  const allocations = data.allocations ?? [];
  const models = data.models ?? [];
  const rebalanceReports = data.rebalanceReports ?? [];
  const scenarioReports = data.scenarioReports ?? [];
  const privacySummary = data.privacySummary ?? DEFAULT_DATA.privacySummary;

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? models[0],
    [models, selectedModelId],
  );

  const filteredSymbols = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return symbolExposures;

    return symbolExposures.filter((item) => {
      return (
        item.symbol.toLowerCase().includes(query) ||
        item.assetName.toLowerCase().includes(query) ||
        item.clientNames.some((name) => name.toLowerCase().includes(query)) ||
        item.assetClass.toLowerCase().includes(query)
      );
    });
  }, [search, symbolExposures]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return clientExposures;

    return clientExposures.filter((client) => {
      return (
        client.clientName.toLowerCase().includes(query) ||
        (client.clientEmail ?? "").toLowerCase().includes(query) ||
        (client.voiceAlias ?? "").toLowerCase().includes(query) ||
        client.symbols.some((symbol) => symbol.toLowerCase().includes(query)) ||
        client.assetClasses.some((assetClass) => assetClass.toLowerCase().includes(query))
      );
    });
  }, [search, clientExposures]);

  const latestRebalance = rebalanceReports[0];
  const latestScenario = scenarioReports[0];

  const rebalanceRecommendations = latestRebalance
    ? parseJsonList<string>(latestRebalance.recommendationsJson)
    : [];

  const scenarioActions = latestScenario
    ? parseJsonList<string>(latestScenario.actionsJson)
    : [];

  async function loadData() {
    setWorking(true);

    try {
      const response = await fetch("/api/portfolio/lab", {
        cache: "no-store",
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to load Portfolio Lab.");
        return;
      }

      setData(payload);

      if (!selectedModelId && payload.models?.[0]) {
        setSelectedModelId(payload.models[0].id);
        setTargetForm((current) => ({ ...current, modelId: payload.models[0].id }));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load Portfolio Lab.");
    } finally {
      setWorking(false);
    }
  }

  async function postAction(body: Record<string, unknown>) {
    setWorking(true);
    setMessage("");

    try {
      const response = await fetch("/api/portfolio/lab", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": String(body.action ?? "portfolio-lab"),
        },
        body: JSON.stringify(body),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Portfolio action failed.");
        return null;
      }

      setData(payload);

      if (payload.emailDraft) {
        setEmailDraft(payload.emailDraft);
      }

      if (!selectedModelId && payload.models?.[0]) {
        setSelectedModelId(payload.models[0].id);
        setTargetForm((current) => ({ ...current, modelId: payload.models[0].id }));
      }

      return payload as PortfolioResponse;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Portfolio action failed.");
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault();

    const payload = await postAction({
      action: "createAccount",
      ...accountForm,
    });

    if (payload) {
      setAccountForm({
        name: "",
        accountType: "Client Household",
        custodian: "",
        clientEmail: "",
        emailOptIn: true,
        preferredGreeting: "",
        deliveryPreference: "Advisor Review",
        voiceAlias: "",
        notes: "",
      });
      setMessage("Client exposure profile created.");
    }
  }

  function startEditingClient(client: ClientExposure) {
    setEditClientId(client.id);
    setEditClientForm({
      name: client.clientName,
      accountType: client.accountType,
      custodian: client.custodian ?? "",
      clientEmail: client.clientEmail ?? "",
      emailOptIn: client.emailOptIn,
      preferredGreeting: client.preferredGreeting ?? "",
      deliveryPreference: client.deliveryPreference,
      voiceAlias: client.voiceAlias ?? "",
      notes: client.notes ?? "",
    });
  }

  async function updateClient(event: FormEvent) {
    event.preventDefault();

    if (!editClientId) {
      setMessage("Select a client first.");
      return;
    }

    const payload = await postAction({
      action: "updateAccount",
      id: editClientId,
      ...editClientForm,
    });

    if (payload) {
      setMessage("Client exposure profile updated.");
    }
  }

  async function deleteClient(client: ClientExposure) {
    const confirmed = window.confirm(`Delete ${client.clientName}?`);
    if (!confirmed) return;

    const payload = await postAction({
      action: "deleteAccount",
      id: client.id,
    });

    if (payload) {
      setEditClientId("");
      setMessage(`${client.clientName} removed.`);
    }
  }

  async function createHolding(event: FormEvent) {
    event.preventDefault();

    const payload = await postAction({
      action: "createHolding",
      ...holdingForm,
      symbol: holdingForm.symbol.toUpperCase().trim(),
      valueNumber: holdingForm.valueNumber,
      costBasis: holdingForm.costBasis,
    });

    if (payload) {
      setHoldingForm({
        accountId: holdingForm.accountId,
        symbol: "",
        assetName: "",
        assetClass: "Stock",
        valueNumber: "",
        costBasis: "",
        targetRole: "Core",
        riskLevel: "Medium",
        thesis: "",
      });
      setMessage("Holding created.");
    }
  }

  async function bulkAddHoldings() {
    const symbols = cleanSymbols(bulkForm.symbols);

    if (!symbols.length) {
      setMessage("Paste at least one symbol.");
      return;
    }

    for (const symbol of symbols) {
      await postAction({
        action: "createHolding",
        accountId: bulkForm.accountId,
        symbol,
        assetName: symbol,
        assetClass: bulkForm.assetClass,
        targetRole: bulkForm.targetRole,
        riskLevel: bulkForm.riskLevel,
        thesis: bulkForm.thesis || "Bulk-added from Portfolio Lab.",
      });
    }

    setBulkForm((current) => ({ ...current, symbols: "" }));
    setMessage(`${symbols.length} holding(s) added.`);
  }

  async function deleteHolding(holding: Holding) {
    const confirmed = window.confirm(`Remove ${holding.symbol}?`);
    if (!confirmed) return;

    const payload = await postAction({
      action: "deleteHolding",
      id: holding.id,
    });

    if (payload) {
      setMessage(`${holding.symbol} removed.`);
    }
  }

  async function createModel(event: FormEvent) {
    event.preventDefault();

    const payload = await postAction({
      action: "createModel",
      ...modelForm,
    });

    if (payload) {
      setModelForm({
        name: "",
        description: "",
        riskLevel: "Balanced",
      });
      setMessage("Allocation model created.");
    }
  }

  async function addTarget(event: FormEvent) {
    event.preventDefault();

    const modelId = targetForm.modelId || selectedModel?.id;

    if (!modelId) {
      setMessage("Create or select a model first.");
      return;
    }

    const payload = await postAction({
      action: "addTarget",
      modelId,
      assetClass: targetForm.assetClass,
      targetPct: targetForm.targetPct,
    });

    if (payload) {
      setTargetForm((current) => ({
        ...current,
        targetPct: "",
      }));
      setMessage("Allocation target added.");
    }
  }

  async function runRebalance() {
    const modelId = selectedModelId || selectedModel?.id;

    if (!modelId) {
      setMessage("Select or create an allocation model first.");
      return;
    }

    const payload = await postAction({
      action: "runRebalance",
      modelId,
    });

    if (payload) {
      setActiveView("reports");
      setMessage("Rebalance report generated.");
    }
  }

  async function runScenario() {
    const payload = await postAction({
      action: "runScenario",
      scenarioType,
    });

    if (payload) {
      setActiveView("reports");
      setMessage("Scenario report generated.");
    }
  }

  function prepareEmailDraft(symbol?: string) {
    const selectedSymbol = symbol || emailForm.symbol;
    const exposure = symbolExposures.find((item) => item.symbol === selectedSymbol);

    if (!exposure) {
      setMessage("Select a symbol with client exposure first.");
      return;
    }

    const recipients = exposure.emailRecipients ?? [];
    const subject = emailForm.subject || `Advisor review: ${exposure.symbol}`;
    const body = [
      `Hi,`,
      ``,
      `I wanted to flag that ${exposure.symbol} is currently tracked in your portfolio context.`,
      emailForm.customMessage || "This is not a recommendation or trade instruction. I will review the details and follow up with advisor-approved context as appropriate.",
      ``,
      `Best,`,
    ].join("\n");

    const draft: EmailDraft = {
      symbol: exposure.symbol,
      subject,
      body,
      recipients,
      recipientEmails: recipients.map((recipient) => recipient.email),
      recipientCount: recipients.length,
      missingEmailClients: exposure.missingEmailClients ?? [],
      optedOutClients: exposure.optedOutClients ?? [],
      mailtoUrl: "",
      complianceNotes: [
        "Advisor review required before sending.",
        "Do not include client-specific recommendations without suitability review.",
        "Retain final communication according to firm policy.",
      ],
    };

    setEmailDraft({
      ...draft,
      mailtoUrl: buildMailtoUrl(draft),
    });
    setEmailForm((current) => ({ ...current, symbol: exposure.symbol, subject }));
    setActiveView("email");
    setMessage("Email draft prepared for advisor review.");
  }

  async function seedDefaults() {
    const payload = await postAction({ action: "seedDefaults" });

    if (payload) {
      setMessage("Default Portfolio Lab data seeded.");
    }
  }

  async function runVoiceCommand(commandOverride?: string) {
    const command = (commandOverride || voiceCommand).trim();

    if (!command) {
      setMessage("Enter or speak a command first.");
      return;
    }

    const lower = command.toLowerCase();

    if (lower.includes("rebalance")) {
      await runRebalance();
      return;
    }

    if (lower.includes("scenario")) {
      await runScenario();
      return;
    }

    if (lower.includes("email")) {
      const symbol = symbolExposures.find((item) => lower.includes(item.symbol.toLowerCase()))?.symbol;
      prepareEmailDraft(symbol);
      return;
    }

    if (lower.startsWith("add client") || lower.startsWith("create client")) {
      const name = command.replace(/^add client/i, "").replace(/^create client/i, "").trim();
      if (name) {
        setAccountForm((current) => ({ ...current, name }));
        setActiveView("clients");
        setMessage("Voice filled the client form. Review and save.");
        return;
      }
    }

    if (lower.includes("add") && lower.includes("to")) {
      const pieces = command.split(/\bto\b/i);
      const symbol = cleanSymbols(pieces[0].replace(/\badd\b/i, ""))[0];
      const clientName = pieces[1]?.trim().toLowerCase();
      const account = accounts.find((item) => item.name.toLowerCase().includes(clientName));

      if (symbol) {
        setHoldingForm((current) => ({
          ...current,
          accountId: account?.id ?? current.accountId,
          symbol,
          assetName: symbol,
        }));
        setActiveView("symbols");
        setMessage("Voice filled the holding form. Review and save.");
        return;
      }
    }

    setMessage("Voice command captured. Try: add client Jane Doe, add AAPL to Jane, run rebalance, or email AAPL.");
  }

  function startVoiceCapture() {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage("Voice capture is not supported in this browser. Type the command instead.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    let finalText = "";

    recognition.onstart = () => {
      setVoiceListening(true);
      setMessage("");
    };

    recognition.onresult = (event) => {
      let interim = "";

      for (let index = event.resultIndex ?? 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? "";

        if (result?.isFinal) {
          finalText = `${finalText} ${transcript}`.trim();
        } else {
          interim = `${interim} ${transcript}`.trim();
        }
      }

      setVoiceCommand((finalText || interim).trim());
    };

    recognition.onerror = () => {
      setVoiceListening(false);
      setMessage("Voice capture paused. Try again or type the command.");
    };

    recognition.onend = () => {
      setVoiceListening(false);
      recognitionRef.current = null;

      const command = finalText.trim();

      if (command) {
        setVoiceCommand(command);
        void runVoiceCommand(command);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopVoiceCapture() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceListening(false);
  }

  useEffect(() => {
    void loadData();

    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const highRiskCount = holdings.filter((holding) => riskTone(holding.riskLevel) === "red").length;
  const emailReadyCount = clientExposures.filter((client) => Boolean(client.clientEmail) && client.emailOptIn).length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_28%),linear-gradient(135deg,_#020617,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-zinc-950/78 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.28),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.16),transparent_26%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <Logo />

            <div className="flex flex-wrap gap-2">
              <a href="/workspace" className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white hover:bg-white/10">
                Workspace
              </a>
              <button type="button" onClick={seedDefaults} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-500/20">
                Seed Defaults
              </button>
              <button type="button" onClick={() => void loadData()} className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20">
                Refresh
              </button>
            </div>
          </div>

          <div className="relative mt-6">
            <div className="flex flex-wrap gap-2">
              <Pill tone="red">Portfolio Lab</Pill>
              <Pill tone="cyan">Client Exposure</Pill>
              <Pill tone="green">Privacy First</Pill>
              <Pill tone="amber">Advisor Review</Pill>
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
              Client exposure and portfolio intelligence.
            </h1>

            <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
              Track client exposure by account, security, model, allocation drift, scenario risk, voice commands, and advisor-approved email workflows.
              This page remains privacy-first and supports workflows without requiring account values.
            </p>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="Clients" value={clientExposures.length} helper={`${emailReadyCount} email ready`} tone="purple" />
            <Metric label="Holdings" value={holdings.length} helper={`${symbolExposures.length} symbols`} tone="cyan" />
            <Metric label="High Risk" value={highRiskCount} helper="Review needed" tone={highRiskCount ? "red" : "green"} />
            <Metric label="Models" value={models.length} helper="Allocation targets" tone="amber" />
            <Metric label="Reports" value={rebalanceReports.length + scenarioReports.length} helper="Rebalance + scenarios" tone="blue" />
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
            {message}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit xl:sticky xl:top-5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
              Navigation
            </div>

            <div className="mt-4 grid gap-2">
              {viewTabs.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setActiveView(view.id)}
                  className={cx(
                    "rounded-2xl border px-4 py-3 text-left text-sm font-black transition",
                    activeView === view.id ? "border-white bg-white text-slate-950" : toneClass(view.tone),
                  )}
                >
                  {view.label}
                </button>
              ))}
            </div>

            <div className="mt-5">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search clients, symbols, assets..."
                className={inputClass}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Status
              </div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {working ? "Working..." : "Ready"}
              </div>
            </div>
          </Card>

          <div className="grid gap-5">
            {activeView === "clients" ? (
              <div className="grid gap-5">
                <Card>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                        Client Exposure
                      </div>
                      <h2 className="mt-2 text-3xl font-black text-white">Profiles and households</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Create, edit, and review client exposure records.
                      </p>
                    </div>
                    <Pill tone="purple">{clientExposures.length} clients</Pill>
                  </div>

                  <form onSubmit={createAccount} className="mt-5 grid gap-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} placeholder="Client / household name" className={inputClass} />
                      <input value={accountForm.clientEmail} onChange={(event) => setAccountForm((current) => ({ ...current, clientEmail: event.target.value }))} placeholder="Client email" className={inputClass} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <select value={accountForm.accountType} onChange={(event) => setAccountForm((current) => ({ ...current, accountType: event.target.value }))} className={selectClass}>
                        <option>Client Household</option>
                        <option>Individual</option>
                        <option>Trust</option>
                        <option>Business Owner</option>
                        <option>Retirement</option>
                      </select>
                      <input value={accountForm.custodian} onChange={(event) => setAccountForm((current) => ({ ...current, custodian: event.target.value }))} placeholder="Custodian" className={inputClass} />
                      <input value={accountForm.voiceAlias} onChange={(event) => setAccountForm((current) => ({ ...current, voiceAlias: event.target.value }))} placeholder="Voice alias" className={inputClass} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <input value={accountForm.preferredGreeting} onChange={(event) => setAccountForm((current) => ({ ...current, preferredGreeting: event.target.value }))} placeholder="Preferred greeting" className={inputClass} />
                      <select value={accountForm.deliveryPreference} onChange={(event) => setAccountForm((current) => ({ ...current, deliveryPreference: event.target.value }))} className={selectClass}>
                        <option>Advisor Review</option>
                        <option>Email Draft Only</option>
                        <option>Meeting First</option>
                        <option>No Email</option>
                      </select>
                    </div>

                    <textarea value={accountForm.notes} onChange={(event) => setAccountForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" rows={3} className={cx(inputClass, "resize-none")} />

                    <button type="submit" disabled={working} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/30 disabled:cursor-not-allowed disabled:opacity-50">
                      Create Client Exposure
                    </button>
                  </form>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  {filteredClients.map((client) => (
                    <SoftCard key={client.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-xl font-black text-white">{client.clientName}</div>
                          <div className="mt-1 truncate text-xs text-slate-500">
                            {client.clientEmail || "No email"} · {client.accountType}
                          </div>
                        </div>
                        <Pill tone={riskTone(client.emailStatus)}>{client.emailStatus || "Profile"}</Pill>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Pill tone="cyan">{client.holdingsCount} holdings</Pill>
                        <Pill tone="purple">{client.symbols.join(", ") || "No symbols"}</Pill>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => startEditingClient(client)} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-black text-white">
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteClient(client)} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100">
                          Delete
                        </button>
                      </div>
                    </SoftCard>
                  ))}
                </div>

                {editClientId ? (
                  <Card>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                      Edit Client
                    </div>

                    <form onSubmit={updateClient} className="mt-5 grid gap-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <input value={editClientForm.name} onChange={(event) => setEditClientForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} />
                        <input value={editClientForm.clientEmail} onChange={(event) => setEditClientForm((current) => ({ ...current, clientEmail: event.target.value }))} className={inputClass} />
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <input value={editClientForm.custodian} onChange={(event) => setEditClientForm((current) => ({ ...current, custodian: event.target.value }))} className={inputClass} />
                        <input value={editClientForm.voiceAlias} onChange={(event) => setEditClientForm((current) => ({ ...current, voiceAlias: event.target.value }))} className={inputClass} />
                        <select value={editClientForm.deliveryPreference} onChange={(event) => setEditClientForm((current) => ({ ...current, deliveryPreference: event.target.value }))} className={selectClass}>
                          <option>Advisor Review</option>
                          <option>Email Draft Only</option>
                          <option>Meeting First</option>
                          <option>No Email</option>
                        </select>
                      </div>
                      <textarea value={editClientForm.notes} onChange={(event) => setEditClientForm((current) => ({ ...current, notes: event.target.value }))} rows={3} className={cx(inputClass, "resize-none")} />
                      <button type="submit" disabled={working} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                        Save Client
                      </button>
                    </form>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {activeView === "symbols" ? (
              <div className="grid gap-5">
                <Card>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                    Holdings
                  </div>
                  <h2 className="mt-2 text-3xl font-black text-white">Add securities</h2>

                  <form onSubmit={createHolding} className="mt-5 grid gap-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <select value={holdingForm.accountId} onChange={(event) => setHoldingForm((current) => ({ ...current, accountId: event.target.value }))} className={selectClass}>
                        <option value="">Select client</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>{account.name}</option>
                        ))}
                      </select>
                      <input value={holdingForm.symbol} onChange={(event) => setHoldingForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} placeholder="Symbol" className={inputClass} />
                      <input value={holdingForm.assetName} onChange={(event) => setHoldingForm((current) => ({ ...current, assetName: event.target.value }))} placeholder="Asset name" className={inputClass} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-5">
                      <select value={holdingForm.assetClass} onChange={(event) => setHoldingForm((current) => ({ ...current, assetClass: event.target.value }))} className={selectClass}>
                        <option>Stock</option>
                        <option>ETF</option>
                        <option>Bond</option>
                        <option>Crypto</option>
                        <option>Cash</option>
                        <option>Alternatives</option>
                        <option>Real Estate</option>
                        <option>Other</option>
                      </select>
                      <select value={holdingForm.targetRole} onChange={(event) => setHoldingForm((current) => ({ ...current, targetRole: event.target.value }))} className={selectClass}>
                        <option>Core</option>
                        <option>Growth</option>
                        <option>Income</option>
                        <option>Hedge</option>
                        <option>Speculative</option>
                      </select>
                      <select value={holdingForm.riskLevel} onChange={(event) => setHoldingForm((current) => ({ ...current, riskLevel: event.target.value }))} className={selectClass}>
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                        <option>Very High</option>
                      </select>
                      <input value={holdingForm.valueNumber} onChange={(event) => setHoldingForm((current) => ({ ...current, valueNumber: event.target.value }))} placeholder="Value optional" className={inputClass} />
                      <input value={holdingForm.costBasis} onChange={(event) => setHoldingForm((current) => ({ ...current, costBasis: event.target.value }))} placeholder="Cost basis optional" className={inputClass} />
                    </div>

                    <input value={holdingForm.thesis} onChange={(event) => setHoldingForm((current) => ({ ...current, thesis: event.target.value }))} placeholder="Thesis / context" className={inputClass} />

                    <button type="submit" disabled={working} className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 disabled:opacity-50">
                      Add Holding
                    </button>
                  </form>

                  <div className="mt-5 grid gap-3">
                    <textarea value={bulkForm.symbols} onChange={(event) => setBulkForm((current) => ({ ...current, symbols: event.target.value }))} placeholder="Bulk symbols: AAPL, MSFT, NVDA..." rows={3} className={cx(inputClass, "resize-none")} />
                    <div className="grid gap-3 md:grid-cols-4">
                      <select value={bulkForm.accountId} onChange={(event) => setBulkForm((current) => ({ ...current, accountId: event.target.value }))} className={selectClass}>
                        <option value="">Select client</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>{account.name}</option>
                        ))}
                      </select>
                      <select value={bulkForm.assetClass} onChange={(event) => setBulkForm((current) => ({ ...current, assetClass: event.target.value }))} className={selectClass}>
                        <option>Stock</option>
                        <option>ETF</option>
                        <option>Bond</option>
                        <option>Crypto</option>
                        <option>Other</option>
                      </select>
                      <select value={bulkForm.riskLevel} onChange={(event) => setBulkForm((current) => ({ ...current, riskLevel: event.target.value }))} className={selectClass}>
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                        <option>Very High</option>
                      </select>
                      <button type="button" onClick={bulkAddHoldings} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white">
                        Bulk Add
                      </button>
                    </div>
                  </div>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredSymbols.map((symbol) => (
                    <SoftCard key={symbol.symbol}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xl font-black text-white">{symbol.symbol}</div>
                          <div className="mt-1 text-xs text-slate-500">{symbol.assetName}</div>
                        </div>
                        <Pill tone={riskTone(symbol.assetClass)}>{symbol.assetClass}</Pill>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Metric label="Clients" value={symbol.clientCount} tone="purple" />
                        <Metric label="Email Ready" value={symbol.emailReadyCount} tone="green" />
                      </div>

                      <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400">
                        {symbol.clientNames.join(", ")}
                      </p>

                      <button type="button" onClick={() => prepareEmailDraft(symbol.symbol)} className="mt-4 rounded-xl border border-green-500/25 bg-green-500/10 px-3 py-2 text-xs font-black text-green-100">
                        Draft Email
                      </button>
                    </SoftCard>
                  ))}
                </div>

                <div className="grid gap-3">
                  {holdings.map((holding) => (
                    <SoftCard key={holding.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-white">
                            {holding.symbol} · {holding.assetName}
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-500">
                            {holding.clientName || "Unassigned"} · {holding.assetClass} · {money(holding.valueNumber ?? holding.value)}
                          </div>
                        </div>
                        <button type="button" onClick={() => deleteHolding(holding)} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100">
                          Remove
                        </button>
                      </div>
                    </SoftCard>
                  ))}
                </div>
              </div>
            ) : null}

            {activeView === "email" ? (
              <div className="grid gap-5">
                <Card>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400">
                    Advisor Email Drafts
                  </div>
                  <h2 className="mt-2 text-3xl font-black text-white">Create review-safe email drafts</h2>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <select value={emailForm.symbol} onChange={(event) => setEmailForm((current) => ({ ...current, symbol: event.target.value }))} className={selectClass}>
                      <option value="">Select symbol</option>
                      {symbolExposures.map((symbol) => (
                        <option key={symbol.symbol} value={symbol.symbol}>{symbol.symbol}</option>
                      ))}
                    </select>
                    <input value={emailForm.subject} onChange={(event) => setEmailForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Subject optional" className={inputClass} />
                    <button type="button" onClick={() => prepareEmailDraft()} className="rounded-2xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm font-black text-green-100">
                      Prepare Draft
                    </button>
                  </div>

                  <textarea value={emailForm.customMessage} onChange={(event) => setEmailForm((current) => ({ ...current, customMessage: event.target.value }))} placeholder="Advisor instructions / custom message" rows={4} className={cx(inputClass, "mt-3 resize-none")} />
                </Card>

                {emailDraft ? (
                  <Card>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <Pill tone="green">{emailDraft.recipientCount} recipients</Pill>
                        <h3 className="mt-3 text-2xl font-black text-white">{emailDraft.subject}</h3>
                      </div>
                      <a href={buildMailtoUrl(emailDraft)} className="rounded-2xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-center text-sm font-black text-green-100">
                        Open Mailto
                      </a>
                    </div>

                    <pre className="mt-5 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/35 p-4 text-sm leading-6 text-slate-300">
                      {emailDraft.body}
                    </pre>

                    <div className="mt-5 grid gap-2">
                      {emailDraft.complianceNotes.map((note) => (
                        <div key={note} className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
                          {note}
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {activeView === "models" ? (
              <div className="grid gap-5">
                <Card>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                    Models
                  </div>
                  <h2 className="mt-2 text-3xl font-black text-white">Allocation models</h2>

                  <form onSubmit={createModel} className="mt-5 grid gap-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <input value={modelForm.name} onChange={(event) => setModelForm((current) => ({ ...current, name: event.target.value }))} placeholder="Model name" className={inputClass} />
                      <input value={modelForm.description} onChange={(event) => setModelForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className={inputClass} />
                      <select value={modelForm.riskLevel} onChange={(event) => setModelForm((current) => ({ ...current, riskLevel: event.target.value }))} className={selectClass}>
                        <option>Conservative</option>
                        <option>Balanced</option>
                        <option>Growth</option>
                        <option>Aggressive</option>
                      </select>
                    </div>
                    <button type="submit" disabled={working} className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100 disabled:opacity-50">
                      Create Model
                    </button>
                  </form>

                  <form onSubmit={addTarget} className="mt-5 grid gap-3 md:grid-cols-4">
                    <select value={targetForm.modelId || selectedModelId} onChange={(event) => setTargetForm((current) => ({ ...current, modelId: event.target.value }))} className={selectClass}>
                      <option value="">Select model</option>
                      {models.map((model) => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))}
                    </select>
                    <input value={targetForm.assetClass} onChange={(event) => setTargetForm((current) => ({ ...current, assetClass: event.target.value }))} placeholder="Asset class" className={inputClass} />
                    <input value={targetForm.targetPct} onChange={(event) => setTargetForm((current) => ({ ...current, targetPct: event.target.value }))} placeholder="Target %" className={inputClass} />
                    <button type="submit" className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white">
                      Add Target
                    </button>
                  </form>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  {models.map((model) => (
                    <SoftCard key={model.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xl font-black text-white">{model.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{model.description || "No description"}</div>
                        </div>
                        <button type="button" onClick={() => setSelectedModelId(model.id)} className={cx("rounded-xl border px-3 py-2 text-xs font-black", selectedModelId === model.id ? "border-white bg-white text-slate-950" : "border-white/10 bg-black/25 text-white")}>
                          Select
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Pill tone={riskTone(model.riskLevel)}>{model.riskLevel}</Pill>
                        <Pill tone="amber">{model.targets.length} targets</Pill>
                      </div>

                      <div className="mt-4 grid gap-2">
                        {model.targets.map((target) => (
                          <div key={target.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-slate-300">
                            <span>{target.assetClass}</span>
                            <span>{target.targetPct}%</span>
                          </div>
                        ))}
                      </div>
                    </SoftCard>
                  ))}
                </div>
              </div>
            ) : null}

            {activeView === "reports" ? (
              <div className="grid gap-5">
                <Card>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
                        Reports
                      </div>
                      <h2 className="mt-2 text-3xl font-black text-white">Rebalance and scenarios</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={runRebalance} className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-sm font-black text-blue-100">
                        Run Rebalance
                      </button>
                      <select value={scenarioType} onChange={(event) => setScenarioType(event.target.value)} className={selectClass}>
                        <option>Market Drawdown</option>
                        <option>Inflation Shock</option>
                        <option>Rate Cut Rally</option>
                        <option>Crypto Crash</option>
                        <option>Venture Write-Down</option>
                        <option>Liquidity Crunch</option>
                      </select>
                      <button type="button" onClick={runScenario} className="rounded-2xl border border-purple-500/25 bg-purple-500/10 px-4 py-3 text-sm font-black text-purple-100">
                        Run Scenario
                      </button>
                    </div>
                  </div>
                </Card>

                {latestRebalance ? (
                  <Card>
                    <Pill tone="blue">Latest Rebalance</Pill>
                    <h3 className="mt-3 text-2xl font-black text-white">{latestRebalance.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{latestRebalance.summary}</p>
                    <div className="mt-5 grid gap-2">
                      {rebalanceRecommendations.map((item, index) => (
                        <div key={`${item}-${index}`} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-300">
                          {item}
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                {latestScenario ? (
                  <Card>
                    <Pill tone="purple">Latest Scenario</Pill>
                    <h3 className="mt-3 text-2xl font-black text-white">{latestScenario.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{latestScenario.summary}</p>
                    <div className="mt-5 grid gap-2">
                      {scenarioActions.map((item, index) => (
                        <div key={`${item}-${index}`} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-300">
                          {item}
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {allocations.map((allocation) => (
                    <Metric
                      key={allocation.assetClass}
                      label={allocation.assetClass}
                      value={`${allocation.pct}%`}
                      helper={money(allocation.value)}
                      tone={riskTone(allocation.assetClass)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {activeView === "voice" ? (
              <div className="grid gap-5">
                <Card>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                    Voice Command
                  </div>
                  <h2 className="mt-2 text-3xl font-black text-white">Speak portfolio actions</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Try “add client Jane Doe”, “add AAPL to Jane”, “run rebalance”, “run scenario”, or “email AAPL”.
                  </p>

                  <textarea value={voiceCommand} onChange={(event) => setVoiceCommand(event.target.value)} rows={4} className={cx(inputClass, "mt-5 resize-none")} />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={voiceListening ? stopVoiceCapture : startVoiceCapture} className={cx("rounded-2xl border px-4 py-3 text-sm font-black", voiceListening ? toneClass("red") : toneClass("green"))}>
                      {voiceListening ? "Stop Listening" : "Start Voice"}
                    </button>
                    <button type="button" onClick={() => runVoiceCommand()} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white">
                      Run Command
                    </button>
                  </div>
                </Card>
              </div>
            ) : null}

            {activeView === "privacy" ? (
              <div className="grid gap-5">
                <Card>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Privacy
                  </div>
                  <h2 className="mt-2 text-3xl font-black text-white">Privacy-first posture</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{privacySummary.dataPolicy}</p>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Metric label="Privacy Mode" value={privacySummary.privacyMode ? "On" : "Off"} tone={privacySummary.privacyMode ? "green" : "amber"} />
                    <Metric label="Clients" value={privacySummary.clientCount} tone="purple" />
                    <Metric label="Holdings" value={privacySummary.holdingsCount} tone="cyan" />
                    <Metric label="High Risk" value={privacySummary.highRiskCount} tone={privacySummary.highRiskCount ? "red" : "green"} />
                  </div>

                  <div className="mt-5 grid gap-2">
                    {privacySummary.compliancePosture.map((item) => (
                      <div key={item} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-bold text-slate-300">
                        {item}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}