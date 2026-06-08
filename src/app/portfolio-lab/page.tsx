"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Account = {
  id: string;
  name: string;
  accountType: string;
  custodian: string | null;
  notes: string | null;
  clientEmail: string | null;
  emailOptIn: boolean;
  preferredGreeting: string | null;
  deliveryPreference: string;
  voiceAlias: string | null;
  createdAt: string;
  holdings: Holding[];
};

type Holding = {
  id: string;
  accountId: string | null;
  clientName: string;
  clientEmail: string | null;
  emailOptIn: boolean;
  preferredGreeting: string | null;
  deliveryPreference: string;
  accountType: string;
  custodian: string | null;
  symbol: string;
  assetName: string;
  assetClass: string;
  targetRole: string;
  riskLevel: string;
  thesis: string | null;
  createdAt: string;
  updatedAt: string;
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
  emailRecipients: Array<{ name: string; email: string; greeting: string | null }>;
  missingEmailClients: string[];
  optedOutClients: string[];
};

type Allocation = {
  assetClass: string;
  count: number;
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

type VoiceResult = {
  type: string;
  message: string;
  emailDraft?: EmailDraft;
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
  voiceResult?: VoiceResult;
};

type View = "clients" | "symbols" | "email" | "models" | "reports" | "voice" | "privacy";

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

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: unknown) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseJsonList(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function shortDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function riskTone(value: string): "red" | "green" | "amber" | "purple" | "slate" | "cyan" {
  const lower = value.toLowerCase();

  if (lower.includes("high") || lower.includes("aggressive") || lower.includes("speculative")) {
    return "red";
  }

  if (lower.includes("medium") || lower.includes("balanced")) {
    return "amber";
  }

  if (lower.includes("low") || lower.includes("conservative")) {
    return "green";
  }

  if (lower.includes("core") || lower.includes("growth")) {
    return "purple";
  }

  if (lower.includes("ready") || lower.includes("email")) {
    return "cyan";
  }

  return "slate";
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
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/76 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function SoftCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "red" | "green" | "amber" | "purple" | "slate" | "cyan";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
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
  tone?: "red" | "green" | "amber" | "purple" | "slate" | "cyan";
}) {
  const glows = {
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div
        className={cx(
          "absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent",
          glows[tone]
        )}
      />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-3xl font-black text-white">
          {value}
        </div>
        {helper ? <div className="mt-1 truncate text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-red-400/40 focus:ring-2 focus:ring-red-500/20";

const selectClass =
  "w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-red-400/40 focus:ring-2 focus:ring-red-500/20";

function Logo() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="truncate text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
          Client Exposure Center
        </div>
      </div>
    </div>
  );
}

export default function PortfolioLabPage() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [activeView, setActiveView] = useState<View>("clients");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [scenarioType, setScenarioType] = useState("Market Drawdown");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [voiceCommand, setVoiceCommand] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

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

  const [holdingForm, setHoldingForm] = useState({
    accountId: "",
    symbol: "",
    assetName: "",
    assetClass: "Stock",
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

  const [emailForm, setEmailForm] = useState({
    symbol: "",
    subject: "",
    customMessage: "",
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

  const [modelForm, setModelForm] = useState({
    name: "",
    description: "",
    riskLevel: "Balanced",
  });

  const [targetForm, setTargetForm] = useState({
    modelId: "",
    assetClass: "Stock",
    targetPct: "",
  });

  const accounts = data?.accounts ?? [];
  const holdings = data?.holdings ?? [];
  const clientExposures = data?.clientExposures ?? [];
  const symbolExposures = data?.symbolExposures ?? [];
  const allocations = data?.allocations ?? [];
  const models = data?.models ?? [];
  const rebalanceReports = data?.rebalanceReports ?? [];
  const scenarioReports = data?.scenarioReports ?? [];
  const privacySummary = data?.privacySummary;

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? models[0],
    [models, selectedModelId]
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
    ? parseJsonList(latestRebalance.recommendationsJson)
    : [];

  const scenarioActions = latestScenario
    ? parseJsonList(latestScenario.actionsJson)
    : [];

  async function loadData() {
    const response = await fetch("/api/portfolio/lab", {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to load Client Exposure Center.");
      return;
    }

    setData(payload);

    if (!selectedModelId && payload.models?.[0]) {
      setSelectedModelId(payload.models[0].id);
      setTargetForm((current) => ({ ...current, modelId: payload.models[0].id }));
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
        setEmailForm((current) => ({
          ...current,
          symbol: payload.emailDraft.symbol,
          subject: payload.emailDraft.subject,
          customMessage: current.customMessage,
        }));
      }

      if (payload.voiceResult?.message) {
        setMessage(payload.voiceResult.message);
      }

      if (!selectedModelId && payload.models?.[0]) {
        setSelectedModelId(payload.models[0].id);
        setTargetForm((current) => ({ ...current, modelId: payload.models[0].id }));
      }

      return payload as PortfolioResponse;
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
      setMessage("Client exposure profile created with email onboarding.");
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

    const payload = await postAction({
      action: "updateAccount",
      id: editClientId,
      ...editClientForm,
    });

    if (payload) {
      setEditClientId("");
      setMessage("Client email and communication profile updated.");
    }
  }

  async function createHolding(event: FormEvent) {
    event.preventDefault();

    const payload = await postAction({
      action: "createHolding",
      ...holdingForm,
    });

    if (payload) {
      setHoldingForm({
        accountId: holdingForm.accountId,
        symbol: "",
        assetName: "",
        assetClass: "Stock",
        targetRole: "Core",
        riskLevel: "Medium",
        thesis: "",
      });
      setMessage("Ticker exposure added. No amount, shares, cost basis, or balance was collected.");
    }
  }

  async function bulkAddHoldings(event: FormEvent) {
    event.preventDefault();

    const payload = await postAction({
      action: "bulkAddHoldings",
      ...bulkForm,
    });

    if (payload) {
      setBulkForm((current) => ({
        ...current,
        symbols: "",
        thesis: "",
      }));
      setMessage("Bulk ticker exposures added.");
    }
  }

  async function deleteHolding(id: string) {
    await postAction({ action: "deleteHolding", id });
  }

  async function prepareSymbolEmail(event?: FormEvent, symbolOverride?: string) {
    event?.preventDefault();

    const payload = await postAction({
      action: "prepareSymbolEmail",
      symbol: symbolOverride || emailForm.symbol,
      subject: emailForm.subject,
      customMessage: emailForm.customMessage,
    });

    if (payload?.emailDraft) {
      setActiveView("email");
      setMessage(`Email draft prepared for ${payload.emailDraft.recipientCount} email-ready client(s).`);
    }
  }

  async function runVoiceCommand(commandOverride?: string) {
    const command = (commandOverride || voiceCommand).trim();

    if (!command) {
      setMessage("Enter or speak a command first.");
      return;
    }

    const payload = await postAction({
      action: "voiceCommand",
      command,
    });

    if (payload?.emailDraft) {
      setActiveView("email");
    }
  }

  function startVoiceCapture() {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

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

  async function createModel(event: FormEvent) {
    event.preventDefault();

    const payload = await postAction({
      action: "createModel",
      ...modelForm,
    });

    if (payload?.models?.[0]) {
      setModelForm({
        name: "",
        description: "",
        riskLevel: "Balanced",
      });
      setMessage("Privacy-aware exposure model created.");
    }
  }

  async function addTarget(event: FormEvent) {
    event.preventDefault();

    const payload = await postAction({
      action: "addTarget",
      ...targetForm,
      modelId: targetForm.modelId || selectedModel?.id,
    });

    if (payload) {
      setTargetForm((current) => ({ ...current, targetPct: "" }));
      setMessage("Exposure target saved.");
    }
  }

  async function deleteTarget(id: string) {
    await postAction({ action: "deleteTarget", id });
  }

  async function runRebalance() {
    if (!selectedModel?.id) {
      setMessage("Select or create an exposure model first.");
      return;
    }

    const payload = await postAction({
      action: "runRebalance",
      modelId: selectedModel.id,
    });

    if (payload) {
      setMessage("Privacy-aware exposure review generated.");
      setActiveView("reports");
    }
  }

  async function runScenario() {
    const payload = await postAction({
      action: "runScenario",
      scenarioType,
    });

    if (payload) {
      setMessage("Privacy-aware scenario generated.");
      setActiveView("reports");
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage("Copy failed. Select the text manually.");
    }
  }

  useEffect(() => {
    void loadData();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1720px] gap-5">
        <header className="sticky top-4 z-40 rounded-[1.75rem] border border-white/10 bg-black/72 p-4 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <Logo />

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Workspace
              </a>
              <a
                href="/watchlists"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
              >
                Watchlists
              </a>
              <a
                href="/workspace/client-emails"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
              >
                Email Center
              </a>
              <button
                onClick={startVoiceCapture}
                disabled={working || voiceListening}
                className={cx(
                  "rounded-2xl px-4 py-3 text-sm font-black text-white shadow-lg disabled:opacity-60",
                  voiceListening
                    ? "bg-cyan-600 shadow-cyan-950/40"
                    : "bg-red-600 shadow-red-950/40"
                )}
              >
                {voiceListening ? "Listening..." : "Voice Command"}
              </button>
              <button
                onClick={() => void loadData()}
                disabled={working}
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {[
              ["clients", "Clients"],
              ["symbols", "Symbol Matrix"],
              ["email", "Targeted Emails"],
              ["models", "Exposure Models"],
              ["reports", "Reviews"],
              ["voice", "Voice"],
              ["privacy", "Privacy Guardrails"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveView(id as View)}
                className={cx(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-black transition",
                  activeView === id
                    ? "bg-gradient-to-r from-red-600 to-red-950 text-white shadow-lg shadow-red-950/40"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <Card className="p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-red-600/16 to-transparent" />

          <div className="relative grid gap-5 xl:grid-cols-[1.05fr_0.95fr] xl:items-end">
            <div>
              <Pill tone="green">Email-ready privacy-first client exposure intelligence</Pill>
              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
                Email every client holding a security without storing amounts.
              </h1>
              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400 md:text-base">
                Slice maps clients to ticker exposure and email preferences so advisors can instantly draft
                an advisor-reviewed note for clients holding a specific stock or security. The platform still
                does not collect share counts, balances, cost basis, market value, or account value.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SoftCard>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Voice examples
                </div>
                <div className="mt-2 text-xl font-black text-white">
                  “Add AAPL to Sarah”
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Also try: “remove TSLA from Mark” or “email clients holding NVDA.”
                </p>
              </SoftCard>

              <SoftCard>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Email targeting
                </div>
                <div className="mt-2 text-xl font-black text-white">
                  BCC draft workflow
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Drafts open in your email client for advisor review before sending.
                </p>
              </SoftCard>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Metric
              label="Clients"
              value={privacySummary?.clientCount ?? clientExposures.length}
              helper="Household profiles"
              tone="green"
            />
            <Metric
              label="Ticker Exposures"
              value={privacySummary?.holdingsCount ?? holdings.length}
              helper="No amounts stored"
              tone="red"
            />
            <Metric
              label="Unique Symbols"
              value={privacySummary?.uniqueSymbolCount ?? symbolExposures.length}
              helper="Cross-client matrix"
              tone="purple"
            />
            <Metric
              label="Email Ready"
              value={symbolExposures.reduce((sum, item) => sum + item.emailReadyCount, 0)}
              helper="Symbol-client links"
              tone="cyan"
            />
            <Metric
              label="High Risk"
              value={privacySummary?.highRiskCount ?? 0}
              helper="Review candidates"
              tone="amber"
            />
            <Metric
              label="Privacy Mode"
              value="On"
              helper="Amounts suppressed"
              tone="slate"
            />
          </div>
        </Card>

        <section className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="grid gap-5">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Client onboarding
              </div>
              <h2 className="mt-2 text-2xl font-black">Client / household</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Onboard the client with email preferences from the start so future security-specific emails are one click away.
              </p>

              <form onSubmit={createAccount} className="mt-5 grid gap-3">
                <input
                  value={accountForm.name}
                  onChange={(event) =>
                    setAccountForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className={inputClass}
                  placeholder="Client or household name"
                />

                <input
                  value={accountForm.clientEmail}
                  onChange={(event) =>
                    setAccountForm((current) => ({ ...current, clientEmail: event.target.value }))
                  }
                  className={inputClass}
                  placeholder="Client email"
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={accountForm.preferredGreeting}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        preferredGreeting: event.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="Greeting name, optional"
                  />

                  <input
                    value={accountForm.voiceAlias}
                    onChange={(event) =>
                      setAccountForm((current) => ({ ...current, voiceAlias: event.target.value }))
                    }
                    className={inputClass}
                    placeholder="Voice alias, optional"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={accountForm.accountType}
                    onChange={(event) =>
                      setAccountForm((current) => ({ ...current, accountType: event.target.value }))
                    }
                    className={selectClass}
                  >
                    <option>Client Household</option>
                    <option>Taxable Brokerage</option>
                    <option>IRA</option>
                    <option>Roth IRA</option>
                    <option>401(k)</option>
                    <option>Trust</option>
                    <option>Foundation</option>
                    <option>Business Account</option>
                    <option>Other</option>
                  </select>

                  <select
                    value={accountForm.deliveryPreference}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        deliveryPreference: event.target.value,
                      }))
                    }
                    className={selectClass}
                  >
                    <option>Advisor Review</option>
                    <option>Email Allowed</option>
                    <option>Call First</option>
                    <option>Do Not Email</option>
                  </select>
                </div>

                <input
                  value={accountForm.custodian}
                  onChange={(event) =>
                    setAccountForm((current) => ({ ...current, custodian: event.target.value }))
                  }
                  className={inputClass}
                  placeholder="Custodian, optional"
                />

                <textarea
                  value={accountForm.notes}
                  onChange={(event) =>
                    setAccountForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  className={cx(inputClass, "min-h-20")}
                  placeholder="Advisor notes. Do not include balances or position sizes."
                />

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-slate-300">
                  Email opt-in confirmed
                  <input
                    type="checkbox"
                    checked={accountForm.emailOptIn}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        emailOptIn: event.target.checked,
                      }))
                    }
                  />
                </label>

                <button
                  disabled={working}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
                >
                  Create Client + Email Profile
                </button>
              </form>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Add ticker exposure
              </div>
              <h2 className="mt-2 text-2xl font-black">Client owns symbol</h2>

              <form onSubmit={createHolding} className="mt-5 grid gap-3">
                <select
                  value={holdingForm.accountId}
                  onChange={(event) =>
                    setHoldingForm((current) => ({ ...current, accountId: event.target.value }))
                  }
                  className={selectClass}
                >
                  <option value="">Select client / household</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>

                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={holdingForm.symbol}
                    onChange={(event) =>
                      setHoldingForm((current) => ({
                        ...current,
                        symbol: event.target.value.toUpperCase(),
                      }))
                    }
                    className={inputClass}
                    placeholder="Symbol"
                  />

                  <input
                    value={holdingForm.assetName}
                    onChange={(event) =>
                      setHoldingForm((current) => ({ ...current, assetName: event.target.value }))
                    }
                    className={inputClass}
                    placeholder="Asset name"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={holdingForm.assetClass}
                    onChange={(event) =>
                      setHoldingForm((current) => ({ ...current, assetClass: event.target.value }))
                    }
                    className={selectClass}
                  >
                    <option>Stock</option>
                    <option>ETF</option>
                    <option>Fund</option>
                    <option>Bond</option>
                    <option>Cash</option>
                    <option>Crypto</option>
                    <option>Private Venture</option>
                    <option>Real Estate</option>
                    <option>Other</option>
                  </select>

                  <select
                    value={holdingForm.riskLevel}
                    onChange={(event) =>
                      setHoldingForm((current) => ({ ...current, riskLevel: event.target.value }))
                    }
                    className={selectClass}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Aggressive</option>
                    <option>Speculative</option>
                  </select>
                </div>

                <select
                  value={holdingForm.targetRole}
                  onChange={(event) =>
                    setHoldingForm((current) => ({ ...current, targetRole: event.target.value }))
                  }
                  className={selectClass}
                >
                  <option>Core</option>
                  <option>Growth</option>
                  <option>Income</option>
                  <option>Hedge</option>
                  <option>Speculative</option>
                  <option>Legacy Holding</option>
                  <option>Watch Closely</option>
                </select>

                <textarea
                  value={holdingForm.thesis}
                  onChange={(event) =>
                    setHoldingForm((current) => ({ ...current, thesis: event.target.value }))
                  }
                  className={cx(inputClass, "min-h-20")}
                  placeholder="Advisor context. No amounts, shares, or cost basis."
                />

                <button
                  disabled={working}
                  className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
                >
                  Add Ticker Exposure
                </button>
              </form>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Fast bulk update
              </div>
              <h2 className="mt-2 text-2xl font-black">Add many symbols</h2>

              <form onSubmit={bulkAddHoldings} className="mt-5 grid gap-3">
                <select
                  value={bulkForm.accountId}
                  onChange={(event) =>
                    setBulkForm((current) => ({ ...current, accountId: event.target.value }))
                  }
                  className={selectClass}
                >
                  <option value="">Select client / household</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>

                <textarea
                  value={bulkForm.symbols}
                  onChange={(event) =>
                    setBulkForm((current) => ({
                      ...current,
                      symbols: event.target.value.toUpperCase(),
                    }))
                  }
                  className={cx(inputClass, "min-h-24")}
                  placeholder="AAPL, MSFT, NVDA, SPY"
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={bulkForm.assetClass}
                    onChange={(event) =>
                      setBulkForm((current) => ({ ...current, assetClass: event.target.value }))
                    }
                    className={selectClass}
                  >
                    <option>Stock</option>
                    <option>ETF</option>
                    <option>Fund</option>
                    <option>Bond</option>
                    <option>Crypto</option>
                  </select>

                  <select
                    value={bulkForm.riskLevel}
                    onChange={(event) =>
                      setBulkForm((current) => ({ ...current, riskLevel: event.target.value }))
                    }
                    className={selectClass}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Aggressive</option>
                    <option>Speculative</option>
                  </select>
                </div>

                <button
                  disabled={working}
                  className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-100 disabled:opacity-60"
                >
                  Bulk Add Symbols
                </button>
              </form>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                Search
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={cx(inputClass, "mt-3")}
                placeholder="Search client, email, symbol, asset class..."
              />
            </Card>
          </div>

          <div className="grid gap-5">
            {activeView === "clients" ? (
              <Card className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                      Client exposure directory
                    </div>
                    <h2 className="mt-2 text-3xl font-black">
                      Email-ready onboarding and holdings context.
                    </h2>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                      Each card shows ticker exposure, client email readiness, risk tags, and quick edit access.
                    </p>
                  </div>
                  <Pill tone="green">{filteredClients.length} clients</Pill>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {filteredClients.length ? (
                    filteredClients.map((client) => (
                      <SoftCard key={client.id}>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <h3 className="text-2xl font-black text-white">
                              {client.clientName}
                            </h3>
                            <div className="mt-1 text-sm text-slate-500">
                              {client.accountType}
                              {client.custodian ? ` · ${client.custodian}` : ""}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-300">
                              {client.clientEmail || "No email on file"}
                            </div>
                          </div>
                          <div className="flex flex-col items-start gap-2 lg:items-end">
                            <Pill tone={client.emailStatus === "Ready" ? "green" : client.emailStatus === "Opted Out" ? "amber" : "red"}>
                              {client.emailStatus}
                            </Pill>
                            <Pill tone="cyan">{client.holdingsCount} symbols</Pill>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {client.symbols.map((symbol) => (
                            <button
                              key={symbol}
                              type="button"
                              onClick={() => void prepareSymbolEmail(undefined, symbol)}
                            >
                              <Pill tone="red">{symbol}</Pill>
                            </button>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                              Communication
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Pill tone="purple">{client.deliveryPreference}</Pill>
                              {client.voiceAlias ? <Pill tone="cyan">Alias: {client.voiceAlias}</Pill> : null}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                              Risk mix
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {Object.entries(client.riskMix).map(([risk, count]) => (
                                <Pill key={risk} tone={riskTone(risk)}>
                                  {risk}: {count}
                                </Pill>
                              ))}
                            </div>
                          </div>
                        </div>

                        {client.notes ? (
                          <p className="mt-4 text-sm leading-6 text-slate-400">
                            {client.notes}
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingClient(client)}
                            className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                          >
                            Edit Client
                          </button>
                        </div>

                        {editClientId === client.id ? (
                          <form onSubmit={updateClient} className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                            <input
                              value={editClientForm.name}
                              onChange={(event) =>
                                setEditClientForm((current) => ({ ...current, name: event.target.value }))
                              }
                              className={inputClass}
                              placeholder="Client name"
                            />
                            <input
                              value={editClientForm.clientEmail}
                              onChange={(event) =>
                                setEditClientForm((current) => ({ ...current, clientEmail: event.target.value }))
                              }
                              className={inputClass}
                              placeholder="Client email"
                            />
                            <div className="grid gap-3 md:grid-cols-2">
                              <input
                                value={editClientForm.preferredGreeting}
                                onChange={(event) =>
                                  setEditClientForm((current) => ({ ...current, preferredGreeting: event.target.value }))
                                }
                                className={inputClass}
                                placeholder="Greeting"
                              />
                              <input
                                value={editClientForm.voiceAlias}
                                onChange={(event) =>
                                  setEditClientForm((current) => ({ ...current, voiceAlias: event.target.value }))
                                }
                                className={inputClass}
                                placeholder="Voice alias"
                              />
                            </div>
                            <select
                              value={editClientForm.deliveryPreference}
                              onChange={(event) =>
                                setEditClientForm((current) => ({ ...current, deliveryPreference: event.target.value }))
                              }
                              className={selectClass}
                            >
                              <option>Advisor Review</option>
                              <option>Email Allowed</option>
                              <option>Call First</option>
                              <option>Do Not Email</option>
                            </select>
                            <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-slate-300">
                              Email opt-in confirmed
                              <input
                                type="checkbox"
                                checked={editClientForm.emailOptIn}
                                onChange={(event) =>
                                  setEditClientForm((current) => ({
                                    ...current,
                                    emailOptIn: event.target.checked,
                                  }))
                                }
                              />
                            </label>
                            <textarea
                              value={editClientForm.notes}
                              onChange={(event) =>
                                setEditClientForm((current) => ({ ...current, notes: event.target.value }))
                              }
                              className={cx(inputClass, "min-h-20")}
                              placeholder="Advisor notes"
                            />
                            <div className="grid gap-2 md:grid-cols-2">
                              <button className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white">
                                Save Client
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditClientId("")}
                                className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : null}
                      </SoftCard>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                      No clients match this search.
                    </div>
                  )}
                </div>
              </Card>
            ) : null}

            {activeView === "symbols" ? (
              <Card className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                      Cross-client symbol matrix
                    </div>
                    <h2 className="mt-2 text-3xl font-black">
                      See every client touched by a security.
                    </h2>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                      When news hits a ticker, this tells the advisor exactly which clients may need a briefing or email.
                    </p>
                  </div>
                  <Pill tone="red">{filteredSymbols.length} symbols</Pill>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {filteredSymbols.length ? (
                    filteredSymbols.map((item) => (
                      <SoftCard key={item.symbol}>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <h3 className="text-3xl font-black text-white">
                              {item.symbol}
                            </h3>
                            <div className="mt-1 text-sm text-slate-500">
                              {item.assetName} · {item.assetClass}
                            </div>
                          </div>
                          <div className="flex flex-col items-start gap-2 lg:items-end">
                            <Pill tone="green">{item.clientCount} clients</Pill>
                            <Pill tone="cyan">{item.emailReadyCount} email-ready</Pill>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                            Exposed clients
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.clientNames.map((client) => (
                              <Pill key={client} tone="cyan">
                                {client}
                              </Pill>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                              Risk labels
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.riskLevels.map((risk) => (
                                <Pill key={risk} tone={riskTone(risk)}>
                                  {risk}
                                </Pill>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                              Email gaps
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.missingEmailClients.length ? (
                                <Pill tone="red">{item.missingEmailClients.length} missing</Pill>
                              ) : (
                                <Pill tone="green">No missing emails</Pill>
                              )}
                              {item.optedOutClients.length ? (
                                <Pill tone="amber">{item.optedOutClients.length} opted out</Pill>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void prepareSymbolEmail(undefined, item.symbol)}
                            className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                          >
                            Draft Email
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSearch(item.symbol);
                              setActiveView("clients");
                            }}
                            className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-white"
                          >
                            View Clients
                          </button>
                        </div>

                        <div className="mt-4 grid gap-2">
                          {holdings
                            .filter((holding) => holding.symbol === item.symbol)
                            .map((holding) => (
                              <div
                                key={holding.id}
                                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/30 p-3 md:flex-row md:items-center md:justify-between"
                              >
                                <div>
                                  <div className="text-sm font-black text-white">
                                    {holding.clientName}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {holding.targetRole} · {holding.riskLevel}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void deleteHolding(holding.id)}
                                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100"
                                >
                                  Remove Exposure
                                </button>
                              </div>
                            ))}
                        </div>
                      </SoftCard>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                      No symbols match this search.
                    </div>
                  )}
                </div>
              </Card>
            ) : null}

            {activeView === "email" ? (
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                  Targeted client emails
                </div>
                <h2 className="mt-2 text-3xl font-black">
                  Draft emails by security ownership.
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                  Enter a ticker and Slice finds email-ready clients holding that symbol. The draft opens with recipients in BCC and requires advisor review before sending.
                </p>

                <div className="mt-5 grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
                  <SoftCard>
                    <h3 className="text-xl font-black">Build targeted email</h3>
                    <form onSubmit={prepareSymbolEmail} className="mt-4 grid gap-3">
                      <input
                        value={emailForm.symbol}
                        onChange={(event) =>
                          setEmailForm((current) => ({
                            ...current,
                            symbol: event.target.value.toUpperCase(),
                          }))
                        }
                        className={inputClass}
                        placeholder="Symbol, e.g. NVDA"
                      />

                      <input
                        value={emailForm.subject}
                        onChange={(event) =>
                          setEmailForm((current) => ({ ...current, subject: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="Subject, optional"
                      />

                      <textarea
                        value={emailForm.customMessage}
                        onChange={(event) =>
                          setEmailForm((current) => ({
                            ...current,
                            customMessage: event.target.value,
                          }))
                        }
                        className={cx(inputClass, "min-h-32")}
                        placeholder="Advisor-reviewed custom message. Do not include trade instructions, exact positions, balances, or performance claims."
                      />

                      <button
                        disabled={working}
                        className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
                      >
                        Prepare Email Draft
                      </button>
                    </form>

                    <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs leading-5 text-amber-100/90">
                      Client communication should be reviewed under the firm’s written supervisory procedures before use.
                    </div>
                  </SoftCard>

                  <SoftCard>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-xl font-black">Draft output</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          Copy recipients, copy the draft, or open your email client.
                        </p>
                      </div>
                      {emailDraft ? <Pill tone="cyan">{emailDraft.recipientCount} recipients</Pill> : null}
                    </div>

                    {emailDraft ? (
                      <div className="mt-5 grid gap-4">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                            Recipients
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {emailDraft.recipients.map((recipient) => (
                              <Pill key={recipient.email} tone="green">
                                {recipient.name}
                              </Pill>
                            ))}
                          </div>
                          <div className="mt-3 break-words text-xs leading-5 text-slate-400">
                            {emailDraft.recipientEmails.join(", ") || "No email-ready recipients."}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                            Subject
                          </div>
                          <div className="mt-2 font-black text-white">{emailDraft.subject}</div>
                        </div>

                        <textarea
                          readOnly
                          value={emailDraft.body}
                          className={cx(inputClass, "min-h-64")}
                        />

                        <div className="grid gap-2 md:grid-cols-3">
                          <button
                            type="button"
                            onClick={() =>
                              void copyText(emailDraft.recipientEmails.join(", "), "Recipients")
                            }
                            className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-black text-white"
                          >
                            Copy Recipients
                          </button>
                          <button
                            type="button"
                            onClick={() => void copyText(emailDraft.body, "Draft")}
                            className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-black text-white"
                          >
                            Copy Draft
                          </button>
                          <a
                            href={emailDraft.mailtoUrl}
                            className="rounded-2xl bg-white px-4 py-3 text-center text-xs font-black text-slate-950"
                          >
                            Open Email Client
                          </a>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
                            <Pill tone="red">Missing emails</Pill>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {emailDraft.missingEmailClients.length ? (
                                emailDraft.missingEmailClients.map((name) => (
                                  <Pill key={name} tone="red">
                                    {name}
                                  </Pill>
                                ))
                              ) : (
                                <span className="text-sm font-bold text-red-100">None</span>
                              )}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                            <Pill tone="amber">Opted out</Pill>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {emailDraft.optedOutClients.length ? (
                                emailDraft.optedOutClients.map((name) => (
                                  <Pill key={name} tone="amber">
                                    {name}
                                  </Pill>
                                ))
                              ) : (
                                <span className="text-sm font-bold text-amber-100">None</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                        No email draft prepared yet.
                      </div>
                    )}
                  </SoftCard>
                </div>
              </Card>
            ) : null}

            {activeView === "voice" ? (
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                  Voice command center
                </div>
                <h2 className="mt-2 text-3xl font-black">
                  Update client exposures by speaking.
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                  Use natural phrases to add exposures, remove exposures, update emails, or prepare security-specific client email drafts.
                </p>

                <div className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
                  <SoftCard>
                    <h3 className="text-xl font-black">Speak or type command</h3>
                    <textarea
                      value={voiceCommand}
                      onChange={(event) => setVoiceCommand(event.target.value)}
                      className={cx(inputClass, "mt-4 min-h-32")}
                      placeholder="Example: email clients holding NVDA"
                    />

                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={startVoiceCapture}
                        disabled={voiceListening || working}
                        className={cx(
                          "rounded-2xl px-4 py-3 text-sm font-black text-white disabled:opacity-60",
                          voiceListening ? "bg-cyan-600" : "bg-red-600"
                        )}
                      >
                        {voiceListening ? "Listening..." : "Speak Command"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void runVoiceCommand()}
                        disabled={working}
                        className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
                      >
                        Run Command
                      </button>
                    </div>
                  </SoftCard>

                  <SoftCard>
                    <h3 className="text-xl font-black">Supported commands</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[
                        "Add AAPL to Sarah",
                        "Remove TSLA from Mark",
                        "Set Sarah email to sarah@example.com",
                        "Email clients holding NVDA",
                        "Show clients holding MSFT",
                        "Bought SPY for Johnson household",
                      ].map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => setVoiceCommand(example)}
                          className="rounded-2xl border border-white/10 bg-black/30 p-4 text-left text-sm font-black text-white hover:bg-white/[0.08]"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </SoftCard>
                </div>
              </Card>
            ) : null}

            {activeView === "models" ? (
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                  Privacy-aware exposure models
                </div>
                <h2 className="mt-2 text-3xl font-black">
                  Model exposure by ticker count, not dollars.
                </h2>

                <div className="mt-5 grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
                  <div className="grid gap-5">
                    <SoftCard>
                      <h3 className="text-xl font-black">Create model</h3>
                      <form onSubmit={createModel} className="mt-4 grid gap-3">
                        <input
                          value={modelForm.name}
                          onChange={(event) =>
                            setModelForm((current) => ({ ...current, name: event.target.value }))
                          }
                          className={inputClass}
                          placeholder="Model name"
                        />

                        <select
                          value={modelForm.riskLevel}
                          onChange={(event) =>
                            setModelForm((current) => ({ ...current, riskLevel: event.target.value }))
                          }
                          className={selectClass}
                        >
                          <option>Conservative</option>
                          <option>Balanced</option>
                          <option>Growth</option>
                          <option>Aggressive</option>
                        </select>

                        <textarea
                          value={modelForm.description}
                          onChange={(event) =>
                            setModelForm((current) => ({ ...current, description: event.target.value }))
                          }
                          className={cx(inputClass, "min-h-20")}
                          placeholder="Model description"
                        />

                        <button
                          disabled={working}
                          className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
                        >
                          Create Model
                        </button>
                      </form>
                    </SoftCard>

                    <SoftCard>
                      <h3 className="text-xl font-black">Add target</h3>
                      <form onSubmit={addTarget} className="mt-4 grid gap-3">
                        <select
                          value={targetForm.modelId || selectedModel?.id || ""}
                          onChange={(event) =>
                            setTargetForm((current) => ({ ...current, modelId: event.target.value }))
                          }
                          className={selectClass}
                        >
                          {models.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={targetForm.assetClass}
                          onChange={(event) =>
                            setTargetForm((current) => ({ ...current, assetClass: event.target.value }))
                          }
                          className={selectClass}
                        >
                          <option>Stock</option>
                          <option>ETF</option>
                          <option>Fund</option>
                          <option>Bond</option>
                          <option>Cash</option>
                          <option>Crypto</option>
                          <option>Private Venture</option>
                          <option>Real Estate</option>
                          <option>Other</option>
                        </select>

                        <input
                          value={targetForm.targetPct}
                          onChange={(event) =>
                            setTargetForm((current) => ({ ...current, targetPct: event.target.value }))
                          }
                          className={inputClass}
                          placeholder="Target %, by exposure count"
                        />

                        <button
                          disabled={working}
                          className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                        >
                          Save Target
                        </button>
                      </form>
                    </SoftCard>
                  </div>

                  <div className="grid gap-4">
                    <div className="flex flex-wrap gap-2">
                      {models.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            setSelectedModelId(model.id);
                            setTargetForm((current) => ({ ...current, modelId: model.id }));
                          }}
                          className={cx(
                            "rounded-full px-4 py-2 text-sm font-black transition",
                            selectedModel?.id === model.id
                              ? "bg-red-600 text-white"
                              : "bg-white/10 text-slate-300 hover:bg-white/20"
                          )}
                        >
                          {model.name}
                        </button>
                      ))}
                    </div>

                    <SoftCard>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h3 className="text-2xl font-black">
                            {selectedModel?.name ?? "No model selected"}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {selectedModel?.description ?? "Create a model to compare count-based exposure."}
                          </p>
                        </div>
                        {selectedModel ? <Pill tone="purple">{selectedModel.riskLevel}</Pill> : null}
                      </div>

                      <div className="mt-5 grid gap-3">
                        {selectedModel?.targets.length ? (
                          selectedModel.targets.map((target) => (
                            <div
                              key={target.id}
                              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 md:flex-row md:items-center md:justify-between"
                            >
                              <div>
                                <div className="font-black text-white">
                                  {target.assetClass}
                                </div>
                                <div className="mt-1 text-sm text-slate-500">
                                  Target exposure count: {target.targetPct}%
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => void deleteTarget(target.id)}
                                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100"
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                            No targets in this model yet.
                          </div>
                        )}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void runRebalance()}
                          disabled={working}
                          className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
                        >
                          Run Exposure Review
                        </button>

                        <select
                          value={scenarioType}
                          onChange={(event) => setScenarioType(event.target.value)}
                          className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
                        >
                          <option>Market Drawdown</option>
                          <option>Inflation Shock</option>
                          <option>Rate Cut Rally</option>
                          <option>Crypto Crash</option>
                          <option>Venture Write-Down</option>
                          <option>Single Stock Concentration</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => void runScenario()}
                          disabled={working}
                          className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                        >
                          Run Scenario
                        </button>
                      </div>
                    </SoftCard>

                    <SoftCard>
                      <h3 className="text-xl font-black">Current exposure mix</h3>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {allocations.map((allocation) => (
                          <div
                            key={allocation.assetClass}
                            className="rounded-2xl border border-white/10 bg-black/30 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-black text-white">
                                  {allocation.assetClass}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {allocation.count} ticker exposure item(s)
                                </div>
                              </div>
                              <div className="text-xl font-black text-red-300">
                                {allocation.pct}%
                              </div>
                            </div>
                          </div>
                        ))}

                        {!allocations.length ? (
                          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                            Add ticker exposures to see count-based allocation.
                          </div>
                        ) : null}
                      </div>
                    </SoftCard>
                  </div>
                </div>
              </Card>
            ) : null}

            {activeView === "reports" ? (
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                  Privacy-aware reviews
                </div>
                <h2 className="mt-2 text-3xl font-black">
                  Reviews without balances or trade amounts.
                </h2>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <SoftCard>
                    <h3 className="text-2xl font-black">Latest exposure review</h3>
                    {latestRebalance ? (
                      <>
                        <p className="mt-3 text-sm leading-6 text-slate-400">
                          {latestRebalance.summary}
                        </p>
                        <div className="mt-3 text-xs text-slate-500">
                          {shortDate(latestRebalance.createdAt)}
                        </div>

                        <div className="mt-4 grid gap-3">
                          {rebalanceRecommendations.length ? (
                            rebalanceRecommendations.map((item, index) => (
                              <div
                                key={`${item.assetClass}-${index}`}
                                className="rounded-2xl border border-white/10 bg-black/30 p-4"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <Pill tone="amber">{item.action}</Pill>
                                  <Pill tone="purple">{item.assetClass}</Pill>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-slate-300">
                                  {item.reason}
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                              No review recommendations yet.
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                        No exposure review generated yet.
                      </div>
                    )}
                  </SoftCard>

                  <SoftCard>
                    <h3 className="text-2xl font-black">Latest scenario</h3>
                    {latestScenario ? (
                      <>
                        <p className="mt-3 text-sm leading-6 text-slate-400">
                          {latestScenario.summary}
                        </p>
                        <div className="mt-3 text-xs text-slate-500">
                          {shortDate(latestScenario.createdAt)}
                        </div>

                        <div className="mt-4 grid gap-3">
                          {scenarioActions.length ? (
                            scenarioActions.map((action, index) => (
                              <div
                                key={`${action}-${index}`}
                                className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-slate-300"
                              >
                                {String(action)}
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                              No scenario actions yet.
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                        No scenario generated yet.
                      </div>
                    )}
                  </SoftCard>
                </div>
              </Card>
            ) : null}

            {activeView === "privacy" ? (
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                  Privacy guardrails
                </div>
                <h2 className="mt-2 text-3xl font-black">
                  Email functionality without sensitive position data.
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                  This module is intentionally designed for exposure awareness and communication targeting, not performance reporting or billing.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {(privacySummary?.compliancePosture ?? []).map((item) => (
                    <SoftCard key={item}>
                      <Pill tone="green">Enabled</Pill>
                      <div className="mt-3 text-lg font-black text-white">
                        {item}
                      </div>
                    </SoftCard>
                  ))}
                </div>

                <div className="mt-5 rounded-[1.5rem] border border-amber-500/25 bg-amber-500/10 p-5">
                  <Pill tone="amber">Compliance note</Pill>
                  <p className="mt-3 text-sm leading-7 text-amber-100/90">
                    This software design supports privacy and advisor review, but it is not legal advice and does not by itself make a firm compliant. A registered adviser or broker-dealer should have compliance review the data collection, opt-in process, client communication workflow, disclosures, recordkeeping, and supervision before production use.
                  </p>
                </div>

                <div className="mt-5 rounded-[1.5rem] border border-red-500/25 bg-red-500/10 p-5">
                  <Pill tone="red">Never collect here</Pill>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {[
                      "Share count",
                      "Dollar value",
                      "Cost basis",
                      "Account balance",
                      "Billing AUM",
                      "Exact position size",
                      "Trade instruction",
                      "Performance return",
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-red-500/20 bg-black/25 p-3 text-sm font-black text-red-100"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}