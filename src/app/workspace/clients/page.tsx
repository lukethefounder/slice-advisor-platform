"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";

type Holding = {
  id: string;
  symbol: string;
  assetName: string;
  assetClass: string;
  value: string | null;
  allocationPct: string | null;
  costBasis: string | null;
  riskLevel: string;
  thesis: string | null;
  createdAt: string;
};

type AdvisorNote = {
  id: string;
  title: string;
  body: string;
  noteType: string;
  createdAt: string;
};

type MeetingTask = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  createdAt: string;
};

type RiskReview = {
  id: string;
  score: number;
  suitabilityStatus: string;
  summary: string;
  flagsJson: string;
  createdAt: string;
};

type DocumentVaultItem = {
  id: string;
  fileName: string;
  documentType: string;
  status: string;
  notes: string | null;
  createdAt: string;
};

type ClientProfile = {
  id: string;
  fullName: string;
  email: string | null;
  householdName: string | null;
  clientType: string;
  riskProfile: string;
  liquidityNeeds: string;
  timeHorizon: string;
  objective: string;
  portfolioValue: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  holdings: Holding[];
  notesList: AdvisorNote[];
  tasks: MeetingTask[];
  reviews: RiskReview[];
  documents: DocumentVaultItem[];
};

type ClientsPayload = {
  clients: ClientProfile[];
  metrics?: {
    clientCount: number;
    activeCount: number;
    emailReadyCount: number;
    missingEmailCount: number;
    holdingsCount: number;
    reviewCount: number;
    notesCount: number;
    taskCount: number;
    documentCount: number;
  };
  vault?: {
    enabled: boolean;
    keyConfigured: boolean;
    algorithm: string;
  };
  privacy?: {
    holdingsMode: string;
    amountStorage: string;
  };
};

type AiImportedHolding = {
  symbol: string;
  assetName: string;
  assetClass: string;
  riskLevel: string;
  thesis: string;
};

type AiImportedClient = {
  importKey: string;
  sourceRow: number;
  fullName: string;
  email: string;
  householdName: string;
  clientType: string;
  riskProfile: string;
  liquidityNeeds: string;
  timeHorizon: string;
  objective: string;
  status: string;
  notes: string;
  holdings: AiImportedHolding[];
  confidence: number;
  warnings: string[];
  duplicateHint: string;
};

type AiImportResponse = {
  ok: boolean;
  aiUsed: boolean;
  fileName: string;
  detectedRows: number;
  profiles: AiImportedClient[];
  warnings: string[];
  message: string;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    isFinal?: boolean;
    0?: {
      transcript?: string;
    };
  }>;
};

type ClientSpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type ClientSpeechRecognitionConstructor = new () => ClientSpeechRecognitionLike;

type SpeechWindow = {
  SpeechRecognition?: ClientSpeechRecognitionConstructor;
  webkitSpeechRecognition?: ClientSpeechRecognitionConstructor;
};

const EMPTY_PAYLOAD: ClientsPayload = {
  clients: [],
  metrics: {
    clientCount: 0,
    activeCount: 0,
    emailReadyCount: 0,
    missingEmailCount: 0,
    holdingsCount: 0,
    reviewCount: 0,
    notesCount: 0,
    taskCount: 0,
    documentCount: 0,
  },
};

const CLIENT_IMPORT_SELECTION_KEY = "slice-client-import-selection-v1";
const CLIENT_NOTIFY_EMAIL_KEY = "slice-client-notify-email-v1";
const CLIENT_NOTIFY_ENABLED_KEY = "slice-client-notify-enabled-v1";

const DEFAULT_CLIENT_FORM = {
  fullName: "",
  email: "",
  householdName: "",
  clientType: "Private Client",
  riskProfile: "Balanced",
  liquidityNeeds: "Moderate",
  timeHorizon: "5-10 years",
  objective: "Long-term wealth growth",
  status: "Active",
  notes: "",
};

const DEFAULT_HOLDING_FORM = {
  symbol: "",
  assetName: "",
  assetClass: "Stock",
  riskLevel: "Medium",
  thesis: "",
};

const DEFAULT_NOTE_FORM = {
  title: "",
  body: "",
  noteType: "General",
};

const DEFAULT_TASK_FORM = {
  title: "",
  description: "",
  priority: "Medium",
  dueDate: "",
};

