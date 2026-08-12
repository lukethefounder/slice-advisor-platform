"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileClock,
  FileSearch,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DocumentUploadPanel } from "@/components/document-upload-panel";
import {
  DOCUMENT_TYPES,
  type DocumentActionResult,
  type DocumentCenterPayload,
  type DocumentType,
  type DocumentVisibility,
} from "@/lib/document-center/contracts";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
} | null;

const EMPTY: DocumentCenterPayload = {
  ok: true,
  actor: {
    kind: "advisor",
    id: "",
    displayName: "",
    firmId: "",
  },
  permissions: {
    canUpload: false,
    canUploadFirmDocument: false,
    canApprove: false,
    canDelete: false,
    canViewFirmScope: false,
  },
  storage: {
    configured: false,
    provider: "Vercel Blob",
    access: "private",
    maximumSizeBytes: 25 * 1024 * 1024,
    allowedContentTypes: [],
  },
  clients: [],
  documents: [],
  metrics: {
    total: 0,
    processing: 0,
    needsReview: 0,
    approved: 0,
    rejected: 0,
    duplicates: 0,
    deletionRequested: 0,
  },
  pagination: {
    limit: 25,
    hasMore: false,
    nextCursor: null,
  },
};

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50";

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
    year: "numeric",
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
  if (status.includes("approved") || status.includes("complete") || status.includes("verified")) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-100";
  }
  if (status.includes("processing") || status.includes("queued") || status.includes("upload")) {
    return "border-cyan-500/25 bg-cyan-500/10 text-cyan-100";
  }
  if (status.includes("review") || status.includes("deletion") || status.includes("deleting")) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-50";
  }
  if (status.includes("rejected") || status.includes("failed") || status.includes("duplicate")) {
    return "border-rose-500/25 bg-rose-500/10 text-rose-100";
  }
  return "border-white/10 bg-white/[0.055] text-slate-300";
}

function Pill({ children, value }: { children?: ReactNode; value: string }) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
        statusStyle(value),
      )}
    >
      {children ?? value}
    </span>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
            {label}
          </div>
          <div className="mt-2 text-3xl font-black text-white">{value}</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-300">
          {icon}
        </div>
      </div>
    </div>
  );
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
    const message =
      typeof body.error === "string"
        ? body.error
        : body.error?.message ?? "The document request failed.";
    throw new Error(message);
  }

  return body;
}

