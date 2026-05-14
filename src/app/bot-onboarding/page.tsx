"use client";

import { useEffect, useMemo, useState } from "react";
import { PERSONAL_BOT_QUESTIONS, defaultBotAnswers } from "@/lib/personal-bot-questions";

type Question = (typeof PERSONAL_BOT_QUESTIONS)[number];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function BotOnboardingPage() {
  const [botName, setBotName] = useState("Slice Bot");
  const [answers, setAnswers] = useState<Record<string, string>>(defaultBotAnswers());
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const question = PERSONAL_BOT_QUESTIONS[index] as Question;
  const progress = Math.round(((index + 1) / PERSONAL_BOT_QUESTIONS.length) * 100);
  const currentAnswer = answers[question.id] ?? "";

  const groupedCount = useMemo(() => {
    return PERSONAL_BOT_QUESTIONS.reduce<Record<string, number>>((counts, item) => {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
      return counts;
    }, {});
  }, []);

  function setAnswer(value: string) {
    setAnswers((current) => ({
      ...current,
      [question.id]: value,
    }));
  }

  async function saveOnboarding() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/personal-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "saveOnboarding",
          botName,
          answers,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(payload.error ?? "Could not save bot setup.");
        return;
      }

      window.location.href = "/workspace/personal-bot";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save bot setup.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    async function loadExisting() {
      const response = await fetch("/api/personal-bot", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const payload = await response.json();

      if (payload.profile?.botName) {
        setBotName(payload.profile.botName);
      }

      if (payload.profile?.answers) {
        setAnswers({
          ...defaultBotAnswers(),
          ...payload.profile.answers,
        });
      }
    }

    void loadExisting();
  }, []);

  return (
    <main className="min-h-screen bg-[#050505] p-5 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-12%] top-[-10%] h-[32rem] w-[32rem] rounded-full bg-red-700/24 blur-3xl" />
        <div className="absolute right-[-12%] top-[14%] h-[34rem] w-[34rem] rounded-full bg-purple-700/12 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Personal bot setup
              </div>
              <h1 className="mt-2 text-3xl font-black md:text-5xl">
                Build your individualized Slice bot.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                Answer 20 questions so your bot understands your personality,
                investment risk style, communication preferences, workflow habits,
                and automation comfort.
              </p>
            </div>

            <a
              href="/workspace"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-white"
            >
              Workspace
            </a>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.76fr_1.24fr]">
          <aside className="grid gap-4">
            <div className="rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-red-950/20">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                Bot name
              </div>
              <input
                value={botName}
                onChange={(event) => setBotName(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                placeholder="Name your bot"
              />
              <p className="mt-3 text-sm leading-6 text-slate-400">
                You can rename this later by typing a command like:
                <span className="font-black text-white"> rename yourself Atlas</span>.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-red-950/20">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Progress
                </div>
                <div className="text-sm font-black text-white">{progress}%</div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-400"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="mt-5 grid gap-2">
                {Object.entries(groupedCount).map(([category, count]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2"
                  >
                    <span className="text-xs font-bold text-slate-300">{category}</span>
                    <span className="text-xs font-black text-red-300">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-2xl shadow-red-950/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-red-300 ring-1 ring-red-500/30">
                Question {index + 1} of {PERSONAL_BOT_QUESTIONS.length}
              </div>
              <div className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-purple-300 ring-1 ring-purple-500/30">
                {question.category}
              </div>
            </div>

            <h2 className="mt-6 text-3xl font-black tracking-tight md:text-4xl">
              {question.prompt}
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-400">
              {question.helper}
            </p>

            <div className="mt-7 grid gap-3">
              {question.type === "scale"
                ? [1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={`${question.id}-${value}`}
                      onClick={() => setAnswer(String(value))}
                      className={cx(
                        "rounded-2xl border px-4 py-4 text-left text-sm font-black transition",
                        currentAnswer === String(value)
                          ? "border-red-400/40 bg-red-500/20 text-white"
                          : "border-white/10 bg-white/[0.055] text-slate-300 hover:bg-white/[0.08]"
                      )}
                    >
                      {value} / 5
                    </button>
                  ))
                : question.options?.map((option, optionIndex) => (
                    <button
                      key={`${question.id}-${optionIndex}-${option}`}
                      onClick={() => setAnswer(option)}
                      className={cx(
                        "rounded-2xl border px-4 py-4 text-left text-sm font-black transition",
                        currentAnswer === option
                          ? "border-red-400/40 bg-red-500/20 text-white"
                          : "border-white/10 bg-white/[0.055] text-slate-300 hover:bg-white/[0.08]"
                      )}
                    >
                      {option}
                    </button>
                  ))}
            </div>

            {message ? (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                {message}
              </div>
            ) : null}

            <div className="mt-7 flex flex-wrap justify-between gap-3">
              <button
                onClick={() => setIndex((current) => Math.max(0, current - 1))}
                disabled={index === 0}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white disabled:opacity-40"
              >
                Back
              </button>

              {index < PERSONAL_BOT_QUESTIONS.length - 1 ? (
                <button
                  onClick={() =>
                    setIndex((current) =>
                      Math.min(PERSONAL_BOT_QUESTIONS.length - 1, current + 1)
                    )
                  }
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={saveOnboarding}
                  disabled={saving}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Finish Bot Setup"}
                </button>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}