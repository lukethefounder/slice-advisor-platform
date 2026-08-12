"use client";

import { useEffect, useRef } from "react";
import { useReportWebVitals } from "next/web-vitals";

const SESSION_STORAGE_KEY = "slice-web-vitals-session-v1";
const SUPPORTED_METRICS = new Set(["CLS", "FCP", "INP", "LCP", "TTFB"]);

function sampleRate() {
  const parsed = Number(process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE ?? "0.25");
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.25;
}

function sessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;

    const created =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return "unavailable";
  }
}

function deviceClass() {
  const width = window.innerWidth;
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function connectionType() {
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string };
    }
  ).connection;

  return String(connection?.effectiveType ?? "unknown").slice(0, 24);
}

function send(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const accepted = navigator.sendBeacon(
      "/api/operations/web-vitals",
      new Blob([body], { type: "application/json" }),
    );

    if (accepted) return;
  }

  void fetch("/api/operations/web-vitals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

export default function WebVitalsReporter() {
  const sampledRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (sampledRef.current === null) {
      sampledRef.current = Math.random() <= sampleRate();
    }
  }, []);

  useReportWebVitals((metric) => {
    if (sampledRef.current !== true || !SUPPORTED_METRICS.has(metric.name)) {
      return;
    }

    send({
      metricId: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
      route: window.location.pathname,
      sessionId: sessionId(),
      deviceClass: deviceClass(),
      connectionType: connectionType(),
      recordedAt: new Date().toISOString(),
    });
  });

  return null;
}