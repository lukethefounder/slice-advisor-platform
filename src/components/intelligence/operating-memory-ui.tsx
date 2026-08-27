"use client";

import {
  Activity,
  Clock3,
  Database,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";

import {
  IntelligencePill,
  type IntelligenceTone,
} from "@/components/intelligence/intelligence-ui";

export type ClientMemoryWindow = {
  days: number;
  startAt: string;
  endAt: string;
  label: string;
  minimumRetainedDays: number;
  durable: boolean;
  scope: string;
};

export type ClientOperatingRun = {
  id: string;
  requestId: string;
  symbol: string;
  asOfAt: string;
  generatedAt: string;
  engineVersion: string;
  modelVersion: string;
  calibrationVersion: string;
  marketRegime: string;
  sliceSentimentScore: number;
  dataQualityScore: number;
  sourceCount: number;
  independentSourceCount: number;
  simulationPaths: number;
  status: string;
  horizonCount: number;
  pendingHorizonCount: number;
  settledHorizonCount: number;
  nextPendingTargetAt: string | null;
};

export type ClientOperatingPrediction = {
  id: string;
  createdAt: string;
  forecastRunId: string | null;
  symbol: string | null;
  modelVersion: string | null;
  horizon: string | null;
  direction: string | null;
  probability: number | null;
  expectedReturnPercent: number | null;
  confidence: number | null;
  status: string;
};

export type ClientOperatingMemory = {
  generatedAt: string;
  window: ClientMemoryWindow;
  summary: {
    forecastRuns: number;
    returnedRuns: number;
    pendingHorizons: number;
    settledHorizons: number;
    settledOutcomes: number;
    modelArtifacts: number;
    horizonPredictions: number;
    ensemblePredictions: number;
    simulationRecords: number;
    completedBacktests: number;
    openDriftAlerts: number;
    evidenceAudits: number;
    validatedEvidenceAudits: number;
    needsReviewEvidenceAudits: number;
  };
  latest: {
    forecastGeneratedAt: string | null;
    providerAsOfAt: string | null;
    settledOutcomeAt: string | null;
    modelCreatedAt: string | null;
    horizonPredictionAt: string | null;
    ensemblePredictionAt: string | null;
    backtestCompletedAt: string | null;
    evidenceAuditAt: string | null;
  };
  recentRuns: ClientOperatingRun[];
  models: Array<{
    id: string;
    displayName: string;
    modelVersion: string;
    engineVersion: string;
    calibrationVersion: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    promotedAt: string | null;
    disabledAt: string | null;
  }>;
  horizonPredictions: ClientOperatingPrediction[];
  ensemblePredictions: ClientOperatingPrediction[];
  backtests: Array<{
    id: string;
    modelId: string;
    modelVersion: string;
    status: string;
    recommendation: string | null;
    createdAt: string;
    completedAt: string | null;
    holdoutSampleCount: number;
    eligibleSampleCount: number;
    excludedSampleCount: number;
    pointInTimeSafe: boolean;
    lookaheadDetected: boolean;
  }>;
  driftAlerts: Array<{
    id: string;
    modelId: string;
    modelVersion: string;
    horizon: string;
    severity: string;
    status: string;
    reason: string;
    createdAt: string;
    currentWindowEndAt: string | null;
  }>;
  safeguards: {
    autonomousTradingEnabled: false;
    automaticPromotionEnabled: false;
    futureDatedEvidenceAccepted: false;
    demoOutcomesAcceptedForValidation: false;
    monthMemoryMinimumEnforced: true;
  };
};

export function useVisibilityRefresh(
  callback: () => void | Promise<void>,
  options: {
    intervalMs?: number;
    enabled?: boolean;
    busy?: boolean;
  } = {},
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (options.enabled === false) return;

    const intervalMs = Math.max(
      30_000,
      options.intervalMs ?? 60_000,
    );
    const timer = window.setInterval(() => {
      if (
        options.busy ||
        document.visibilityState !== "visible" ||
        !navigator.onLine
      ) {
        return;
      }

      void callbackRef.current();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [
    options.busy,
    options.enabled,
    options.intervalMs,
  ]);
}

export function OperatingMemoryPills({
  memory,
  online,
  busy,
  children,
}: {
  memory: ClientOperatingMemory | null;
  online: boolean;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <IntelligencePill tone="emerald">
        <Database className="h-3.5 w-3.5" />
        {memory?.window.label ?? "30-day operating memory"}
      </IntelligencePill>
      <IntelligencePill tone={online ? "cyan" : "amber"}>
        {online ? (
          <Wifi className="h-3.5 w-3.5" />
        ) : (
          <WifiOff className="h-3.5 w-3.5" />
        )}
        {online ? "Live monitor online" : "Offline · retained memory"}
      </IntelligencePill>
      <IntelligencePill tone={busy ? "amber" : "slate"}>
        {busy ? (
          <Activity className="h-3.5 w-3.5 animate-pulse" />
        ) : (
          <Clock3 className="h-3.5 w-3.5" />
        )}
        {busy ? "Operation running" : "60-second visible refresh"}
      </IntelligencePill>
      {children}
    </div>
  );
}

export function statusTone(status: string): IntelligenceTone {
  const normalized = status.trim().toLowerCase();

  if (
    normalized.includes("production") ||
    normalized.includes("trained") ||
    normalized.includes("complete") ||
    normalized.includes("validated") ||
    normalized.includes("settled") ||
    normalized.includes("recorded")
  ) {
    return "emerald";
  }

  if (
    normalized.includes("failed") ||
    normalized.includes("disabled") ||
    normalized.includes("critical") ||
    normalized.includes("rejected")
  ) {
    return "rose";
  }

  if (
    normalized.includes("review") ||
    normalized.includes("warning") ||
    normalized.includes("pending") ||
    normalized.includes("prior")
  ) {
    return "amber";
  }

  if (
    normalized.includes("candidate") ||
    normalized.includes("shadow") ||
    normalized.includes("evaluation")
  ) {
    return "violet";
  }

  return "slate";
}