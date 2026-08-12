"use client";

import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DocumentUploadPanel } from "@/components/document-upload-panel";
import type {
  DocumentActionResult,
  DocumentCenterPayload,
  DocumentListItem,
} from "@/lib/document-center/contracts";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDate(value: string | null | undefined) {
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

function formatBytes(value: number | null) {
  if (value === null) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function statusStyle(value: string) {
  const status = value.toLowerCase();
  if (status.includes("approved") || status.includes("complete")) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-100";
  }
  if (status.includes("processing") || status.includes("queued")) {
    return "border-cyan-500/25 bg-cyan-500/10 text-cyan-100";
  }
  if (status.includes("review") || status.includes("deletion") || status.includes("deleting")) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-50";
  }
  if (status.includes("failed") || status.includes("rejected") || status.includes("duplicate")) {
    return "border-rose-500/25 bg-rose-500/10 text-rose-100";
  }
  return "border-white/10 bg-white/[0.05] text-slate-300";
}

function openSecureDocumentAccess(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string | { message?: string };
  } & T;

  if (!response.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.error?.message ?? "The document request failed.",
    );
  }

  return body;
}

export function ClientPortalDocumentDock() {
  const [expanded, setExpanded] = useState(false);
  const [payload, setPayload] = useState<DocumentCenterPayload | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selected = useMemo(
    () => payload?.documents.find((document) => document.id === selectedId) ?? payload?.documents[0] ?? null,
    [payload?.documents, selectedId],
  );

  const load = useCallback(async (preferredId?: string) => {
    setLoading(true);
    setError("");

    try {
      const data = await readJson<DocumentCenterPayload>(
        await fetch("/api/documents?actor=client&limit=25", { cache: "no-store" }),
      );
      setPayload(data);
      setSelectedId(preferredId || selectedId || data.documents[0]?.id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load secure documents.");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!expanded) return;
    void load();
  }, [expanded]);

  useEffect(() => {
    if (!expanded || !payload?.documents.some((document) => ["Queued", "Processing"].includes(document.processingStatus))) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(selectedId);
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [expanded, load, payload?.documents, selectedId]);

  async function action(
    document: DocumentListItem,
    actionName: string,
    options?: { disposition?: "inline" | "attachment"; confirmation?: string },
  ) {
    setBusy(actionName);
    setError("");
    setMessage("");

    try {
      const data = await readJson<DocumentActionResult>(
        await fetch("/api/documents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(options?.confirmation
              ? { "x-slice-sensitive-action": options.confirmation }
              : {}),
          },
          body: JSON.stringify({
            actorHint: "client",
            action: actionName,
            documentId: document.id,
            disposition: options?.disposition,
          }),
        }),
      );

      if (data.accessUrl) {
        openSecureDocumentAccess(data.accessUrl);
      }

      setMessage(data.message);
      await load(document.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Document action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside className="fixed bottom-4 right-4 z-[94] w-[min(440px,calc(100vw-2rem))] text-white">
      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/96 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-4 border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.22),transparent_48%),rgba(0,0,0,0.58)] px-5 py-4 text-left"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-2.5 text-emerald-300">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                Secure documents
              </div>
              <div className="mt-1 text-sm font-black">
                Private upload and advisor review
              </div>
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
            {expanded ? "Close" : "Open"}
          </span>
        </button>

        {expanded ? (
          <div className="max-h-[78vh] overflow-y-auto p-4">
            {error ? (
              <div className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-semibold leading-5 text-amber-50" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="mb-3 flex items-start gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs font-semibold leading-5 text-emerald-50" role="status">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {message}
              </div>
            ) : null}

            {!payload && loading ? (
              <div className="grid min-h-40 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-300" />
              </div>
            ) : null}

            {payload ? (
              <div className="grid gap-4">
                {!payload.storage.configured ? (
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-semibold leading-5 text-amber-50">
                    Secure document storage is temporarily unavailable. Your advisor can still receive portal messages.
                  </div>
                ) : payload.permissions.canUpload ? (
                  <DocumentUploadPanel
                    actor="client"
                    compact
                    onUploaded={async () => {
                      setMessage("Upload complete. Registration and secure processing are continuing in the background.");
                      window.setTimeout(() => void load(), 2_500);
                      window.setTimeout(() => void load(), 6_000);
                    }}
                  />
                ) : null}

                <section>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
                        Your vault
                      </div>
                      <h3 className="mt-1 text-lg font-black">Documents</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => void load(selectedId)}
                      className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-slate-300"
                      aria-label="Refresh secure documents"
                    >
                      <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} />
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {!payload.documents.length ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
                        <FileText className="mx-auto h-7 w-7 text-slate-600" />
                        <div className="mt-2 text-sm font-black">No secure documents yet</div>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                          Upload a file above or wait for your advisor to share an approved document.
                        </p>
                      </div>
                    ) : null}

                    {payload.documents.map((document) => (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => setSelectedId(document.id)}
                        className={cx(
                          "rounded-2xl border p-3 text-left",
                          selected?.id === document.id
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : "border-white/10 bg-white/[0.035]",
                        )}
                      >
                        <div className="truncate text-xs font-black">{document.fileName}</div>
                        <div className="mt-1 text-[11px] font-semibold text-slate-500">
                          {document.documentType} · {formatBytes(document.sizeBytes)} · {formatDate(document.createdAt)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className={cx("rounded-full border px-2 py-0.5 text-[9px] font-black uppercase", statusStyle(document.status))}>
                            {document.status}
                          </span>
                          <span className={cx("rounded-full border px-2 py-0.5 text-[9px] font-black uppercase", statusStyle(document.processingStatus))}>
                            {document.processingStatus}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                {selected ? (
                  <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-sm font-black">{selected.fileName}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {selected.visibility === "AdvisorAndClient" ? "Visible to you and your assigned advisor" : "Advisor only"}
                    </div>
                    {selected.processingError ? (
                      <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-semibold leading-5 text-amber-50">
                        {selected.processingError}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selected.canDownload ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void action(selected, "createAccessUrl", { disposition: "inline" })}
                            disabled={busy !== null}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[11px] font-black text-cyan-50 disabled:opacity-50"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => void action(selected, "createAccessUrl", { disposition: "attachment" })}
                            disabled={busy !== null}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-black disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </button>
                        </>
                      ) : null}
                      {selected.canRequestDelete ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Ask your advisor to review deletion of this document?")) {
                              void action(selected, "requestDelete", {
                                confirmation: "document-request-delete",
                              });
                            }
                          }}
                          disabled={busy !== null}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] font-black text-amber-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Request deletion
                        </button>
                      ) : null}
                      {selected.status === "Archived" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-black text-slate-400">
                          <Archive className="h-3.5 w-3.5" /> Archived
                        </span>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                <p className="text-[11px] font-semibold leading-5 text-slate-600">
                  Slice verifies file signatures and fingerprints. This does not represent an external malware scan. Your advisor reviews processed documents before client sharing.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}