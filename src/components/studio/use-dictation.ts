"use client";

import { useEffect, useRef, useState } from "react";

import { STUDIO_LIMITS } from "@/lib/studio/contracts";

export function useDictation(
  onText: (text: string) => void,
  onError: (message: string) => void,
) {
  const [supported, setSupported] = useState(false);

  const [state, setState] = useState<
    "idle" | "recording" | "transcribing"
  >("idle");

  const [seconds, setSeconds] = useState(0);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);

  const discard = useRef(false);
  const alive = useRef(true);
  const token = useRef(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const tick = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const upload = useRef<AbortController | null>(null);
  const total = useRef(0);

  const textRef = useRef(onText);
  const errorRef = useRef(onError);

  textRef.current = onText;
  errorRef.current = onError;

  function cleanTimers() {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    if (tick.current) {
      clearInterval(tick.current);
    }
  }

  function stopTracks() {
    stream.current?.getTracks().forEach((track) => {
      track.stop();
    });

    stream.current = null;
  }

  function cancel() {
    token.current += 1;
    discard.current = true;

    cleanTimers();
    upload.current?.abort();

    if (recorder.current?.state === "recording") {
      recorder.current.stop();
    }

    stopTracks();

    if (alive.current) {
      setState("idle");
    }
  }

  useEffect(() => {
    alive.current = true;

    // Check capabilities without requesting microphone permission.
    // Explicit typeof checks avoid the TypeScript TS2774 error.
    const canRecord =
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia ===
        "function" &&
      typeof MediaRecorder === "function";

    setSupported(canRecord);

    return () => {
      alive.current = false;
      cancel();
    };
  }, []);

  async function start() {
    const generation = ++token.current;

    discard.current = false;
    chunks.current = [];
    total.current = 0;

    setSeconds(0);

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      // Permission can resolve after cancellation or navigation.
      // Release that stream without starting a recording.
      if (!alive.current || generation !== token.current) {
        media.getTracks().forEach((track) => {
          track.stop();
        });

        return;
      }

      stream.current = media;

      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));

      const activeRecorder = new MediaRecorder(
        media,
        mime ? { mimeType: mime } : undefined,
      );

      recorder.current = activeRecorder;

      activeRecorder.ondataavailable = (event) => {
        if (!event.data.size) {
          return;
        }

        total.current += event.data.size;

        if (total.current > STUDIO_LIMITS.audioBytes) {
          cancel();

          errorRef.current(
            "The recording exceeded 3 MB. Try a shorter message.",
          );

          return;
        }

        chunks.current.push(event.data);
      };

      activeRecorder.onerror = () => {
        cancel();

        errorRef.current(
          "The microphone could not record. Check browser permissions or type your message.",
        );
      };

      activeRecorder.onstop = async () => {
        cleanTimers();
        stopTracks();

        if (
          discard.current ||
          !alive.current ||
          generation !== token.current
        ) {
          return;
        }

        const blob = new Blob(chunks.current, {
          type: activeRecorder.mimeType || "audio/webm",
        });

        if (!blob.size) {
          setState("idle");
          return;
        }

        setState("transcribing");

        const controller = new AbortController();
        upload.current = controller;

        const timeout = setTimeout(() => {
          controller.abort();
        }, 50_000);

        try {
          const data = new FormData();

          const filename = blob.type.includes("mp4")
            ? "dictation.m4a"
            : blob.type.includes("ogg")
              ? "dictation.ogg"
              : "dictation.webm";

          data.append("audio", blob, filename);

          const response = await fetch(
            "/api/ai-studio/transcribe",
            {
              method: "POST",
              body: data,
              signal: controller.signal,
            },
          );

          const payload = await response.json();

          if (!response.ok) {
            throw new Error(
              typeof payload.message === "string"
                ? payload.message
                : "Transcription failed.",
            );
          }

          if (
            alive.current &&
            generation === token.current &&
            typeof payload.text === "string"
          ) {
            textRef.current(payload.text);
          }
        } catch (error) {
          if (alive.current && generation === token.current) {
            errorRef.current(
              error instanceof Error &&
                error.name !== "AbortError"
                ? error.message
                : "Transcription stopped or timed out.",
            );
          }
        } finally {
          clearTimeout(timeout);

          if (alive.current && generation === token.current) {
            setState("idle");
          }
        }
      };

      activeRecorder.start(500);
      setState("recording");

      const began = Date.now();

      tick.current = setInterval(() => {
        if (alive.current) {
          setSeconds(
            Math.floor((Date.now() - began) / 1_000),
          );
        }
      }, 1_000);

      timer.current = setTimeout(() => {
        if (activeRecorder.state === "recording") {
          activeRecorder.stop();
        }
      }, STUDIO_LIMITS.audioSeconds * 1_000);
    } catch (error) {
      stopTracks();

      if (alive.current && generation === token.current) {
        setState("idle");

        errorRef.current(
          error instanceof Error &&
            error.name === "NotAllowedError"
            ? "Microphone access was denied. Enable it in your browser or type your message."
            : "Microphone recording is unavailable in this browser. You can still type.",
        );
      }
    }
  }

  return {
    supported,
    state,
    seconds,
    start,

    stop: () => {
      if (recorder.current?.state === "recording") {
        recorder.current.stop();
      }
    },

    cancel,
  };
}