"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type BotMessage = {
  id: string;
  role: string;
  content: string;
  intent: string;
  createdAt: string;
  metadata?: {
    clientAction?: {
      type?: string;
      href?: string;
      autoRun?: boolean;
    };
    structuredCommand?: Record<string, unknown>;
    aiParserOk?: boolean;
    aiParserError?: string;
    spokenAccent?: string;
    universalAiProvider?: string;
    universalAiStatus?: string;
  };
};

type BotCommand = {
  id: string;
  commandText: string;
  commandType: string;
  status: string;
  resultSummary: string | null;
  createdAt: string;
  action?: Record<string, unknown>;
};

type BotPayload = {
  profile: {
    id: string;
    botName: string;
    onboardingComplete: boolean;
    preferredTone: string;
    commandStyle: string;
    autonomyLevel: string;
    voiceEnabled: boolean;
    customInstructions: string | null;
    personality: Record<string, unknown>;
    risk: Record<string, unknown>;
    capabilities: string[];
    spokenAccent?: string;
    speechLanguage?: string;
  };
  aiEngine?: {
    provider: string;
    configured: boolean;
    model: string;
    structuredCommands: boolean;
    universalAnswers?: boolean;
    approvalGates: boolean;
    platformBrain?: boolean;
    voiceLearning?: boolean;
    webSearchEnabled?: boolean;
    spokenAccent?: string;
    speechLanguage?: string;
  };
  messages: BotMessage[];
  commands: BotCommand[];
  tabs: Array<{
    id: string;
    tabName: string;
    notes: string | null;
    pinnedCommands: string[];
    status: string;
  }>;
  pdfReports?: Array<{
    id: string;
    title: string;
    reportType: string;
    status: string;
    downloadUrl: string;
  }>;
  memories?: Array<{
    id: string;
    memoryType: string;
    title: string;
    value: string;
    confidenceScore: number;
    status: string;
  }>;
  approvals?: Array<{
    id: string;
    title: string;
    actionType: string;
    riskLevel: string;
    summary: string;
    status: string;
  }>;
  backendApprovals?: Array<{
    id: string;
    title: string;
    actionType: string;
    riskLevel: string;
    summary: string;
    status: string;
  }>;
  platformMap?: Array<{
    id: string;
    label: string;
    route: string;
    category: string;
    aliases: string[];
    capabilities: string[];
    examplePrompts: string[];
    status: string;
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

const MAX_REQUESTS = 5;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function byNewest<T extends { createdAt?: string }>(items: T[] = []) {
  return [...items].sort((a, b) => {
    const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    return right - left;
  });
}

function limitBotPayload(payload: BotPayload): BotPayload {
  return {
    ...payload,
    messages: byNewest(payload.messages).slice(0, MAX_REQUESTS),
    commands: byNewest(payload.commands).slice(0, MAX_REQUESTS),
    pdfReports: payload.pdfReports?.slice(0, MAX_REQUESTS),
    memories: payload.memories?.slice(0, MAX_REQUESTS),
    approvals: payload.approvals?.slice(0, MAX_REQUESTS),
    backendApprovals: payload.backendApprovals?.slice(0, MAX_REQUESTS),
    platformMap: payload.platformMap?.slice(0, 12),
  };
}

function toneFor(value: string): "red" | "green" | "amber" | "purple" | "cyan" | "slate" {
  const lower = value.toLowerCase();

  if (lower.includes("failed") || lower.includes("critical") || lower.includes("high")) return "red";
  if (lower.includes("complete") || lower.includes("active") || lower.includes("ready") || lower.includes("configured")) return "green";
  if (lower.includes("open") || lower.includes("queued") || lower.includes("draft") || lower.includes("pending")) return "amber";
  if (lower.includes("ai") || lower.includes("bot") || lower.includes("research")) return "purple";
  if (lower.includes("voice") || lower.includes("backend") || lower.includes("tool")) return "cyan";

  return "slate";
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "red" | "green" | "amber" | "purple" | "cyan" | "slate";
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
    <span className={cx("inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1", tones[tone])}>
      {children}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-[1.75rem] border border-white/10 bg-zinc-950/82 p-5 shadow-xl shadow-red-950/20 backdrop-blur-xl", className)}>
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
  tone?: "red" | "green" | "amber" | "purple" | "cyan" | "slate";
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
    <div className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getBritishVoice(voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((voice) => voice.lang?.toLowerCase() === "en-gb") ??
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("en-gb")) ??
    voices.find((voice) => /british|united kingdom|uk english|english \(uk\)/i.test(voice.name)) ??
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("en")) ??
    null
  );
}

