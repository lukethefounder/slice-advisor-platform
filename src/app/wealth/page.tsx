"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
};

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
};

type RiskReview = {
  id: string;
  score: number;
  suitabilityStatus: string;
  summary: string;
  flagsJson: string;
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
  holdings: Holding[];
  notesList: AdvisorNote[];
  tasks: MeetingTask[];
  reviews: RiskReview[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[2rem] border border-white/10 bg-zinc-950/70 shadow-xl shadow-emerald-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "red",
}: {
  children: React.ReactNode;
  tone?: "red" | "green" | "amber" | "slate";
}) {
  const tones = {
    red: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-950 via-zinc-950 to-emerald-700 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-emerald-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-emerald-700" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">
          Wealth Manager Workspace
        </div>
      </div>
    </div>
  );
}

export default function WealthPage() {
  const [user, setUser] = useState<User | null>(null);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [message, setMessage] = useState("");

  const [clientForm, setClientForm] = useState({
    fullName: "",
    email: "",
    householdName: "",
    clientType: "Private Client",
    riskProfile: "Balanced",
    liquidityNeeds: "Moderate",
    timeHorizon: "5-10 years",
    objective: "Long-term wealth growth",
    portfolioValue: "",
    status: "Active",
    notes: "",
  });

  const [holdingForm, setHoldingForm] = useState({
    symbol: "",
    assetName: "",
    assetClass: "Stock",
    value: "",
    allocationPct: "",
    costBasis: "",
    riskLevel: "Medium",
    thesis: "",
  });

  const [noteForm, setNoteForm] = useState({
    title: "",
    body: "",
    noteType: "General",
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "Medium",
  });

  const [riskForm, setRiskForm] = useState({
    concentrationLevel: "Moderate",
    altExposure: "Moderate",
    debtConcern: "No",
    notes: "",
  });

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? clients[0],
    [clients, selectedClientId]
  );

  async function loadClients() {
    const response = await fetch("/api/clients", { cache: "no-store" });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    setClients(data.clients ?? []);

    if (!selectedClientId && data.clients?.[0]) {
      setSelectedClientId(data.clients[0].id);
    }
  }

  async function loadMe() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await response.json();

    if (data.user) {
      setUser(data.user);
      await loadClients();
    }
  }

  useEffect(() => {
    void loadMe();
  }, []);

  async function createClient(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/clients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clientForm),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not create client.");
      return;
    }

    setClientForm({
      fullName: "",
      email: "",
      householdName: "",
      clientType: "Private Client",
      riskProfile: "Balanced",
      liquidityNeeds: "Moderate",
      timeHorizon: "5-10 years",
      objective: "Long-term wealth growth",
      portfolioValue: "",
      status: "Active",
      notes: "",
    });

    await loadClients();
    setSelectedClientId(data.client.id);
  }

  async function addHolding(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient) return;

    const response = await fetch(`/api/clients/${selectedClient.id}/holdings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(holdingForm),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not add holding.");
      return;
    }

    setHoldingForm({
      symbol: "",
      assetName: "",
      assetClass: "Stock",
      value: "",
      allocationPct: "",
      costBasis: "",
      riskLevel: "Medium",
      thesis: "",
    });

    await loadClients();
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient) return;

    const response = await fetch(`/api/clients/${selectedClient.id}/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(noteForm),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not add note.");
      return;
    }

    setNoteForm({
      title: "",
      body: "",
      noteType: "General",
    });

    await loadClients();
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();

    if (!selectedClient) return;

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...taskForm,
        clientId: selectedClient.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not add task.");
      return;
    }

    setTaskForm({
      title: "",
      description: "",
      dueDate: "",
      priority: "Medium",
    });

    await loadClients();
  }

  async function completeTask(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "Complete",
      }),
    });

    await loadClients();
  }

  async function runRiskReview() {
    if (!selectedClient) return;

    const response = await fetch("/api/risk-reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientId: selectedClient.id,
        riskProfile: selectedClient.riskProfile,
        liquidityNeeds: selectedClient.liquidityNeeds,
        timeHorizon: selectedClient.timeHorizon,
        ...riskForm,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not run risk review.");
      return;
    }

    setRiskForm({
      concentrationLevel: "Moderate",
      altExposure: "Moderate",
      debtConcern: "No",
      notes: "",
    });

    await loadClients();
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(4,120,87,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col items-center justify-center text-center">
          <Logo />
          <h1 className="mt-8 text-5xl font-black tracking-tight">
            Sign in to open the wealth manager workspace.
          </h1>
          <p className="mt-4 max-w-2xl text-slate-400">
            Use the functional portal to register or log in first. Then come back
            here to manage clients, holdings, tasks, notes, and risk reviews.
          </p>
          <a
            href="/portal"
            className="mt-8 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-6 py-4 font-black text-white shadow-lg shadow-emerald-950/40"
          >
            Go to Login Portal
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(4,120,87,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-xl shadow-emerald-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <Logo />

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl bg-white/5 px-4 py-3">
              <div className="text-xs font-black uppercase text-slate-500">
                Advisor
              </div>
              <div className="font-black text-white">{user.name}</div>
            </div>

            <a
              href="/"
              className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
            >
              Main App
            </a>

            <a
              href="/portal"
              className="rounded-2xl bg-emerald-600 px-4 py-3 font-black text-white"
            >
              Portal
            </a>
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">
            {message}
          </div>
        ) : null}

        <section className="mt-6 grid gap-5 md:grid-cols-4">
          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Clients</div>
            <div className="mt-1 text-4xl font-black">{clients.length}</div>
          </Card>
          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Selected Portfolio</div>
            <div className="mt-1 text-4xl font-black">
              {selectedClient?.portfolioValue ?? "—"}
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Holdings</div>
            <div className="mt-1 text-4xl font-black">
              {selectedClient?.holdings.length ?? 0}
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Open Tasks</div>
            <div className="mt-1 text-4xl font-black">
              {selectedClient?.tasks.filter((task) => task.status !== "Complete")
                .length ?? 0}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="p-6">
            <h2 className="text-2xl font-black">Add Client / Household</h2>

            <form onSubmit={createClient} className="mt-5 grid gap-3">
              <input
                value={clientForm.fullName}
                onChange={(event) =>
                  setClientForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Client full name"
              />

              <input
                value={clientForm.email}
                onChange={(event) =>
                  setClientForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Client email"
              />

              <input
                value={clientForm.householdName}
                onChange={(event) =>
                  setClientForm((current) => ({
                    ...current,
                    householdName: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Household name"
              />

              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={clientForm.riskProfile}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      riskProfile: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                >
                  <option>Conservative</option>
                  <option>Balanced</option>
                  <option>Growth</option>
                  <option>Aggressive</option>
                </select>

                <select
                  value={clientForm.liquidityNeeds}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      liquidityNeeds: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                >
                  <option>Low</option>
                  <option>Moderate</option>
                  <option>High</option>
                </select>
              </div>

              <input
                value={clientForm.portfolioValue}
                onChange={(event) =>
                  setClientForm((current) => ({
                    ...current,
                    portfolioValue: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Portfolio value, e.g. $2.4M"
              />

              <input
                value={clientForm.objective}
                onChange={(event) =>
                  setClientForm((current) => ({
                    ...current,
                    objective: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Primary objective"
              />

              <button className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-5 py-3 font-black text-white">
                Add Client
              </button>
            </form>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Client Book</h2>

            <div className="mt-5 grid gap-3">
              {clients.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
                  No clients yet. Add your first client household.
                </div>
              ) : (
                clients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={cx(
                      "rounded-3xl border p-5 text-left transition",
                      selectedClient?.id === client.id
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    )}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-xl font-black">{client.fullName}</div>
                        <div className="text-sm font-semibold text-slate-400">
                          {client.householdName || "No household"} ·{" "}
                          {client.clientType}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Pill tone="red">{client.riskProfile}</Pill>
                        <Pill tone="slate">{client.portfolioValue || "No value"}</Pill>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </section>

        {selectedClient ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <Pill tone="red">Selected Client</Pill>
                  <h2 className="mt-3 text-3xl font-black">
                    {selectedClient.fullName}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-400">
                    Objective: {selectedClient.objective}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/5 px-4 py-3">
                  <div className="text-xs font-black uppercase text-slate-500">
                    Portfolio
                  </div>
                  <div className="text-2xl font-black">
                    {selectedClient.portfolioValue || "—"}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-black uppercase text-slate-500">
                    Risk
                  </div>
                  <div className="mt-2 font-black">{selectedClient.riskProfile}</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-black uppercase text-slate-500">
                    Liquidity
                  </div>
                  <div className="mt-2 font-black">
                    {selectedClient.liquidityNeeds}
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-black uppercase text-slate-500">
                    Horizon
                  </div>
                  <div className="mt-2 font-black">{selectedClient.timeHorizon}</div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-xl font-black">Portfolio Holdings</h3>

                <form onSubmit={addHolding} className="mt-4 grid gap-3 md:grid-cols-4">
                  <input
                    value={holdingForm.symbol}
                    onChange={(event) =>
                      setHoldingForm((current) => ({
                        ...current,
                        symbol: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Symbol"
                  />
                  <input
                    value={holdingForm.assetName}
                    onChange={(event) =>
                      setHoldingForm((current) => ({
                        ...current,
                        assetName: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Asset name"
                  />
                  <input
                    value={holdingForm.value}
                    onChange={(event) =>
                      setHoldingForm((current) => ({
                        ...current,
                        value: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Value"
                  />
                  <button className="rounded-2xl bg-emerald-600 px-4 py-3 font-black">
                    Add Holding
                  </button>
                </form>

                <div className="mt-4 space-y-3">
                  {selectedClient.holdings.length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm font-semibold text-slate-400">
                      No holdings added yet.
                    </div>
                  ) : (
                    selectedClient.holdings.map((holding) => (
                      <div
                        key={holding.id}
                        className="rounded-3xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-black">{holding.symbol}</div>
                            <div className="text-sm font-semibold text-slate-400">
                              {holding.assetName} · {holding.assetClass}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-black">{holding.value || "—"}</div>
                            <div className="text-xs font-bold text-slate-500">
                              Risk: {holding.riskLevel}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-xl font-black">Advisor Notes</h3>

                <form onSubmit={addNote} className="mt-4 space-y-3">
                  <input
                    value={noteForm.title}
                    onChange={(event) =>
                      setNoteForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Note title"
                  />
                  <textarea
                    value={noteForm.body}
                    onChange={(event) =>
                      setNoteForm((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Meeting note, client concern, strategy point..."
                  />
                  <button className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-black">
                    Save Note
                  </button>
                </form>

                <div className="mt-4 space-y-3">
                  {selectedClient.notesList.slice(0, 4).map((note) => (
                    <div
                      key={note.id}
                      className="rounded-3xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="font-black">{note.title}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {note.body}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-xl font-black">Meeting Tasks</h3>

                <form onSubmit={addTask} className="mt-4 space-y-3">
                  <input
                    value={taskForm.title}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Task title"
                  />
                  <input
                    value={taskForm.dueDate}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }))
                    }
                    type="date"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                  />
                  <button className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-black">
                    Add Task
                  </button>
                </form>

                <div className="mt-4 space-y-3">
                  {selectedClient.tasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="rounded-3xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black">{task.title}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-400">
                            {task.status} · {task.priority}
                          </div>
                        </div>

                        {task.status !== "Complete" ? (
                          <button
                            onClick={() => completeTask(task.id)}
                            className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-300 ring-1 ring-emerald-500/30"
                          >
                            Complete
                          </button>
                        ) : (
                          <Pill tone="green">Done</Pill>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-xl font-black">Suitability / Risk Review</h3>

                <div className="mt-4 grid gap-3">
                  <select
                    value={riskForm.concentrationLevel}
                    onChange={(event) =>
                      setRiskForm((current) => ({
                        ...current,
                        concentrationLevel: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                  >
                    <option>Low</option>
                    <option>Moderate</option>
                    <option>High</option>
                  </select>

                  <select
                    value={riskForm.altExposure}
                    onChange={(event) =>
                      setRiskForm((current) => ({
                        ...current,
                        altExposure: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                  >
                    <option>Low</option>
                    <option>Moderate</option>
                    <option>High</option>
                  </select>

                  <select
                    value={riskForm.debtConcern}
                    onChange={(event) =>
                      setRiskForm((current) => ({
                        ...current,
                        debtConcern: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                  >
                    <option>No</option>
                    <option>Yes</option>
                    <option>High</option>
                  </select>

                  <button
                    onClick={runRiskReview}
                    className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-4 py-3 font-black"
                  >
                    Run Risk Review
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {selectedClient.reviews.slice(0, 3).map((review) => (
                    <div
                      key={review.id}
                      className="rounded-3xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black">{review.suitabilityStatus}</div>
                        <Pill tone={review.score >= 75 ? "red" : "amber"}>
                          {review.score}/100
                        </Pill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {review.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}