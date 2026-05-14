"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

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
  };
  aiEngine?: {
    provider: string;
    configured: boolean;
    model: string;
    structuredCommands: boolean;
    approvalGates: boolean;
    platformBrain?: boolean;
    voiceLearning?: boolean;
    webSearchEnabled?: boolean;
  };
  messages: Array<{
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
    };
  }>;
  commands: Array<{
    id: string;
    commandText: string;
    commandType: string;
    status: string;
    resultSummary: string | null;
    createdAt: string;
    action?: Record<string, unknown>;
  }>;
  tabs: Array<{
    id: string;
    tabName: string;
    notes: string | null;
    pinnedCommands: string[];
    status: string;
  }>;
  emailDrafts?: Array<{
    id: string;
    targetTicker: string | null;
    subject: string;
    body: string;
    status: string;
    deliveryMode: string;
    recipients: Array<Record<string, unknown>>;
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
  dataViews?: Array<{
    id: string;
    viewName: string;
    viewType: string;
    result: Array<Record<string, unknown>>;
  }>;
  backendToolRuns?: Array<{
    id: string;
    toolKey: string;
    toolName: string;
    status: string;
    createdAt: string;
  }>;
  voiceSessions?: Array<{
    id: string;
    sessionKey: string;
    transcript: string;
    finalTranscript: string | null;
    status: string;
    confidenceScore: number;
    createdAt: string;
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
  trainingPhrases?: Array<{
    id: string;
    phrase: string;
    targetIntent: string;
    targetRoute: string | null;
    usageCount: number;
    successCount: number;
    status: string;
  }>;
  corrections?: Array<{
    id: string;
    originalCommand: string;
    interpretedIntent: string | null;
    correctedIntent: string;
    correctedRoute: string | null;
    correctionNotes: string | null;
    status: string;
  }>;
  researchRuns?: Array<{
    id: string;
    query: string;
    ticker: string | null;
    depth: string;
    status: string;
    confidenceScore: number;
    createdAt: string;
  }>;
};

type VoiceMode = "openai" | "browser";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneFor(value: string): "red" | "green" | "amber" | "purple" | "cyan" | "slate" {
  const lower = value.toLowerCase();

  if (
    lower.includes("high") ||
    lower.includes("pending") ||
    lower.includes("failed") ||
    lower.includes("critical")
  ) {
    return "red";
  }

  if (
    lower.includes("complete") ||
    lower.includes("active") ||
    lower.includes("approved") ||
    lower.includes("ready") ||
    lower.includes("configured")
  ) {
    return "green";
  }

  if (
    lower.includes("medium") ||
    lower.includes("open") ||
    lower.includes("queued") ||
    lower.includes("draft") ||
    lower.includes("listening")
  ) {
    return "amber";
  }

  if (lower.includes("ai") || lower.includes("bot") || lower.includes("research")) {
    return "purple";
  }

  if (
    lower.includes("backend") ||
    lower.includes("tool") ||
    lower.includes("kernel") ||
    lower.includes("voice")
  ) {
    return "cyan";
  }

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
    <span
      className={cx(
        "inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
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
        "rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-red-950/20 backdrop-blur-xl",
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
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function FriendlyRobot({
  listening,
  recording,
  thinking,
  onClick,
}: {
  listening: boolean;
  recording: boolean;
  thinking: boolean;
  onClick: () => void;
}) {
  const active = listening || recording;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group relative flex h-32 w-32 shrink-0 items-center justify-center rounded-[2.5rem] border shadow-2xl transition hover:scale-[1.03]",
        active
          ? "border-cyan-300/60 bg-cyan-500/15 shadow-cyan-950/40"
          : "border-white/10 bg-white/[0.06] shadow-red-950/30"
      )}
      aria-label="Tap robot to start or stop voice command"
    >
      <div
        className={cx(
          "absolute inset-[-10px] rounded-[3rem] border",
          active ? "animate-pulse border-cyan-400/40" : "border-white/5"
        )}
      />
      <div className="absolute inset-[-18px] rounded-[3.35rem] bg-cyan-400/5 blur-xl" />
      <div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-[2rem] bg-gradient-to-br from-slate-100 via-white to-slate-300 shadow-inner">
        <div className="absolute top-[-8px] h-4 w-12 rounded-full bg-slate-200 shadow-sm" />
        <div className="flex gap-4">
          <div
            className={cx(
              "h-3.5 w-3.5 rounded-full",
              recording ? "animate-pulse bg-cyan-500" : active ? "bg-cyan-500" : "bg-red-500"
            )}
          />
          <div
            className={cx(
              "h-3.5 w-3.5 rounded-full",
              thinking ? "animate-pulse bg-purple-500" : "bg-slate-800"
            )}
          />
        </div>
        <div className="mt-3 h-2 w-12 rounded-full bg-slate-800/80" />
        <div className="absolute bottom-2 left-4 h-3 w-2 rounded-full bg-slate-400" />
        <div className="absolute bottom-2 right-4 h-3 w-2 rounded-full bg-slate-400" />
      </div>
    </button>
  );
}

function getSupportedMimeType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return "";

  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
  ];

  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function extensionForMime(type: string) {
  if (type.includes("mp4")) return "mp4";
  if (type.includes("mpeg")) return "mp3";
  if (type.includes("wav")) return "wav";
  return "webm";
}

