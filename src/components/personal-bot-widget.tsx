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

type ClientAction = {
  type?: string;
  href?: string;
  autoRun?: boolean;
};

type BotProfile = {
  id: string;
  botName: string;
  onboardingComplete: boolean;
  preferredTone: string;
  commandStyle?: string;
  autonomyLevel?: string;
  voiceEnabled: boolean;
  spokenAccent?: string;
  speechLanguage?: string;
};

type BotMessage = {
  id: string;
  role: string;
  content: string;
  intent: string;
  metadata?: {
    clientAction?: ClientAction;
    spokenAccent?: string;
    universalAiProvider?: string;
    universalAiStatus?: string;
    universalAiError?: string;
    structuredCommand?: {
      intent?: string;
      confidence?: number;
      riskLevel?: string;
    };
  };
};

type BotPayload = {
  profile: BotProfile;
  aiEngine?: {
    configured?: boolean;
    provider?: string;
    model?: string;
    universalAnswers?: boolean;
    spokenAccent?: string;
    speechLanguage?: string;
    webSearchEnabled?: boolean;
  };
  requiresOnboarding: boolean;
  messages: BotMessage[];
  pdfReports?: Array<{
    id: string;
    title: string;
    downloadUrl: string;
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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function cleanTranscript(value: string) {
  return value
    .replace(/\b(um|uh|er|ah)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getLatestAssistantMessage(payload: BotPayload | null) {
  return [...(payload?.messages ?? [])]
    .reverse()
    .find((item) => item.role === "assistant");
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
    .replace(/https?:\/\/\S+/g, "source link available in the chat")
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2400);
}

function speechSettingsForTone(tone: string | undefined) {
  const lower = String(tone ?? "").toLowerCase();

  if (lower.includes("witty")) {
    return {
      rate: 1.04,
      pitch: 1.08,
    };
  }

  if (lower.includes("calm")) {
    return {
      rate: 0.9,
      pitch: 0.95,
    };
  }

  if (lower.includes("direct")) {
    return {
      rate: 1.02,
      pitch: 0.98,
    };
  }

  if (lower.includes("brutally")) {
    return {
      rate: 1.03,
      pitch: 0.92,
    };
  }

  if (lower.includes("encouraging")) {
    return {
      rate: 0.98,
      pitch: 1.06,
    };
  }

  return {
    rate: 0.96,
    pitch: 1.02,
  };
}

function actionIsReport(action?: ClientAction) {
  return action?.type === "report" && Boolean(action.href);
}

function actionIsSource(action?: ClientAction) {
  return action?.type === "source" && Boolean(action.href);
}

function actionIsNavigation(action?: ClientAction) {
  return action?.type === "navigate" && Boolean(action.href);
}

function readableStatus(payload: BotPayload | null) {
  if (!payload) return "Loading";
  if (!payload.aiEngine?.configured) return "Fallback mode";

  return `${payload.aiEngine.provider ?? "OpenAI"} · ${
    payload.aiEngine.model ?? "AI"
  }`;
}

function HumanRobotAvatar({
  listening,
  speaking,
  size = "large",
}: {
  listening: boolean;
  speaking: boolean;
  size?: "small" | "large";
}) {
  const isLarge = size === "large";
  const shellSize = isLarge ? "h-20 w-20" : "h-14 w-14";
  const headSize = isLarge ? "h-16 w-16" : "h-11 w-11";
  const faceSize = isLarge ? "h-12 w-[3.25rem]" : "h-8 w-9";
  const active = listening || speaking;

  return (
    <div className={cx("relative flex shrink-0 items-center justify-center", shellSize)}>
      {active ? (
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
          active
            ? "border-cyan-300/55 bg-gradient-to-br from-cyan-300/16 via-slate-900 to-black shadow-cyan-950/40"
            : "border-white/15 bg-gradient-to-br from-slate-600 via-zinc-950 to-black shadow-red-950/45",
          shellSize
        )}
      >
        <div className="absolute inset-x-3 top-2 h-6 rounded-full bg-white/12 blur-sm" />
        <div className="absolute -left-5 top-2 h-16 w-10 rotate-12 bg-white/10 blur-xl" />

        <div
          className={cx(
            "relative overflow-hidden rounded-full border border-white/25 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-500 shadow-inner",
            headSize
          )}
        >
          <div
            className={cx(
              "absolute inset-x-2 top-1 rounded-t-full bg-gradient-to-b from-slate-800 to-slate-700",
              isLarge ? "h-5" : "h-3.5"
            )}
          />

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

          <div
            className={cx(
              "absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-white/35 bg-gradient-to-br from-white via-slate-100 to-slate-300 shadow-inner",
              faceSize
            )}
          >
            <div className="absolute inset-x-3 top-1.5 h-1.5 rounded-full bg-white/70" />

            <div
              className={cx(
                "absolute rounded-full",
                active
                  ? "bg-cyan-400 shadow-[0_0_12px] shadow-cyan-300/80"
                  : "bg-slate-950 shadow-[0_0_8px] shadow-slate-900/30",
                isLarge ? "left-3 top-5 h-2.5 w-2.5" : "left-2 top-3.5 h-2 w-2"
              )}
            />
            <div
              className={cx(
                "absolute rounded-full",
                active
                  ? "bg-cyan-400 shadow-[0_0_12px] shadow-cyan-300/80"
                  : "bg-slate-950 shadow-[0_0_8px] shadow-slate-900/30",
                isLarge ? "right-3 top-5 h-2.5 w-2.5" : "right-2 top-3.5 h-2 w-2"
              )}
            />

            <div
              className={cx(
                "absolute left-1/2 -translate-x-1/2 rounded-b-full border-b-2 border-slate-950/70",
                speaking
                  ? isLarge
                    ? "bottom-2.5 h-3.5 w-6 animate-pulse rounded-full border-2 border-slate-950/70"
                    : "bottom-2 h-2.5 w-4 animate-pulse rounded-full border-2 border-slate-950/70"
                  : isLarge
                    ? "bottom-3 h-2.5 w-7"
                    : "bottom-2 h-2 w-5"
              )}
            />
          </div>
        </div>

        <div
          className={cx(
            "absolute rounded-full border border-white/10 bg-black/85 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-lg",
            isLarge ? "-bottom-3" : "-bottom-2"
          )}
        >
          {listening ? "Listening" : speaking ? "Speaking" : "Ask"}
        </div>
      </div>
    </div>
  );
}

function FloatingButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-3 text-xs font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
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
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [recognitionLanguage, setRecognitionLanguage] = useState("en-US");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");

  const latestAssistantMessage = useMemo(() => getLatestAssistantMessage(bot), [bot]);
  const latestAction = latestAssistantMessage?.metadata?.clientAction;
  const latestPdf = bot?.pdfReports?.[0];

  const quickPrompts = [
    "Give me a sharp professional answer to my next question.",
    "Create a presentation-ready Slice PDF report.",
    "Summarize the most important thing in my advisor workspace.",
    "Help me prepare for a client or investor meeting.",
  ];

  function handleClientAction(payload: BotPayload) {
    const latest = getLatestAssistantMessage(payload);
    const action = latest?.metadata?.clientAction;

    if (action?.type === "theme") {
      window.dispatchEvent(new Event("slice-theme-updated"));
    }

    // No auto-navigation from the floating bot.
    // The assistant answers first and shows manual links only.
  }

  function stopSpeaking() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function speakText(text: string, force = false, payload?: BotPayload | null) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setMessage("Spoken replies are not supported in this browser.");
      return;
    }

    const activePayload = payload ?? bot;

    if (!force && !speakReplies) return;
    if (!activePayload?.profile.voiceEnabled) return;

    const clean = stripForSpeech(text);

    if (!clean) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = getBritishVoice(voices);
    const toneSettings = speechSettingsForTone(activePayload.profile.preferredTone);

    utterance.lang = "en-GB";
    utterance.rate = toneSettings.rate;
    utterance.pitch = toneSettings.pitch;
    utterance.volume = 1;

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  function speakLatestAssistant(payload: BotPayload, force = false) {
    const latest = getLatestAssistantMessage(payload);

    if (!latest?.content) return;

    speakText(latest.content, force, payload);
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

      const payload = (await response.json()) as BotPayload;

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

  async function sendPromptText(
    text: string,
    source: "typed" | "voice" | "quick" = "typed"
  ) {
    const clean = cleanTranscript(text);

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
          voiceTranscript: source === "voice" ? clean : null,
          currentPath: window.location.pathname + window.location.search,
          pageTitle: document.title,
          preferredSpeechLanguage: "en-GB",
          answerMode: "chat_first",
          preventAutoNavigation: true,
        }),
      });

      const payload = (await response.json()) as BotPayload & { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Bot command failed.");
        return;
      }

      setBot(payload);
      setPrompt("");
      setVoiceTranscript("");
      handleClientAction(payload);
      speakLatestAssistant(payload);
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

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void sendPromptText(prompt);
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
    if (bot && !bot.profile.voiceEnabled) {
      setPanelOpen(true);
      setMessage("Voice is disabled for this bot profile. Enable voice in the bot settings to speak commands.");
      return;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setPanelOpen(true);
      setMessage("Voice commands are not supported in this browser. Type the request instead.");
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
      setPanelOpen(true);
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
      setPanelOpen(true);
      setMessage("Voice recognition paused. Try again, or type the request directly.");
    };

    recognition.onend = () => {
      const finalText = cleanTranscript(
        finalTranscriptRef.current || interimTranscriptRef.current || voiceTranscript
      );

      recognitionRef.current = null;
      setListening(false);

      if (finalText) {
        void sendPromptText(finalText, "voice");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function toggleSpeakReplies() {
    const next = !speakReplies;
    setSpeakReplies(next);

    try {
      localStorage.setItem("slice-bot-speak-replies", next ? "true" : "false");
    } catch {
      // Ignore local storage failures.
    }

    if (!next) {
      stopSpeaking();
    }
  }

  useEffect(() => {
    void loadBot();
  }, []);

  useEffect(() => {
    try {
      const savedSound = localStorage.getItem("slice-bot-speak-replies");
      const savedRecognitionLanguage = localStorage.getItem("slice-bot-recognition-language");

      if (savedSound === "false") {
        setSpeakReplies(false);
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
      localStorage.setItem("slice-bot-recognition-language", recognitionLanguage);
    } catch {
      // Ignore local storage failures.
    }
  }, [recognitionLanguage]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

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

  if (!enabled) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999]">
      {panelOpen ? (
        <div className="w-[min(580px,calc(100vw-2rem))] overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/96 shadow-2xl shadow-red-950/50 backdrop-blur-xl">
          <div className="border-b border-white/10 bg-gradient-to-r from-red-950/70 via-zinc-950 to-black p-4">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={listening ? stopVoiceCommand : startVoiceCommand}
                className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500"
                title={listening ? "Stop listening" : "Tap to speak"}
              >
                <HumanRobotAvatar listening={listening} speaking={speaking} size="small" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-white">
                  {bot?.profile.botName ?? "Slice AI"}
                </div>
                <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-red-300">
                  {listening
                    ? `Listening · ${recognitionLanguage}`
                    : speaking
                      ? `Speaking · ${bot?.profile.preferredTone ?? "Professional"}`
                      : `${bot?.profile.preferredTone ?? "Professional"} · Chat-first AI`}
                </div>
              </div>

              <a
                href="/workspace/personal-bot"
                className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-400/20"
              >
                Studio
              </a>

              <button
                onClick={() => setPanelOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:bg-white/10"
              >
                Hide
              </button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2">
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200">
                  AI
                </div>
                <div className="mt-1 truncate text-xs font-bold text-white">
                  {readableStatus(bot)}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">
                  Behaviour
                </div>
                <div className="mt-1 truncate text-xs font-bold text-white">
                  Answers stay here
                </div>
              </div>
              <div className="rounded-2xl border border-purple-400/20 bg-purple-400/10 px-3 py-2">
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-purple-200">
                  Voice
                </div>
                <div className="mt-1 truncate text-xs font-bold text-white">
                  Tone-aware speech
                </div>
              </div>
            </div>
          </div>

          <div className="max-h-[500px] space-y-3 overflow-y-auto p-4">
            {bot?.requiresOnboarding ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                Your bot is not personalized yet. Finish setup to unlock stronger style, memory, and command behaviour.
                <a
                  href="/bot-onboarding"
                  className="mt-3 block rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950"
                >
                  Start Bot Setup
                </a>
              </div>
            ) : null}

            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4 text-sm leading-6 text-slate-300">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                  Ask anything
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                  Presentation mode
                </span>
                <span className="rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-red-100">
                  No auto-reroute
                </span>
              </div>

              <div className="whitespace-pre-wrap">
                {latestAssistantMessage?.content ??
                  "Ask anything. I will answer in a fast, professional, advisor-grade way first. I will only suggest destinations, sources, or reports when useful, and I will not automatically move you to another section."}
              </div>
            </div>

            {voiceTranscript && listening ? (
              <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-sm font-semibold leading-6 text-cyan-100">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
                  Heard so far
                </div>
                <div className="mt-1">{voiceTranscript}</div>
              </div>
            ) : null}

            {actionIsReport(latestAction) ? (
              <a
                href={latestAction?.href}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm font-black text-red-100 hover:bg-red-500/20"
              >
                Open Presentation PDF
              </a>
            ) : null}

            {actionIsSource(latestAction) ? (
              <a
                href={latestAction?.href}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-center text-sm font-black text-cyan-100 hover:bg-cyan-500/20"
              >
                Open Source Link
              </a>
            ) : null}

            {actionIsNavigation(latestAction) ? (
              <div className="rounded-2xl border border-white/10 bg-black/35 p-3 text-xs leading-5 text-slate-400">
                Slice found a related workspace destination. It will not move you there automatically.
                <a
                  href={latestAction?.href}
                  className="mt-2 block rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-black text-white hover:bg-white/10"
                >
                  Open Suggested Section Manually
                </a>
              </div>
            ) : null}

            {latestPdf ? (
              <a
                href={latestPdf.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-500/15 to-cyan-500/10 px-4 py-3 text-center text-sm font-black text-red-50 hover:from-red-500/25 hover:to-cyan-500/20"
              >
                Download Latest PDF Report
              </a>
            ) : null}

            <div className="grid gap-2">
              {quickPrompts.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => void sendPromptText(item, "quick")}
                  disabled={sending}
                  className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-left text-xs font-bold leading-5 text-slate-200 hover:border-red-400/30 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {item}
                </button>
              ))}
            </div>

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
              onKeyDown={handlePromptKeyDown}
              className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              placeholder="Ask anything, give a rough voice-style command, or request a presentation-ready report..."
            />

            <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] gap-2">
              <select
                value={recognitionLanguage}
                onChange={(event) => setRecognitionLanguage(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/50 px-3 py-3 text-xs font-black text-white outline-none"
                title="Voice recognition language"
              >
                <option value="en-US">Voice: US English</option>
                <option value="en-GB">Voice: UK English</option>
                <option value="en-AU">Voice: AU English</option>
              </select>

              <FloatingButton
                onClick={() => prompt.trim() && speakText(prompt, true)}
                disabled={!prompt.trim() || !bot?.profile.voiceEnabled}
              >
                Read Mine
              </FloatingButton>

              <FloatingButton
                onClick={() => {
                  if (latestAssistantMessage?.content) {
                    speakText(latestAssistantMessage.content, true);
                  }
                }}
                disabled={!latestAssistantMessage?.content || !bot?.profile.voiceEnabled}
              >
                Read Bot
              </FloatingButton>

              <button
                disabled={sending || !prompt.trim()}
                className="rounded-2xl bg-red-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
              >
                {sending ? "Thinking" : "Send"}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              <button
                type="button"
                onClick={listening ? stopVoiceCommand : startVoiceCommand}
                disabled={!bot?.profile.voiceEnabled}
                className={cx(
                  "rounded-full px-3 py-1.5",
                  listening
                    ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/30"
                    : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
                )}
              >
                {listening ? "Stop listening" : "Voice command"}
              </button>

              <button
                type="button"
                onClick={toggleSpeakReplies}
                className={cx(
                  "rounded-full px-3 py-1.5 ring-1",
                  speakReplies
                    ? "bg-cyan-500/15 text-cyan-100 ring-cyan-400/30"
                    : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"
                )}
              >
                {speakReplies ? "Auto-speak on" : "Auto-speak off"}
              </button>

              <span>Ctrl + Enter sends</span>
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
            <HumanRobotAvatar listening={listening} speaking={speaking} size="large" />
          </button>

          <button
            onClick={() => setPanelOpen(true)}
            className="mb-1 rounded-2xl border border-white/10 bg-zinc-950/90 px-3 py-2 text-xs font-black text-white shadow-xl shadow-red-950/30 hover:bg-white/10"
          >
            AI Studio
          </button>
        </div>
      )}
    </div>
  );
}