const DEFAULT_DOCUMENT_FORM = {
  fileName: "",
  documentType: "General",
  status: "Needs Review",
  notes: "",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function id(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function shortDate(value: string | null | undefined) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseFlags(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function cleanSymbols(value: string) {
  return Array.from(
    new Set(
      value
        .split(/,|\n|\s|\t/)
        .map((item) => item.trim().toUpperCase().replace(/[^A-Z0-9._/!\-$]/g, ""))
        .filter(Boolean),
    ),
  ).slice(0, 50);
}

function assetClassForSymbol(symbol: string) {
  const upper = symbol.toUpperCase();

  if (upper.includes("BTC") || upper.includes("ETH") || upper.includes("USDT")) return "Crypto";
  if (upper.endsWith("1!") || upper.includes("ES") || upper.includes("NQ")) return "Futures";
  if (["SPY", "QQQ", "VOO", "VTI", "TLT", "GLD", "IWM", "DIA"].includes(upper)) return "ETF";
  if (upper.startsWith("^")) return "Index";

  return "Stock";
}

function toneFor(value: string | number | null | undefined): Tone {
  const lower = String(value ?? "").toLowerCase();
  const numeric = typeof value === "number" ? value : Number.NaN;

  if (
    lower.includes("missing") ||
    lower.includes("failed") ||
    lower.includes("high") ||
    lower.includes("aggressive") ||
    lower.includes("needs") ||
    lower.includes("overdue") ||
    lower.includes("delete") ||
    lower.includes("critical") ||
    (!Number.isNaN(numeric) && numeric < 55)
  ) {
    return "red";
  }

  if (
    lower.includes("active") ||
    lower.includes("balanced") ||
    lower.includes("aligned") ||
    lower.includes("done") ||
    lower.includes("complete") ||
    lower.includes("ready") ||
    lower.includes("synced") ||
    (!Number.isNaN(numeric) && numeric >= 78)
  ) {
    return "green";
  }

  if (
    lower.includes("moderate") ||
    lower.includes("review") ||
    lower.includes("open") ||
    lower.includes("medium") ||
    lower.includes("conservative") ||
    (!Number.isNaN(numeric) && numeric >= 55 && numeric < 78)
  ) {
    return "amber";
  }

  if (lower.includes("client") || lower.includes("household") || lower.includes("profile")) {
    return "purple";
  }

  if (lower.includes("stock") || lower.includes("security") || lower.includes("etf") || lower.includes("bond")) {
    return "cyan";
  }

  return "slate";
}

function loadLocal(key: string, fallback = "") {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

function saveLocal(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
}

function SectionShell({
  title,
  eyebrow,
  tone = "slate",
  open,
  onToggle,
  children,
  action,
}: {
  title: string;
  eyebrow: string;
  tone?: Tone;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.045]">
      <div className="flex items-center justify-between gap-3 p-4">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{eyebrow}</div>
          <div className="mt-1 flex items-center gap-3">
            <span className={cx("h-2.5 w-2.5 rounded-full shadow-lg", dotClass(tone))} />
            <h3 className="truncate text-lg font-black text-white">{title}</h3>
            <span className="text-xs font-black text-slate-500">{open ? "Close" : "Open"}</span>
          </div>
        </button>
        {action}
      </div>

      {open ? <div className="border-t border-white/10 p-4">{children}</div> : null}
    </div>
  );
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    red: "border-red-500/30 bg-red-500/10 text-red-200",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-200",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-200",
    slate: "border-slate-500/20 bg-slate-500/10 text-slate-200",
  };

  return (
    <span className={cx("inline-flex max-w-full rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]", tones[tone])}>
      <span className="truncate">{children}</span>
    </span>
  );
}

function dotClass(tone: Tone) {
  const dots: Record<Tone, string> = {
    red: "bg-red-400 shadow-red-400/50",
    green: "bg-emerald-400 shadow-emerald-400/50",
    amber: "bg-amber-400 shadow-amber-400/50",
    purple: "bg-purple-400 shadow-purple-400/50",
    cyan: "bg-cyan-400 shadow-cyan-400/50",
    blue: "bg-blue-400 shadow-blue-400/50",
    slate: "bg-slate-400 shadow-slate-400/50",
  };

  return dots[tone];
}

function toneClass(tone: Tone) {
  const tones: Record<Tone, string> = {
    red: "border-red-500/25 bg-red-500/10 text-red-100 shadow-red-950/20",
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/20",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-100 shadow-amber-950/20",
    purple: "border-purple-500/25 bg-purple-500/10 text-purple-100 shadow-purple-950/20",
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100 shadow-cyan-950/20",
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-100 shadow-blue-950/20",
    slate: "border-slate-500/20 bg-slate-500/10 text-slate-100 shadow-slate-950/20",
  };

  return tones[tone];
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-red-950/20 backdrop-blur-xl", className)}>
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
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
    blue: "from-blue-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative min-h-[112px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

const inputClass =
  "rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-red-400/40 focus:ring-2 focus:ring-red-500/20";

const compactInputClass =
  "rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-xs font-semibold text-white outline-none placeholder:text-slate-600 focus:border-red-400/40 focus:ring-2 focus:ring-red-500/20";

export default function ClientProfilesPage() {
  const [payload, setPayload] = useState<ClientsPayload>(EMPTY_PAYLOAD);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<Tone>("slate");
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");

  const [clientForm, setClientForm] = useState(DEFAULT_CLIENT_FORM);
  const [holdingForm, setHoldingForm] = useState(DEFAULT_HOLDING_FORM);
  const [bulkSymbols, setBulkSymbols] = useState("");
  const [noteForm, setNoteForm] = useState(DEFAULT_NOTE_FORM);
  const [taskForm, setTaskForm] = useState(DEFAULT_TASK_FORM);
  const [documentForm, setDocumentForm] = useState(DEFAULT_DOCUMENT_FORM);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    profile: true,
    securities: true,
    voice: false,
    import: false,
    notes: false,
    tasks: false,
    documents: false,
    risk: false,
    portal: false,
    remove: false,
  });

  const [importProfiles, setImportProfiles] = useState<AiImportedClient[]>([]);
  const [importSelections, setImportSelections] = useState<Record<string, boolean>>({});
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [advisorNotifyEmail, setAdvisorNotifyEmail] = useState("");
  const [sendChangeEmails, setSendChangeEmails] = useState(true);

  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const recognitionRef = useRef<ClientSpeechRecognitionLike | null>(null);

  const clients = payload.clients ?? [];
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? clients[0] ?? null;
  const metrics = payload.metrics ?? EMPTY_PAYLOAD.metrics!;

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesSearch =
        !query ||
        client.fullName.toLowerCase().includes(query) ||
        client.householdName?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.holdings.some(
          (holding) =>
            holding.symbol.toLowerCase().includes(query) ||
            holding.assetName.toLowerCase().includes(query),
        );

      const matchesStatus = statusFilter === "All" || client.status === statusFilter;
      const matchesRisk = riskFilter === "All" || client.riskProfile === riskFilter;

      return matchesSearch && matchesStatus && matchesRisk;
    });
  }, [clients, search, statusFilter, riskFilter]);

  const selectedRiskReview = selectedClient?.reviews?.[0] ?? null;
  const selectedOpenTasks =
    selectedClient?.tasks?.filter((task) => task.status !== "Done" && task.status !== "Complete") ?? [];

  const allHeldSymbols = useMemo(() => {
    return Array.from(new Set(clients.flatMap((client) => client.holdings.map((holding) => holding.symbol)))).sort();
  }, [clients]);

  useEffect(() => {
    setAdvisorNotifyEmail(loadLocal(CLIENT_NOTIFY_EMAIL_KEY));
    setSendChangeEmails(loadLocal(CLIENT_NOTIFY_ENABLED_KEY, "true") !== "false");

    const savedImportSelections = loadLocal(CLIENT_IMPORT_SELECTION_KEY);
    if (savedImportSelections) {
      try {
        setImportSelections(JSON.parse(savedImportSelections));
      } catch {
        setImportSelections({});
      }
    }

    void loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveLocal(CLIENT_NOTIFY_EMAIL_KEY, advisorNotifyEmail);
  }, [advisorNotifyEmail]);

  useEffect(() => {
    saveLocal(CLIENT_NOTIFY_ENABLED_KEY, String(sendChangeEmails));
  }, [sendChangeEmails]);

  useEffect(() => {
    saveLocal(CLIENT_IMPORT_SELECTION_KEY, JSON.stringify(importSelections));
  }, [importSelections]);

  function setStatus(text: string, tone: Tone = "slate") {
    setMessage(text);
    setMessageTone(tone);
  }

  function toggleSection(key: string) {
    setOpenSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function loadClients(nextSelectedId?: string) {
    setLoading(true);
    setStatus("");

    try {
      const response = await fetch("/api/clients", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error ?? "Unable to load client profiles.", "red");
        return;
      }

      setPayload(data);

      const nextId = nextSelectedId || selectedClientId || data.clients?.[0]?.id || "";
      setSelectedClientId(nextId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load client profiles.", "red");
    } finally {
      setLoading(false);
    }
  }

  async function notifyAdvisor(changeType: string, clientName: string, summary: string) {
    if (!sendChangeEmails) return;
    if (!advisorNotifyEmail.trim()) return;

    await fetch("/api/clients/notify-change", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slice-sensitive-action": "client-change-notification",
      },
      body: JSON.stringify({
        advisorEmail: advisorNotifyEmail.trim(),
        clientName,
        changeType,
        summary,
        source: "Advisor Client Profiles",
      }),
    }).catch(() => null);
  }

  async function postClientAction(
    body: Record<string, unknown>,
    successMessage: string,
    notify?: { type: string; clientName: string; summary: string },
  ) {
    setLoading(true);
    setStatus("");

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": String(body.action ?? "client-action"),
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error ?? "Client action failed.", "red");
        return null;
      }

      setPayload(data);

      if (data.client?.id) {
        setSelectedClientId(data.client.id);
      }

      if (notify) {
        await notifyAdvisor(notify.type, notify.clientName, notify.summary);
      }

      setStatus(successMessage, "green");
      return data as ClientsPayload & { client?: ClientProfile };
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Client action failed.", "red");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function rawClientAction(body: Record<string, unknown>) {
    const response = await fetch("/api/clients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-slice-sensitive-action": String(body.action ?? "client-action"),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Client action failed.");
    }

    return data as ClientsPayload & { client?: ClientProfile };
  }

  function loadClientIntoForm(client: ClientProfile) {
    setSelectedClientId(client.id);
    setClientForm({
      fullName: client.fullName,
      email: client.email ?? "",
      householdName: client.householdName ?? "",
      clientType: client.clientType,
      riskProfile: client.riskProfile,
      liquidityNeeds: client.liquidityNeeds,
      timeHorizon: client.timeHorizon,
      objective: client.objective,
      status: client.status,
      notes: client.notes ?? "",
    });
    setOpenSections((current) => ({ ...current, profile: true }));
  }

  function resetClientForm() {
    setSelectedClientId("");
    setClientForm(DEFAULT_CLIENT_FORM);
    setStatus("Ready to create a new client profile.", "cyan");
  }

  async function createClient(event: FormEvent) {
    event.preventDefault();

    if (!clientForm.fullName.trim()) {
      setStatus("Client full name is required.", "red");
      return;
    }

    const result = await postClientAction(
      {
        action: "createClient",
        ...clientForm,
      },
      "Client profile created.",
      {
        type: "Client created",
        clientName: clientForm.fullName,
        summary: `${clientForm.fullName} was created in Client Profiles.`,
      },
    );

    if (result?.client) {
      setClientForm(DEFAULT_CLIENT_FORM);
    }
  }

  async function updateClient(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient) {
      setStatus("Select a client first.", "red");
      return;
    }

    await postClientAction(
      {
        action: "updateClient",
        clientId: selectedClient.id,
        ...clientForm,
      },
      "Client profile updated.",
      {
        type: "Client profile updated",
        clientName: selectedClient.fullName,
        summary: `${selectedClient.fullName}'s profile details were updated.`,
      },
    );
  }

  async function addHolding(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient) {
      setStatus("Select a client first.", "red");
      return;
    }

    if (!holdingForm.symbol.trim()) {
      setStatus("Security symbol is required.", "red");
      return;
    }

    const symbol = holdingForm.symbol.toUpperCase().trim();

    const result = await postClientAction(
      {
        action: "addHolding",
        clientId: selectedClient.id,
        ...holdingForm,
        symbol,
        assetName: holdingForm.assetName || symbol,
        assetClass: holdingForm.assetClass || assetClassForSymbol(symbol),
      },
      `${symbol} added to ${selectedClient.fullName}.`,
      {
        type: "Security added",
        clientName: selectedClient.fullName,
        summary: `${symbol} was added to ${selectedClient.fullName}'s profile.`,
      },
    );

    if (result) {
      setHoldingForm(DEFAULT_HOLDING_FORM);
    }
  }

  async function bulkAddHoldings() {
    if (!selectedClient) {
      setStatus("Select a client first.", "red");
      return;
    }

    const symbols = cleanSymbols(bulkSymbols);

    if (!symbols.length) {
      setStatus("Paste at least one symbol.", "red");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      for (const symbol of symbols) {
        await rawClientAction({
          action: "addHolding",
          clientId: selectedClient.id,
          symbol,
          assetName: symbol,
          assetClass: assetClassForSymbol(symbol),
          riskLevel: "Medium",
          thesis: "Added through quick bulk entry.",
        });
      }

      setBulkSymbols("");
      await loadClients(selectedClient.id);
      await notifyAdvisor(
        "Bulk securities added",
        selectedClient.fullName,
        `${symbols.length} securities were added to ${selectedClient.fullName}: ${symbols.join(", ")}.`,
      );
      setStatus(`${symbols.length} security symbol(s) added without storing position amounts.`, "green");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to add symbols.", "red");
    } finally {
      setLoading(false);
    }
  }

  async function removeHolding(holding: Holding) {
    if (!selectedClient) return;

    await postClientAction(
      {
        action: "removeHolding",
        clientId: selectedClient.id,
        holdingId: holding.id,
      },
      `${holding.symbol} removed from ${selectedClient.fullName}.`,
      {
        type: "Security removed",
        clientName: selectedClient.fullName,
        summary: `${holding.symbol} was removed from ${selectedClient.fullName}'s profile.`,
      },
    );
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient) {
      setStatus("Select a client first.", "red");
      return;
    }

    if (!noteForm.title.trim() || !noteForm.body.trim()) {
      setStatus("Note title and body are required.", "red");
      return;
    }

    const result = await postClientAction(
      {
        action: "addNote",
        clientId: selectedClient.id,
        ...noteForm,
      },
      "Advisor note added.",
      {
        type: "Advisor note added",
        clientName: selectedClient.fullName,
        summary: `A ${noteForm.noteType} note was added to ${selectedClient.fullName}.`,
      },
    );

    if (result) {
      setNoteForm(DEFAULT_NOTE_FORM);
    }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient) {
      setStatus("Select a client first.", "red");
      return;
    }

    if (!taskForm.title.trim()) {
      setStatus("Task title is required.", "red");
      return;
    }

    const result = await postClientAction(
      {
        action: "addTask",
        clientId: selectedClient.id,
        ...taskForm,
      },
      "Client follow-up task added.",
      {
        type: "Client task added",
        clientName: selectedClient.fullName,
        summary: `Task added for ${selectedClient.fullName}: ${taskForm.title}.`,
      },
    );

    if (result) {
      setTaskForm(DEFAULT_TASK_FORM);
    }
  }

  async function completeTask(task: MeetingTask) {
    if (!selectedClient) return;

    await postClientAction(
      {
        action: "completeTask",
        clientId: selectedClient.id,
        taskId: task.id,
        status: task.status === "Done" ? "Open" : "Done",
      },
      task.status === "Done" ? "Task reopened." : "Task completed.",
      {
        type: "Client task updated",
        clientName: selectedClient.fullName,
        summary: `Task "${task.title}" was ${task.status === "Done" ? "reopened" : "completed"} for ${selectedClient.fullName}.`,
      },
    );
  }

  async function addDocument(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient) {
      setStatus("Select a client first.", "red");
      return;
    }

    if (!documentForm.fileName.trim()) {
      setStatus("Document name is required.", "red");
      return;
    }

    const result = await postClientAction(
      {
        action: "addDocument",
        clientId: selectedClient.id,
        ...documentForm,
      },
      "Document reference added.",
      {
        type: "Client document added",
        clientName: selectedClient.fullName,
        summary: `Document reference added for ${selectedClient.fullName}: ${documentForm.fileName}.`,
      },
    );

    if (result) {
      setDocumentForm(DEFAULT_DOCUMENT_FORM);
    }
  }

  async function addRiskReview() {
    if (!selectedClient) {
      setStatus("Select a client first.", "red");
      return;
    }

    await postClientAction(
      {
        action: "addRiskReview",
        clientId: selectedClient.id,
      },
      "Client risk review created.",
      {
        type: "Risk review created",
        clientName: selectedClient.fullName,
        summary: `A risk review was created for ${selectedClient.fullName}.`,
      },
    );
  }

  async function deleteSelectedClient() {
    if (!selectedClient) {
      setStatus("Select a client first.", "red");
      return;
    }

    const confirmed = window.confirm(`Remove ${selectedClient.fullName}? This deletes the profile and related client records.`);
    if (!confirmed) return;

    setLoading(true);

    try {
      const response = await fetch("/api/clients/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "delete-client-profile",
        },
        body: JSON.stringify({
          clientId: selectedClient.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error ?? "Unable to delete client.", "red");
        return;
      }

      await notifyAdvisor(
        "Client removed",
        selectedClient.fullName,
        `${selectedClient.fullName} was removed from Client Profiles.`,
      );

      setSelectedClientId("");
      setClientForm(DEFAULT_CLIENT_FORM);
      await loadClients("");
      setStatus(`${selectedClient.fullName} removed.`, "green");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to delete client.", "red");
    } finally {
      setLoading(false);
    }
  }

  async function normalizeImportFile(file: File) {
    setImportLoading(true);
    setStatus("");
    setImportProfiles([]);
    setImportWarnings([]);
    setImportFileName(file.name);

    try {
      const lowerName = file.name.toLowerCase();
      const isExcel = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");

      let body: Record<string, unknown> = {
        fileName: file.name,
        mimeType: file.type,
      };

      if (isExcel) {
        body = {
          ...body,
          base64: arrayBufferToBase64(await file.arrayBuffer()),
        };
      } else {
        body = {
          ...body,
          text: await file.text(),
        };
      }

      const response = await fetch("/api/clients/ai-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "client-ai-import",
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as AiImportResponse;

      if (!response.ok || !data.ok) {
        setStatus(data.message || "Unable to normalize client file.", "red");
        setImportWarnings(data.warnings ?? []);
        return;
      }

      setImportProfiles(data.profiles);
      setImportWarnings(data.warnings ?? []);

      const selections: Record<string, boolean> = {};
      for (const profile of data.profiles) {
        selections[profile.importKey] = profile.confidence >= 88 && !profile.duplicateHint;
      }

      setImportSelections(selections);
      setOpenSections((current) => ({ ...current, import: true }));
      setStatus(`${data.profiles.length} profile(s) prepared from ${file.name}. Review before importing.`, "green");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to import file.", "red");
    } finally {
      setImportLoading(false);
    }
  }

  async function importSelectedProfiles() {
    const selectedProfiles = importProfiles.filter((profile) => importSelections[profile.importKey]);

    if (!selectedProfiles.length) {
      setStatus("Select at least one AI-prepared profile to import.", "red");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      let createdCount = 0;
      let holdingsCount = 0;
      let lastClientId = "";

      for (const profile of selectedProfiles) {
        const result = await rawClientAction({
          action: "createClient",
          fullName: profile.fullName,
          email: profile.email,
          householdName: profile.householdName,
          clientType: profile.clientType,
          riskProfile: profile.riskProfile,
          liquidityNeeds: profile.liquidityNeeds,
          timeHorizon: profile.timeHorizon,
          objective: profile.objective,
          status: profile.status,
          notes: [
            profile.notes,
            profile.warnings.length ? `Import warnings: ${profile.warnings.join(" | ")}` : "",
            `Import confidence: ${profile.confidence}%. Source row: ${profile.sourceRow}.`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        });

        if (!result.client?.id) continue;

        createdCount += 1;
        lastClientId = result.client.id;

        for (const holding of profile.holdings.slice(0, 40)) {
          await rawClientAction({
            action: "addHolding",
            clientId: result.client.id,
            symbol: holding.symbol,
            assetName: holding.assetName || holding.symbol,
            assetClass: holding.assetClass || assetClassForSymbol(holding.symbol),
            riskLevel: holding.riskLevel || "Medium",
            thesis: holding.thesis || "Imported from advisor client file.",
          });
          holdingsCount += 1;
        }
      }

      await loadClients(lastClientId);
      await notifyAdvisor(
        "Client import completed",
        "Client import",
        `${createdCount} clients and ${holdingsCount} securities were imported from ${importFileName}.`,
      );

      setImportProfiles([]);
      setImportSelections({});
      setStatus(`${createdCount} clients imported with ${holdingsCount} security records.`, "green");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to import selected profiles.", "red");
    } finally {
      setLoading(false);
    }
  }

  function selectAllImports(value: boolean) {
    const next: Record<string, boolean> = {};
    for (const profile of importProfiles) {
      next[profile.importKey] = value;
    }
    setImportSelections(next);
  }

  function toggleImportSelection(importKey: string) {
    setImportSelections((current) => ({
      ...current,
      [importKey]: !current[importKey],
    }));
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void normalizeImportFile(file);
  }

  function startVoice() {
    const speechWindow = window as unknown as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setStatus("Voice entry is not supported in this browser. Try Chrome or Edge.", "amber");
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      setVoiceTranscript(transcript);
      applyVoiceCommand(transcript);
    };

    recognition.onerror = (event) => {
      setVoiceListening(false);
      setStatus(event.error ? `Voice error: ${event.error}` : "Voice command failed.", "red");
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    setVoiceListening(true);
    recognition.start();
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setVoiceListening(false);
  }

  function applyVoiceCommand(transcript: string) {
    const text = transcript.trim();
    const lower = text.toLowerCase();

    if (!text) return;

    if (lower.startsWith("add client") || lower.startsWith("create client")) {
      const withoutCommand = text.replace(/^add client/i, "").replace(/^create client/i, "").trim();
      const emailMatch = withoutCommand.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
      const email = emailMatch?.[0] ?? "";
      const name = withoutCommand
        .replace(email, "")
        .replace(/\bemail\b/gi, "")
        .replace(/\brisk\b.*/gi, "")
        .trim();

      setClientForm((current) => ({
        ...current,
        fullName: name || current.fullName,
        email: email || current.email,
      }));

      setOpenSections((current) => ({ ...current, profile: true }));
      setStatus("Voice filled the client form. Review, then save.", "cyan");
      return;
    }

    if (lower.includes("add") && lower.includes("to")) {
      const parts = text.split(/\bto\b/i);
      const symbolPart = parts[0]?.replace(/\badd\b/i, "").trim();
      const clientNamePart = parts[1]?.trim();

      if (symbolPart) {
        const symbol = cleanSymbols(symbolPart)[0] ?? symbolPart.toUpperCase();
        setHoldingForm((current) => ({
          ...current,
          symbol,
          assetName: symbol,
          assetClass: assetClassForSymbol(symbol),
        }));
      }

      if (clientNamePart) {
        const match = clients.find((client) => client.fullName.toLowerCase().includes(clientNamePart.toLowerCase()));
        if (match) loadClientIntoForm(match);
      }

      setOpenSections((current) => ({ ...current, securities: true }));
      setStatus("Voice prepared the security entry. Review, then add.", "cyan");
      return;
    }

    if (lower.startsWith("note")) {
      setNoteForm((current) => ({
        ...current,
        title: "Voice note",
        body: text.replace(/^note/i, "").trim() || text,
      }));
      setOpenSections((current) => ({ ...current, notes: true }));
      setStatus("Voice prepared an advisor note. Review, then save.", "cyan");
      return;
    }

    setStatus("Voice captured text, but no automatic command matched. Use it as a note or form input.", "amber");
  }

  async function applyPortalPreferenceChange() {
    if (!selectedClient) {
      setStatus("Select a client first.", "red");
      return;
    }

    await postClientAction(
      {
        action: "updateClient",
        clientId: selectedClient.id,
        ...clientForm,
        notes: [
          clientForm.notes,
          `Client portal preference sync applied on ${new Date().toLocaleString()}.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
      "Client portal preference sync applied.",
      {
        type: "Client portal preference change",
        clientName: selectedClient.fullName,
        summary: `${selectedClient.fullName}'s portal-linked preferences were updated in the advisor profile.`,
      },
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.46),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_28%),radial-gradient(circle_at_bottom,_rgba(168,85,247,0.13),_transparent_36%),linear-gradient(135deg,_#020617,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-zinc-950/78 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(239,68,68,0.28),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.16),transparent_26%)]" />
          <div className="pointer-events-none absolute right-[-120px] top-[-160px] hidden h-[360px] w-[360px] rounded-full border border-red-500/10 xl:block">
            <div className="absolute inset-12 rounded-full border border-cyan-500/10" />
            <div className="absolute inset-24 rounded-full border border-white/10" />
          </div>

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="purple">Client profiles</Pill>
                <Pill tone="cyan">CSV / Excel AI import</Pill>
                <Pill tone="amber">Voice entry</Pill>
                <Pill tone="green">Advisor alerts</Pill>
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                Premium client intelligence center.
              </h1>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
                Drop in client lists, let AI stage clean profiles from the file, review every field before import,
                add securities by text or voice, manage client portal preference changes, and notify the advisor
                whenever profile data changes.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <a href="/workspace" className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-center text-sm font-black text-white hover:bg-white/10">
                Workspace
              </a>
              <a href="/workspace/client-emails" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-black text-emerald-100 hover:bg-emerald-500/20">
                Email Center
              </a>
              <a href="/workspace/client-briefings" className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-center text-sm font-black text-cyan-100 hover:bg-cyan-500/20">
                Briefings
              </a>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="Clients" value={metrics.clientCount} helper={`${metrics.activeCount} active`} tone="purple" />
            <Metric label="Email Ready" value={metrics.emailReadyCount} helper={`${metrics.missingEmailCount} missing`} tone={metrics.missingEmailCount ? "amber" : "green"} />
            <Metric label="Tracked Securities" value={metrics.holdingsCount} helper={`${allHeldSymbols.length} unique`} tone="cyan" />
            <Metric label="Open Follow-Ups" value={selectedOpenTasks.length || metrics.taskCount} helper="Client tasks" tone="amber" />
            <Metric label="Vault" value={payload.vault?.enabled ? "Encrypted" : "Ready"} helper={payload.vault?.keyConfigured ? "Key configured" : "Local/plain mode"} tone={payload.vault?.enabled ? "green" : "slate"} />
          </div>
        </header>

        {message ? (
          <div className={cx("rounded-2xl border p-4 text-sm font-bold", toneClass(messageTone))}>
            {message}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="grid h-fit gap-5 xl:sticky xl:top-5">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                    Client Directory
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">Find or create a profile</h2>
                </div>
                <button type="button" onClick={() => void loadClients(selectedClientId)} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-white hover:bg-white/10">
                  {loading ? "Loading" : "Refresh"}
                </button>
              </div>

              <div className="mt-5 grid gap-3">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients, households, emails, symbols..." className={inputClass} />

                <div className="grid gap-2 md:grid-cols-2">
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
                    <option>All</option>
                    <option>Active</option>
                    <option>Needs Review</option>
                    <option>Prospect</option>
                    <option>Inactive</option>
                  </select>

                  <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className={inputClass}>
                    <option>All</option>
                    <option>Conservative</option>
                    <option>Balanced</option>
                    <option>Growth</option>
                    <option>Aggressive</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 grid max-h-[520px] gap-3 overflow-y-auto pr-2">
                {filteredClients.map((client) => {
                  const active = selectedClient?.id === client.id;

                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => loadClientIntoForm(client)}
                      className={cx(
                        "rounded-[1.5rem] border p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08]",
                        active ? "border-cyan-400/50 bg-cyan-500/10 shadow-lg shadow-cyan-950/20" : "border-white/10 bg-black/35",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-red-600 via-red-900 to-zinc-950 text-sm font-black text-white shadow-lg shadow-red-950/30">
                          {initials(client.fullName)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-base font-black text-white">{client.fullName}</div>
                          <div className="mt-1 truncate text-xs text-slate-500">
                            {client.householdName || "No household"} · {client.email || "No email"}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Pill tone={toneFor(client.riskProfile)}>{client.riskProfile}</Pill>
                            <Pill tone={toneFor(client.status)}>{client.status}</Pill>
                            <Pill tone="cyan">{client.holdings.length} holdings</Pill>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {!filteredClients.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                    No matching clients yet.
                  </div>
                ) : null}
              </div>
            </Card>

            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                AI Import
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Drop CSV or Excel</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                AI stages profiles first. Advisors approve before anything is created.
              </p>

              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="mt-5 flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-cyan-500/30 bg-cyan-500/10 p-5 text-center transition hover:bg-cyan-500/15"
              >
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx,.xls"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void normalizeImportFile(file);
                  }}
                />
                <div className="text-sm font-black text-cyan-100">
                  {importLoading ? "Interpreting file..." : "Drop file or click to upload"}
                </div>
                <div className="mt-2 text-xs leading-5 text-cyan-200/80">
                  CSV, TSV, TXT, XLSX, or XLS. Excel support requires the server xlsx package.
                </div>
              </label>

              {importFileName ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs font-bold text-slate-300">
                  Current file: {importFileName}
                </div>
              ) : null}

              <div className="mt-4 grid gap-2">
                <input
                  value={advisorNotifyEmail}
                  onChange={(event) => setAdvisorNotifyEmail(event.target.value)}
                  placeholder="Advisor notification email"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setSendChangeEmails((current) => !current)}
                  className={cx("rounded-2xl border px-4 py-3 text-xs font-black", sendChangeEmails ? toneClass("green") : toneClass("slate"))}
                >
                  {sendChangeEmails ? "Advisor change emails on" : "Advisor change emails off"}
                </button>
              </div>

              {importProfiles.length ? (
                <div className="mt-5 grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Pill tone="cyan">{importProfiles.length} staged</Pill>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => selectAllImports(true)} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-black text-white">
                        Select All
                      </button>
                      <button type="button" onClick={() => selectAllImports(false)} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-black text-white">
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1">
                    {importProfiles.map((profile) => (
                      <button
                        key={profile.importKey}
                        type="button"
                        onClick={() => toggleImportSelection(profile.importKey)}
                        className={cx(
                          "rounded-2xl border p-3 text-left transition hover:bg-white/[0.075]",
                          importSelections[profile.importKey] ? "border-emerald-500/35 bg-emerald-500/10" : "border-white/10 bg-black/25",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-white">{profile.fullName || "Unnamed profile"}</div>
                            <div className="mt-1 truncate text-xs text-slate-500">
                              Row {profile.sourceRow} · {profile.email || "No email"} · {profile.holdings.length} holdings
                            </div>
                          </div>
                          <Pill tone={profile.confidence >= 90 ? "green" : profile.confidence >= 75 ? "amber" : "red"}>
                            {profile.confidence}%
                          </Pill>
                        </div>
                        {profile.warnings.length || profile.duplicateHint ? (
                          <div className="mt-2 text-xs leading-5 text-amber-200">
                            {[profile.duplicateHint, ...profile.warnings].filter(Boolean).join(" · ")}
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>

                  {importWarnings.length ? (
                    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                      {importWarnings.join(" ")}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={importSelectedProfiles}
                    disabled={loading || importLoading}
                    className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Import Selected Profiles
                  </button>
                </div>
              ) : null}
            </Card>
          </div>

          <div className="grid gap-5">
            <Card>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Pill tone="purple">{selectedClient ? "Selected Client" : "New Client"}</Pill>
                    {selectedClient ? <Pill tone={toneFor(selectedClient.status)}>{selectedClient.status}</Pill> : null}
                    {selectedClient ? <Pill tone="cyan">{selectedClient.holdings.length} holdings</Pill> : null}
                  </div>

                  <h2 className="mt-3 truncate text-4xl font-black tracking-tight text-white">
                    {selectedClient?.fullName ?? "Create a new client profile"}
                  </h2>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                    {selectedClient
                      ? `${selectedClient.householdName || "No household"} · ${selectedClient.email || "No email on file"}`
                      : "Use the profile form, AI import, or voice command to create a client."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={resetClientForm} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-black text-white hover:bg-white/10">
                    New Client
                  </button>
                  {selectedClient ? (
                    <button type="button" onClick={() => loadClientIntoForm(selectedClient)} className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-xs font-black text-cyan-100 hover:bg-cyan-500/15">
                      Load Into Form
                    </button>
                  ) : null}
                </div>
              </div>
            </Card>

            <SectionShell
              title="Profile Details"
              eyebrow="Pulldown client profile"
              tone="purple"
              open={openSections.profile}
              onToggle={() => toggleSection("profile")}
            >
              <form onSubmit={selectedClient ? updateClient : createClient} className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={clientForm.fullName} onChange={(event) => setClientForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Client full name" className={inputClass} />
                  <input value={clientForm.email} onChange={(event) => setClientForm((current) => ({ ...current, email: event.target.value }))} placeholder="Client email" className={inputClass} />
                </div>

                <input value={clientForm.householdName} onChange={(event) => setClientForm((current) => ({ ...current, householdName: event.target.value }))} placeholder="Household name" className={inputClass} />

                <div className="grid gap-3 md:grid-cols-3">
                  <select value={clientForm.clientType} onChange={(event) => setClientForm((current) => ({ ...current, clientType: event.target.value }))} className={inputClass}>
                    <option>Private Client</option>
                    <option>Household</option>
                    <option>Business Owner</option>
                    <option>Trust / Estate</option>
                    <option>Prospect</option>
                  </select>

                  <select value={clientForm.riskProfile} onChange={(event) => setClientForm((current) => ({ ...current, riskProfile: event.target.value }))} className={inputClass}>
                    <option>Conservative</option>
                    <option>Balanced</option>
                    <option>Growth</option>
                    <option>Aggressive</option>
                  </select>

                  <select value={clientForm.status} onChange={(event) => setClientForm((current) => ({ ...current, status: event.target.value }))} className={inputClass}>
                    <option>Active</option>
                    <option>Needs Review</option>
                    <option>Prospect</option>
                    <option>Inactive</option>
                  </select>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <input value={clientForm.liquidityNeeds} onChange={(event) => setClientForm((current) => ({ ...current, liquidityNeeds: event.target.value }))} placeholder="Liquidity needs" className={inputClass} />
                  <input value={clientForm.timeHorizon} onChange={(event) => setClientForm((current) => ({ ...current, timeHorizon: event.target.value }))} placeholder="Time horizon" className={inputClass} />
                </div>

                <input value={clientForm.objective} onChange={(event) => setClientForm((current) => ({ ...current, objective: event.target.value }))} placeholder="Primary objective" className={inputClass} />

                <textarea value={clientForm.notes} onChange={(event) => setClientForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Advisor notes / client context" rows={4} className={cx(inputClass, "resize-none")} />

                <button type="submit" disabled={loading} className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30 disabled:cursor-not-allowed disabled:opacity-50">
                  {selectedClient ? "Save Profile Changes" : "Create Client Profile"}
                </button>
              </form>
            </SectionShell>

            <SectionShell
              title="Securities / Holdings"
              eyebrow="Pulldown securities"
              tone="cyan"
              open={openSections.securities}
              onToggle={() => toggleSection("securities")}
            >
              <form onSubmit={addHolding} className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <input value={holdingForm.symbol} onChange={(event) => setHoldingForm((current) => ({ ...current, symbol: event.target.value.toUpperCase(), assetClass: current.assetClass || assetClassForSymbol(event.target.value) }))} placeholder="Symbol, e.g. AAPL" className={inputClass} />
                  <input value={holdingForm.assetName} onChange={(event) => setHoldingForm((current) => ({ ...current, assetName: event.target.value }))} placeholder="Name optional" className={inputClass} />
                  <select value={holdingForm.assetClass} onChange={(event) => setHoldingForm((current) => ({ ...current, assetClass: event.target.value }))} className={inputClass}>
                    <option>Stock</option>
                    <option>ETF</option>
                    <option>Mutual Fund</option>
                    <option>Bond</option>
                    <option>Crypto</option>
                    <option>Futures</option>
                    <option>Alternative</option>
                    <option>Other</option>
                  </select>
                  <select value={holdingForm.riskLevel} onChange={(event) => setHoldingForm((current) => ({ ...current, riskLevel: event.target.value }))} className={inputClass}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Aggressive</option>
                  </select>
                </div>

                <input value={holdingForm.thesis} onChange={(event) => setHoldingForm((current) => ({ ...current, thesis: event.target.value }))} placeholder="Thesis / reason this security matters" className={inputClass} />

                <button type="submit" disabled={loading || !selectedClient} className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">
                  Add Security
                </button>
              </form>

              <div className="mt-5 grid gap-3">
                <textarea value={bulkSymbols} onChange={(event) => setBulkSymbols(event.target.value)} placeholder="Bulk add symbols: AAPL, MSFT, NVDA, SPY..." rows={3} className={cx(inputClass, "resize-none")} />
                <button type="button" onClick={bulkAddHoldings} disabled={loading || !selectedClient} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                  Bulk Add Symbols
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(selectedClient?.holdings ?? []).map((holding) => (
                  <div key={holding.id} className="rounded-[1.25rem] border border-white/10 bg-black/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-lg font-black text-white">{holding.symbol}</div>
                        <div className="mt-1 truncate text-xs text-slate-500">{holding.assetName}</div>
                      </div>
                      <button type="button" onClick={() => removeHolding(holding)} className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-xs font-black text-slate-300 hover:text-white">
                        ×
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill tone={toneFor(holding.assetClass)}>{holding.assetClass}</Pill>
                      <Pill tone={toneFor(holding.riskLevel)}>{holding.riskLevel}</Pill>
                    </div>
                    {holding.thesis ? <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400">{holding.thesis}</p> : null}
                  </div>
                ))}

                {!selectedClient?.holdings?.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                    No securities attached yet.
                  </div>
                ) : null}
              </div>
            </SectionShell>

            <SectionShell
              title="Voice Client Entry"
              eyebrow="Pulldown voice mode"
              tone="amber"
              open={openSections.voice}
              onToggle={() => toggleSection("voice")}
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-sm font-black text-white">Voice examples</div>
                  <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-400">
                    <div>• “Add client John Smith email john@example.com”</div>
                    <div>• “Add AAPL to John Smith”</div>
                    <div>• “Note client wants conservative income focus”</div>
                  </div>
                  {voiceTranscript ? (
                    <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                      {voiceTranscript}
                    </div>
                  ) : null}
                </div>

                <button type="button" onClick={voiceListening ? stopVoice : startVoice} className={cx("rounded-[1.5rem] border p-5 text-center text-sm font-black", voiceListening ? toneClass("red") : toneClass("amber"))}>
                  {voiceListening ? "Stop Listening" : "Start Voice Entry"}
                </button>
              </div>
            </SectionShell>

            <SectionShell
              title="Client Portal Preference Sync"
              eyebrow="Pulldown client account changes"
              tone="green"
              open={openSections.portal}
              onToggle={() => toggleSection("portal")}
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-sm font-black text-white">Advisor notification flow</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    When client portal data changes, use the same profile update path and notification route.
                    This keeps advisor records synced and sends a Resend email when the advisor email is configured.
                  </p>
                </div>

                <button type="button" onClick={applyPortalPreferenceChange} disabled={!selectedClient || loading} className="rounded-[1.5rem] border border-emerald-500/25 bg-emerald-500/10 p-5 text-center text-sm font-black text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">
                  Apply Portal Sync + Notify
                </button>
              </div>
            </SectionShell>

            <SectionShell
              title="Advisor Notes"
              eyebrow="Pulldown notes"
              tone="purple"
              open={openSections.notes}
              onToggle={() => toggleSection("notes")}
            >
              <form onSubmit={addNote} className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <input value={noteForm.title} onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))} placeholder="Note title" className={inputClass} />
                  <select value={noteForm.noteType} onChange={(event) => setNoteForm((current) => ({ ...current, noteType: event.target.value }))} className={inputClass}>
                    <option>General</option>
                    <option>Meeting</option>
                    <option>Suitability</option>
                    <option>Client Preference</option>
                    <option>Investment Discussion</option>
                    <option>Compliance</option>
                  </select>
                </div>
                <textarea value={noteForm.body} onChange={(event) => setNoteForm((current) => ({ ...current, body: event.target.value }))} placeholder="Note body" rows={3} className={cx(inputClass, "resize-none")} />
                <button type="submit" disabled={!selectedClient || loading} className="rounded-2xl border border-purple-500/25 bg-purple-500/10 px-4 py-3 text-sm font-black text-purple-100 disabled:cursor-not-allowed disabled:opacity-50">
                  Add Note
                </button>
              </form>

              <div className="mt-5 grid gap-3">
                {(selectedClient?.notesList ?? []).map((note) => (
                  <div key={note.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-black text-white">{note.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{note.noteType} · {shortDate(note.createdAt)}</div>
                      </div>
                      <Pill tone={toneFor(note.noteType)}>{note.noteType}</Pill>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{note.body}</p>
                  </div>
                ))}

                {!selectedClient?.notesList?.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                    No notes yet.
                  </div>
                ) : null}
              </div>
            </SectionShell>

            <SectionShell
              title="Tasks"
              eyebrow="Pulldown follow-ups"
              tone="amber"
              open={openSections.tasks}
              onToggle={() => toggleSection("tasks")}
            >
              <form onSubmit={addTask} className="grid gap-3">
                <input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} placeholder="Task title" className={inputClass} />
                <textarea value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} placeholder="Task details" rows={2} className={cx(inputClass, "resize-none")} />
                <div className="grid gap-3 md:grid-cols-2">
                  <select value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))} className={inputClass}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                  <input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} className={inputClass} />
                </div>
                <button type="submit" disabled={!selectedClient || loading} className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100 disabled:cursor-not-allowed disabled:opacity-50">
                  Add Task
                </button>
              </form>

              <div className="mt-5 grid gap-3">
                {(selectedClient?.tasks ?? []).map((task) => (
                  <div key={task.id} className={cx("rounded-2xl border p-4", toneClass(toneFor(task.priority)))}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">{task.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{task.priority} · {task.dueDate ? shortDate(task.dueDate) : "No due date"}</div>
                      </div>
                      <button type="button" onClick={() => completeTask(task)} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-white">
                        {task.status === "Done" ? "Reopen" : "Done"}
                      </button>
                    </div>
                    {task.description ? <p className="mt-3 text-sm leading-6 text-slate-400">{task.description}</p> : null}
                  </div>
                ))}

                {!selectedClient?.tasks?.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                    No tasks yet.
                  </div>
                ) : null}
              </div>
            </SectionShell>

            <SectionShell
              title="Documents"
              eyebrow="Pulldown vault references"
              tone="blue"
              open={openSections.documents}
              onToggle={() => toggleSection("documents")}
            >
              <form onSubmit={addDocument} className="grid gap-3">
                <input value={documentForm.fileName} onChange={(event) => setDocumentForm((current) => ({ ...current, fileName: event.target.value }))} placeholder="Document name / reference" className={inputClass} />
                <div className="grid gap-3 md:grid-cols-2">
                  <select value={documentForm.documentType} onChange={(event) => setDocumentForm((current) => ({ ...current, documentType: event.target.value }))} className={inputClass}>
                    <option>General</option>
                    <option>IPS</option>
                    <option>Risk Survey</option>
                    <option>Statement</option>
                    <option>Estate</option>
                    <option>Tax</option>
                    <option>Agreement</option>
                  </select>
                  <select value={documentForm.status} onChange={(event) => setDocumentForm((current) => ({ ...current, status: event.target.value }))} className={inputClass}>
                    <option>Needs Review</option>
                    <option>Reviewed</option>
                    <option>Approved</option>
                    <option>Archived</option>
                  </select>
                </div>
                <input value={documentForm.notes} onChange={(event) => setDocumentForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Document notes" className={inputClass} />
                <button type="submit" disabled={!selectedClient || loading} className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-sm font-black text-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                  Add Document Reference
                </button>
              </form>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {(selectedClient?.documents ?? []).map((document) => (
                  <div key={document.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-sm font-black text-white">{document.fileName}</div>
                    <div className="mt-1 text-xs text-slate-500">{document.documentType} · {document.status}</div>
                    {document.notes ? <p className="mt-3 text-sm leading-6 text-slate-400">{document.notes}</p> : null}
                  </div>
                ))}

                {!selectedClient?.documents?.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                    No document references yet.
                  </div>
                ) : null}
              </div>
            </SectionShell>

            <SectionShell
              title="Risk Review"
              eyebrow="Pulldown suitability context"
              tone={toneFor(selectedRiskReview?.score ?? selectedClient?.riskProfile)}
              open={openSections.risk}
              onToggle={() => toggleSection("risk")}
              action={
                <button type="button" onClick={addRiskReview} disabled={!selectedClient || loading} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                  Generate
                </button>
              }
            >
              {selectedRiskReview ? (
                <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className={cx("rounded-2xl border p-4 text-center", toneClass(toneFor(selectedRiskReview.score)))}>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Risk Score</div>
                    <div className="mt-2 text-5xl font-black text-white">{selectedRiskReview.score}</div>
                    <div className="mt-2 text-xs font-black text-slate-300">{selectedRiskReview.suitabilityStatus}</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-sm font-black text-white">Summary</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{selectedRiskReview.summary}</p>

                    <div className="mt-4 grid gap-2">
                      {parseFlags(selectedRiskReview.flagsJson).map((flag) => (
                        <div key={flag} className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
                          {flag}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                  No risk review yet. Generate one from the current client profile.
                </div>
              )}
            </SectionShell>

            <SectionShell
              title="Remove Client"
              eyebrow="Pulldown removal"
              tone="red"
              open={openSections.remove}
              onToggle={() => toggleSection("remove")}
            >
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
                  <div className="text-sm font-black text-white">Removal is permanent</div>
                  <p className="mt-2 text-sm leading-6 text-red-100">
                    This removes the selected client profile and related local profile records from the client data API.
                  </p>
                </div>

                <button type="button" onClick={deleteSelectedClient} disabled={!selectedClient || loading} className="rounded-2xl bg-red-600 px-4 py-4 text-sm font-black text-white shadow-lg shadow-red-950/30 disabled:cursor-not-allowed disabled:opacity-50">
                  Remove Selected Client
                </button>
              </div>
            </SectionShell>
          </div>
        </section>
      </div>
    </main>
  );
}