export default function WorkspacePersonalBotPage() {
  const [data, setData] = useState<BotPayload | null>(null);
  const [prompt, setPrompt] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [browserListening, setBrowserListening] = useState(false);
  const [serverRecording, setServerRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [recorderSupported, setRecorderSupported] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("openai");
  const [voiceLanguage, setVoiceLanguage] = useState("en-US");
  const [autoSendVoice, setAutoSendVoice] = useState(true);
  const [speakResponses, setSpeakResponses] = useState(true);
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastVoiceProvider, setLastVoiceProvider] = useState("");

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const [profileForm, setProfileForm] = useState({
    botName: "",
    preferredTone: "Professional",
    commandStyle: "Concise",
    autonomyLevel: "Advisor approval required",
    customInstructions: "",
    voiceEnabled: true,
  });

  const [tabForm, setTabForm] = useState({
    tabName: "My Bot",
    notes: "",
    pinnedCommandsText:
      "What should I do next?\nResearch NVDA\nOpen market visuals\nOpen venture monitor\nFind source for NVDA\nSearch the firm for Apple exposure\nSort opportunities by score\nCreate a price alert for NVDA above 1000\nRun backend vendor health\nCreate a premium PDF report",
  });

  const [correctionForm, setCorrectionForm] = useState({
    originalCommand: "",
    interpretedIntent: "",
    correctedIntent: "navigate",
    correctedRoute: "/market-visuals",
    correctionNotes: "",
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

    setData(payload);

    setProfileForm({
      botName: payload.profile.botName,
      preferredTone: payload.profile.preferredTone,
      commandStyle: payload.profile.commandStyle,
      autonomyLevel: payload.profile.autonomyLevel,
      customInstructions: payload.profile.customInstructions ?? "",
      voiceEnabled: payload.profile.voiceEnabled,
    });

    const tab = payload.tabs?.[0];

    if (tab) {
      setTabForm({
        tabName: tab.tabName,
        notes: tab.notes ?? "",
        pinnedCommandsText: tab.pinnedCommands.join("\n"),
      });
    }
  }

  function speak(text: string) {
    if (!speakResponses) return;
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;

    const clean = text.replace(/\s+/g, " ").slice(0, 900);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1;
    utterance.pitch = 1.02;
    utterance.volume = 0.92;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function runClientAction(clientAction?: Record<string, unknown>) {
    if (!clientAction) return;

    if (clientAction.type === "theme") {
      window.dispatchEvent(new Event("slice-theme-updated"));
    }

    if (typeof clientAction.href === "string" && clientAction.autoRun) {
      window.location.href = clientAction.href;
    }
  }

  function handleClientAction(payload: BotPayload) {
    const latestMessage = [...(payload.messages ?? [])]
      .reverse()
      .find((item) => item.role === "assistant");

    const clientAction = latestMessage?.metadata?.clientAction;

    if (latestMessage?.content) {
      speak(latestMessage.content);
    }

    runClientAction(clientAction);
  }

  async function sendCommand(event?: FormEvent, overridePrompt?: string, voiceTranscript?: string) {
    event?.preventDefault();

    const commandText = (overridePrompt ?? prompt).trim();

    if (!commandText) return;

    setSaving(true);
    setMessage("");
    setVoiceError("");

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
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Command failed.");
        return;
      }

      setData(payload);
      setPrompt("");
      setInterimTranscript("");
      handleClientAction(payload);
    } finally {
      setSaving(false);
    }
  }

  async function sendAudioToOpenAi(blob: Blob) {
    setSaving(true);
    setMessage("");
    setVoiceError("");

    try {
      const mimeType = blob.type || "audio/webm";
      const ext = extensionForMime(mimeType);

      const formData = new FormData();
      formData.set("action", autoSendVoice ? "transcribeAndExecute" : "transcribeOnly");
      formData.set("language", voiceLanguage);
      formData.set("fallbackPrompt", prompt);
      formData.set("fallbackTranscript", lastTranscript);
      formData.set("audio", blob, `slice-voice-${Date.now()}.${ext}`);

      const response = await fetch("/api/personal-bot/voice", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        setVoiceError(payload.error ?? "Voice transcription had an issue. The bot stayed ready for typed commands.");
        return;
      }

      setLastTranscript(payload.transcript ?? "");
      setLastVoiceProvider(
        `${payload.transcription?.provider ?? "OpenAI"} · ${payload.transcription?.model ?? "transcription"}`
      );

      if (payload.transcript && !autoSendVoice) {
        setPrompt(payload.transcript);
      }

      if (payload.result?.answer) {
        speak(payload.result.answer);
        runClientAction(payload.result.clientAction);
      }

      await loadBot();
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

      setData(payload);
      setMessage("Bot profile updated.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTab() {
    setSaving(true);
    setMessage("");

    try {
      const pinnedCommands = tabForm.pinnedCommandsText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);

      const response = await fetch("/api/personal-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "updateTab",
          tabName: tabForm.tabName,
          notes: tabForm.notes,
          pinnedCommands,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Tab update failed.");
        return;
      }

      setData(payload);
      setMessage("Bot tab updated.");
    } finally {
      setSaving(false);
    }
  }

  async function rebuildPlatformBrain() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/personal-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "rebuildPlatformBrain",
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Platform Brain rebuild failed.");
        return;
      }

      setData(payload);
      setMessage("Platform Brain rebuilt.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCorrection() {
    if (!correctionForm.originalCommand.trim() || !correctionForm.correctedIntent.trim()) {
      setMessage("Original command and corrected intent are required.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/personal-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "saveCorrection",
          ...correctionForm,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Correction save failed.");
        return;
      }

      setData(payload);
      setMessage("Correction saved. The bot will use it as training context.");
      setCorrectionForm({
        originalCommand: "",
        interpretedIntent: "",
        correctedIntent: "navigate",
        correctedRoute: "/market-visuals",
        correctionNotes: "",
      });
    } finally {
      setSaving(false);
    }
  }

  function startBrowserVoice() {
    setVoiceError("");

    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError("Browser voice recognition is not supported here. Switch to OpenAI Voice mode.");
      setVoiceMode("openai");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = voiceLanguage;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setBrowserListening(true);
      setInterimTranscript("");
      setLastVoiceProvider("Browser Speech Recognition");
    };

    recognition.onerror = (event: any) => {
      setVoiceError(
        event?.error
          ? `Browser voice error: ${event.error}. Switch to OpenAI Voice if this continues.`
          : "Browser voice recognition had an issue. Switch to OpenAI Voice if this continues."
      );
      setBrowserListening(false);
    };

    recognition.onend = () => {
      setBrowserListening(false);
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript ?? "";

        if (event.results[index].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim) {
        setInterimTranscript(interim);
      }

      if (finalText.trim()) {
        const clean = finalText.trim();
        setPrompt(clean);
        setLastTranscript(clean);
        setInterimTranscript("");

        if (autoSendVoice) {
          void sendCommand(undefined, clean, clean);
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  async function startOpenAiVoice() {
    setVoiceError("");

    if (typeof window === "undefined") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Microphone recording is not supported in this browser.");
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setVoiceError("Voice recording requires HTTPS or localhost.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setServerRecording(true);
        setInterimTranscript("Recording voice command...");
        setLastVoiceProvider("OpenAI Audio Transcription");
      };

      recorder.onerror = () => {
        setVoiceError("Recording had an issue. Check microphone permission or try Browser Voice.");
        setServerRecording(false);
      };

      recorder.onstop = () => {
        setServerRecording(false);
        setInterimTranscript("");

        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type });

        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        if (blob.size <= 0) {
          setVoiceError("No audio was recorded. The bot is still ready for a typed command.");
          return;
        }

        void sendAudioToOpenAi(blob);
      };

      recorder.start();
    } catch (error) {
      setVoiceError(
        error instanceof Error
          ? `${error.message}. Try Browser Voice or type the command.`
          : "Could not start microphone recording. Try Browser Voice or type the command."
      );
      setServerRecording(false);
    }
  }

  function stopOpenAiVoice() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }

  function stopBrowserVoice() {
    recognitionRef.current?.stop?.();
    setBrowserListening(false);
  }

  function toggleVoice() {
    if (browserListening) {
      stopBrowserVoice();
      return;
    }

    if (serverRecording) {
      stopOpenAiVoice();
      return;
    }

    if (voiceMode === "browser") {
      startBrowserVoice();
      return;
    }

    void startOpenAiVoice();
  }

  useEffect(() => {
    void loadBot();

    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      setVoiceSupported(Boolean(SpeechRecognition));
      setRecorderSupported(Boolean(navigator.mediaDevices?.getUserMedia && "MediaRecorder" in window));
    }

    return () => {
      recognitionRef.current?.stop?.();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#050505] p-6 text-white">
        <Card className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-black">Loading Slice AI command center...</h1>
          {message ? <p className="mt-3 text-sm text-red-200">{message}</p> : null}
        </Card>
      </main>
    );
  }

  const openInsights = data.researchRuns ?? [];

  const pendingApprovals = [
    ...(data.approvals
      ?.filter((item) => item.status === "Pending")
      .map((item) => ({
        ...item,
        approvalSource: "bot-approval",
      })) ?? []),
    ...(data.backendApprovals
      ?.filter((item) => item.status === "Pending")
      .map((item) => ({
        ...item,
        approvalSource: "backend-approval",
      })) ?? []),
  ];

  const latestAssistant = [...data.messages].reverse().find((item) => item.role === "assistant");
  const latestStructuredCommand = latestAssistant?.metadata?.structuredCommand;
  const activeVoice = browserListening || serverRecording;

  return (
    <main className="min-h-screen bg-[#050505] p-5 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-12%] top-[-10%] h-[32rem] w-[32rem] rounded-full bg-red-700/24 blur-3xl" />
        <div className="absolute right-[-12%] top-[14%] h-[34rem] w-[34rem] rounded-full bg-cyan-700/12 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[30%] h-[30rem] w-[30rem] rounded-full bg-purple-700/12 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-[1700px] gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <FriendlyRobot
                listening={browserListening}
                recording={serverRecording}
                thinking={saving}
                onClick={toggleVoice}
              />

              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                  Slice Personal AI Voice Command Center
                </div>
                <h1 className="mt-2 text-4xl font-black md:text-6xl">
                  {data.profile.botName}
                </h1>
                <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400">
                  This bot uses OpenAI audio transcription, browser voice recognition, fast local command routing,
                  Platform Brain memory, learned phrase correction, and safe backend execution. Rough commands are
                  recovered into navigation, research, search, action, answer, or help instead of hard-failing.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Pill tone={data.aiEngine?.configured ? "green" : "amber"}>
                    {data.aiEngine?.provider ?? "AI Engine"}
                  </Pill>
                  <Pill tone="purple">{data.aiEngine?.model ?? "gpt-5"}</Pill>
                  <Pill tone={recorderSupported ? "green" : "red"}>
                    OpenAI Voice {recorderSupported ? "Ready" : "Unavailable"}
                  </Pill>
                  <Pill tone={voiceSupported ? "green" : "amber"}>
                    Browser Voice {voiceSupported ? "Ready" : "Fallback Needed"}
                  </Pill>
                  <Pill tone="cyan">Fast Router</Pill>
                  <Pill tone="red">Approval Gates</Pill>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <a href="/workspace" className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950">
                Workspace Home
              </a>
              <a href="/backend-kernel" className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-center text-sm font-black text-cyan-100">
                Backend Kernel
              </a>
              <a href="/market-visuals" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-black text-emerald-100">
                Market Visuals
              </a>
              <button
                onClick={rebuildPlatformBrain}
                className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-center text-sm font-black text-purple-100"
              >
                Rebuild Brain
              </button>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        {voiceError ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
            {voiceError}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
          <Metric label="Voice Mode" value={voiceMode === "openai" ? "OpenAI" : "Browser"} helper={lastVoiceProvider || "Ready"} tone="cyan" />
          <Metric label="Voice Sessions" value={data.voiceSessions?.length ?? 0} helper="Stored sessions" tone="purple" />
          <Metric label="Training" value={data.trainingPhrases?.length ?? 0} helper="Learned phrases" tone="green" />
          <Metric label="Corrections" value={data.corrections?.length ?? 0} helper="Fixed commands" tone="amber" />
          <Metric label="Platform Map" value={data.platformMap?.length ?? 0} helper="Known routes" tone="cyan" />
          <Metric label="Approvals" value={pendingApprovals.length} helper="Pending decisions" tone={pendingApprovals.length ? "red" : "green"} />
          <Metric label="Research" value={openInsights.length} helper="Research runs" tone="purple" />
          <Metric label="Commands" value={data.commands?.length ?? 0} helper="History" tone="slate" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                  Voice-to-Command Infrastructure
                </div>
                <h2 className="mt-2 text-2xl font-black">
                  Tap robot, speak, execute
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  Use OpenAI Voice when browser recognition struggles. Use Browser Voice for fast local commands.
                  Auto-send immediately executes the transcribed command; review mode places the transcript in the text box first.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setVoiceMode("openai")}
                  className={cx(
                    "rounded-2xl px-4 py-3 text-xs font-black",
                    voiceMode === "openai"
                      ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-500/30"
                      : "bg-white/5 text-white ring-1 ring-white/10"
                  )}
                >
                  OpenAI Voice
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceMode("browser")}
                  className={cx(
                    "rounded-2xl px-4 py-3 text-xs font-black",
                    voiceMode === "browser"
                      ? "bg-purple-500/15 text-purple-100 ring-1 ring-purple-500/30"
                      : "bg-white/5 text-white ring-1 ring-white/10"
                  )}
                >
                  Browser Voice
                </button>
                <button
                  type="button"
                  onClick={() => setAutoSendVoice((current) => !current)}
                  className={cx(
                    "rounded-2xl px-4 py-3 text-xs font-black",
                    autoSendVoice
                      ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/30"
                      : "bg-white/5 text-white ring-1 ring-white/10"
                  )}
                >
                  Auto-send {autoSendVoice ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  onClick={() => setSpeakResponses((current) => !current)}
                  className={cx(
                    "rounded-2xl px-4 py-3 text-xs font-black",
                    speakResponses
                      ? "bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/30"
                      : "bg-white/5 text-white ring-1 ring-white/10"
                  )}
                >
                  Speak replies {speakResponses ? "On" : "Off"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px]">
              <select
                value={voiceLanguage}
                onChange={(event) => setVoiceLanguage(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-cyan-500 focus:ring-2"
              >
                <option value="en-US">English - US</option>
                <option value="en-GB">English - UK</option>
                <option value="es-US">Spanish - US</option>
                <option value="es-MX">Spanish - Mexico</option>
              </select>

              <button
                type="button"
                onClick={toggleVoice}
                className={cx(
                  "rounded-2xl px-5 py-3 text-sm font-black shadow-lg disabled:opacity-50",
                  activeVoice
                    ? "bg-cyan-500 text-slate-950 shadow-cyan-950/40"
                    : "border border-cyan-500/30 bg-cyan-500/10 text-cyan-100 shadow-cyan-950/30"
                )}
              >
                {activeVoice ? "Stop Voice" : "Start Voice"}
              </button>
            </div>

            <form onSubmit={sendCommand} className="mt-5">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-40 w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                placeholder="Try: Research NVDA. Open market visuals. Open venture monitor. Find source for Apple. Search firm for Tesla exposure. Create price alert for MSFT below 390. Run backend vendor health. Approve latest."
              />

              {interimTranscript ? (
                <div className="mt-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm font-bold text-cyan-100">
                  {interimTranscript}
                </div>
              ) : null}

              {lastTranscript ? (
                <div className="mt-3 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3 text-sm font-bold text-purple-100">
                  Last transcript: {lastTranscript}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  disabled={saving || !prompt.trim()}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
                >
                  Execute Command
                </button>

                <button
                  type="button"
                  onClick={toggleVoice}
                  className={cx(
                    "rounded-2xl px-5 py-3 text-sm font-black shadow-lg disabled:opacity-50",
                    activeVoice
                      ? "bg-cyan-500 text-slate-950 shadow-cyan-950/40"
                      : "border border-cyan-500/30 bg-cyan-500/10 text-cyan-100 shadow-cyan-950/30"
                  )}
                >
                  {activeVoice ? "Stop Listening" : "Tap to Speak"}
                </button>

                {data.tabs[0]?.pinnedCommands.map((command, index) => (
                  <button
                    key={`${data.tabs[0].id}-pinned-${index}-${command}`}
                    type="button"
                    onClick={() => setPrompt(command)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white"
                  >
                    {command}
                  </button>
                ))}
              </div>
            </form>

            {latestStructuredCommand ? (
              <div className="mt-5 rounded-[1.5rem] border border-cyan-500/20 bg-cyan-500/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                      Latest AI Interpretation
                    </div>
                    <div className="mt-1 text-lg font-black text-white">
                      {String((latestStructuredCommand as any).intent ?? "unknown")}
                    </div>
                  </div>
                  <Pill tone={(latestStructuredCommand as any).requiresApproval ? "red" : "green"}>
                    {(latestStructuredCommand as any).requiresApproval ? "Approval Required" : "Direct Action"}
                  </Pill>
                </div>

                <pre className="mt-4 max-h-72 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-slate-300">
                  {JSON.stringify(latestStructuredCommand, null, 2)}
                </pre>
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              {data.messages.slice(-12).map((item) => (
                <div
                  key={item.id}
                  className={cx(
                    "rounded-2xl border p-4 text-sm leading-7",
                    item.role === "user"
                      ? "border-red-500/30 bg-red-500/10 text-red-100"
                      : "border-white/10 bg-white/[0.055] text-slate-300"
                  )}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    <span>{item.role}</span>
                    <span>·</span>
                    <span>{item.intent}</span>
                    {item.metadata?.aiParserOk === false ? <Pill tone="amber">Fallback Parser</Pill> : null}
                  </div>
                  <div className="whitespace-pre-wrap">{item.content}</div>

                  {item.metadata?.clientAction?.href && !item.metadata.clientAction.autoRun ? (
                    <a
                      href={item.metadata.clientAction.href}
                      target={item.metadata.clientAction.type === "source" ? "_blank" : undefined}
                      rel={item.metadata.clientAction.type === "source" ? "noreferrer" : undefined}
                      className="mt-3 inline-flex rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                    >
                      Open Result
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <aside className="grid gap-6">
            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                Voice Health
              </div>
              <div className="mt-4 grid gap-3">
                <Metric label="OpenAI Voice" value={recorderSupported ? "Ready" : "Unavailable"} helper="Server transcription fallback" tone={recorderSupported ? "green" : "red"} />
                <Metric label="Browser Voice" value={voiceSupported ? "Ready" : "Fallback"} helper="SpeechRecognition API" tone={voiceSupported ? "green" : "amber"} />
                <Metric
                  label="Secure Context"
                  value={typeof window !== "undefined" && (window.isSecureContext || window.location.hostname === "localhost") ? "Ready" : "Needs HTTPS"}
                  helper="Mic access requirement"
                  tone={typeof window !== "undefined" && (window.isSecureContext || window.location.hostname === "localhost") ? "green" : "red"}
                />
              </div>
            </Card>

            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                Voice Command Examples
              </div>

              <div className="mt-4 grid gap-2">
                {[
                  "Open market visuals",
                  "Open venture monitor",
                  "Take me to trage",
                  "Research NVDA deeply",
                  "Find source for Apple",
                  "Search the firm for Tesla exposure",
                  "Create a price alert for MSFT below 390",
                  "Run backend vendor health",
                  "Approve latest",
                  "Remember I prefer direct answers",
                ].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-left text-sm font-bold text-white hover:bg-white/[0.08]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                Teach the Bot
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                If the bot misunderstands a phrase, save the correction here. It will be included in future OpenAI command context.
              </p>

              <div className="mt-4 grid gap-3">
                <input
                  value={correctionForm.originalCommand}
                  onChange={(event) => setCorrectionForm((current) => ({ ...current, originalCommand: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                  placeholder="Original command it misunderstood"
                />

                <input
                  value={correctionForm.interpretedIntent}
                  onChange={(event) => setCorrectionForm((current) => ({ ...current, interpretedIntent: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                  placeholder="Interpreted intent, optional"
                />

                <select
                  value={correctionForm.correctedIntent}
                  onChange={(event) => setCorrectionForm((current) => ({ ...current, correctedIntent: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                >
                  <option value="navigate">navigate</option>
                  <option value="research">research</option>
                  <option value="platform_search">platform_search</option>
                  <option value="source_lookup">source_lookup</option>
                  <option value="create_task">create_task</option>
                  <option value="create_price_alert">create_price_alert</option>
                  <option value="backend_job">backend_job</option>
                  <option value="approval_decision">approval_decision</option>
                  <option value="create_report">create_report</option>
                </select>

                <input
                  value={correctionForm.correctedRoute}
                  onChange={(event) => setCorrectionForm((current) => ({ ...current, correctedRoute: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                  placeholder="Correct route, optional"
                />

                <textarea
                  value={correctionForm.correctionNotes}
                  onChange={(event) => setCorrectionForm((current) => ({ ...current, correctionNotes: event.target.value }))}
                  className="min-h-24 resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                  placeholder="Correction notes"
                />

                <button
                  onClick={saveCorrection}
                  disabled={saving}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
                >
                  Save Correction
                </button>
              </div>
            </Card>

            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                Bot Profile
              </div>

              <div className="mt-4 grid gap-3">
                <input
                  value={profileForm.botName}
                  onChange={(event) => setProfileForm((current) => ({ ...current, botName: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                  placeholder="Bot name"
                />

                <input
                  value={profileForm.preferredTone}
                  onChange={(event) => setProfileForm((current) => ({ ...current, preferredTone: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                  placeholder="Preferred tone"
                />

                <textarea
                  value={profileForm.customInstructions}
                  onChange={(event) => setProfileForm((current) => ({ ...current, customInstructions: event.target.value }))}
                  className="min-h-28 resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                  placeholder="Custom instructions"
                />

                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
                >
                  Save Bot Profile
                </button>
              </div>
            </Card>

            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                Custom Pinned Commands
              </div>

              <div className="mt-4 grid gap-3">
                <input
                  value={tabForm.tabName}
                  onChange={(event) => setTabForm((current) => ({ ...current, tabName: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                />

                <textarea
                  value={tabForm.pinnedCommandsText}
                  onChange={(event) => setTabForm((current) => ({ ...current, pinnedCommandsText: event.target.value }))}
                  className="min-h-36 resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                />

                <button
                  onClick={saveTab}
                  disabled={saving}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
                >
                  Save Bot Tab
                </button>
              </div>
            </Card>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-4">
          <Card>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
              Voice Sessions
            </div>
            <div className="mt-4 grid max-h-[420px] gap-3 overflow-y-auto pr-1">
              {(data.voiceSessions ?? []).slice(0, 12).map((session) => (
                <div key={session.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-black text-white">{session.status}</div>
                    <Pill tone={toneFor(session.status)}>{session.confidenceScore}%</Pill>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">
                    {session.finalTranscript || session.transcript || "No transcript"}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
              Platform Brain
            </div>
            <div className="mt-4 grid max-h-[420px] gap-3 overflow-y-auto pr-1">
              {(data.platformMap ?? []).slice(0, 14).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="font-black text-white">{item.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.category} · {item.route}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.aliases.slice(0, 4).map((alias) => (
                      <Pill key={`${item.id}-${alias}`} tone="slate">
                        {alias}
                      </Pill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
              Learned Phrases
            </div>
            <div className="mt-4 grid max-h-[420px] gap-3 overflow-y-auto pr-1">
              {(data.trainingPhrases ?? []).slice(0, 14).map((phrase) => (
                <div key={phrase.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="font-black text-white">{phrase.phrase}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {phrase.targetIntent} · used {phrase.usageCount}
                  </div>
                  {phrase.targetRoute ? (
                    <div className="mt-2 text-xs text-cyan-300">{phrase.targetRoute}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
              Corrections
            </div>
            <div className="mt-4 grid max-h-[420px] gap-3 overflow-y-auto pr-1">
              {(data.corrections ?? []).slice(0, 14).map((correction) => (
                <div key={correction.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="font-black text-white">{correction.originalCommand}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    → {correction.correctedIntent}
                  </div>
                  {correction.correctedRoute ? (
                    <div className="mt-2 text-xs text-cyan-300">{correction.correctedRoute}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                  Approval Queue
                </div>
                <h2 className="mt-2 text-xl font-black">Human-gated actions</h2>
              </div>
              <Pill tone={pendingApprovals.length ? "red" : "green"}>{pendingApprovals.length}</Pill>
            </div>

            <div className="mt-4 grid gap-3">
              {pendingApprovals.slice(0, 8).map((approval, index) => (
                <div
                  key={`pending-approval-${approval.approvalSource}-${approval.id}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-black text-white">{approval.title}</div>
                    <Pill tone={toneFor(approval.status)}>{approval.status}</Pill>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{approval.actionType} · {approval.riskLevel}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{approval.summary}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
              Research Runs
            </div>
            <div className="mt-4 grid gap-3">
              {(data.researchRuns ?? []).slice(0, 10).map((run) => (
                <div key={run.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="font-black text-white">{run.query}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {run.ticker ?? "No ticker"} · {run.depth} · {run.confidenceScore}%
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
              Backend Tool Runs
            </div>
            <div className="mt-4 grid gap-3">
              {(data.backendToolRuns ?? []).slice(0, 10).map((run) => (
                <div key={run.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{run.toolName}</div>
                      <div className="mt-1 text-xs text-slate-500">{run.toolKey} · {new Date(run.createdAt).toLocaleString()}</div>
                    </div>
                    <Pill tone={toneFor(run.status)}>{run.status}</Pill>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
            Recent Commands
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.commands.slice(0, 15).map((command) => (
              <div key={command.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-3">
                <div className="text-sm font-black text-white">{command.commandType}</div>
                <div className="mt-1 text-xs leading-5 text-slate-400">{command.resultSummary ?? command.commandText}</div>
                <div className="mt-2 inline-flex rounded-full bg-slate-500/10 px-2 py-1 text-[10px] font-black text-slate-300 ring-1 ring-slate-500/30">
                  {command.status}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}