"use client";

import { createPortal } from "react-dom";
import { Mic, MicOff, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ClientListItem } from "@/lib/clients/contracts";
import {
  WorkspaceAlert,
  WorkspaceButton,
  WorkspacePill,
  WorkspaceTextarea,
} from "@/components/workspace/core/workspace-ui";

type ClientVoiceSpeechRecognitionAlternative = {
  transcript: string;
  confidence?: number;
};

type ClientVoiceSpeechRecognitionResult = {
  0?: ClientVoiceSpeechRecognitionAlternative;
  isFinal?: boolean;
};

type ClientVoiceSpeechRecognitionEvent = {
  resultIndex?: number;
  results: ArrayLike<ClientVoiceSpeechRecognitionResult>;
};

type ClientVoiceSpeechRecognitionErrorEvent = {
  error?: string;
  message?: string;
};

type ClientVoiceRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onstart: (() => void) | null;
  onresult: ((event: ClientVoiceSpeechRecognitionEvent) => void) | null;
  onerror:
    | ((event: ClientVoiceSpeechRecognitionErrorEvent) => void)
    | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type ClientVoiceRecognitionConstructor =
  new () => ClientVoiceRecognition;

/**
 * Deliberately do not extend or intersect the global Window interface here.
 *
 * Other Slice voice surfaces augment Window.SpeechRecognition with their own
 * browser-boundary types. Keeping this component's constructor shape local
 * prevents those declarations from being merged into a constructor union.
 */
type ClientVoiceWindow = {
  SpeechRecognition?: ClientVoiceRecognitionConstructor;
  webkitSpeechRecognition?: ClientVoiceRecognitionConstructor;
};

function cleanSymbols(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((symbol) =>
      symbol
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9.\-:$]/g, ""),
    )
    .filter(Boolean);
}

