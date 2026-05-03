"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Preference = {
  id: string;
  channel: string;
  enabled: boolean;
  minUrgency: string;
  minScore: number;
  digestOnly: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  cooldownMinutes: number;
};

type Delivery = {
  id: string;
  channel: string;
  status: string;
  urgency: string;
  score: number;
  title: string;
  body: string;
  reason: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

type Digest = {
  id: string;
  title: string;
  summary: string;
  itemCount: number;
  urgencyMixJson: string;
  itemsJson: string;
  status: string;
  createdAt: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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
          Notification Center
        </div>
      </div>
    </div>
  );
}

function deliveryTone(status: string): "red" | "green" | "amber" | "slate" {
  if (status === "Delivered") return "green";
  if (status === "Queued") return "amber";
  if (status === "Suppressed") return "slate";
  return "red";
}

function urgencyTone(urgency: string): "red" | "green" | "amber" | "slate" {
  if (urgency === "Critical") return "red";
  if (urgency === "High") return "amber";
  if (urgency === "Medium") return "green";
  return "slate";
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export default function NotificationsPage() {
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const stats = useMemo(() => {
    return {
      delivered: deliveries.filter((item) => item.status === "Delivered").length,
      queued: deliveries.filter((item) => item.status === "Queued").length,
      suppressed: deliveries.filter((item) => item.status === "Suppressed").length,
      digests: digests.length,
    };
  }, [deliveries, digests]);

  async function loadData() {
    const response = await fetch("/api/notifications", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    setPreferences(data.preferences ?? []);
    setDeliveries(data.deliveries ?? []);
    setDigests(data.digests ?? []);
  }

  async function runAction(action: "queue" | "process" | "digest") {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Notification action failed.");
        return;
      }

      setMessage(`${action} complete: ${JSON.stringify(data.result)}`);
      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Notification action failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function updatePreference(
    preference: Preference,
    patch: Partial<Preference>
  ) {
    setMessage("");

    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: preference.channel,
        ...patch,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not update preference.");
      return;
    }

    await loadData();
  }

  useEffect(() => {
    void loadData();
  }, []);

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
              href="/triage"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Triage
            </a>

            <a
              href="/investor"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Investor
            </a>

            <button
              onClick={() => runAction("queue")}
              disabled={loading}
              className="rounded-2xl bg-red-500/10 px-4 py-3 font-black text-red-300 ring-1 ring-red-500/30 disabled:opacity-60"
            >
              Queue Alerts
            </button>

            <button
              onClick={() => runAction("process")}
              disabled={loading}
              className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
            >
              Process Queue
            </button>

            <button
              onClick={() => runAction("digest")}
              disabled={loading}
              className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950 disabled:opacity-60"
            >
              Generate Digest
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
            <div className="text-sm font-bold text-slate-400">Delivered</div>
            <div className="mt-1 text-4xl font-black">{stats.delivered}</div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Queued</div>
            <div className="mt-1 text-4xl font-black">{stats.queued}</div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Suppressed</div>
            <div className="mt-1 text-4xl font-black">{stats.suppressed}</div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Digests</div>
            <div className="mt-1 text-4xl font-black">{stats.digests}</div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-black">Notification Preferences</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                These settings decide which alerts go to dashboard, email, SMS,
                push, or digest. External providers will connect later.
              </p>

              <div className="mt-5 space-y-4">
                {preferences.map((preference) => (
                  <div
                    key={preference.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={preference.enabled ? "green" : "slate"}>
                            {preference.enabled ? "Enabled" : "Disabled"}
                          </Pill>
                          {preference.digestOnly ? (
                            <Pill tone="purple">Digest only</Pill>
                          ) : null}
                        </div>

                        <h3 className="mt-3 text-xl font-black">
                          {preference.channel}
                        </h3>

                        <p className="mt-2 text-sm font-semibold text-slate-400">
                          Minimum urgency: {preference.minUrgency} · minimum
                          score: {preference.minScore} · cooldown:{" "}
                          {preference.cooldownMinutes} min
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          updatePreference(preference, {
                            enabled: !preference.enabled,
                          })
                        }
                        className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
                      >
                        {preference.enabled ? "Disable" : "Enable"}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <label>
                        <span className="text-xs font-black uppercase text-slate-500">
                          Min Score
                        </span>
                        <input
                          type="number"
                          value={preference.minScore}
                          onChange={(event) =>
                            updatePreference(preference, {
                              minScore: Number(event.target.value),
                            })
                          }
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                        />
                      </label>

                      <label>
                        <span className="text-xs font-black uppercase text-slate-500">
                          Min Urgency
                        </span>
                        <select
                          value={preference.minUrgency}
                          onChange={(event) =>
                            updatePreference(preference, {
                              minUrgency: event.target.value,
                            })
                          }
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                        >
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                          <option>Critical</option>
                        </select>
                      </label>

                      <label>
                        <span className="text-xs font-black uppercase text-slate-500">
                          Cooldown Minutes
                        </span>
                        <input
                          type="number"
                          value={preference.cooldownMinutes}
                          onChange={(event) =>
                            updatePreference(preference, {
                              cooldownMinutes: Number(event.target.value),
                            })
                          }
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-black">Digest Reports</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Digests summarize noteworthy items without triggering immediate
                SMS or email noise.
              </p>

              <div className="mt-5 space-y-4">
                {digests.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                    No digest reports yet.
                  </div>
                ) : (
                  digests.map((digest) => {
                    const items = parseJson(digest.itemsJson) as
                      | Array<{
                          title: string;
                          source: string;
                          ticker: string | null;
                          urgency: string;
                          score: number;
                        }>
                      | null;

                    return (
                      <div
                        key={digest.id}
                        className="rounded-3xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black">{digest.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {digest.summary}
                            </p>
                          </div>

                          <Pill tone="amber">{digest.itemCount} items</Pill>
                        </div>

                        {items?.length ? (
                          <div className="mt-4 space-y-2">
                            {items.slice(0, 5).map((item) => (
                              <div
                                key={`${item.title}-${item.score}`}
                                className="rounded-2xl border border-white/10 bg-black/30 p-3"
                              >
                                <div className="text-sm font-black">
                                  {item.title}
                                </div>
                                <div className="mt-1 text-xs font-semibold text-slate-500">
                                  {item.source} · {item.ticker ?? "General"} ·{" "}
                                  {item.urgency} · score {item.score}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Delivery Queue</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              This is the audit trail of what Slice would deliver, queue, or
              suppress. Real email/SMS providers connect in a later phase.
            </p>

            <div className="mt-5 space-y-4">
              {deliveries.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm font-semibold text-slate-400">
                  No notification deliveries yet. Run triage, then queue alerts.
                </div>
              ) : (
                deliveries.map((delivery) => (
                  <article
                    key={delivery.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={deliveryTone(delivery.status)}>
                            {delivery.status}
                          </Pill>
                          <Pill tone={urgencyTone(delivery.urgency)}>
                            {delivery.urgency}
                          </Pill>
                          <Pill tone="slate">{delivery.channel}</Pill>
                        </div>

                        <h3 className="mt-4 text-xl font-black">
                          {delivery.title}
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {delivery.body}
                        </p>

                        {delivery.reason ? (
                          <p className="mt-3 text-xs font-bold text-slate-500">
                            Reason: {delivery.reason}
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
                        <div className="text-xs font-black uppercase text-red-300">
                          Score
                        </div>
                        <div className="text-3xl font-black">
                          {delivery.score}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-xs font-black uppercase text-slate-500">
                          Created
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-300">
                          {new Date(delivery.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-xs font-black uppercase text-slate-500">
                          Delivered
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-300">
                          {delivery.deliveredAt
                            ? new Date(delivery.deliveredAt).toLocaleString()
                            : "Not delivered"}
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}