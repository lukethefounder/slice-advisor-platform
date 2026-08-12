"use client";

import { upload } from "@vercel/blob/client";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  DOCUMENT_TYPES,
  documentAcceptAttribute,
  documentMaximumUploadBytes,
  type DocumentActorKind,
  type DocumentClientOption,
  type DocumentType,
  type DocumentUploadDeclaration,
  type DocumentVisibility,
} from "@/lib/document-center/contracts";

type UploadState =
  | "idle"
  | "hashing"
  | "authorizing"
  | "uploading"
  | "registering"
  | "complete"
  | "error";

export type DocumentUploadCompletion = {
  pathname: string;
  url: string;
  etag: string;
  claimedSha256: string;
  fileName: string;
};

export type DocumentUploadPanelProps = {
  actor: DocumentActorKind;
  clients?: DocumentClientOption[];
  defaultClientId?: string | null;
  compact?: boolean;
  onUploaded?: (result: DocumentUploadCompletion) => void | Promise<void>;
};

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50";

function safeFileName(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\\/]+/g, "-")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240)
    .replace(/[^a-zA-Z0-9 ._()\-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\-\s]+/, "") || "document";
}

function fileSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function contentTypeForFile(file: File) {
  const extension = file.name.toLowerCase().match(/\.[a-z0-9]{1,10}$/)?.[0] ?? "";
  const byExtension: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  const browserType = file.type.trim().toLowerCase();

  if (extension === ".csv" && browserType === "application/vnd.ms-excel") {
    return "text/csv";
  }

  return browserType || byExtension[extension] || "application/octet-stream";
}

async function sha256(file: File) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser cannot calculate the secure file fingerprint.");
  }

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function errorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Upload cancelled.";
  }

  if (error instanceof Error) return error.message;
  return "The secure document upload failed.";
}

function stateLabel(state: UploadState, percentage: number) {
  if (state === "hashing") return "Calculating a duplicate-prevention fingerprint";
  if (state === "authorizing") return "Checking firm and client permissions";
  if (state === "uploading") return `Uploading directly to private storage · ${percentage}%`;
  if (state === "registering") return "Registering the upload and queuing secure processing";
  if (state === "complete") return "Upload complete; secure processing is queued";
  if (state === "error") return "Upload needs attention";
  return "Ready to upload";
}

