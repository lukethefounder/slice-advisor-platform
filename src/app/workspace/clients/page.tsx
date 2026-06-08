"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";

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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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

  if (
    lower.includes("client") ||
    lower.includes("household") ||
    lower.includes("profile")
  ) {
    return "purple";
  }

  if (
    lower.includes("stock") ||
    lower.includes("security") ||
    lower.includes("etf") ||
    lower.includes("bond")
  ) {
    return "cyan";
  }

  return "slate";
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
        .split(/,|\n|\s/)
        .map((item) => item.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, ""))
        .filter(Boolean)
    )
  ).slice(0, 30);
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const tones: Record<Tone, string> = {
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
        "inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
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
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-red-950/20 backdrop-blur-xl",
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
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[1.5rem] border border-white/10 bg-white/[0.052] p-4 shadow-lg shadow-black/10",
        className
      )}
    >
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

const inputClass =
  "rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-red-400/40 focus:ring-2 focus:ring-red-500/20";

export default function ClientProfilesPage() {
  const [payload, setPayload] = useState<ClientsPayload>(EMPTY_PAYLOAD);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");

  const [clientForm, setClientForm] = useState({
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
  });

  const [holdingForm, setHoldingForm] = useState({
    symbol: "",
    assetName: "",
    assetClass: "Stock",
    riskLevel: "Medium",
    thesis: "",
  });

  const [bulkSymbols, setBulkSymbols] = useState("");

  const [noteForm, setNoteForm] = useState({
    title: "",
    body: "",
    noteType: "General",
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "Medium",
    dueDate: "",
  });

  const [documentForm, setDocumentForm] = useState({
    fileName: "",
    documentType: "General",
    status: "Needs Review",
    notes: "",
  });

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
            holding.assetName.toLowerCase().includes(query)
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
    return Array.from(
      new Set(
        clients.flatMap((client) => client.holdings.map((holding) => holding.symbol))
      )
    ).sort();
  }, [clients]);

  async function loadClients(nextSelectedId?: string) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/clients", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Unable to load client profiles.");
        return;
      }

      setPayload(data);

      const nextId =
        nextSelectedId ||
        selectedClientId ||
        data.clients?.[0]?.id ||
        "";

      setSelectedClientId(nextId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load client profiles.");
    } finally {
      setLoading(false);
    }
  }

  async function postClientAction(body: Record<string, unknown>, successMessage: string) {
    setLoading(true);
    setMessage("");

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
        setMessage(data.error ?? "Client action failed.");
        return null;
      }

      setPayload(data);

      if (data.client?.id) {
        setSelectedClientId(data.client.id);
      }

      setMessage(successMessage);
      return data as ClientsPayload & { client?: ClientProfile };
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Client action failed.");
      return null;
    } finally {
      setLoading(false);
    }
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
  }

  async function createClient(event: FormEvent) {
    event.preventDefault();

    if (!clientForm.fullName.trim()) {
      setMessage("Client full name is required.");
      return;
    }

    const result = await postClientAction(
      {
        action: "createClient",
        ...clientForm,
      },
      "Client profile created."
    );

    if (result?.client) {
      setClientForm({
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
      });
    }
  }

  async function updateClient(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient) {
      setMessage("Select a client first.");
      return;
    }

    await postClientAction(
      {
        action: "updateClient",
        clientId: selectedClient.id,
        ...clientForm,
      },
      "Client profile updated."
    );
  }

  async function addHolding(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient) {
      setMessage("Select a client first.");
      return;
    }

    if (!holdingForm.symbol.trim()) {
      setMessage("Security symbol is required.");
      return;
    }

    const result = await postClientAction(
      {
        action: "addHolding",
        clientId: selectedClient.id,
        ...holdingForm,
      },
      `${holdingForm.symbol.toUpperCase()} added to ${selectedClient.fullName}.`
    );

    if (result) {
      setHoldingForm({
        symbol: "",
        assetName: "",
        assetClass: "Stock",
        riskLevel: "Medium",
        thesis: "",
      });
    }
  }

  async function bulkAddHoldings() {
    if (!selectedClient) {
      setMessage("Select a client first.");
      return;
    }

    const symbols = cleanSymbols(bulkSymbols);

    if (!symbols.length) {
      setMessage("Paste at least one symbol.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      for (const symbol of symbols) {
        const response = await fetch("/api/clients", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-slice-sensitive-action": "bulk-add-client-holdings",
          },
          body: JSON.stringify({
            action: "addHolding",
            clientId: selectedClient.id,
            symbol,
            assetName: symbol,
            assetClass: "Stock",
            riskLevel: "Medium",
            thesis: "Added through quick bulk entry.",
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? `Unable to add ${symbol}.`);
        }
      }

      setBulkSymbols("");
      await loadClients(selectedClient.id);
      setMessage(`${symbols.length} security symbol(s) added without storing position amounts.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add symbols.");
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
      `${holding.symbol} removed from ${selectedClient.fullName}.`
    );
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient) {
      setMessage("Select a client first.");
      return;
    }

    if (!noteForm.title.trim() || !noteForm.body.trim()) {
      setMessage("Note title and body are required.");
      return;
    }

    const result = await postClientAction(
      {
        action: "addNote",
        clientId: selectedClient.id,
        ...noteForm,
      },
      "Advisor note added."
    );

    if (result) {
      setNoteForm({
        title: "",
        body: "",
        noteType: "General",
      });
    }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient) {
      setMessage("Select a client first.");
      return;
    }

    if (!taskForm.title.trim()) {
      setMessage("Task title is required.");
      return;
    }

    const result = await postClientAction(
      {
        action: "addTask",
        clientId: selectedClient.id,
        ...taskForm,
      },
      "Client follow-up task added."
    );

    if (result) {
      setTaskForm({
        title: "",
        description: "",
        priority: "Medium",
        dueDate: "",
      });
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
      task.status === "Done" ? "Task reopened." : "Task completed."
    );
  }

  async function addDocument(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient) {
      setMessage("Select a client first.");
      return;
    }

    if (!documentForm.fileName.trim()) {
      setMessage("Document name is required.");
      return;
    }

    const result = await postClientAction(
      {
        action: "addDocument",
        clientId: selectedClient.id,
        ...documentForm,
      },
      "Document reference added."
    );

    if (result) {
      setDocumentForm({
        fileName: "",
        documentType: "General",
        status: "Needs Review",
        notes: "",
      });
    }
  }

  async function addRiskReview() {
    if (!selectedClient) {
      setMessage("Select a client first.");
      return;
    }

    await postClientAction(
      {
        action: "addRiskReview",
        clientId: selectedClient.id,
      },
      "Client risk review created."
    );
  }

  useEffect(() => {
    void loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_28%),linear-gradient(135deg,_#020617,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-zinc-950/78 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(239,68,68,0.28),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.16),transparent_26%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="purple">Client profiles</Pill>
                <Pill tone="green">Holdings without amounts</Pill>
                <Pill tone="cyan">Advisor workflow</Pill>
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                Client intelligence made effortless.
              </h1>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
                Add clients, update relationship context, track the securities each client owns,
                prepare notes, assign follow-ups, and keep portfolio visibility privacy-first.
                This screen intentionally tracks symbols and security names without requiring
                account values or position amounts.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/workspace"
                className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white hover:bg-white/10"
              >
                Workspace
              </a>
              <a
                href="/workspace/client-emails"
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-500/20"
              >
                Email Center
              </a>
              <a
                href="/workspace/client-briefings"
                className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20"
              >
                Briefings
              </a>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="Clients" value={metrics.clientCount} helper={`${metrics.activeCount} active`} tone="purple" />
            <Metric label="Email Ready" value={metrics.emailReadyCount} helper={`${metrics.missingEmailCount} missing`} tone={metrics.missingEmailCount ? "amber" : "green"} />
            <Metric label="Tracked Securities" value={metrics.holdingsCount} helper="No amounts required" tone="cyan" />
            <Metric label="Open Follow-Ups" value={metrics.taskCount} helper="Client tasks" tone="amber" />
            <Metric label="Vault" value={payload.vault?.enabled ? "Encrypted" : "Ready"} helper={payload.vault?.keyConfigured ? "Key configured" : "Local/plain mode"} tone={payload.vault?.enabled ? "green" : "slate"} />
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="grid gap-5">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                    Client Directory
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    Find or create a profile
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void loadClients(selectedClientId)}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-white hover:bg-white/10"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-5 grid gap-3">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search clients, households, emails, symbols..."
                  className={inputClass}
                />

                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className={inputClass}
                  >
                    <option>All</option>
                    <option>Active</option>
                    <option>Needs Review</option>
                    <option>Prospect</option>
                    <option>Inactive</option>
                  </select>

                  <select
                    value={riskFilter}
                    onChange={(event) => setRiskFilter(event.target.value)}
                    className={inputClass}
                  >
                    <option>All</option>
                    <option>Conservative</option>
                    <option>Balanced</option>
                    <option>Growth</option>
                    <option>Aggressive</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 grid max-h-[760px] gap-3 overflow-y-auto pr-2">
                {filteredClients.map((client) => {
                  const active = selectedClient?.id === client.id;

                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => loadClientIntoForm(client)}
                      className={cx(
                        "rounded-[1.5rem] border p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08]",
                        active
                          ? "border-cyan-400/50 bg-cyan-500/10 shadow-lg shadow-cyan-950/20"
                          : "border-white/10 bg-black/35"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-red-600 via-red-900 to-zinc-950 text-sm font-black text-white shadow-lg shadow-red-950/30">
                          {initials(client.fullName)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-base font-black text-white">
                            {client.fullName}
                          </div>
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
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
                Create / Edit Client
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                Profile details
              </h2>

              <form
                onSubmit={selectedClient ? updateClient : createClient}
                className="mt-5 grid gap-3"
              >
                <input
                  value={clientForm.fullName}
                  onChange={(event) =>
                    setClientForm((current) => ({ ...current, fullName: event.target.value }))
                  }
                  placeholder="Client full name"
                  className={inputClass}
                />

                <input
                  value={clientForm.email}
                  onChange={(event) =>
                    setClientForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="Client email"
                  className={inputClass}
                />

                <input
                  value={clientForm.householdName}
                  onChange={(event) =>
                    setClientForm((current) => ({ ...current, householdName: event.target.value }))
                  }
                  placeholder="Household name"
                  className={inputClass}
                />

                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={clientForm.clientType}
                    onChange={(event) =>
                      setClientForm((current) => ({ ...current, clientType: event.target.value }))
                    }
                    className={inputClass}
                  >
                    <option>Private Client</option>
                    <option>Retirement Client</option>
                    <option>Business Owner</option>
                    <option>Executive</option>
                    <option>Prospect</option>
                    <option>Family Office</option>
                  </select>

                  <select
                    value={clientForm.status}
                    onChange={(event) =>
                      setClientForm((current) => ({ ...current, status: event.target.value }))
                    }
                    className={inputClass}
                  >
                    <option>Active</option>
                    <option>Needs Review</option>
                    <option>Prospect</option>
                    <option>Inactive</option>
                  </select>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={clientForm.riskProfile}
                    onChange={(event) =>
                      setClientForm((current) => ({ ...current, riskProfile: event.target.value }))
                    }
                    className={inputClass}
                  >
                    <option>Conservative</option>
                    <option>Balanced</option>
                    <option>Growth</option>
                    <option>Aggressive</option>
                  </select>

                  <select
                    value={clientForm.liquidityNeeds}
                    onChange={(event) =>
                      setClientForm((current) => ({ ...current, liquidityNeeds: event.target.value }))
                    }
                    className={inputClass}
                  >
                    <option>Low</option>
                    <option>Moderate</option>
                    <option>High</option>
                    <option>Near-term</option>
                  </select>
                </div>

                <input
                  value={clientForm.timeHorizon}
                  onChange={(event) =>
                    setClientForm((current) => ({ ...current, timeHorizon: event.target.value }))
                  }
                  placeholder="Time horizon"
                  className={inputClass}
                />

                <textarea
                  value={clientForm.objective}
                  onChange={(event) =>
                    setClientForm((current) => ({ ...current, objective: event.target.value }))
                  }
                  placeholder="Client objective"
                  className={cx(inputClass, "min-h-24")}
                />

                <textarea
                  value={clientForm.notes}
                  onChange={(event) =>
                    setClientForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Private advisor notes"
                  className={cx(inputClass, "min-h-24")}
                />

                <div className="grid gap-2 md:grid-cols-2">
                  <button
                    disabled={loading}
                    className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30 disabled:opacity-50"
                  >
                    {selectedClient ? "Save Client" : "Create Client"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientId("");
                      setClientForm({
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
                      });
                    }}
                    className="rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3 text-sm font-black text-white hover:bg-white/10"
                  >
                    New Blank
                  </button>
                </div>
              </form>
            </Card>
          </div>

          <div className="grid gap-5">
            {selectedClient ? (
              <>
                <Card className="p-0">
                  <div className="relative overflow-hidden rounded-[2rem] p-6">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.16),transparent_28%)]" />

                    <div className="relative grid gap-5 xl:grid-cols-[1fr_320px] xl:items-center">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={toneFor(selectedClient.status)}>{selectedClient.status}</Pill>
                          <Pill tone={toneFor(selectedClient.riskProfile)}>{selectedClient.riskProfile}</Pill>
                          <Pill tone="cyan">{selectedClient.holdings.length} securities</Pill>
                          <Pill tone={selectedClient.email ? "green" : "amber"}>
                            {selectedClient.email ? "Email ready" : "Email missing"}
                          </Pill>
                        </div>

                        <h2 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
                          {selectedClient.fullName}
                        </h2>

                        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                          {selectedClient.objective}
                        </p>

                        <div className="mt-5 grid gap-3 md:grid-cols-4">
                          <Metric label="Household" value={selectedClient.householdName || "—"} tone="purple" />
                          <Metric label="Liquidity" value={selectedClient.liquidityNeeds} tone={toneFor(selectedClient.liquidityNeeds)} />
                          <Metric label="Time Horizon" value={selectedClient.timeHorizon} tone="cyan" />
                          <Metric label="Open Tasks" value={selectedOpenTasks.length} tone={selectedOpenTasks.length ? "amber" : "green"} />
                        </div>
                      </div>

                      <Panel className="bg-black/35">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          Risk Review
                        </div>

                        <div className="mt-3 text-5xl font-black text-white">
                          {selectedRiskReview?.score ?? "—"}
                        </div>

                        <div className="mt-2">
                          <Pill tone={toneFor(selectedRiskReview?.score ?? 0)}>
                            {selectedRiskReview?.suitabilityStatus ?? "No review yet"}
                          </Pill>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-slate-400">
                          {selectedRiskReview?.summary ??
                            "Create a quick review after adding securities and profile context."}
                        </p>

                        {selectedRiskReview ? (
                          <div className="mt-3 grid gap-2">
                            {parseFlags(selectedRiskReview.flagsJson).slice(0, 3).map((flag) => (
                              <div
                                key={flag}
                                className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100"
                              >
                                {flag}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <button
                          type="button"
                          onClick={addRiskReview}
                          disabled={loading}
                          className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                        >
                          Run Review
                        </button>
                      </Panel>
                    </div>
                  </div>
                </Card>

                <section className="grid gap-5 2xl:grid-cols-[1.05fr_0.95fr]">
                  <Card>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                          Privacy-First Portfolio Map
                        </div>
                        <h3 className="mt-2 text-2xl font-black text-white">
                          Securities held, without position amounts
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          Track what the client owns so advisors can identify who needs communication
                          when news affects a specific stock or security. Amounts, shares, and allocations
                          are intentionally not required here.
                        </p>
                      </div>
                      <Pill tone="green">No amounts stored</Pill>
                    </div>

                    <form onSubmit={addHolding} className="mt-5 grid gap-3">
                      <div className="grid gap-2 md:grid-cols-[130px_1fr_160px_150px]">
                        <input
                          value={holdingForm.symbol}
                          onChange={(event) =>
                            setHoldingForm((current) => ({
                              ...current,
                              symbol: event.target.value.toUpperCase(),
                            }))
                          }
                          placeholder="AAPL"
                          className={inputClass}
                        />

                        <input
                          value={holdingForm.assetName}
                          onChange={(event) =>
                            setHoldingForm((current) => ({
                              ...current,
                              assetName: event.target.value,
                            }))
                          }
                          placeholder="Security name"
                          className={inputClass}
                        />

                        <select
                          value={holdingForm.assetClass}
                          onChange={(event) =>
                            setHoldingForm((current) => ({
                              ...current,
                              assetClass: event.target.value,
                            }))
                          }
                          className={inputClass}
                        >
                          <option>Stock</option>
                          <option>ETF</option>
                          <option>Bond</option>
                          <option>Fund</option>
                          <option>Alternative</option>
                          <option>Cash</option>
                          <option>Other</option>
                        </select>

                        <select
                          value={holdingForm.riskLevel}
                          onChange={(event) =>
                            setHoldingForm((current) => ({
                              ...current,
                              riskLevel: event.target.value,
                            }))
                          }
                          className={inputClass}
                        >
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                        </select>
                      </div>

                      <textarea
                        value={holdingForm.thesis}
                        onChange={(event) =>
                          setHoldingForm((current) => ({
                            ...current,
                            thesis: event.target.value,
                          }))
                        }
                        placeholder="Optional reason this security matters for the client"
                        className={cx(inputClass, "min-h-20")}
                      />

                      <button
                        disabled={loading}
                        className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                      >
                        Add Security
                      </button>
                    </form>

                    <Panel className="mt-4 bg-black/30">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Bulk add
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Paste symbols separated by commas, spaces, or new lines.
                      </p>

                      <textarea
                        value={bulkSymbols}
                        onChange={(event) => setBulkSymbols(event.target.value)}
                        placeholder="NVDA, MSFT, VOO, SCHD"
                        className={cx(inputClass, "mt-3 min-h-20 w-full")}
                      />

                      <button
                        type="button"
                        disabled={loading}
                        onClick={bulkAddHoldings}
                        className="mt-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 disabled:opacity-50"
                      >
                        Bulk Add Symbols
                      </button>
                    </Panel>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {selectedClient.holdings.map((holding) => (
                        <Panel key={holding.id} className="bg-black/35">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-2xl font-black text-white">
                                {holding.symbol}
                              </div>
                              <div className="mt-1 text-sm font-bold text-slate-400">
                                {holding.assetName}
                              </div>
                            </div>
                            <Pill tone={toneFor(holding.riskLevel)}>{holding.riskLevel}</Pill>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Pill tone={toneFor(holding.assetClass)}>{holding.assetClass}</Pill>
                            <Pill tone="green">Amount hidden</Pill>
                          </div>

                          {holding.thesis ? (
                            <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400">
                              {holding.thesis}
                            </p>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => removeHolding(holding)}
                            className="mt-4 w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 hover:bg-red-500/20"
                          >
                            Remove
                          </button>
                        </Panel>
                      ))}

                      {!selectedClient.holdings.length ? (
                        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                          No securities added yet.
                        </div>
                      ) : null}
                    </div>
                  </Card>

                  <div className="grid gap-5">
                    <Card>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                        Follow-Ups
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-white">
                        Client action list
                      </h3>

                      <form onSubmit={addTask} className="mt-5 grid gap-3">
                        <input
                          value={taskForm.title}
                          onChange={(event) =>
                            setTaskForm((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          placeholder="Follow-up task"
                          className={inputClass}
                        />

                        <textarea
                          value={taskForm.description}
                          onChange={(event) =>
                            setTaskForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          placeholder="Task detail"
                          className={cx(inputClass, "min-h-20")}
                        />

                        <div className="grid gap-2 md:grid-cols-2">
                          <select
                            value={taskForm.priority}
                            onChange={(event) =>
                              setTaskForm((current) => ({
                                ...current,
                                priority: event.target.value,
                              }))
                            }
                            className={inputClass}
                          >
                            <option>Low</option>
                            <option>Medium</option>
                            <option>High</option>
                            <option>Critical</option>
                          </select>

                          <input
                            type="date"
                            value={taskForm.dueDate}
                            onChange={(event) =>
                              setTaskForm((current) => ({
                                ...current,
                                dueDate: event.target.value,
                              }))
                            }
                            className={inputClass}
                          />
                        </div>

                        <button
                          disabled={loading}
                          className="rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                        >
                          Add Follow-Up
                        </button>
                      </form>

                      <div className="mt-5 grid gap-3">
                        {selectedClient.tasks.slice(0, 8).map((task) => (
                          <div
                            key={task.id}
                            className={cx(
                              "rounded-2xl border p-4",
                              task.status === "Done" || task.status === "Complete"
                                ? "border-emerald-500/25 bg-emerald-500/10"
                                : "border-white/10 bg-black/35"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-black text-white">{task.title}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {task.dueDate ? shortDate(task.dueDate) : "No due date"}
                                </div>
                              </div>
                              <Pill tone={toneFor(task.priority)}>{task.priority}</Pill>
                            </div>

                            {task.description ? (
                              <p className="mt-2 text-sm leading-6 text-slate-400">
                                {task.description}
                              </p>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => completeTask(task)}
                              className="mt-3 rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                            >
                              {task.status === "Done" ? "Reopen" : "Mark Done"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                        Notes
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-white">
                        Advisor memory
                      </h3>

                      <form onSubmit={addNote} className="mt-5 grid gap-3">
                        <input
                          value={noteForm.title}
                          onChange={(event) =>
                            setNoteForm((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          placeholder="Note title"
                          className={inputClass}
                        />

                        <select
                          value={noteForm.noteType}
                          onChange={(event) =>
                            setNoteForm((current) => ({
                              ...current,
                              noteType: event.target.value,
                            }))
                          }
                          className={inputClass}
                        >
                          <option>General</option>
                          <option>Meeting</option>
                          <option>Portfolio</option>
                          <option>Family</option>
                          <option>Compliance</option>
                          <option>Planning</option>
                        </select>

                        <textarea
                          value={noteForm.body}
                          onChange={(event) =>
                            setNoteForm((current) => ({
                              ...current,
                              body: event.target.value,
                            }))
                          }
                          placeholder="Advisor note"
                          className={cx(inputClass, "min-h-24")}
                        />

                        <button
                          disabled={loading}
                          className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                        >
                          Add Note
                        </button>
                      </form>

                      <div className="mt-5 grid max-h-[420px] gap-3 overflow-y-auto pr-2">
                        {selectedClient.notesList.slice(0, 12).map((note) => (
                          <Panel key={note.id} className="bg-black/35">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-black text-white">{note.title}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {note.noteType} · {shortDate(note.createdAt)}
                                </div>
                              </div>
                              <Pill tone="purple">{note.noteType}</Pill>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                              {note.body}
                            </p>
                          </Panel>
                        ))}

                        {!selectedClient.notesList.length ? (
                          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                            No notes yet.
                          </div>
                        ) : null}
                      </div>
                    </Card>
                  </div>
                </section>

                <section className="grid gap-5 xl:grid-cols-2">
                  <Card>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                      Documents
                    </div>
                    <h3 className="mt-2 text-2xl font-black text-white">
                      Client document references
                    </h3>

                    <form onSubmit={addDocument} className="mt-5 grid gap-3">
                      <input
                        value={documentForm.fileName}
                        onChange={(event) =>
                          setDocumentForm((current) => ({
                            ...current,
                            fileName: event.target.value,
                          }))
                        }
                        placeholder="Document name or reference"
                        className={inputClass}
                      />

                      <div className="grid gap-2 md:grid-cols-2">
                        <select
                          value={documentForm.documentType}
                          onChange={(event) =>
                            setDocumentForm((current) => ({
                              ...current,
                              documentType: event.target.value,
                            }))
                          }
                          className={inputClass}
                        >
                          <option>General</option>
                          <option>IPS</option>
                          <option>Statement</option>
                          <option>Tax</option>
                          <option>Estate</option>
                          <option>Insurance</option>
                          <option>Meeting Notes</option>
                        </select>

                        <select
                          value={documentForm.status}
                          onChange={(event) =>
                            setDocumentForm((current) => ({
                              ...current,
                              status: event.target.value,
                            }))
                          }
                          className={inputClass}
                        >
                          <option>Needs Review</option>
                          <option>Reviewed</option>
                          <option>Approved</option>
                          <option>Archived</option>
                        </select>
                      </div>

                      <textarea
                        value={documentForm.notes}
                        onChange={(event) =>
                          setDocumentForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Document notes"
                        className={cx(inputClass, "min-h-20")}
                      />

                      <button
                        disabled={loading}
                        className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                      >
                        Add Document Reference
                      </button>
                    </form>

                    <div className="mt-5 grid gap-3">
                      {selectedClient.documents.slice(0, 8).map((document) => (
                        <Panel key={document.id} className="bg-black/35">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-black text-white">{document.fileName}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {document.documentType} · {shortDate(document.createdAt)}
                              </div>
                            </div>
                            <Pill tone={toneFor(document.status)}>{document.status}</Pill>
                          </div>
                          {document.notes ? (
                            <p className="mt-3 text-sm leading-6 text-slate-400">
                              {document.notes}
                            </p>
                          ) : null}
                        </Panel>
                      ))}

                      {!selectedClient.documents.length ? (
                        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                          No document references yet.
                        </div>
                      ) : null}
                    </div>
                  </Card>

                  <Card>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400">
                      Coverage Map
                    </div>
                    <h3 className="mt-2 text-2xl font-black text-white">
                      Securities across all clients
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      This makes it simple to know who may need a client email when a stock,
                      ETF, fund, or bond has material news.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {allHeldSymbols.map((symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          onClick={() => setSearch(symbol)}
                          className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-black text-white hover:bg-white/10"
                        >
                          {symbol}
                        </button>
                      ))}

                      {!allHeldSymbols.length ? (
                        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                          Add holdings to build the coverage map.
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-3">
                      <a
                        href="/workspace/client-emails"
                        className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-black text-slate-950"
                      >
                        Draft Client Emails
                      </a>
                      <a
                        href="/market-visuals"
                        className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-center text-sm font-black text-red-100"
                      >
                        Open Market Visuals
                      </a>
                    </div>
                  </Card>
                </section>
              </>
            ) : (
              <Card className="grid min-h-[520px] place-items-center text-center">
                <div>
                  <Pill tone="purple">No client selected</Pill>
                  <h2 className="mt-4 text-4xl font-black text-white">
                    Create your first client profile.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                    Use the form on the left to add a client. Once created, this
                    workspace becomes the fastest place to update profile context,
                    add securities, record notes, and manage follow-up work.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}