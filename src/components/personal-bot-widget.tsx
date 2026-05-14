"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type BotProfile = {
  id: string;
  botName: string;
  onboardingComplete: boolean;
  preferredTone: string;
  voiceEnabled: boolean;
};

type BotMessage = {
  id: string;
  role: string;
  content: string;
  intent: string;
  metadata?: {
    clientAction?: {
      type?: string;
      href?: string;
      autoRun?: boolean;
    };
  };
};

type BotPayload = {
  profile: BotProfile;
  requiresOnboarding: boolean;
  messages: BotMessage[];
  pdfReports?: Array<{
    id: string;
    title: string;
    downloadUrl: string;
  }>;
};

type SpeechRecognitionResultLike = {
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getLatestAssistantMessage(payload: BotPayload | null) {
  return [...(payload?.messages ?? [])]
    .reverse()
    .find((item) => item.role === "assistant");
}

function HumanRobotAvatar({
  listening,
  size = "large",
}: {
  listening: boolean;
  size?: "small" | "large";
}) {
  const isLarge = size === "large";
  const shellSize = isLarge ? "h-20 w-20" : "h-14 w-14";
  const headSize = isLarge ? "h-16 w-16" : "h-11 w-11";
  const faceSize = isLarge ? "h-12 w-13" : "h-8 w-9";

  return (
    <div className={cx("relative flex shrink-0 items-center justify-center", shellSize)}>
      {listening ? (
        <>
          <span className="absolute inset-0 rounded-full bg-cyan-300/20 blur-lg" />
          <span className="absolute inset-0 animate-ping rounded-full border border-cyan-300/45" />
        </>
      ) : (
        <span className="absolute inset-0 rounded-full bg-red-500/14 blur-lg" />
      )}

      <div
        className={cx(
          "relative flex items-center justify-center rounded-full border shadow-2xl transition",
          listening
            ? "border-cyan-300/55 bg-gradient-to-br from-cyan-300/16 via-slate-900 to-black shadow-cyan-950/40"
            : "border-white/15 bg-gradient-to-br from-slate-600 via-zinc-950 to-black shadow-red-950/45",
          shellSize
        )}
      >
        <div className="absolute inset-x-3 top-2 h-6 rounded-full bg-white/12 blur-sm" />
        <div className="absolute -left-5 top-2 h-16 w-10 rotate-12 bg-white/10 blur-xl" />

        {/* soft humanoid head */}
        <div
          className={cx(
            "relative overflow-hidden rounded-full border border-white/25 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-500 shadow-inner",
            headSize
          )}
        >
          {/* subtle hairline / helmet cap */}
          <div
            className={cx(
              "absolute inset-x-2 top-1 rounded-t-full bg-gradient-to-b from-slate-800 to-slate-700",
              isLarge ? "h-5" : "h-3.5"
            )}
          />

          {/* side temple panels */}
          <div
            className={cx(
              "absolute rounded-full bg-slate-700/80",
              isLarge ? "left-1 top-7 h-5 w-2" : "left-0.5 top-5 h-3.5 w-1.5"
            )}
          />
          <div
            className={cx(
              "absolute rounded-full bg-slate-700/80",
              isLarge ? "right-1 top-7 h-5 w-2" : "right-0.5 top-5 h-3.5 w-1.5"
            )}
          />

          {/* face area */}
          <div
            className={cx(
              "absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-white/35 bg-gradient-to-br from-white via-slate-100 to-slate-300 shadow-inner",
              faceSize
            )}
          >
            {/* brows / visor shine */}
            <div className="absolute inset-x-3 top-1.5 h-1.5 rounded-full bg-white/70" />

            {/* eyes */}
            <div
              className={cx(
                "absolute rounded-full",
                listening
                  ? "bg-cyan-400 shadow-[0_0_12px] shadow-cyan-300/80"
                  : "bg-slate-950 shadow-[0_0_8px] shadow-slate-900/30",
                isLarge ? "left-3 top-5 h-2.5 w-2.5" : "left-2 top-3.5 h-2 w-2"
              )}
            />
            <div
              className={cx(
                "absolute rounded-full",
                listening
                  ? "bg-cyan-400 shadow-[0_0_12px] shadow-cyan-300/80"
                  : "bg-slate-950 shadow-[0_0_8px] shadow-slate-900/30",
                isLarge ? "right-3 top-5 h-2.5 w-2.5" : "right-2 top-3.5 h-2 w-2"
              )}
            />

            {/* eye highlights */}
            <div
              className={cx(
                "absolute rounded-full bg-white",
                isLarge ? "left-[19px] top-[21px] h-1 w-1" : "left-[13px] top-[15px] h-0.5 w-0.5"
              )}
            />
            <div
              className={cx(
                "absolute rounded-full bg-white",
                isLarge ? "right-[13px] top-[21px] h-1 w-1" : "right-[9px] top-[15px] h-0.5 w-0.5"
              )}
            />

            {/* friendly mouth */}
            <div
              className={cx(
                "absolute left-1/2 -translate-x-1/2 rounded-b-full border-b-2 border-slate-950/70",
                isLarge ? "bottom-3 h-2.5 w-7" : "bottom-2 h-2 w-5"
              )}
            />

            {/* cheeks */}
            <div
              className={cx(
                "absolute rounded-full bg-red-300/60",
                isLarge ? "bottom-3.5 left-2 h-2 w-2" : "bottom-2.5 left-1.5 h-1.5 w-1.5"
              )}
            />
            <div
              className={cx(
                "absolute rounded-full bg-red-300/60",
                isLarge ? "bottom-3.5 right-2 h-2 w-2" : "bottom-2.5 right-1.5 h-1.5 w-1.5"
              )}
            />
          </div>

          {/* neck / base */}
          <div
            className={cx(
              "absolute left-1/2 -translate-x-1/2 rounded-full bg-slate-700/70",
              isLarge ? "bottom-0 h-2 w-7" : "bottom-0 h-1.5 w-5"
            )}
          />
        </div>

        <div
          className={cx(
            "absolute rounded-full border border-white/10 bg-black/85 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-lg",
            isLarge ? "-bottom-3" : "-bottom-2"
          )}
        >
          {listening ? "Listening" : "Speak"}
        </div>
      </div>
    </div>
  );
}

export default function PersonalBotWidget() {
  const [enabled, setEnabled] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [bot, setBot] = useState<BotPayload | null>(null);
  const [prompt, setPrompt] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);

  const latestAssistantMessage = useMemo(() => getLatestAssistantMessage(bot), [bot]);
  const latestPdf = bot?.pdfReports?.[0];

  function handleClientAction(payload: BotPayload) {
    const latest = getLatestAssistantMessage(payload);
    const action = latest?.metadata?.clientAction;

    if (!action) return;

    if (action.type === "theme") {
      window.dispatchEvent(new Event("slice-theme-updated"));
    }

    if (action.href && action.autoRun) {
      window.location.href = action.href;
    }
  }

  async function loadBot() {
    try {
      const response = await fetch("/api/personal-bot", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setEnabled(false);
        return;
      }

      const payload = await response.json();

      if (!response.ok) {
        setEnabled(false);
        return;
      }

      setEnabled(true);
      setBot(payload);

      const path = window.location.pathname;
      const exempt =
        path.startsWith("/bot-onboarding") ||
        path.startsWith("/founder-login") ||
        path.startsWith("/portal");

      if (payload.requiresOnboarding && !exempt) {
        window.location.href = "/bot-onboarding";
      }
    } catch {
      setEnabled(false);
    }
  }

  async function sendPromptText(text: string) {
    const clean = text.trim();

    if (!clean) return;

    setSending(true);
    setMessage("");
    setPanelOpen(true);

    try {
      const response = await fetch("/api/personal-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "sendMessage",
          prompt: clean,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Bot command failed.");
        return;
      }

      setBot(payload);
      setPrompt("");
      handleClientAction(payload);
      window.dispatchEvent(new Event("slice-theme-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bot command failed.");
    } finally {
      setSending(false);
    }
  }

  async function sendPrompt(event?: FormEvent) {
    event?.preventDefault();
    await sendPromptText(prompt);
  }

  function startVoiceCommand() {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setPanelOpen(true);
      setMessage("Voice commands are not supported in this browser. Type the command instead.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setPrompt(transcript);
      setListening(false);
      void sendPromptText(transcript);
    };

    recognition.onerror = () => {
      setListening(false);
      setPanelOpen(true);
      setMessage("Voice command failed. Try typing the command instead.");
    };

    recognition.onend = () => {
      setListening(false);
    };

    setPanelOpen(true);
    setListening(true);
    recognition.start();
  }

  useEffect(() => {
    void loadBot();
  }, []);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999]">
      {panelOpen ? (
        <div className="w-[min(460px,calc(100vw-2.5rem))] overflow-hidden rounded-[1.9rem] border border-white/10 bg-zinc-950/95 shadow-2xl shadow-red-950/50 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-white/[0.06] to-transparent p-4">
            <button
              onClick={startVoiceCommand}
              className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500"
              title="Tap to speak"
            >
              <HumanRobotAvatar listening={listening} size="small" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-white">
                {bot?.profile.botName ?? "Slice Bot"}
              </div>
              <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                {listening ? "Listening now" : "Human-like command assistant"}
              </div>
            </div>

            <button
              onClick={() => setPanelOpen(false)}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:bg-white/10"
            >
              Collapse
            </button>
          </div>

          <div className="max-h-[390px] space-y-3 overflow-y-auto p-4">
            {bot?.requiresOnboarding ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                Your bot is not personalized yet. Finish the 20-question setup to unlock the individualized bot.
                <a
                  href="/bot-onboarding"
                  className="mt-3 block rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950"
                >
                  Start Bot Setup
                </a>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm leading-6 text-slate-300">
              {latestAssistantMessage?.content ??
                "Tap the assistant and say: direct me to triage, create a task, send an email to investors holding NVDA, change my color scheme to blue, or create a premium PDF report."}
            </div>

            {latestAssistantMessage?.metadata?.clientAction?.href &&
            !latestAssistantMessage.metadata.clientAction.autoRun ? (
              <a
                href={latestAssistantMessage.metadata.clientAction.href}
                className="block rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950"
              >
                Open Result
              </a>
            ) : null}

            {latestPdf ? (
              <a
                href={latestPdf.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm font-black text-red-100"
              >
                Download Latest PDF Report
              </a>
            ) : null}

            {message ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-100">
                {message}
              </div>
            ) : null}
          </div>

          <form onSubmit={sendPrompt} className="border-t border-white/10 p-4">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              placeholder="Tell your assistant what to do..."
            />

            <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
              <a
                href="/workspace/personal-bot"
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center text-xs font-black text-white hover:bg-white/10"
              >
                Full Bot Tab
              </a>

              <button
                type="button"
                onClick={startVoiceCommand}
                disabled={listening || !bot?.profile.voiceEnabled}
                className={cx(
                  "rounded-2xl px-3 py-3 text-xs font-black",
                  listening
                    ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/30"
                    : "bg-white/5 text-white ring-1 ring-white/10 hover:bg-white/10"
                )}
              >
                {listening ? "Listening" : "Voice"}
              </button>

              <button
                disabled={sending || !prompt.trim()}
                className="rounded-2xl bg-red-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <button
            onClick={startVoiceCommand}
            className="rounded-full transition hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500"
            title="Tap assistant to speak"
          >
            <HumanRobotAvatar listening={listening} size="large" />
          </button>

          <button
            onClick={() => setPanelOpen(true)}
            className="mb-1 rounded-2xl border border-white/10 bg-zinc-950/90 px-3 py-2 text-xs font-black text-white shadow-xl shadow-red-950/30 hover:bg-white/10"
          >
            Chat
          </button>
        </div>
      )}
    </div>
  );
}