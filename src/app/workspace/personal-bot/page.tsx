"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";

type ClientAction = {
  type?: string;
  href?: string;
  autoRun?: boolean;
};

type BotMessage = {
  id: string;
  role: string;
  content: string;
  intent: string;
  createdAt: string;
  metadata?: {
    clientAction?: ClientAction;
    structuredCommand?: {
      intent?: string;
      confidence?: number;
      riskLevel?: string;
      requiresApproval?: boolean;
    };
    aiParserOk?: boolean;
    aiParserError?: string;
    spokenAccent?: string;
    universalAiProvider?: string;
    universalAiStatus?: string;
    universalAiError?: string;
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
    createdAt?: string;
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

const MAX_ITEMS = 20;

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
    messages: byNewest(payload.messages).slice(0, MAX_ITEMS),
    commands: byNewest(payload.commands).slice(0, MAX_ITEMS),
    pdfReports: byNewest(payload.pdfReports ?? []).slice(0, MAX_ITEMS),
    memories: payload.memories?.slice(0, MAX_ITEMS),
    approvals: payload.approvals?.slice(0, MAX_ITEMS),
    backendApprovals: payload.backendApprovals?.slice(0, MAX_ITEMS),
    platformMap: payload.platformMap?.slice(0, 18),
  };
}

function cleanTranscript(value: string) {
  return value
    .replace(/\b(um|uh|er|ah)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toneFor(value: string | null | undefined): Tone {
  const lower = String(value ?? "").toLowerCase();

  if (
    lower.includes("failed") ||
    lower.includes("critical") ||
    lower.includes("high") ||
    lower.includes("error")
  ) {
    return "red";
  }

  if (
    lower.includes("complete") ||
    lower.includes("active") ||
    lower.includes("ready") ||
    lower.includes("configured") ||
    lower.includes("generated")
  ) {
    return "green";
  }

  if (
    lower.includes("open") ||
    lower.includes("queued") ||
    lower.includes("draft") ||
    lower.includes("pending") ||
    lower.includes("approval")
  ) {
    return "amber";
  }

  if (lower.includes("ai") || lower.includes("bot") || lower.includes("research")) {
    return "purple";
  }

  if (lower.includes("voice") || lower.includes("backend") || lower.includes("tool")) {
    return "cyan";
  }

  return "slate";
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
        "rounded-[1.75rem] border border-white/10 bg-zinc-950/82 p-5 shadow-xl shadow-red-950/20 backdrop-blur-xl",
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
    <div className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-4">
      <div
        className={cx(
          "absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent",
          glows[tone]
        )}
      />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
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
    voices.find((voice) =>
      /british|united kingdom|uk english|english \(uk\)/i.test(voice.name)
    ) ??
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("en")) ??
    null
  );
}

function stripForSpeech(text: string) {
  return text
    .replace(/https?:\/\/\S+/g, "source link available in the workspace")
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2600);
}

function actionLabel(action?: ClientAction) {
  if (!action?.href) return null;
  if (action.type === "report") return "Open Presentation PDF";
  if (action.type === "source") return "Open Source";
  if (action.type === "navigate") return "Open Suggested Section";
  return "Open Result";
}

