"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";

type Account = {
  id: string;
  name: string;
  accountType: string;
  custodian: string | null;
};

type Holding = {
  id: string;
  accountId: string | null;
  symbol: string;
  assetName: string;
  assetClass: string;
  valueNumber: number;
  costBasis: number | null;
  targetRole: string;
  riskLevel: string;
  thesis: string | null;
  account?: Account | null;
};

type Allocation = {
  assetClass: string;
  value: number;
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
  totalValue: number;
  currentAllocationsJson: string;
  targetAllocationsJson: string;
  driftJson: string;
  recommendationsJson: string;
  createdAt: string;
};

type ScenarioReport = {
  id: string;
  title: string;
  scenarioType: string;
  totalBefore: number;
  totalAfter: number;
  impactAmount: number;
  impactPct: number;
  summary: string;
  actionsJson: string;
  afterJson: string;
  createdAt: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function parseJsonList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
        "rounded-[2rem] border border-white/10 bg-zinc-950/70 shadow-xl shadow-red-950/20 backdrop-blur-xl",
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
  children: ReactNode;
  tone?: "red" | "green" | "amber" | "slate" | "purple";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
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
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
          Portfolio Lab
        </div>
      </div>
    </div>
  );
}

export default function PortfolioLabPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [models, setModels] = useState<AllocationModel[]>([]);
  const [rebalanceReports, setRebalanceReports] = useState<RebalanceReport[]>([]);
  const [scenarioReports, setScenarioReports] = useState<ScenarioReport[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [scenarioType, setScenarioType] = useState("Market Drawdown");
  const [message, setMessage] = useState("");

  const [accountForm, setAccountForm] = useState({
    name: "",
    accountType: "Taxable Brokerage",
    custodian: "",
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

  const latestRebalance = rebalanceReports[0];
  const latestScenario = scenarioReports[0];

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? models[0],
    [models, selectedModelId]
  );

  async function loadData() {
    const response = await fetch("/api/portfolio/lab", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    setAccounts(data.accounts ?? []);
    setHoldings(data.holdings ?? []);
    setAllocations(data.allocations ?? []);
    setModels(data.models ?? []);
    setRebalanceReports(data.rebalanceReports ?? []);
    setScenarioReports(data.scenarioReports ?? []);
    setTotalValue(data.totalValue ?? 0);

    if (!selectedModelId && data.models?.[0]) {
      setSelectedModelId(data.models[0].id);
      setTargetForm((current) => ({ ...current, modelId: data.models[0].id }));
    }

    if (!targetForm.modelId && data.models?.[0]) {
      setTargetForm((current) => ({ ...current, modelId: data.models[0].id }));
    }
  }

  async function postAction(body: Record<string, unknown>) {
    setMessage("");

    const response = await fetch("/api/portfolio/lab", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Portfolio Lab action failed.");
      return null;
    }

    await loadData();
    return data;
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault();

    const data = await postAction({
      action: "createAccount",
      ...accountForm,
    });

    if (data) {
      setAccountForm({
        name: "",
        accountType: "Taxable Brokerage",
        custodian: "",
        notes: "",
      });
      setMessage("Account created.");
    }
  }

  async function createHolding(event: FormEvent) {
    event.preventDefault();

    const data = await postAction({
      action: "createHolding",
      ...holdingForm,
    });

    if (data) {
      setHoldingForm({
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
      setMessage("Holding added.");
    }
  }

  async function createModel(event: FormEvent) {
    event.preventDefault();

    const data = await postAction({
      action: "createModel",
      ...modelForm,
    });

    if (data?.model?.id) {
      setSelectedModelId(data.model.id);
      setTargetForm((current) => ({ ...current, modelId: data.model.id }));
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

    const data = await postAction({
      action: "addTarget",
      ...targetForm,
      modelId: targetForm.modelId || selectedModel?.id,
    });

    if (data) {
      setTargetForm((current) => ({
        ...current,
        targetPct: "",
      }));
      setMessage("Target allocation saved.");
    }
  }

  async function deleteHolding(id: string) {
    await postAction({ action: "deleteHolding", id });
  }

  async function deleteTarget(id: string) {
    await postAction({ action: "deleteTarget", id });
  }

  async function runRebalance() {
    if (!selectedModel?.id) {
      setMessage("Select an allocation model first.");
      return;
    }

    const data = await postAction({
      action: "runRebalance",
      modelId: selectedModel.id,
    });

    if (data) {
      setMessage("Rebalance report generated.");
    }
  }

  async function runScenario() {
    const data = await postAction({
      action: "runScenario",
      scenarioType,
    });

    if (data) {
      setMessage("Scenario report generated.");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const rebalanceRecommendations = latestRebalance
    ? parseJsonList(latestRebalance.recommendationsJson)
    : [];

  const scenarioActions = latestScenario
    ? parseJsonList(latestScenario.actionsJson)
    : [];

  const scenarioAfter = latestScenario
    ? parseJsonList(latestScenario.afterJson)
    : [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <Logo />

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/"
              className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
            >
              Main App
            </a>

            <a
              href="/investor"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Investor
            </a>

            <a
              href="/briefings"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Briefings
            </a>

            <button
              onClick={runRebalance}
              className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 font-black text-white shadow-lg shadow-red-950/40"
            >
              Run Rebalance
            </button>
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        <section className="mt-6 grid gap-5 md:grid-cols-4">
          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Total Value</div>
            <div className="mt-1 text-4xl font-black">{money(totalValue)}</div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Holdings</div>
            <div className="mt-1 text-4xl font-black">{holdings.length}</div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Accounts</div>
            <div className="mt-1 text-4xl font-black">{accounts.length}</div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Models</div>
            <div className="mt-1 text-4xl font-black">{models.length}</div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-black">Add Account</h2>

              <form onSubmit={createAccount} className="mt-5 space-y-3">
                <input
                  value={accountForm.name}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                  placeholder="Account name"
                />

                <select
                  value={accountForm.accountType}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      accountType: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                >
                  <option>Taxable Brokerage</option>
                  <option>IRA</option>
                  <option>Roth IRA</option>
                  <option>401(k)</option>
                  <option>Trust</option>
                  <option>Crypto Wallet</option>
                  <option>Private Investments</option>
                </select>

                <input
                  value={accountForm.custodian}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      custodian: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                  placeholder="Custodian, optional"
                />

                <button className="w-full rounded-2xl bg-red-600 px-4 py-3 font-black">
                  Create Account
                </button>
              </form>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-black">Add Holding</h2>

              <form onSubmit={createHolding} className="mt-5 grid gap-3">
                <select
                  value={holdingForm.accountId}
                  onChange={(event) =>
                    setHoldingForm((current) => ({
                      ...current,
                      accountId: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                >
                  <option value="">No account selected</option>
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
                        symbol: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
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
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Asset name"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={holdingForm.assetClass}
                    onChange={(event) =>
                      setHoldingForm((current) => ({
                        ...current,
                        assetClass: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                  >
                    <option>Stock</option>
                    <option>ETF</option>
                    <option>Bond</option>
                    <option>Cash</option>
                    <option>Crypto</option>
                    <option>Private Venture</option>
                    <option>Real Estate</option>
                    <option>Other</option>
                  </select>

                  <input
                    value={holdingForm.valueNumber}
                    onChange={(event) =>
                      setHoldingForm((current) => ({
                        ...current,
                        valueNumber: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Current value"
                  />
                </div>

                <textarea
                  value={holdingForm.thesis}
                  onChange={(event) =>
                    setHoldingForm((current) => ({
                      ...current,
                      thesis: event.target.value,
                    }))
                  }
                  className="min-h-20 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                  placeholder="Holding thesis, optional"
                />

                <button className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 font-black text-white">
                  Add Holding
                </button>
              </form>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Current Holdings</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Manual holdings are used for allocation, scenario, and rebalance analysis.
            </p>

            <div className="mt-5 space-y-3">
              {holdings.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm font-semibold text-slate-400">
                  No holdings added yet.
                </div>
              ) : (
                holdings.map((holding) => (
                  <div
                    key={holding.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone="red">{holding.assetClass}</Pill>
                          <Pill tone="slate">{holding.targetRole}</Pill>
                        </div>

                        <div className="mt-3 text-xl font-black">
                          {holding.symbol}
                        </div>

                        <div className="text-sm font-semibold text-slate-400">
                          {holding.assetName} ·{" "}
                          {holding.account?.name ?? "No account"}
                        </div>

                        {holding.thesis ? (
                          <p className="mt-3 text-sm leading-6 text-slate-400">
                            {holding.thesis}
                          </p>
                        ) : null}
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-black">
                          {money(holding.valueNumber)}
                        </div>
                        <button
                          onClick={() => deleteHolding(holding.id)}
                          className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 ring-1 ring-red-500/30"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Card className="p-6">
            <h2 className="text-2xl font-black">Allocation Models</h2>

            <form onSubmit={createModel} className="mt-5 space-y-3">
              <input
                value={modelForm.name}
                onChange={(event) =>
                  setModelForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Model name"
              />

              <select
                value={modelForm.riskLevel}
                onChange={(event) =>
                  setModelForm((current) => ({
                    ...current,
                    riskLevel: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
              >
                <option>Conservative</option>
                <option>Balanced</option>
                <option>Growth</option>
                <option>Aggressive</option>
              </select>

              <button className="w-full rounded-2xl bg-red-600 px-4 py-3 font-black">
                Create Model
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    setSelectedModelId(model.id);
                    setTargetForm((current) => ({
                      ...current,
                      modelId: model.id,
                    }));
                  }}
                  className={cx(
                    "w-full rounded-3xl border p-4 text-left transition",
                    selectedModel?.id === model.id
                      ? "border-red-500/40 bg-red-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="font-black">{model.name}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-400">
                    {model.riskLevel} · {model.targets.length} targets
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-black">Target Allocation</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Selected model: {selectedModel?.name ?? "None"}
                </p>
              </div>

              <button
                onClick={runRebalance}
                className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 font-black text-white"
              >
                Run Rebalance
              </button>
            </div>

            <form onSubmit={addTarget} className="mt-5 grid gap-3 md:grid-cols-3">
              <select
                value={targetForm.assetClass}
                onChange={(event) =>
                  setTargetForm((current) => ({
                    ...current,
                    assetClass: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
              >
                <option>Stocks</option>
                <option>ETFs</option>
                <option>Bonds</option>
                <option>Cash</option>
                <option>Crypto</option>
                <option>Private Venture</option>
                <option>Real Estate</option>
                <option>Other</option>
              </select>

              <input
                value={targetForm.targetPct}
                onChange={(event) =>
                  setTargetForm((current) => ({
                    ...current,
                    targetPct: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Target %"
              />

              <button className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950">
                Save Target
              </button>
            </form>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-black">Current Allocation</h3>
                <div className="mt-3 space-y-3">
                  {allocations.length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                      No allocation yet.
                    </div>
                  ) : (
                    allocations.map((allocation) => (
                      <div
                        key={allocation.assetClass}
                        className="rounded-3xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex justify-between gap-3">
                          <div className="font-black">
                            {allocation.assetClass}
                          </div>
                          <div className="font-black">{allocation.pct}%</div>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-red-600 to-red-950"
                            style={{ width: `${Math.min(allocation.pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-black">Model Targets</h3>
                <div className="mt-3 space-y-3">
                  {selectedModel?.targets.length ? (
                    selectedModel.targets.map((target) => (
                      <div
                        key={target.id}
                        className="rounded-3xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-black">
                              {target.assetClass}
                            </div>
                            <div className="text-sm text-slate-400">
                              {target.targetPct}% target
                            </div>
                          </div>

                          <button
                            onClick={() => deleteTarget(target.id)}
                            className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 ring-1 ring-red-500/30"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                      No targets for this model.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <h2 className="text-2xl font-black">Latest Rebalance Report</h2>

            {latestRebalance ? (
              <div className="mt-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <Pill tone="red">{latestRebalance.title}</Pill>
                    <p className="mt-4 text-sm leading-7 text-slate-400">
                      {latestRebalance.summary}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-right">
                    <div className="text-xs font-black uppercase text-red-300">
                      Total
                    </div>
                    <div className="text-2xl font-black">
                      {money(latestRebalance.totalValue)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {rebalanceRecommendations.length ? (
                    rebalanceRecommendations.map((item, index) => (
                      <div
                        key={`${item.assetClass}-${index}`}
                        className="rounded-3xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-black">
                              {item.assetClass}: {item.action}
                            </div>
                            <p className="mt-1 text-sm text-slate-400">
                              {item.reason}
                            </p>
                          </div>

                          <Pill tone="amber">{money(item.amount)}</Pill>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                      No major drift recommendations.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
                No rebalance report yet.
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Scenario Analysis</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Run deterministic stress tests before external market assumptions are added.
            </p>

            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <select
                value={scenarioType}
                onChange={(event) => setScenarioType(event.target.value)}
                className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
              >
                <option>Market Drawdown</option>
                <option>Inflation Shock</option>
                <option>Rate Cut Rally</option>
                <option>Crypto Crash</option>
                <option>Venture Write-down</option>
              </select>

              <button
                onClick={runScenario}
                className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 font-black text-white"
              >
                Run Scenario
              </button>
            </div>

            {latestScenario ? (
              <div className="mt-5">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <Pill tone="red">{latestScenario.scenarioType}</Pill>
                      <p className="mt-4 text-sm leading-7 text-slate-400">
                        {latestScenario.summary}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-right">
                      <div className="text-xs font-black uppercase text-red-300">
                        Impact
                      </div>
                      <div className="text-2xl font-black">
                        {latestScenario.impactPct}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-black uppercase text-slate-500">
                      Before
                    </div>
                    <div className="mt-1 text-xl font-black">
                      {money(latestScenario.totalBefore)}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-black uppercase text-slate-500">
                      After
                    </div>
                    <div className="mt-1 text-xl font-black">
                      {money(latestScenario.totalAfter)}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-black uppercase text-slate-500">
                      Impact
                    </div>
                    <div className="mt-1 text-xl font-black">
                      {money(latestScenario.impactAmount)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {scenarioActions.map((action, index) => (
                    <div
                      key={`${String(action)}-${index}`}
                      className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-slate-300"
                    >
                      • {String(action)}
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {scenarioAfter.slice(0, 5).map((item, index) => (
                    <div
                      key={`${item.symbol}-${index}`}
                      className="rounded-2xl border border-white/10 bg-black/30 p-3"
                    >
                      <div className="flex justify-between gap-3">
                        <div className="font-black">{item.symbol}</div>
                        <div className="text-sm font-bold text-red-300">
                          {money(item.impact)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Shock: {item.shockPct}% · After:{" "}
                        {money(item.afterValue)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
                No scenario report yet.
              </div>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}