export function DocumentUploadPanel({
  actor,
  clients = [],
  defaultClientId = null,
  compact = false,
  onUploaded,
}: DocumentUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [documentType, setDocumentType] = useState<DocumentType>("General");
  const [visibility, setVisibility] =
    useState<DocumentVisibility>(actor === "client" ? "AdvisorAndClient" : "AdvisorOnly");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const busy = ["hashing", "authorizing", "uploading", "registering"].includes(state);
  const maximumBytes = documentMaximumUploadBytes();
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId) ?? null,
    [clientId, clients],
  );

  function choose(nextFile: File | null) {
    setMessage("");
    setState("idle");
    setProgress(0);

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (nextFile.size <= 0 || nextFile.size > maximumBytes) {
      setFile(null);
      setState("error");
      setMessage(
        `Choose a document smaller than ${Math.round(maximumBytes / 1024 / 1024)} MB.`,
      );
      return;
    }

    setFile(nextFile);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    choose(event.target.files?.[0] ?? null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    choose(event.dataTransfer.files?.[0] ?? null);
  }

  async function beginUpload() {
    if (!file || busy) return;

    if (actor === "advisor" && !clientId && clients.length && visibility === "AdvisorAndClient") {
      setState("error");
      setMessage("Choose a client before sharing a document with the client portal.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setMessage("");
    setProgress(0);

    try {
      setState("hashing");
      const claimedSha256 = await sha256(file);
      const safeName = safeFileName(file.name);
      const pathname = `slice-documents/${globalThis.crypto.randomUUID()}-${safeName}`;
      const declaredContentType = contentTypeForFile(file);
      const declaration: DocumentUploadDeclaration = {
        actorHint: actor,
        clientId: actor === "client" ? null : clientId || null,
        originalFileName: safeName,
        declaredContentType,
        declaredSizeBytes: file.size,
        claimedSha256,
        documentType,
        visibility: actor === "client" ? "AdvisorAndClient" : visibility,
        notes: notes.trim() || null,
      };

      setState("authorizing");

      const blob = await upload(pathname, file, {
        access: "private",
        contentType: declaredContentType,
        handleUploadUrl: "/api/documents/upload",
        clientPayload: JSON.stringify(declaration),
        multipart: file.size >= 8 * 1024 * 1024,
        abortSignal: controller.signal,
        onUploadProgress(event: {
          loaded: number;
          total: number;
          percentage: number;
        }) {
          setState("uploading");
          setProgress(Math.max(0, Math.min(100, Math.round(event.percentage))));
        },
      });

      setState("registering");
      setProgress(100);

      await onUploaded?.({
        pathname: blob.pathname,
        url: blob.url,
        etag: blob.etag,
        claimedSha256,
        fileName: safeName,
      });

      setState("complete");
      setMessage(
        "The original file is stored privately. Slice is verifying its fingerprint and file signature in the background.",
      );
      setFile(null);
      setNotes("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setState("error");
      setMessage(errorMessage(error));
    } finally {
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  return (
    <section
      className={
        compact
          ? "rounded-3xl border border-white/10 bg-white/[0.045] p-4"
          : "rounded-[2rem] border border-white/10 bg-zinc-950/82 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl"
      }
      aria-labelledby="secure-document-upload-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span className="text-[10px] font-black uppercase tracking-[0.18em]">
              Private document storage
            </span>
          </div>
          <h2 id="secure-document-upload-title" className="mt-2 text-xl font-black text-white">
            Upload a secure document
          </h2>
          <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-slate-400">
            The original file uploads directly to private object storage. Slice then verifies its
            fingerprint and file signature before making it available.
          </p>
        </div>
        <FileUp className="h-7 w-7 shrink-0 text-emerald-300" aria-hidden="true" />
      </div>

      <div className={compact ? "mt-4 grid gap-3" : "mt-5 grid gap-4 md:grid-cols-2"}>
        {actor === "advisor" && clients.length ? (
          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              Client or firm vault
            </span>
            <select
              className={inputClass}
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              disabled={busy}
            >
              <option value="">Firm document · advisor only</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.fullName}
                  {client.householdName ? ` · ${client.householdName}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="grid gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            Document category
          </span>
          <select
            className={inputClass}
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value as DocumentType)}
            disabled={busy}
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        {actor === "advisor" ? (
          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              Visibility
            </span>
            <select
              className={inputClass}
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as DocumentVisibility)}
              disabled={busy || !clientId}
            >
              <option value="AdvisorOnly">Advisor only</option>
              <option value="AdvisorAndClient">Advisor and assigned client</option>
            </select>
          </label>
        ) : null}

        <label className="grid gap-2 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            Notes (optional)
          </span>
          <textarea
            className={inputClass}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={compact ? 2 : 3}
            maxLength={5000}
            placeholder="Purpose, requested review, or document context…"
            disabled={busy}
          />
        </label>
      </div>

      <div
        className={`mt-4 grid min-h-32 place-items-center rounded-3xl border border-dashed p-5 text-center transition ${
          dragActive
            ? "border-emerald-400 bg-emerald-500/10"
            : "border-white/15 bg-black/30 hover:border-emerald-500/35"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
      >
        <div>
          <UploadCloud className="mx-auto h-8 w-8 text-emerald-300" aria-hidden="true" />
          <div className="mt-2 text-sm font-black text-white">
            {file ? file.name : "Drop a document here or choose a file"}
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-500">
            {file
              ? `${fileSize(file.size)} · ${file.type || "Unknown browser MIME type"}`
              : `PDF, JPG, PNG, TXT, CSV, JSON, DOCX, or XLSX · up to ${Math.round(
                  maximumBytes / 1024 / 1024,
                )} MB`}
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50"
            disabled={busy}
          >
            Choose file
          </button>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={documentAcceptAttribute()}
            onChange={onFileChange}
            disabled={busy}
          />
        </div>
      </div>

      {busy || state === "complete" ? (
        <div className="mt-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-xs font-bold">
            <span className="inline-flex items-center gap-2 text-slate-300">
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-300" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              )}
              {stateLabel(state, progress)}
            </span>
            <span className="text-slate-500">{progress}%</span>
          </div>
          <progress
            className="mt-2 h-2 w-full overflow-hidden rounded-full accent-emerald-500"
            value={progress}
            max={100}
            aria-label="Document upload progress"
          />
        </div>
      ) : null}

      {message ? (
        <div
          className={`mt-4 flex items-start gap-3 rounded-2xl border p-3 text-xs font-semibold leading-5 ${
            state === "error"
              ? "border-amber-500/25 bg-amber-500/10 text-amber-50"
              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-50"
          }`}
          role={state === "error" ? "alert" : "status"}
        >
          {state === "error" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{message}</span>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] font-semibold leading-5 text-slate-500">
          {actor === "client"
            ? "Your assigned advisor receives a secure inbox notification after upload."
            : clientId
              ? `Target: ${selectedClient?.fullName ?? "selected client"}.`
              : "No client selected: this remains a firm-level advisor document."}
        </div>
        <div className="flex gap-2">
          {busy ? (
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void beginUpload()}
            disabled={!file || busy}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Upload securely
          </button>
        </div>
      </div>
    </section>
  );
}