export default function DocumentsPage() {
  const [payload, setPayload] = useState<DocumentCenterPayload>(EMPTY);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [editType, setEditType] = useState<DocumentType>("General");
  const [editVisibility, setEditVisibility] =
    useState<DocumentVisibility>("AdvisorOnly");
  const [editNotes, setEditNotes] = useState("");

  const selected = useMemo(
    () => payload.documents.find((document) => document.id === selectedId) ?? payload.documents[0] ?? null,
    [payload.documents, selectedId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setEditType(
      DOCUMENT_TYPES.includes(selected.documentType as DocumentType)
        ? (selected.documentType as DocumentType)
        : "General",
    );
    setEditVisibility(
      selected.visibility === "AdvisorAndClient" ? "AdvisorAndClient" : "AdvisorOnly",
    );
    setEditNotes(selected.notes ?? "");
  }, [selected?.id]);

  const load = useCallback(
    async (options?: { cursor?: string | null; append?: boolean; preferredId?: string }) => {
      const append = options?.append === true;
      append ? setLoadingMore(true) : setLoading(true);

      try {
        const params = new URLSearchParams({ actor: "advisor", limit: "25" });
        if (debouncedQuery) params.set("q", debouncedQuery);
        if (status) params.set("status", status);
        if (documentType) params.set("documentType", documentType);
        if (clientId) params.set("clientId", clientId);
        if (options?.cursor) params.set("cursor", options.cursor);

        const data = await readJson<DocumentCenterPayload>(
          await fetch(`/api/documents?${params.toString()}`, { cache: "no-store" }),
        );

        setPayload((current) => ({
          ...data,
          documents: append
            ? [
                ...current.documents,
                ...data.documents.filter(
                  (document) => !current.documents.some((currentDocument) => currentDocument.id === document.id),
                ),
              ]
            : data.documents,
        }));

        const requestedId =
          options?.preferredId ||
          new URLSearchParams(window.location.search).get("documentId") ||
          selectedId ||
          data.documents[0]?.id ||
          "";
        setSelectedId(requestedId);
        setNotice(null);
      } catch (error) {
        setNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "Unable to load the secure document center.",
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [clientId, debouncedQuery, documentType, selectedId, status],
  );

  useEffect(() => {
    void load();
  }, [debouncedQuery, status, documentType, clientId]);

  useEffect(() => {
    if (!payload.documents.some((document) => ["Queued", "Processing"].includes(document.processingStatus))) {
      return;
    }

    const timer = window.setInterval(() => void load({ preferredId: selectedId }), 5_000);
    return () => window.clearInterval(timer);
  }, [load, payload.documents, selectedId]);

  async function action(
    body: Record<string, unknown>,
    options?: {
      confirmation?: string;
      success?: string;
      openAccess?: boolean;
    },
  ) {
    const actionName = String(body.action ?? "document-action");
    setBusy(actionName);
    setNotice(null);

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
          body: JSON.stringify({ ...body, actorHint: "advisor" }),
        }),
      );

      if (options?.openAccess && data.accessUrl) {
        openSecureDocumentAccess(data.accessUrl);
      }

      setNotice({
        tone: "success",
        text: options?.success ?? data.message,
      });
      await load({ preferredId: String(body.documentId ?? selectedId) });
      return data;
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Document action failed.",
      });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function saveMetadata() {
    if (!selected) return;
    await action(
      {
        action: "updateMetadata",
        documentId: selected.id,
        documentType: editType,
        visibility: editVisibility,
        notes: editNotes,
      },
      { success: "Document details saved." },
    );
  }

  async function deleteSelected() {
    if (!selected) return;
    const confirmed = window.confirm(
      `Delete ${selected.fileName} from private storage? The immutable audit record will remain.`,
    );
    if (!confirmed) return;

    await action(
      { action: "delete", documentId: selected.id },
      { confirmation: "document-delete" },
    );
  }

  return (
    <main className="min-h-screen bg-[#030806] p-4 text-white md:p-6">
      <div className="mx-auto grid max-w-[1900px] gap-4">
        <header className="rounded-[2rem] border border-white/10 bg-zinc-950/82 p-5 shadow-2xl shadow-black/35 backdrop-blur-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill value="private">Private storage</Pill>
                <Pill value="audit">Append-only audit</Pill>
                <Pill value="processing">Background processing</Pill>
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
                Secure document center
              </h1>
              <p className="mt-3 max-w-4xl text-sm font-semibold leading-7 text-slate-400">
                Upload originals to private object storage, verify file signatures and fingerprints,
                classify documents in the background, control client visibility, and preserve every
                material access or change in the audit trail.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/workspace"
                className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white"
              >
                Back to Workspace
              </Link>
              <button
                type="button"
                onClick={() => void load({ preferredId: selectedId })}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-50 disabled:opacity-50"
              >
                <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </button>
            </div>
          </div>

          {notice ? (
            <div
              className={cx(
                "mt-4 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold",
                notice.tone === "error"
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-50"
                  : notice.tone === "success"
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-50"
                    : "border-cyan-500/25 bg-cyan-500/10 text-cyan-50",
              )}
              role={notice.tone === "error" ? "alert" : "status"}
            >
              {notice.tone === "error" ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              {notice.text}
            </div>
          ) : null}
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total documents" value={payload.metrics.total} icon={<FileText className="h-5 w-5" />} />
          <Metric label="Processing" value={payload.metrics.processing} icon={<FileClock className="h-5 w-5" />} />
          <Metric label="Needs review" value={payload.metrics.needsReview} icon={<FileSearch className="h-5 w-5" />} />
          <Metric label="Approved" value={payload.metrics.approved} icon={<FileCheck2 className="h-5 w-5" />} />
        </section>

        {!payload.storage.configured ? (
          <div className="rounded-3xl border border-amber-500/25 bg-amber-500/10 p-5 text-sm font-semibold leading-7 text-amber-50">
            Private Blob storage is not configured. Connect a private Vercel Blob store and provide
            its server credential before uploading production documents.
          </div>
        ) : null}

        {payload.permissions.canUpload ? (
          <DocumentUploadPanel
            actor="advisor"
            clients={payload.clients}
            defaultClientId={clientId || null}
            onUploaded={async () => {
              setNotice({
                tone: "info",
                text: "Upload complete. The registration callback and secure processing job may take a few seconds to appear.",
              });
              window.setTimeout(() => void load(), 2_500);
              window.setTimeout(() => void load(), 6_000);
            }}
          />
        ) : null}

        <section className="grid min-h-[720px] gap-4 xl:grid-cols-[390px_minmax(0,1fr)_390px]">
          <aside className="min-h-0 rounded-[2rem] border border-white/10 bg-zinc-950/82 p-4 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400">
                  Document registry
                </div>
                <h2 className="mt-1 text-2xl font-black">Files</h2>
              </div>
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-emerald-300" /> : null}
            </div>

            <div className="mt-4 grid gap-2">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  className={`${inputClass} pl-10`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search client, type, or status…"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">All statuses</option>
                  <option>Processing</option>
                  <option>Needs Review</option>
                  <option>Approved</option>
                  <option>Rejected</option>
                  <option>Duplicate</option>
                  <option>Deletion Requested</option>
                  <option>Archived</option>
                </select>
                <select
                  className={inputClass}
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                >
                  <option value="">All categories</option>
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </div>
              <select className={inputClass} value={clientId} onChange={(event) => setClientId(event.target.value)}>
                <option value="">All visible clients and firm files</option>
                {payload.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid max-h-[510px] gap-2 overflow-y-auto pr-1">
              {!loading && !payload.documents.length ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
                  <FileText className="mx-auto h-8 w-8 text-slate-500" />
                  <div className="mt-3 font-black">No matching documents</div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                    Adjust the filters or upload the first secure document.
                  </p>
                </div>
              ) : null}

              {payload.documents.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(document.id);
                    const next = new URL(window.location.href);
                    next.searchParams.set("documentId", document.id);
                    window.history.replaceState({}, "", next);
                  }}
                  className={cx(
                    "rounded-2xl border p-4 text-left transition",
                    selected?.id === document.id
                      ? "border-emerald-500/35 bg-emerald-500/10"
                      : "border-white/10 bg-white/[0.035] hover:bg-white/[0.065]",
                  )}
                >
                  <div className="truncate text-sm font-black text-white">{document.fileName}</div>
                  <div className="mt-1 truncate text-xs font-semibold text-slate-500">
                    {document.clientName ?? "Firm document"} · {formatBytes(document.sizeBytes)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Pill value={document.status} />
                    <Pill value={document.processingStatus} />
                  </div>
                </button>
              ))}
            </div>

            {payload.pagination.hasMore && payload.pagination.nextCursor ? (
              <button
                type="button"
                onClick={() =>
                  void load({ cursor: payload.pagination.nextCursor, append: true, preferredId: selectedId })
                }
                disabled={loadingMore}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-black text-white disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            ) : null}
          </aside>

          <article className="min-h-0 rounded-[2rem] border border-white/10 bg-zinc-950/82 p-5 shadow-2xl shadow-black/30">
            {!selected ? (
              <div className="grid h-full min-h-96 place-items-center text-center">
                <div>
                  <FileSearch className="mx-auto h-10 w-10 text-slate-600" />
                  <h2 className="mt-4 text-2xl font-black">Select a document</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Review processing, classification, visibility, and access history.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Pill value={selected.status} />
                      <Pill value={selected.processingStatus} />
                      <Pill value={selected.securityStatus} />
                    </div>
                    <h2 className="mt-4 break-words text-3xl font-black">{selected.fileName}</h2>
                    <p className="mt-2 text-sm font-semibold text-slate-400">
                      {selected.clientName ?? "Firm document"} · {selected.documentType} · {formatBytes(selected.sizeBytes)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.canDownload ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void action(
                              { action: "createAccessUrl", documentId: selected.id, disposition: "inline" },
                              { openAccess: true },
                            )
                          }
                          disabled={busy !== null}
                          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-50 disabled:opacity-50"
                        >
                          <Eye className="h-4 w-4" /> View
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void action(
                              { action: "createAccessUrl", documentId: selected.id, disposition: "attachment" },
                              { openAccess: true },
                            )
                          }
                          disabled={busy !== null}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" /> Download
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {selected.processingError ? (
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm font-semibold leading-6 text-amber-50">
                    <strong>Processing issue:</strong> {selected.processingError}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["Client", selected.clientName ?? "Firm document"],
                    ["Uploaded by", selected.uploadedByType],
                    ["Visibility", selected.visibility === "AdvisorAndClient" ? "Advisor and client" : "Advisor only"],
                    ["Content type", selected.contentType ?? "Pending"],
                    ["Created", formatDate(selected.createdAt)],
                    ["Last viewed", formatDate(selected.lastViewedAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        {label}
                      </div>
                      <div className="mt-2 break-words text-sm font-bold text-white">{value}</div>
                    </div>
                  ))}
                </div>

                <section className="rounded-3xl border border-white/10 bg-black/30 p-5">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <ShieldCheck className="h-5 w-5" />
                    <h3 className="font-black">Processing and security</h3>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                      <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">SHA-256 fingerprint</div>
                      <div className="mt-2 break-all font-mono text-xs text-slate-300">
                        {selected.sha256 ?? "Calculated during background processing"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                      <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Classification</div>
                      <div className="mt-2 text-sm font-bold text-white">
                        {typeof selected.classification.category === "string"
                          ? selected.classification.category
                          : selected.documentType}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {typeof selected.classification.confidence === "number"
                          ? `${selected.classification.confidence}% deterministic confidence`
                          : "Awaiting classification"}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">
                    Signature verification confirms that the file bytes match the declared format.
                    It is not a malware scan. No external malware-scanning provider is represented as active.
                  </p>
                </section>

                {selected.extractedTextPreview ? (
                  <section className="rounded-3xl border border-white/10 bg-black/30 p-5">
                    <h3 className="font-black">Bounded text preview</h3>
                    <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/35 p-4 text-xs leading-6 text-slate-300">
                      {selected.extractedTextPreview}
                    </pre>
                  </section>
                ) : null}

                {payload.permissions.canApprove ? (
                  <section className="rounded-3xl border border-white/10 bg-black/30 p-5">
                    <h3 className="font-black">Advisor controls</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Category</span>
                        <select className={inputClass} value={editType} onChange={(event) => setEditType(event.target.value as DocumentType)}>
                          {DOCUMENT_TYPES.map((type) => (
                            <option key={type}>{type}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Visibility</span>
                        <select
                          className={inputClass}
                          value={editVisibility}
                          onChange={(event) => setEditVisibility(event.target.value as DocumentVisibility)}
                          disabled={!selected.clientId}
                        >
                          <option value="AdvisorOnly">Advisor only</option>
                          <option value="AdvisorAndClient">Advisor and client</option>
                        </select>
                      </label>
                      <label className="grid gap-2 md:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Notes</span>
                        <textarea className={inputClass} rows={4} value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void saveMetadata()}
                        disabled={busy !== null}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                      >
                        Save details
                      </button>
                      {selected.canApprove && selected.status !== "Approved" ? (
                        <button
                          type="button"
                          onClick={() =>
                            void action(
                              { action: "approve", documentId: selected.id },
                              { confirmation: "document-approve" },
                            )
                          }
                          disabled={busy !== null}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-xs font-black text-emerald-50 disabled:opacity-50"
                        >
                          <FileCheck2 className="h-4 w-4" /> Approve
                        </button>
                      ) : null}
                      {selected.canReprocess ? (
                        <button
                          type="button"
                          onClick={() =>
                            void action(
                              { action: "reprocess", documentId: selected.id },
                              { confirmation: "document-reprocess" },
                            )
                          }
                          disabled={busy !== null}
                          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2.5 text-xs font-black text-cyan-50 disabled:opacity-50"
                        >
                          <RotateCcw className="h-4 w-4" /> Reprocess
                        </button>
                      ) : null}
                      {selected.canArchive ? (
                        <button
                          type="button"
                          onClick={() =>
                            void action({
                              action: selected.status === "Archived" ? "restore" : "archive",
                              documentId: selected.id,
                            })
                          }
                          disabled={busy !== null}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                        >
                          {selected.status === "Archived" ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                          {selected.status === "Archived" ? "Restore" : "Archive"}
                        </button>
                      ) : null}
                      {selected.canDelete ? (
                        <button
                          type="button"
                          onClick={() => void deleteSelected()}
                          disabled={busy !== null}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-xs font-black text-rose-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" /> Delete object
                        </button>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </article>

          <aside className="min-h-0 rounded-[2rem] border border-white/10 bg-zinc-950/82 p-5 shadow-2xl shadow-black/30">
            <div className="flex items-center gap-2 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-xl font-black text-white">Audit history</h2>
            </div>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
              Uploads, access links, views, downloads, approvals, processing results, and deletions are appended here.
            </p>

            <div className="mt-4 grid max-h-[620px] gap-3 overflow-y-auto pr-1">
              {!selected?.audit.length ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-slate-500">
                  No audit events are available for the selected document.
                </div>
              ) : null}
              {selected?.audit.map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-400">
                    {event.action.replaceAll(".", " ")}
                  </div>
                  <div className="mt-2 text-xs font-bold text-white">{event.actorType}</div>
                  {event.detail ? (
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">{event.detail}</p>
                  ) : null}
                  <div className="mt-2 text-[11px] text-slate-600">{formatDate(event.createdAt)}</div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}