function BotOrb({
  listening,
  speaking,
}: {
  listening: boolean;
  speaking: boolean;
}) {
  const active = listening || speaking;

  return (
    <div className="relative grid h-24 w-24 shrink-0 place-items-center">
      <span
        className={cx(
          "absolute inset-0 rounded-full blur-2xl",
          active ? "bg-cyan-400/25" : "bg-red-600/20"
        )}
      />
      {active ? (
        <span className="absolute inset-0 animate-ping rounded-full border border-cyan-300/45" />
      ) : null}

      <div
        className={cx(
          "relative grid h-20 w-20 place-items-center rounded-full border shadow-2xl",
          active
            ? "border-cyan-300/60 bg-gradient-to-br from-cyan-300/20 via-slate-950 to-black shadow-cyan-950/40"
            : "border-white/15 bg-gradient-to-br from-red-950 via-zinc-950 to-black shadow-red-950/45"
        )}
      >
        <div className="grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-gradient-to-br from-white via-slate-200 to-slate-500 shadow-inner">
          <div className="h-8 w-10 rounded-[1.5rem] border border-white/40 bg-slate-950">
            <div className="mt-2 flex justify-center gap-2">
              <span
                className={cx(
                  "block h-2 w-2 rounded-full",
                  active ? "bg-cyan-300 shadow-[0_0_12px] shadow-cyan-300" : "bg-red-400"
                )}
              />
              <span
                className={cx(
                  "block h-2 w-2 rounded-full",
                  active ? "bg-cyan-300 shadow-[0_0_12px] shadow-cyan-300" : "bg-red-400"
                )}
              />
            </div>
            <div
              className={cx(
                "mx-auto mt-2 h-2 w-5 rounded-full border-b-2 border-white/80",
                speaking ? "animate-pulse border-2" : ""
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
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
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [recognitionLanguage, setRecognitionLanguage] = useState("en-US");
  const [activeView, setActiveView] = useState<"command" | "reports" | "history" | "settings">("command");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");

  const [profileForm, setProfileForm] = useState({
    botName: "",
    preferredTone: "Professional",
    commandStyle: "Balanced detail",
    autonomyLevel: "Advisor approval required",
    customInstructions: "",
    voiceEnabled: true,
  });

  const latestAssistant = useMemo(
    () => data?.messages.find((item) => item.role === "assistant"),
    [data]
  );

  const latestAction = latestAssistant?.metadata?.clientAction;
  const latestActionLabel = actionLabel(latestAction);

  const pendingApprovals = useMemo(
    () =>
      [
        ...(data?.approvals?.filter((item) => item.status === "Pending") ?? []),
        ...(data?.backendApprovals?.filter((item) => item.status === "Pending") ?? []),
      ].slice(0, MAX_ITEMS),
    [data]
  );

  const quickCommands = useMemo(
    () => [
      "Give me a presentation-ready answer to anything I ask.",
      "Create a stunning PDF report for tomorrow morning's presentation.",
      "Summarize the AI layer in a way that sounds investor-ready.",
      "Create a professional advisor briefing from the latest Slice intelligence.",
      "Research NVDA and give me the bull case, bear case, and advisor next steps.",
      "What should I improve before showing this platform to a wealth manager?",
    ],
    []
  );

  async function loadBot() {
    try {
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load personal bot.");
    }
  }

  function speak(text: string, force = false) {
    if (!force && !speakResponses) return;
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) {
      setMessage("Speech synthesis is not supported in this browser.");
      return;
    }

    const clean = stripForSpeech(text);

    if (!clean) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = getBritishVoice(voices);

    utterance.lang = "en-GB";
    utterance.rate = 0.97;
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

  function handleClientAction(payload: BotPayload) {
    const limited = limitBotPayload(payload);
    const assistant = limited.messages.find((item) => item.role === "assistant");

    if (assistant?.content) {
      speak(assistant.content);
    }

    if (assistant?.metadata?.clientAction?.type === "theme") {
      window.dispatchEvent(new Event("slice-theme-updated"));
    }

    // Intentional: no automatic navigation from the main AI Studio.
    // Links remain manual so the user stays in control during presentations.
  }

  async function sendCommand(
    event?: FormEvent,
    overridePrompt?: string,
    source: "typed" | "voice" | "quick" = "typed"
  ) {
    event?.preventDefault();

    const commandText = cleanTranscript(overridePrompt ?? prompt);

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
          voiceTranscript: source === "voice" ? commandText : null,
          currentPath: window.location.pathname + window.location.search,
          pageTitle: document.title,
          preferredSpeechLanguage: "en-GB",
          answerMode: "chat_first",
          preventAutoNavigation: true,
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
      setVoiceTranscript("");
      handleClientAction(limited);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Command failed.");
    } finally {
      setSaving(false);
    }
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void sendCommand(undefined, prompt, "typed");
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

  function stopVoiceCommand() {
    const recognition = recognitionRef.current;

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        recognition.abort?.();
      }
    }

    recognitionRef.current = null;
    setListening(false);
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

    const SpeechRecognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage("Voice commands are not supported in this browser. Type the command instead.");
      return;
    }

    stopSpeaking();
    stopVoiceCommand();

    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setVoiceTranscript("");
    setPrompt("");

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = recognitionLanguage;

    recognition.onstart = () => {
      setListening(true);
      setMessage("");
    };

    recognition.onresult = (event) => {
      let finalText = finalTranscriptRef.current;
      let interimText = "";
      const startIndex = event.resultIndex ?? 0;

      for (let index = startIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? "";

        if (result?.isFinal) {
          finalText = `${finalText} ${transcript}`.trim();
        } else {
          interimText = `${interimText} ${transcript}`.trim();
        }
      }

      finalTranscriptRef.current = cleanTranscript(finalText);
      interimTranscriptRef.current = cleanTranscript(interimText);

      const combined = cleanTranscript(
        `${finalTranscriptRef.current} ${interimTranscriptRef.current}`
      );

      setVoiceTranscript(combined);
      setPrompt(combined);
    };

    recognition.onerror = () => {
      setListening(false);
      setMessage("Voice command paused. Try again, or type the command instead.");
    };

    recognition.onend = () => {
      const finalText = cleanTranscript(
        finalTranscriptRef.current || interimTranscriptRef.current || voiceTranscript
      );

      recognitionRef.current = null;
      setListening(false);

      if (finalText) {
        void sendCommand(undefined, finalText, "voice");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  useEffect(() => {
    void loadBot();
  }, []);

  useEffect(() => {
    try {
      const savedSound = localStorage.getItem("slice-bot-main-speak-responses");
      const savedRecognitionLanguage = localStorage.getItem("slice-bot-main-recognition-language");

      if (savedSound === "false") {
        setSpeakResponses(false);
      }

      if (savedRecognitionLanguage) {
        setRecognitionLanguage(savedRecognitionLanguage);
      }
    } catch {
      // Ignore local storage failures.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("slice-bot-main-speak-responses", speakResponses ? "true" : "false");
      localStorage.setItem("slice-bot-main-recognition-language", recognitionLanguage);
    } catch {
      // Ignore local storage failures.
    }
  }, [speakResponses, recognitionLanguage]);

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

  useEffect(() => {
    return () => {
      stopVoiceCommand();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#050505] p-4 text-white">
        <Card className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-black">Loading Slice AI Studio...</h1>
          {message ? <p className="mt-3 text-sm text-red-200">{message}</p> : null}
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_32%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-4 text-white md:p-5">
      <div className="mx-auto grid max-w-[1380px] gap-5">
        <header className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-black/72 p-5 shadow-2xl shadow-red-950/40 backdrop-blur-xl">
          <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <BotOrb listening={listening} speaking={speaking} />

            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.28em] text-red-400">
                Slice AI Studio
              </div>
              <h1 className="mt-2 truncate text-4xl font-black tracking-tight md:text-6xl">
                {data.profile.botName}
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                A presentation-grade AI command layer for asking anything, speaking commands, hearing responses,
                creating reports, and keeping advisor workflows review-safe.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Pill tone={data.aiEngine?.configured ? "green" : "amber"}>
                  {data.aiEngine?.provider ?? "AI Engine"}
                </Pill>
                <Pill tone="purple">{data.aiEngine?.model ?? "gpt-5"}</Pill>
                <Pill tone="cyan">Voice input + output</Pill>
                <Pill tone={data.profile.voiceEnabled ? "green" : "red"}>
                  Voice {data.profile.voiceEnabled ? "Enabled" : "Disabled"}
                </Pill>
                <Pill tone="amber">Manual navigation only</Pill>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950"
              >
                Workspace
              </a>
              <a
                href="/bot-onboarding"
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm font-black text-red-100"
              >
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

        <section className="grid gap-3 md:grid-cols-4">
          <Metric
            label="AI Status"
            value={data.aiEngine?.configured ? "Live" : "Fallback"}
            helper={data.aiEngine?.model ?? "Model pending"}
            tone={data.aiEngine?.configured ? "green" : "amber"}
          />
          <Metric
            label="Voice"
            value={listening ? "Listening" : speaking ? "Speaking" : "Ready"}
            helper={recognitionLanguage}
            tone="cyan"
          />
          <Metric
            label="Reports"
            value={data.pdfReports?.length ?? 0}
            helper="Presentation PDFs"
            tone="purple"
          />
          <Metric
            label="Approvals"
            value={pendingApprovals.length}
            helper="Review-safe actions"
            tone={pendingApprovals.length ? "amber" : "green"}
          />
        </section>

        <nav className="flex flex-wrap gap-2 rounded-[1.5rem] border border-white/10 bg-black/45 p-2">
          {[
            ["command", "Command Desk"],
            ["reports", "PDF Studio"],
            ["history", "History"],
            ["settings", "Settings"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveView(key as typeof activeView)}
              className={cx(
                "rounded-2xl px-4 py-3 text-sm font-black transition",
                activeView === key
                  ? "bg-white text-slate-950"
                  : "bg-white/5 text-white hover:bg-white/10"
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        {activeView === "command" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
            <Card className="min-w-0">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                    Ask Anything
                  </div>
                  <h2 className="mt-2 text-3xl font-black text-white">
                    State-of-the-art advisor assistant
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <select
                    value={recognitionLanguage}
                    onChange={(event) => setRecognitionLanguage(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/55 px-3 py-3 text-xs font-black text-white outline-none"
                  >
                    <option value="en-US">US English input</option>
                    <option value="en-GB">UK English input</option>
                    <option value="en-AU">AU English input</option>
                  </select>

                  <button
                    type="button"
                    onClick={listening ? stopVoiceCommand : startVoiceCommand}
                    disabled={saving || !data.profile.voiceEnabled}
                    className={cx(
                      "rounded-2xl px-4 py-3 text-xs font-black ring-1 disabled:opacity-50",
                      listening
                        ? "bg-cyan-500/20 text-cyan-100 ring-cyan-400/30"
                        : "bg-white/5 text-white ring-white/10 hover:bg-white/10"
                    )}
                  >
                    {listening ? "Stop Listening" : "Speak Command"}
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
                    {speakResponses ? "Auto-Speak On" : "Auto-Speak Off"}
                  </button>
                </div>
              </div>

              <form onSubmit={sendCommand} className="grid gap-3">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={handlePromptKeyDown}
                  className="min-h-[150px] w-full resize-none rounded-[1.5rem] border border-white/10 bg-black/45 px-4 py-4 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  placeholder="Ask anything, give a rough voice command, request a PDF report, prepare for a presentation, or tell Slice what to analyse..."
                />

                {voiceTranscript && listening ? (
                  <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm font-semibold leading-6 text-cyan-100">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                      Heard so far
                    </div>
                    <div className="mt-1">{voiceTranscript}</div>
                  </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-slate-400">
                    Ctrl + Enter sends. Voice input captures the user. Speak buttons read either your prompt or the bot answer.
                  </div>

                  <button
                    type="button"
                    onClick={() => prompt.trim() && speak(prompt, true)}
                    disabled={!prompt.trim() || speaking}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    Read Mine
                  </button>

                  <button
                    type="button"
                    onClick={() => latestAssistant?.content && speak(latestAssistant.content, true)}
                    disabled={!latestAssistant?.content || speaking}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    Read Bot
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
                <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Pill tone={toneFor(latestAssistant.intent)}>{latestAssistant.intent}</Pill>
                    {latestAssistant.metadata?.universalAiProvider ? (
                      <Pill tone="purple">{latestAssistant.metadata.universalAiProvider}</Pill>
                    ) : null}
                    <Pill tone="cyan">British English output</Pill>
                    <Pill tone="amber">Chat-first</Pill>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto whitespace-pre-wrap pr-2 text-sm leading-7 text-slate-200">
                    {latestAssistant.content}
                  </div>

                  {latestAction?.href && latestActionLabel ? (
                    <a
                      href={latestAction.href}
                      target={latestAction.type === "source" || latestAction.type === "report" ? "_blank" : undefined}
                      rel={latestAction.type === "source" || latestAction.type === "report" ? "noreferrer" : undefined}
                      className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                    >
                      {latestActionLabel}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </Card>

            <aside className="grid content-start gap-5">
              <Card>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                  Presentation Shortcuts
                </div>
                <div className="mt-4 grid gap-2">
                  {quickCommands.map((command) => (
                    <button
                      key={command}
                      type="button"
                      onClick={() => void sendCommand(undefined, command, "quick")}
                      disabled={saving}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-xs font-bold leading-5 text-slate-300 hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
                    >
                      {command}
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                  Latest PDF
                </div>
                {data.pdfReports?.[0] ? (
                  <div className="mt-4">
                    <div className="text-lg font-black text-white">
                      {data.pdfReports[0].title}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pill tone={toneFor(data.pdfReports[0].status)}>
                        {data.pdfReports[0].status}
                      </Pill>
                      <Pill tone="purple">{data.pdfReports[0].reportType}</Pill>
                    </div>
                    <a
                      href={data.pdfReports[0].downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 block rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950"
                    >
                      Open Presentation PDF
                    </a>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm font-bold text-slate-500">
                    No PDF yet. Ask Slice to create a stunning presentation-ready PDF report.
                  </div>
                )}
              </Card>
            </aside>
          </section>
        ) : null}

        {activeView === "reports" ? (
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                PDF Studio
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">
                Presentation-ready report library
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                Ask the AI to create a report, then open it here. Reports are designed for advisor review before external use.
              </p>

              <div className="mt-5 grid gap-3">
                {(data.pdfReports ?? []).map((report) => (
                  <div
                    key={report.id}
                    className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-black text-white">{report.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{report.reportType}</div>
                      </div>
                      <Pill tone={toneFor(report.status)}>{report.status}</Pill>
                    </div>

                    <a
                      href={report.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                    >
                      Open PDF
                    </a>
                  </div>
                ))}

                {!data.pdfReports?.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                    No reports generated yet.
                  </div>
                ) : null}
              </div>
            </Card>

            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                One-click report prompts
              </div>
              <div className="mt-4 grid gap-2">
                {[
                  "Create a stunning PDF report explaining Slice's AI capabilities for a wealth manager presentation.",
                  "Generate a premium PDF report on the strongest current investment signals.",
                  "Create a beautiful advisor operating report with risks, opportunities, sources, and next actions.",
                  "Build a client-ready briefing PDF, but keep it marked advisor-review required.",
                ].map((command) => (
                  <button
                    key={command}
                    type="button"
                    onClick={() => void sendCommand(undefined, command, "quick")}
                    disabled={saving}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-xs font-bold leading-5 text-slate-300 hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
                  >
                    {command}
                  </button>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "history" ? (
          <section className="grid gap-5 lg:grid-cols-2">
            <Card className="min-w-0">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                    Latest Requests
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">Command history</h2>
                </div>
                <Pill tone="cyan">{MAX_ITEMS} max</Pill>
              </div>

              <div className="grid max-h-[620px] gap-3 overflow-y-auto pr-2">
                {data.commands.map((command) => (
                  <div
                    key={command.id}
                    className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4"
                  >
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
                        <Pill tone={toneFor(command.commandType)}>
                          {command.commandType}
                        </Pill>
                        <Pill tone={toneFor(command.status)}>{command.status}</Pill>
                      </div>
                    </div>
                    {command.resultSummary ? (
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {command.resultSummary}
                      </p>
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
              <h2 className="mt-2 text-2xl font-black text-white">Message stream</h2>

              <div className="mt-4 grid max-h-[620px] gap-3 overflow-y-auto pr-2">
                {data.messages.map((item) => (
                  <div
                    key={item.id}
                    className={cx(
                      "rounded-[1.35rem] border p-4",
                      item.role === "assistant"
                        ? "border-cyan-500/20 bg-cyan-500/[0.08]"
                        : "border-white/10 bg-white/[0.045]"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Pill tone={item.role === "assistant" ? "cyan" : "slate"}>
                        {item.role}
                      </Pill>
                      <span className="text-[11px] font-bold text-slate-500">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                      {item.content}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "settings" ? (
          <section className="grid gap-5 lg:grid-cols-2">
            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
                Bot Profile
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Personality and controls</h2>

              <div className="mt-4 grid gap-3">
                <input
                  value={profileForm.botName}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      botName: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  placeholder="Bot name"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={profileForm.preferredTone}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        preferredTone: event.target.value,
                      }))
                    }
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
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        commandStyle: event.target.value,
                      }))
                    }
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
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      autonomyLevel: event.target.value,
                    }))
                  }
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
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      customInstructions: event.target.value,
                    }))
                  }
                  className="min-h-[130px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  placeholder="Custom instructions for how the bot should talk and behave..."
                />

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={profileForm.voiceEnabled}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        voiceEnabled: event.target.checked,
                      }))
                    }
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
              <h2 className="mt-2 text-2xl font-black text-white">Review-safe queue</h2>

              <div className="mt-4 grid max-h-[520px] gap-3 overflow-y-auto pr-2">
                {pendingApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-black text-white">{approval.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {approval.actionType}
                        </div>
                      </div>
                      <Pill tone={toneFor(approval.riskLevel)}>{approval.riskLevel}</Pill>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {approval.summary}
                    </p>
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
        ) : null}
      </div>
    </main>
  );
}