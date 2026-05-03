"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
};

type InvestorGoal = {
  id: string;
  title: string;
  goalType: string;
  targetAmount: string | null;
  currentAmount: string | null;
  targetDate: string | null;
  priority: string;
  status: string;
  notes: string | null;
};

type ResearchNote = {
  id: string;
  ticker: string | null;
  title: string;
  thesis: string;
  risks: string | null;
  decision: string;
  conviction: string;
  sourceLinks: string | null;
};

type AlertEvent = {
  id: string;
  title: string;
  body: string;
  source: string;
  ticker: string | null;
  urgency: string;
  score: number;
  channel: string;
  status: string;
  createdAt: string;
};

type Insight = {
  title: string;
  category: string;
  score: number;
  summary: string;
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
  children: React.ReactNode;
  tone?: "red" | "green" | "amber" | "slate";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
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
          Investor Workspace
        </div>
      </div>
    </div>
  );
}

export default function InvestorPage() {
  const [user, setUser] = useState<User | null>(null);
  const [goals, setGoals] = useState<InvestorGoal[]>([]);
  const [research, setResearch] = useState<ResearchNote[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [message, setMessage] = useState("");

  const [goalForm, setGoalForm] = useState({
    title: "",
    goalType: "Wealth Growth",
    targetAmount: "",
    currentAmount: "",
    targetDate: "",
    priority: "Medium",
    notes: "",
  });

  const [researchForm, setResearchForm] = useState({
    ticker: "",
    title: "",
    thesis: "",
    risks: "",
    decision: "Watch",
    conviction: "Medium",
    sourceLinks: "",
  });

  const unreadAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === "Unread"),
    [alerts]
  );

  async function loadMe() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await response.json();

    if (data.user) {
      setUser(data.user);
      await loadEverything();
    }
  }

  async function loadEverything() {
    const [goalsResponse, researchResponse, alertsResponse, insightsResponse] =
      await Promise.all([
        fetch("/api/investor/goals", { cache: "no-store" }),
        fetch("/api/investor/research", { cache: "no-store" }),
        fetch("/api/investor/alerts", { cache: "no-store" }),
        fetch("/api/investor/insights", { cache: "no-store" }),
      ]);

    if (goalsResponse.ok) {
      const data = await goalsResponse.json();
      setGoals(data.goals ?? []);
    }

    if (researchResponse.ok) {
      const data = await researchResponse.json();
      setResearch(data.notes ?? []);
    }

    if (alertsResponse.ok) {
      const data = await alertsResponse.json();
      setAlerts(data.alerts ?? []);
    }

    if (insightsResponse.ok) {
      const data = await insightsResponse.json();
      setInsights(data.insights ?? []);
    }
  }

  useEffect(() => {
    void loadMe();
  }, []);

  async function addGoal(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/investor/goals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(goalForm),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not create goal.");
      return;
    }

    setGoalForm({
      title: "",
      goalType: "Wealth Growth",
      targetAmount: "",
      currentAmount: "",
      targetDate: "",
      priority: "Medium",
      notes: "",
    });

    await loadEverything();
  }

  async function completeGoal(goal: InvestorGoal) {
    await fetch(`/api/investor/goals/${goal.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: goal.status === "Complete" ? "Active" : "Complete",
      }),
    });

    await loadEverything();
  }

  async function deleteGoal(goalId: string) {
    await fetch(`/api/investor/goals/${goalId}`, {
      method: "DELETE",
    });

    await loadEverything();
  }

  async function addResearch(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/investor/research", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(researchForm),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not save research note.");
      return;
    }

    setResearchForm({
      ticker: "",
      title: "",
      thesis: "",
      risks: "",
      decision: "Watch",
      conviction: "Medium",
      sourceLinks: "",
    });

    await loadEverything();
  }

  async function deleteResearch(noteId: string) {
    await fetch(`/api/investor/research/${noteId}`, {
      method: "DELETE",
    });

    await loadEverything();
  }

  async function markAlertRead(alertId: string) {
    await fetch(`/api/investor/alerts/${alertId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "Read",
      }),
    });

    await loadEverything();
  }

  async function deleteAlert(alertId: string) {
    await fetch(`/api/investor/alerts/${alertId}`, {
      method: "DELETE",
    });

    await loadEverything();
  }

  async function runDemoScan() {
    setMessage("");

    const response = await fetch("/api/investor/run-scan", {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not run scan.");
      return;
    }

    setMessage(`Scan complete: ${data.matched} alert candidates saved.`);
    await loadEverything();
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col items-center justify-center text-center">
          <Logo />
          <h1 className="mt-8 text-5xl font-black tracking-tight">
            Sign in to open the investor workspace.
          </h1>
          <p className="mt-4 max-w-2xl text-slate-400">
            Register or log in through the functional portal first.
          </p>
          <a
            href="/portal"
            className="mt-8 rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-6 py-4 font-black text-white shadow-lg shadow-red-950/40"
          >
            Go to Login Portal
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <Logo />

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl bg-white/5 px-4 py-3">
              <div className="text-xs font-black uppercase text-slate-500">
                Investor
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
              className="rounded-2xl bg-red-600 px-4 py-3 font-black text-white"
            >
              Portal
            </a>

            <button
              onClick={runDemoScan}
              className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 font-black text-white"
            >
              Run Demo Scan
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
            <div className="text-sm font-bold text-slate-400">Goals</div>
            <div className="mt-1 text-4xl font-black">{goals.length}</div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Research Notes</div>
            <div className="mt-1 text-4xl font-black">{research.length}</div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Unread Alerts</div>
            <div className="mt-1 text-4xl font-black">{unreadAlerts.length}</div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Insights</div>
            <div className="mt-1 text-4xl font-black">{insights.length}</div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="p-6">
            <h2 className="text-2xl font-black">Investor Goals</h2>

            <form onSubmit={addGoal} className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                value={goalForm.title}
                onChange={(event) =>
                  setGoalForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2 md:col-span-2"
                placeholder="Goal title, e.g. Build $100k opportunity fund"
              />

              <select
                value={goalForm.goalType}
                onChange={(event) =>
                  setGoalForm((current) => ({
                    ...current,
                    goalType: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
              >
                <option>Wealth Growth</option>
                <option>Retirement</option>
                <option>Liquidity</option>
                <option>Home Purchase</option>
                <option>Alternative Allocation</option>
                <option>Education</option>
              </select>

              <select
                value={goalForm.priority}
                onChange={(event) =>
                  setGoalForm((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>

              <input
                value={goalForm.targetAmount}
                onChange={(event) =>
                  setGoalForm((current) => ({
                    ...current,
                    targetAmount: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Target amount"
              />

              <input
                value={goalForm.currentAmount}
                onChange={(event) =>
                  setGoalForm((current) => ({
                    ...current,
                    currentAmount: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Current amount"
              />

              <button className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 font-black text-white md:col-span-2">
                Add Goal
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {goals.map((goal) => (
                <div
                  key={goal.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-black">{goal.title}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-400">
                        {goal.goalType} · {goal.priority} priority
                      </div>
                      <div className="mt-2 text-sm text-slate-400">
                        {goal.currentAmount || "—"} / {goal.targetAmount || "—"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => completeGoal(goal)}
                        className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-300 ring-1 ring-emerald-500/30"
                      >
                        {goal.status === "Complete" ? "Reopen" : "Complete"}
                      </button>

                      <button
                        onClick={() => deleteGoal(goal.id)}
                        className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 ring-1 ring-red-500/30"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Research Notes</h2>

            <form onSubmit={addResearch} className="mt-5 grid gap-3">
              <input
                value={researchForm.ticker}
                onChange={(event) =>
                  setResearchForm((current) => ({
                    ...current,
                    ticker: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Ticker or theme, optional"
              />

              <input
                value={researchForm.title}
                onChange={(event) =>
                  setResearchForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Research title"
              />

              <textarea
                value={researchForm.thesis}
                onChange={(event) =>
                  setResearchForm((current) => ({
                    ...current,
                    thesis: event.target.value,
                  }))
                }
                className="min-h-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Investment thesis"
              />

              <textarea
                value={researchForm.risks}
                onChange={(event) =>
                  setResearchForm((current) => ({
                    ...current,
                    risks: event.target.value,
                  }))
                }
                className="min-h-20 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Risks"
              />

              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={researchForm.decision}
                  onChange={(event) =>
                    setResearchForm((current) => ({
                      ...current,
                      decision: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                >
                  <option>Watch</option>
                  <option>Research More</option>
                  <option>High Interest</option>
                  <option>Avoid</option>
                  <option>Review With Advisor</option>
                </select>

                <select
                  value={researchForm.conviction}
                  onChange={(event) =>
                    setResearchForm((current) => ({
                      ...current,
                      conviction: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>

              <button className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 font-black text-white">
                Save Research
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {research.slice(0, 6).map((note) => (
                <div
                  key={note.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-black">{note.title}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-400">
                        {note.ticker || "General"} · {note.decision} ·{" "}
                        {note.conviction}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {note.thesis}
                      </p>
                    </div>

                    <button
                      onClick={() => deleteResearch(note.id)}
                      className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 ring-1 ring-red-500/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black">Alert Inbox</h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  Saved alerts from Slice intelligence decisions.
                </p>
              </div>
              <Pill tone="red">{unreadAlerts.length} unread</Pill>
            </div>

            <div className="mt-5 space-y-3">
              {alerts.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm font-semibold text-slate-400">
                  No alerts yet. Click “Run Demo Scan” after adding watchlist
                  assets in the portal.
                </div>
              ) : (
                alerts.slice(0, 8).map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill
                            tone={
                              alert.urgency === "Critical"
                                ? "red"
                                : alert.urgency === "High"
                                  ? "amber"
                                  : "slate"
                            }
                          >
                            {alert.urgency}
                          </Pill>
                          <Pill tone={alert.status === "Unread" ? "red" : "green"}>
                            {alert.status}
                          </Pill>
                        </div>

                        <div className="mt-3 text-lg font-black">{alert.title}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {alert.body}
                        </p>
                        <div className="mt-2 text-xs font-bold text-slate-500">
                          {alert.source} · {alert.ticker || "General"} · score{" "}
                          {alert.score}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {alert.status === "Unread" ? (
                          <button
                            onClick={() => markAlertRead(alert.id)}
                            className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-300 ring-1 ring-emerald-500/30"
                          >
                            Mark Read
                          </button>
                        ) : null}

                        <button
                          onClick={() => deleteAlert(alert.id)}
                          className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 ring-1 ring-red-500/30"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Portfolio Health Insights</h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              Derived from goals, watchlist, research, alerts, crypto, and private
              venture tracking.
            </p>

            <div className="mt-5 space-y-3">
              {insights.map((insight) => (
                <div
                  key={insight.title}
                  className="rounded-3xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black">{insight.title}</div>
                      <div className="mt-1 text-xs font-bold uppercase text-red-300">
                        {insight.category}
                      </div>
                    </div>
                    <Pill
                      tone={
                        insight.score >= 75
                          ? "green"
                          : insight.score >= 50
                            ? "amber"
                            : "red"
                      }
                    >
                      {insight.score}/100
                    </Pill>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {insight.summary}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}