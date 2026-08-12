"use client";

import { createPortal } from "react-dom";
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { mutateClient } from "@/lib/clients/client-api";
import {
  WorkspaceAlert,
  WorkspaceButton,
  WorkspaceEmptyState,
  WorkspacePill,
  WorkspaceSkeleton,
  cx,
} from "@/components/workspace/core/workspace-ui";

type ImportedHolding = {
  symbol: string;
  assetName: string;
  assetClass: string;
  riskLevel: string;
  thesis: string;
};

type ImportedClient = {
  importKey: string;
  sourceRow: number;
  fullName: string;
  email: string;
  householdName: string;
  clientType: string;
  riskProfile: string;
  liquidityNeeds: string;
  timeHorizon: string;
  objective: string;
  status: string;
  notes: string;
  holdings: ImportedHolding[];
  confidence: number;
  warnings: string[];
  duplicateHint: string;
};

type ImportResponse = {
  ok: boolean;
  aiUsed: boolean;
  fileName: string;
  detectedRows: number;
  profiles: ImportedClient[];
  warnings: string[];
  message: string;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
}

export default function ClientImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (clientId: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [fileName, setFileName] = useState("");
  const [profiles, setProfiles] = useState<ImportedClient[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading && !importing) {
        onClose();
        return;
      }

      if (event.key === "Tab") {
        const focusable = dialogRef.current
          ? Array.from(
              dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
              ),
            )
          : [];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [importing, loading, onClose, open]);

  const selectedProfiles = useMemo(
    () => profiles.filter((profile) => selected[profile.importKey]),
    [profiles, selected],
  );

  function reset() {
    setFileName("");
    setProfiles([]);
    setSelected({});
    setWarnings([]);
    setMessage("");
    setError("");
    setProgress({ current: 0, total: 0 });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function analyzeFile(file: File) {
    setLoading(true);
    setError("");
    setMessage("");
    setProfiles([]);
    setWarnings([]);
    setFileName(file.name);

    try {
      const lowerName = file.name.toLowerCase();
      const isExcel = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");
      const maximumBytes = isExcel ? 10 * 1024 * 1024 : 5 * 1024 * 1024;

      if (file.size > maximumBytes) {
        throw new Error(
          `The selected file exceeds the ${isExcel ? "10" : "5"} MB import limit.`,
        );
      }

      let body: Record<string, unknown> = {
        fileName: file.name,
        mimeType: file.type,
      };

      if (isExcel) {
        body = {
          ...body,
          base64: arrayBufferToBase64(await file.arrayBuffer()),
        };
      } else {
        body = {
          ...body,
          text: await file.text(),
        };
      }

      const response = await fetch("/api/clients/ai-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "client-ai-import",
        },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as ImportResponse;

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The client file could not be analyzed.");
      }

      const nextSelected: Record<string, boolean> = {};
      for (const profile of result.profiles) {
        nextSelected[profile.importKey] =
          profile.confidence >= 88 && !profile.duplicateHint;
      }

      setProfiles(result.profiles);
      setSelected(nextSelected);
      setWarnings(result.warnings || []);
      setMessage(
        `${result.profiles.length} profile${result.profiles.length === 1 ? "" : "s"} prepared. Review every record before importing.`,
      );
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "The import could not be prepared.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function importProfiles() {
    if (!selectedProfiles.length) {
      setError("Select at least one prepared client profile.");
      return;
    }

    setImporting(true);
    setError("");
    setMessage("");
    setProgress({ current: 0, total: selectedProfiles.length });
    let lastClientId: string | null = null;
    let created = 0;
    let holdings = 0;

    try {
      for (let index = 0; index < selectedProfiles.length; index += 1) {
        const profile = selectedProfiles[index];
        setProgress({ current: index, total: selectedProfiles.length });

        const createdClient = await mutateClient(
          {
            action: "createClient",
            fullName: profile.fullName,
            email: profile.email,
            householdName: profile.householdName,
            clientType: profile.clientType,
            riskProfile: profile.riskProfile,
            liquidityNeeds: profile.liquidityNeeds,
            timeHorizon: profile.timeHorizon,
            objective: profile.objective,
            status: profile.status,
            notes: [
              profile.notes,
              profile.warnings.length
                ? `Import warnings: ${profile.warnings.join(" | ")}`
                : "",
              `Import confidence: ${profile.confidence}%. Source row: ${profile.sourceRow}.`,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
          "createClient",
        );

        lastClientId = createdClient.clientId;
        created += 1;

        if (profile.holdings.length) {
          const holdingResult = await mutateClient({
            action: "bulkAddHoldings",
            clientId: createdClient.clientId,
            holdings: profile.holdings.slice(0, 100),
          });
          holdings += holdingResult.affectedCount;
        }

        setProgress({ current: index + 1, total: selectedProfiles.length });
      }

      setMessage(
        `${created} client${created === 1 ? "" : "s"} and ${holdings} security record${holdings === 1 ? "" : "s"} imported.`,
      );
      onImported(lastClientId);
      setProfiles([]);
      setSelected({});
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "The selected profiles could not be imported.",
      );
    } finally {
      setImporting(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483645] grid place-items-center bg-black/76 p-3 backdrop-blur-md sm:p-6">
      <button
        type="button"
        className="absolute inset-0"
        onClick={() => !loading && !importing && onClose()}
        aria-label="Close client import"
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-import-title"
        className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.65rem] border border-emerald-300/18 bg-[#020806] shadow-[0_36px_110px_rgba(0,0,0,0.72)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/8 p-5">
          <div>
            <div className="flex flex-wrap gap-2">
              <WorkspacePill tone="cyan">CSV / Excel / JSON</WorkspacePill>
              <WorkspacePill tone="amber">Advisor review required</WorkspacePill>
            </div>
            <h2 id="client-import-title" className="mt-3 text-2xl font-black text-white">
              AI-assisted client import
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
              Slice normalizes the existing file, but nothing is created until you review and select each prepared profile.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            disabled={loading || importing}
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white disabled:opacity-40"
            aria-label="Close client import"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error ? <WorkspaceAlert tone="error">{error}</WorkspaceAlert> : null}
          {message ? <WorkspaceAlert tone="success">{message}</WorkspaceAlert> : null}
          {warnings.length ? (
            <WorkspaceAlert tone="warning" title={`${warnings.length} import warning${warnings.length === 1 ? "" : "s"}`}>
              {warnings.slice(0, 4).join(" ")}
            </WorkspaceAlert>
          ) : null}

          <label
            className="mt-4 grid min-h-44 cursor-pointer place-items-center rounded-2xl border border-dashed border-emerald-400/25 bg-emerald-500/[0.045] p-6 text-center transition hover:bg-emerald-500/[0.075]"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void analyzeFile(file);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.json,.txt,.xlsx,.xls,text/csv,application/json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void analyzeFile(file);
              }}
            />
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-emerald-300" aria-hidden="true" />
            ) : (
              <Upload className="h-8 w-8 text-emerald-300" aria-hidden="true" />
            )}
            <div>
              <p className="mt-3 text-base font-black text-white">
                {loading ? "Analyzing file…" : fileName || "Choose or drop a client file"}
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                Excel files up to 10 MB; text-based imports up to 5 MB.
              </p>
            </div>
          </label>

          {loading ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <WorkspaceSkeleton lines={4} />
                </div>
              ))}
            </div>
          ) : null}

          {!loading && profiles.length ? (
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">Prepared profiles</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {selectedProfiles.length} of {profiles.length} selected
                  </p>
                </div>
                <div className="flex gap-2">
                  <WorkspaceButton
                    size="sm"
                    variant="quiet"
                    onClick={() =>
                      setSelected(
                        Object.fromEntries(profiles.map((profile) => [profile.importKey, true])),
                      )
                    }
                  >
                    Select all
                  </WorkspaceButton>
                  <WorkspaceButton
                    size="sm"
                    variant="quiet"
                    onClick={() => setSelected({})}
                  >
                    Clear
                  </WorkspaceButton>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {profiles.map((profile) => {
                  const checked = selected[profile.importKey] === true;

                  return (
                    <label
                      key={profile.importKey}
                      className={cx(
                        "cursor-pointer rounded-2xl border p-4 transition",
                        checked
                          ? "border-emerald-400/24 bg-emerald-500/[0.07]"
                          : "border-white/8 bg-white/[0.025] hover:border-white/12",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelected((current) => ({
                              ...current,
                              [profile.importKey]: !current[profile.importKey],
                            }))
                          }
                          className="mt-1 h-4 w-4 accent-emerald-600"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-black text-white">
                              {profile.fullName || `Row ${profile.sourceRow}`}
                            </p>
                            <WorkspacePill tone={profile.confidence >= 88 ? "emerald" : "amber"}>
                              {profile.confidence}% confidence
                            </WorkspacePill>
                          </div>
                          <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                            {profile.email || "No email"} · {profile.riskProfile}
                          </p>
                          <p className="mt-2 text-xs font-semibold text-slate-500">
                            {profile.holdings.length} holding{profile.holdings.length === 1 ? "" : "s"}
                          </p>
                          {profile.duplicateHint ? (
                            <p className="mt-2 text-xs font-bold text-amber-200">
                              Possible duplicate: {profile.duplicateHint}
                            </p>
                          ) : null}
                          {profile.warnings.length ? (
                            <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-amber-100/80">
                              {profile.warnings.join(" ")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!loading && !profiles.length && fileName ? (
            <WorkspaceEmptyState
              title="No importable profiles were returned"
              description="Review the file format and column names, then try another file."
              icon={<FileSpreadsheet className="h-5 w-5" aria-hidden="true" />}
            />
          ) : null}

          {importing ? (
            <div className="mt-5 rounded-2xl border border-cyan-400/22 bg-cyan-500/[0.07] p-4" role="status">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-200" aria-hidden="true" />
                <div>
                  <p className="text-sm font-black text-white">Importing reviewed profiles</p>
                  <p className="mt-1 text-xs font-semibold text-cyan-100/75">
                    {progress.current} of {progress.total} complete
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-[width]"
                  style={{
                    width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-white/8 p-4 sm:flex-row sm:items-center sm:justify-between">
          <WorkspaceButton
            variant="quiet"
            disabled={loading || importing}
            onClick={reset}
          >
            Reset
          </WorkspaceButton>
          <div className="flex gap-2">
            <WorkspaceButton
              variant="secondary"
              disabled={loading || importing}
              onClick={onClose}
            >
              Close
            </WorkspaceButton>
            <WorkspaceButton
              variant="primary"
              loading={importing}
              disabled={!selectedProfiles.length || loading}
              icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              onClick={() => void importProfiles()}
            >
              Import {selectedProfiles.length || "selected"}
            </WorkspaceButton>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}