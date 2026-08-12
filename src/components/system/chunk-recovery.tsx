"use client";

import { useEffect } from "react";

const RECOVERY_KEY = "slice-chunk-recovery-v2";
const RECOVERY_QUERY_KEY = "__slice_chunk_refresh";

const RECOVERABLE_PATTERNS = [
  /module factory is not available/i,
  /chunkloaderror/i,
  /loading chunk [\d\w-]+ failed/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /was instantiated because it was required from module/i,
] as const;

function errorText(value: unknown) {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [record.name, record.message, record.reason]
      .map((item) => (typeof item === "string" ? item : ""))
      .filter(Boolean)
      .join(": ");
  }

  return "";
}

function recoverable(value: unknown) {
  const text = errorText(value);
  return Boolean(text && RECOVERABLE_PATTERNS.some((pattern) => pattern.test(text)));
}

async function unregisterLegacyWorkers() {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.allSettled(
    registrations
      .filter((registration) => {
        const script = registration.active?.scriptURL ?? "";
        return /(?:service-worker|sw\.js|workbox|next-pwa)/i.test(script);
      })
      .map((registration) => registration.unregister()),
  );
}

async function clearLegacyRuntimeCaches() {
  if (!("caches" in window)) return;

  const names = await caches.keys();

  await Promise.allSettled(
    names
      .filter((name) => /(?:slice|workbox|next-pwa|runtime)/i.test(name))
      .map((name) => caches.delete(name)),
  );
}

function canonicalLocation() {
  const url = new URL(window.location.href);
  url.searchParams.delete(RECOVERY_QUERY_KEY);
  return `${url.pathname}${url.search}`;
}

async function recoverOnce() {
  const current = canonicalLocation();
  const previous = window.sessionStorage.getItem(RECOVERY_KEY);

  if (previous === current) {
    return;
  }

  window.sessionStorage.setItem(RECOVERY_KEY, current);

  await Promise.allSettled([
    unregisterLegacyWorkers(),
    clearLegacyRuntimeCaches(),
  ]);

  const url = new URL(window.location.href);
  url.searchParams.set(RECOVERY_QUERY_KEY, Date.now().toString(36));
  window.location.replace(url.toString());
}

export default function ChunkRecovery() {
  useEffect(() => {
    function onWindowError(event: ErrorEvent) {
      if (recoverable(event.error ?? event.message)) {
        void recoverOnce();
      }
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      if (recoverable(event.reason)) {
        void recoverOnce();
      }
    }

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    const successfulMount = window.setTimeout(() => {
      window.sessionStorage.removeItem(RECOVERY_KEY);

      const url = new URL(window.location.href);
      if (url.searchParams.has(RECOVERY_QUERY_KEY)) {
        url.searchParams.delete(RECOVERY_QUERY_KEY);
        window.history.replaceState(window.history.state, "", url.toString());
      }
    }, 8_000);

    return () => {
      window.clearTimeout(successfulMount);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}