function stripForSpeech(text: string) {
  return text
    .replace(/https?:\/\/\S+/g, "source link available in the chat")
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1600);
}

export default function WorkspacePersonalBotPage() {
  const [data, setData] = useState<BotPayload | null>(null);
  const [prompt, setPrompt] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakResponses, setSpeakResponses] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const [profileForm, setProfileForm] = useState({
    botName: "",
    preferredTone: "Professional",
    commandStyle: "Balanced detail",
    autonomyLevel: "Advisor approval required",
    customInstructions: "",
    voiceEnabled: true,
  });

  async function loadBot() {
    const response = await fetch("/api/personal-bot", {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Could not load personal bot.");
      return;
    }

    const limited = limitBotPayload(payload);
    setData(limited);

    setProfileForm({
      botName: limited.profile.botName,
      preferredTone: limited.profile.preferredTone,
      commandStyle: limited.profile.commandStyle,
      autonomyLevel: limited.profile.autonomyLevel,
      customInstructions: limited.profile.customInstructions ?? "",
      voiceEnabled: limited.profile.voiceEnabled,
    });
  }

  const latestAssistant = useMemo(
    () => data?.messages.find((item) => item.role === "assistant"),
    [data]
  );

  const pendingApprovals = useMemo(
    () => [
      ...(data?.approvals?.filter((item) => item.status === "Pending") ?? []),
      ...(data?.backendApprovals?.filter((item) => item.status === "Pending") ?? []),
    ].slice(0, MAX_REQUESTS),
    [data]
  );

  function speak(text: string, force = false) {
    if (!force && !speakResponses) return;
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;

    const clean = stripForSpeech(text);

    if (!clean) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = getBritishVoice(voices);

    utterance.lang = "en-GB";
    utterance.rate = 0.96;
    utterance.pitch = 1.02;
    utterance.volume = 1;

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function runClientAction(clientAction?: { type?: string; href?: string; autoRun?: boolean }) {
    if (!clientAction) return;

    if (clientAction.type === "theme") {
      window.dispatchEvent(new Event("slice-theme-updated"));
    }

    if (clientAction.href && clientAction.autoRun) {
      window.location.href = clientAction.href;
    }
  }

  function handleClientAction(payload: BotPayload) {
    const limited = limitBotPayload(payload);
    const assistant = limited.messages.find((item) => item.role === "assistant");

    if (assistant?.content) {
      speak(assistant.content);
    }

    runClientAction(assistant?.metadata?.clientAction);
  }

  async function sendCommand(event?: FormEvent, overridePrompt?: string, voiceTranscript?: string) {
    event?.preventDefault();

    const commandText = (overridePrompt ?? prompt).trim();

    if (!commandText) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/personal-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "sendMessage",
          prompt: commandText,
          voiceTranscript,
          currentPath: window.location.pathname + window.location.search,
          pageTitle: document.title,
          preferredSpeechLanguage: "en-GB",
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Command failed.");
        return;
      }

      const limited = limitBotPayload(payload);
      setData(limited);
      setPrompt("");
      handleClientAction(limited);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Command failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/personal-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "updateProfile",
          ...profileForm,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Profile update failed.");
        return;
      }

      setData(limitBotPayload(payload));
      setMessage("Bot profile updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profile update failed.");
    } finally {
      setSaving(false);
    }
  }

  function startVoiceCommand() {
    if (!data?.profile.voiceEnabled) {
      setMessage("Voice is disabled for this bot profile.");
      return;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage("Voice commands are not supported in this browser. Type the command instead.");
      return;
    }

    stopSpeaking();

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-GB";

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setPrompt(transcript);
      setListening(false);
      void sendCommand(undefined, transcript, transcript);
    };

    recognition.onerror = () => {
      setListening(false);
      setMessage("Voice command failed. Try typing the command instead.");
    };

    recognition.onend = () => {
      setListening(false);
    };

    setListening(true);
    recognition.start();
  }

  useEffect(() => {
    void loadBot();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;

    function updateVoices() {
      setVoices(window.speechSynthesis.getVoices());
    }

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#050505] p-4 text-white">
        <Card className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-black">Loading Slice AI command center...</h1>
          {message ? <p className="mt-3 text-sm text-red-200">{message}</p> : null}
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.35),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.14),_transparent_32%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-4 text-white md:p-5">
      <div className="mx-auto grid max-w-[1280px] gap-5">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Slice Personal AI
              </div>
              <h1 className="mt-2 truncate text-4xl font-black md:text-5xl">
                {data.profile.botName}
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                Compact command center with newest-first request history. The page keeps only the latest five requests in memory,
                while the global bot remains available on every page.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Pill tone={data.aiEngine?.configured ? "green" : "amber"}>
                  {data.aiEngine?.provider ?? "AI Engine"}
                </Pill>
                <Pill tone="purple">{data.aiEngine?.model ?? "gpt-5"}</Pill>
                <Pill tone="cyan">British English Voice</Pill>
                <Pill tone={data.profile.voiceEnabled ? "green" : "red"}>
                  Voice {data.profile.voiceEnabled ? "Enabled" : "Disabled"}
                </Pill>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2">
              <a href="/workspace" className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950">
                Workspace
              </a>
              <a href="/bot-onboarding" className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm font-black text-red-100">
                Onboarding
              </a>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                  Ask Anything
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">
                  Universal Slice assistant
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startVoiceCommand}
                  disabled={listening || saving || !data.profile.voiceEnabled}
                  className={cx(
                    "rounded-2xl px-4 py-3 text-xs font-black ring-1 disabled:opacity-50",
                    listening
                      ? "bg-cyan-500/20 text-cyan-100 ring-cyan-400/30"
                      : "bg-white/5 text-white ring-white/10 hover:bg-white/10"
                  )}
                >
                  {listening ? "Listening" : "Voice"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSpeakResponses((current) => !current);
                    if (speakResponses) stopSpeaking();
                  }}
                  className={cx(
                    "rounded-2xl px-4 py-3 text-xs font-black ring-1",
                    speakResponses
                      ? "bg-cyan-500/15 text-cyan-100 ring-cyan-400/30"
                      : "bg-white/5 text-white ring-white/10 hover:bg-white/10"
                  )}
                >
                  {speakResponses ? "Sound On" : "Sound Off"}
                </button>
              </div>
            </div>

            <form onSubmit={sendCommand} className="grid gap-3">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-[120px] w-full resize-none rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                placeholder="Ask a question or tell the bot what to do..."
              />

              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-slate-400">
                  Newest requests appear at the top. Only {MAX_REQUESTS} are kept on this page.
                </div>

                <button
                  type="button"
                  onClick={() => latestAssistant?.content && speak(latestAssistant.content, true)}
                  disabled={!latestAssistant?.content || speaking}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {speaking ? "Speaking" : "Speak Latest"}
                </button>

                <button
                  disabled={saving || !prompt.trim()}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
                >
                  {saving ? "Thinking..." : "Send"}
                </button>
              </div>
            </form>

            {latestAssistant ? (
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Pill tone={toneFor(latestAssistant.intent)}>{latestAssistant.intent}</Pill>
                  {latestAssistant.metadata?.universalAiProvider ? (
                    <Pill tone="purple">{latestAssistant.metadata.universalAiProvider}</Pill>
                  ) : null}
                  <Pill tone="cyan">British English</Pill>
                </div>
                <div className="max-h-[260px] overflow-y-auto whitespace-pre-wrap pr-2 text-sm leading-7 text-slate-200">
                  {latestAssistant.content}
                </div>

                {latestAssistant.metadata?.clientAction?.href && !latestAssistant.metadata.clientAction.autoRun ? (
                  <a
                    href={latestAssistant.metadata.clientAction.href}
                    className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                  >
                    Open Result
                  </a>
                ) : null}
              </div>
            ) : null}
          </Card>

          <aside className="grid content-start gap-5">
            <Metric label="Requests Held" value={data.commands.length} helper={`Max ${MAX_REQUESTS} on this page`} tone="cyan" />
            <Metric label="Tone" value={data.profile.preferredTone} helper={data.profile.commandStyle} tone="purple" />
            <Metric label="Approvals" value={pendingApprovals.length} helper="Pending visible items" tone={pendingApprovals.length ? "amber" : "green"} />

            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                Quick Commands
              </div>
              <div className="mt-4 grid gap-2">
                {(data.tabs[0]?.pinnedCommands ?? [
                  "What should I do next?",
                  "Research NVDA",
                  "Open market visuals",
                  "Run backend vendor health",
                  "Create a premium PDF report",
                ])
                  .slice(0, 5)
                  .map((command) => (
                    <button
                      key={command}
                      type="button"
                      onClick={() => void sendCommand(undefined, command)}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-xs font-bold text-slate-300 hover:bg-white/[0.07] hover:text-white"
                    >
                      {command}
                    </button>
                  ))}
              </div>
            </Card>
          </aside>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                  Latest Requests
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">Newest first</h2>
              </div>
              <Pill tone="cyan">5 max</Pill>
            </div>

            <div className="grid max-h-[520px] gap-3 overflow-y-auto pr-2">
              {data.commands.map((command) => (
                <div key={command.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-white">
                        {command.commandText}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatTime(command.createdAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Pill tone={toneFor(command.commandType)}>{command.commandType}</Pill>
                      <Pill tone={toneFor(command.status)}>{command.status}</Pill>
                    </div>
                  </div>
                  {command.resultSummary ? (
                    <p className="mt-3 text-sm leading-6 text-slate-400">{command.resultSummary}</p>
                  ) : null}
                </div>
              ))}

              {!data.commands.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                  No requests yet.
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
              Latest Conversation
            </div>
            <h2 className="mt-2 text-2xl font-black text-white">Five-message memory window</h2>

            <div className="mt-4 grid max-h-[520px] gap-3 overflow-y-auto pr-2">
              {data.messages.map((item) => (
                <div
                  key={item.id}
                  className={cx(
                    "rounded-[1.35rem] border p-4",
                    item.role === "assistant"
                      ? "border-cyan-500/20 bg-cyan-500/8"
                      : "border-white/10 bg-white/[0.045]"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Pill tone={item.role === "assistant" ? "cyan" : "slate"}>{item.role}</Pill>
                    <span className="text-[11px] font-bold text-slate-500">{formatTime(item.createdAt)}</span>
                  </div>
                  <div className="line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                    {item.content}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
              Bot Profile
            </div>
            <h2 className="mt-2 text-2xl font-black text-white">Personality and controls</h2>

            <div className="mt-4 grid gap-3">
              <input
                value={profileForm.botName}
                onChange={(event) => setProfileForm((current) => ({ ...current, botName: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                placeholder="Bot name"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={profileForm.preferredTone}
                  onChange={(event) => setProfileForm((current) => ({ ...current, preferredTone: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                >
                  <option>Professional</option>
                  <option>Witty</option>
                  <option>Direct</option>
                  <option>Calm</option>
                  <option>Encouraging</option>
                  <option>Brutally honest</option>
                </select>

                <select
                  value={profileForm.commandStyle}
                  onChange={(event) => setProfileForm((current) => ({ ...current, commandStyle: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                >
                  <option>One-line answer</option>
                  <option>Short summary</option>
                  <option>Balanced detail</option>
                  <option>Detailed breakdown</option>
                  <option>Deep research style</option>
                </select>
              </div>

              <select
                value={profileForm.autonomyLevel}
                onChange={(event) => setProfileForm((current) => ({ ...current, autonomyLevel: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
              >
                <option>Suggest only</option>
                <option>Draft only</option>
                <option>Advisor approval required</option>
                <option>Create tasks with approval</option>
                <option>High autonomy with review</option>
              </select>

              <textarea
                value={profileForm.customInstructions}
                onChange={(event) => setProfileForm((current) => ({ ...current, customInstructions: event.target.value }))}
                className="min-h-[110px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                placeholder="Custom instructions for how the bot should talk and behave..."
              />

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={profileForm.voiceEnabled}
                  onChange={(event) => setProfileForm((current) => ({ ...current, voiceEnabled: event.target.checked }))}
                />
                Voice enabled
              </label>

              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
              >
                Save Profile
              </button>
            </div>
          </Card>

          <Card>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
              Pending Approvals
            </div>
            <h2 className="mt-2 text-2xl font-black text-white">Newest approval items</h2>

            <div className="mt-4 grid max-h-[460px] gap-3 overflow-y-auto pr-2">
              {pendingApprovals.map((approval) => (
                <div key={approval.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{approval.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{approval.actionType}</div>
                    </div>
                    <Pill tone={toneFor(approval.riskLevel)}>{approval.riskLevel}</Pill>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{approval.summary}</p>
                  <Pill tone={toneFor(approval.status)}>{approval.status}</Pill>
                </div>
              ))}

              {!pendingApprovals.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                  No pending approvals.
                </div>
              ) : null}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}