export default function ClientVoiceAssistant({
  open,
  clients,
  onClose,
  onCreateDraft,
  onSelectClient,
  onPrepareHolding,
  onPrepareNote,
}: {
  open: boolean;
  clients: ClientListItem[];
  onClose: () => void;
  onCreateDraft: (values: {
    fullName?: string;
    email?: string;
  }) => void;
  onSelectClient: (clientId: string) => void;
  onPrepareHolding: (
    symbol: string,
    clientId?: string,
  ) => void;
  onPrepareNote: (
    body: string,
    clientId?: string,
  ) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const recognitionRef =
    useRef<ClientVoiceRecognition | null>(null);

  const dialogRef =
    useRef<HTMLElement | null>(null);

  const closeButtonRef =
    useRef<HTMLButtonElement | null>(null);

  const previousFocusRef =
    useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    previousFocusRef.current =
      document.activeElement as HTMLElement | null;

    document.body.style.overflow =
      "hidden";

    const focusTimer =
      window.setTimeout(
        () =>
          closeButtonRef.current?.focus(),
        0,
      );

    function onKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        onClose();
        return;
      }

      if (
        event.key ===
        "Tab"
      ) {
        const focusable =
          dialogRef.current
            ? Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(
                  'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
                ),
              )
            : [];

        if (
          !focusable.length
        ) {
          return;
        }

        const first =
          focusable[0];

        const last =
          focusable[
            focusable.length - 1
          ];

        if (
          event.shiftKey &&
          document.activeElement ===
            first
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement ===
            last
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener(
      "keydown",
      onKeyDown,
    );

    return () => {
      recognitionRef.current?.stop();

      document.body.style.overflow =
        previousOverflow;

      window.clearTimeout(
        focusTimer,
      );

      document.removeEventListener(
        "keydown",
        onKeyDown,
      );

      previousFocusRef.current?.focus();

      previousFocusRef.current =
        null;
    };
  }, [onClose, open]);

  function findClient(
    value: string,
  ) {
    const normalized =
      value
        .trim()
        .toLowerCase();

    if (!normalized) {
      return null;
    }

    return (
      clients.find(
        (client) =>
          client.fullName.toLowerCase() ===
          normalized,
      ) ||
      clients.find(
        (client) =>
          client.fullName
            .toLowerCase()
            .includes(
              normalized,
            ),
      ) ||
      null
    );
  }

  function applyCommand(
    raw: string,
  ) {
    const text =
      raw.trim();

    const lower =
      text.toLowerCase();

    setError("");
    setMessage("");

    if (!text) {
      setError(
        "Say or type a client command first.",
      );
      return;
    }

    if (
      lower.startsWith(
        "create client",
      ) ||
      lower.startsWith(
        "add client",
      )
    ) {
      const content =
        text
          .replace(
            /^create client/i,
            "",
          )
          .replace(
            /^add client/i,
            "",
          )
          .trim();

      const email =
        content.match(
          /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
        )?.[0] || "";

      const name =
        content
          .replace(
            email,
            "",
          )
          .replace(
            /\bemail\b/gi,
            "",
          )
          .replace(
            /\s+/g,
            " ",
          )
          .trim();

      onCreateDraft({
        fullName:
          name || undefined,

        email:
          email || undefined,
      });

      setMessage(
        "The new-client form is prepared. Review it before saving.",
      );

      onClose();
      return;
    }

    if (
      lower.startsWith(
        "select client",
      ) ||
      lower.startsWith(
        "open client",
      )
    ) {
      const name =
        text
          .replace(
            /^select client/i,
            "",
          )
          .replace(
            /^open client/i,
            "",
          )
          .trim();

      const client =
        findClient(name);

      if (!client) {
        setError(
          `No visible client matched “${name}”.`,
        );
        return;
      }

      onSelectClient(
        client.id,
      );

      setMessage(
        `${client.fullName} selected.`,
      );

      onClose();
      return;
    }

    const addMatch =
      text.match(
        /^add\s+(.+?)\s+to\s+(.+)$/i,
      );

    if (addMatch) {
      const symbol =
        cleanSymbols(
          addMatch[1] || "",
        )[0];

      const client =
        findClient(
          addMatch[2] || "",
        );

      if (!symbol) {
        setError(
          "The security symbol was not recognized.",
        );
        return;
      }

      if (!client) {
        setError(
          `No visible client matched “${addMatch[2]}”.`,
        );
        return;
      }

      onPrepareHolding(
        symbol,
        client.id,
      );

      setMessage(
        `${symbol} is prepared for ${client.fullName}. Review before adding.`,
      );

      onClose();
      return;
    }

    const noteMatch =
      text.match(
        /^note(?:\s+for\s+(.+?))?\s*[:,-]?\s*(.+)$/i,
      );

    if (noteMatch) {
      const client =
        noteMatch[1]
          ? findClient(
              noteMatch[1],
            )
          : null;

      const body =
        noteMatch[2]?.trim() ||
        "";

      if (!body) {
        setError(
          "The note body was empty.",
        );
        return;
      }

      onPrepareNote(
        body,
        client?.id,
      );

      setMessage(
        "The advisor note is prepared. Review before saving.",
      );

      onClose();
      return;
    }

    setError(
      "Command not recognized. Try “create client…”, “select client…”, “add NVDA to Jordan Smith”, or “note for Jordan Smith: follow up next week”.",
    );
  }

  function startListening() {
    /*
     * Cast through unknown into a local, component-specific browser boundary.
     * This prevents globally augmented SpeechRecognition constructors from
     * becoming part of the inferred constructor type.
     */
    const speechWindow =
      window as unknown as ClientVoiceWindow;

    const Recognition:
      | ClientVoiceRecognitionConstructor
      | undefined =
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setError(
        "Voice entry is not supported in this browser. Chrome or Edge is recommended.",
      );
      return;
    }

    recognitionRef.current?.stop();

    const recognition =
      new Recognition();

    recognitionRef.current =
      recognition;

    recognition.lang =
      "en-US";

    recognition.continuous =
      false;

    recognition.interimResults =
      false;

    recognition.maxAlternatives =
      1;

    recognition.onstart =
      () => {
        setListening(true);
      };

    recognition.onresult =
      (event) => {
        const firstResult =
          event.results[0];

        const firstAlternative =
          firstResult?.[0];

        const value =
          firstAlternative?.transcript.trim() ??
          "";

        setTranscript(
          value,
        );

        applyCommand(
          value,
        );
      };

    recognition.onerror =
      (event) => {
        setListening(false);

        setError(
          event.error
            ? `Voice error: ${event.error}`
            : event.message ||
                "Voice recognition failed.",
        );
      };

    recognition.onend =
      () => {
        setListening(false);
      };

    setError("");
    setMessage("");
    setListening(true);

    try {
      recognition.start();
    } catch (
      recognitionError
    ) {
      recognitionRef.current =
        null;

      setListening(false);

      setError(
        recognitionError instanceof
        Error
          ? recognitionError.message
          : "Voice recognition could not start.",
      );
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  if (
    !mounted ||
    !open
  ) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[2147483645] grid place-items-center bg-black/76 p-4 backdrop-blur-md">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label="Close voice assistant"
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-voice-title"
        className="relative w-full max-w-2xl rounded-[1.65rem] border border-emerald-300/18 bg-[#020806] p-5 shadow-[0_36px_110px_rgba(0,0,0,0.72)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <WorkspacePill tone="emerald">
                Review before save
              </WorkspacePill>

              <WorkspacePill tone="cyan">
                Browser voice recognition
              </WorkspacePill>
            </div>

            <h2
              id="client-voice-title"
              className="mt-3 text-2xl font-black text-white"
            >
              Client voice assistant
            </h2>

            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              Voice commands prepare forms only. They never create,
              delete, or change client data without your review.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
            aria-label="Close voice assistant"
          >
            <X
              className="h-4 w-4"
              aria-hidden="true"
            />
          </button>
        </div>

        {error ? (
          <WorkspaceAlert
            tone="error"
            className="mt-4"
          >
            {error}
          </WorkspaceAlert>
        ) : null}

        {message ? (
          <WorkspaceAlert
            tone="success"
            className="mt-4"
          >
            {message}
          </WorkspaceAlert>
        ) : null}

        <div className="mt-5 grid place-items-center rounded-2xl border border-white/8 bg-white/[0.025] p-6 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full border border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-200">
            {listening ? (
              <Mic
                className="h-8 w-8 animate-pulse"
                aria-hidden="true"
              />
            ) : (
              <Sparkles
                className="h-8 w-8"
                aria-hidden="true"
              />
            )}
          </div>

          <p className="mt-4 text-sm font-black text-white">
            {listening
              ? "Listening…"
              : "Speak a client command"}
          </p>

          <p className="mt-2 max-w-lg text-xs font-semibold leading-5 text-slate-500">
            Examples: “create client Dana Lee email
            dana@example.com”, “select client Dana Lee”, “add NVDA
            to Dana Lee”, or “note for Dana Lee: schedule tax
            review”.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <WorkspaceButton
              variant="primary"
              icon={
                <Mic
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              }
              onClick={
                startListening
              }
              disabled={
                listening
              }
            >
              Start listening
            </WorkspaceButton>

            <WorkspaceButton
              variant="secondary"
              icon={
                <MicOff
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              }
              onClick={
                stopListening
              }
              disabled={
                !listening
              }
            >
              Stop
            </WorkspaceButton>
          </div>
        </div>

        <div className="mt-4">
          <label
            className="text-xs font-black text-slate-200"
            htmlFor="client-voice-command"
          >
            Type or edit a command
          </label>

          <WorkspaceTextarea
            id="client-voice-command"
            value={transcript}
            onChange={
              (event) =>
                setTranscript(
                  event.target.value,
                )
            }
            placeholder="Type a command when voice is unavailable…"
            className="mt-2"
          />

          <WorkspaceButton
            className="mt-3 w-full"
            variant="secondary"
            onClick={
              () =>
                applyCommand(
                  transcript,
                )
            }
          >
            Prepare command
          </WorkspaceButton>
        </div>
      </section>
    </div>,
    document.body,
  );
}