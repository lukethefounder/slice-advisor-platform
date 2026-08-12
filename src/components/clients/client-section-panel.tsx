"use client";

import {
  Check,
  FileText,
  ListChecks,
  NotebookPen,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  fetchClientSection,
  mutateClient,
  type ClientMutationResponse,
} from "@/lib/clients/client-api";
import type {
  ClientBriefingItem,
  ClientDocumentItem,
  ClientHoldingItem,
  ClientNoteItem,
  ClientRiskReviewItem,
  ClientSectionItem,
  ClientSectionName,
  ClientTaskItem,
} from "@/lib/clients/contracts";
import {
  WorkspaceAlert,
  WorkspaceButton,
  WorkspaceEmptyState,
  WorkspaceField,
  WorkspaceInput,
  WorkspacePill,
  WorkspaceSelect,
  WorkspaceSkeleton,
  WorkspaceTextarea,
  cx,
} from "@/components/workspace/core/workspace-ui";

function dateLabel(value: string | null | undefined) {
  if (!value) return "No date";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : value;
}

function flags(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function cleanSymbols(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,;\n]+/)
        .map((symbol) =>
          symbol
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9.\-:$]/g, ""),
        )
        .filter(Boolean),
    ),
  ).slice(0, 100);
}

function sectionTitle(section: ClientSectionName) {
  const labels: Record<ClientSectionName, string> = {
    holdings: "Portfolio holdings",
    notes: "Advisor notes",
    tasks: "Client tasks",
    documents: "Client documents",
    "risk-reviews": "Risk reviews",
    briefings: "Client briefings",
  };
  return labels[section];
}

function sectionDescription(section: ClientSectionName) {
  const labels: Record<ClientSectionName, string> = {
    holdings: "Load and manage securities only when this section is open.",
    notes: "Private advisor notes are loaded on demand and remain firm-scoped.",
    tasks: "Track follow-up work without loading the complete client history.",
    documents: "Open the secure document center for private files and access history.",
    "risk-reviews": "Review suitability scores, flags, and prior risk assessments.",
    briefings: "Review generated client briefings and communication context.",
  };
  return labels[section];
}

export default function ClientSectionPanel({
  clientId,
  clientName,
  section,
  refreshToken = 0,
  prefillHoldingSymbol = "",
  prefillNoteBody = "",
  onPrefillConsumed,
  onChanged,
}: {
  clientId: string;
  clientName: string;
  section: ClientSectionName;
  refreshToken?: number;
  prefillHoldingSymbol?: string;
  prefillNoteBody?: string;
  onPrefillConsumed?: () => void;
  onChanged?: (result: ClientMutationResponse) => void;
}) {
  const [items, setItems] = useState<ClientSectionItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [holdingForm, setHoldingForm] = useState({
    symbol: "",
    assetName: "",
    assetClass: "Stock",
    riskLevel: "Medium",
    thesis: "",
  });
  const [bulkSymbols, setBulkSymbols] = useState("");
  const [noteForm, setNoteForm] = useState({
    title: "",
    body: "",
    noteType: "General",
  });
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "Medium",
  });
  const debouncedQuery = useDebouncedValue(query, 350);

  const load = useCallback(
    async (input: { append?: boolean; cursor?: string | null } = {}) => {
      const append = input.append === true;
      append ? setLoadingMore(true) : setLoading(true);
      setError("");

      try {
        const result = await fetchClientSection({
          clientId,
          section,
          q: debouncedQuery,
          status,
          cursor: input.cursor ?? null,
          limit: 25,
        });

        setItems((current) =>
          append
            ? [
                ...current,
                ...result.items.filter(
                  (item) => !current.some((existing) => existing.id === item.id),
                ),
              ]
            : result.items,
        );
        setNextCursor(result.pagination.nextCursor);
        setHasMore(result.pagination.hasMore);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : `Unable to load ${sectionTitle(section).toLowerCase()}.`,
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [clientId, debouncedQuery, section, status],
  );

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    if (prefillHoldingSymbol && section === "holdings") {
      setHoldingForm((current) => ({
        ...current,
        symbol: prefillHoldingSymbol.toUpperCase(),
        assetName: current.assetName || prefillHoldingSymbol.toUpperCase(),
      }));
      onPrefillConsumed?.();
    }

    if (prefillNoteBody && section === "notes") {
      setNoteForm((current) => ({
        ...current,
        title: current.title || "Voice note",
        body: prefillNoteBody,
      }));
      onPrefillConsumed?.();
    }
  }, [onPrefillConsumed, prefillHoldingSymbol, prefillNoteBody, section]);

  async function runMutation(
    body: Record<string, unknown>,
    message: string,
    confirmation?: string,
  ) {
    if (confirmation && !window.confirm(confirmation)) return null;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await mutateClient(body);
      setSuccess(message || result.message);
      await load();
      onChanged?.(result);
      return result;
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "The client record could not be updated.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  const statusOptions = useMemo(() => {
    if (section === "tasks") return ["", "Open", "Done", "Complete"];
    if (section === "documents") {
      return ["", "Needs Review", "Approved", "Processing", "Archived"];
    }
    if (section === "briefings") return ["", "Generated", "Approved", "Archived"];
    return [];
  }, [section]);

  async function addHolding() {
    const symbol = holdingForm.symbol.trim().toUpperCase();
    if (!symbol) {
      setError("Security symbol is required.");
      return;
    }

    const result = await runMutation(
      {
        action: "addHolding",
        clientId,
        ...holdingForm,
        symbol,
        assetName: holdingForm.assetName.trim() || symbol,
      },
      `${symbol} added to ${clientName}.`,
    );

    if (result) {
      setHoldingForm({
        symbol: "",
        assetName: "",
        assetClass: "Stock",
        riskLevel: "Medium",
        thesis: "",
      });
    }
  }

  async function addBulkHoldings() {
    const symbols = cleanSymbols(bulkSymbols);
    if (!symbols.length) {
      setError("Enter at least one valid security symbol.");
      return;
    }

    const result = await runMutation(
      {
        action: "bulkAddHoldings",
        clientId,
        symbols,
      },
      `${symbols.length} securities added to ${clientName}.`,
    );

    if (result) setBulkSymbols("");
  }

  async function addNote() {
    if (!noteForm.title.trim() || !noteForm.body.trim()) {
      setError("Note title and body are required.");
      return;
    }

    const result = await runMutation(
      {
        action: "addNote",
        clientId,
        ...noteForm,
      },
      "Advisor note saved.",
    );

    if (result) {
      setNoteForm({ title: "", body: "", noteType: "General" });
    }
  }

  async function addTask() {
    if (!taskForm.title.trim()) {
      setError("Task title is required.");
      return;
    }

    const result = await runMutation(
      {
        action: "addTask",
        clientId,
        ...taskForm,
      },
      "Client task created.",
    );

    if (result) {
      setTaskForm({
        title: "",
        description: "",
        dueDate: "",
        priority: "Medium",
      });
    }
  }

  return (
    <section aria-labelledby={`client-${section}-heading`}>
      <div className="flex flex-col gap-3 border-b border-white/8 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
            Loaded on demand
          </p>
          <h3 id={`client-${section}-heading`} className="mt-1 text-xl font-black text-white">
            {sectionTitle(section)}
          </h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {sectionDescription(section)}
          </p>
        </div>
        <WorkspaceButton
          variant="quiet"
          size="sm"
          icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={() => void load()}
          loading={loading}
        >
          Refresh
        </WorkspaceButton>
      </div>

      <div className="grid gap-4 p-4 sm:p-5">
        {error ? <WorkspaceAlert tone="error">{error}</WorkspaceAlert> : null}
        {success ? <WorkspaceAlert tone="success">{success}</WorkspaceAlert> : null}

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
          <label className="relative block">
            <span className="sr-only">Search {sectionTitle(section)}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <WorkspaceInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${sectionTitle(section).toLowerCase()}…`}
              className="pl-10"
            />
          </label>
          {statusOptions.length ? (
            <WorkspaceSelect value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All statuses"}
                </option>
              ))}
            </WorkspaceSelect>
          ) : (
            <div />
          )}
        </div>

        {section === "holdings" ? (
          <div className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 xl:grid-cols-[1fr_1fr_180px_160px]">
            <WorkspaceField label="Symbol" required>
              <WorkspaceInput
                value={holdingForm.symbol}
                onChange={(event) =>
                  setHoldingForm((current) => ({
                    ...current,
                    symbol: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="NVDA"
              />
            </WorkspaceField>
            <WorkspaceField label="Asset name">
              <WorkspaceInput
                value={holdingForm.assetName}
                onChange={(event) =>
                  setHoldingForm((current) => ({
                    ...current,
                    assetName: event.target.value,
                  }))
                }
                placeholder="NVIDIA Corporation"
              />
            </WorkspaceField>
            <WorkspaceField label="Asset class">
              <WorkspaceSelect
                value={holdingForm.assetClass}
                onChange={(event) =>
                  setHoldingForm((current) => ({
                    ...current,
                    assetClass: event.target.value,
                  }))
                }
              >
                {[
                  "Stock",
                  "ETF",
                  "Bond",
                  "Mutual Fund",
                  "Cash",
                  "Alternative",
                  "Crypto",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </WorkspaceSelect>
            </WorkspaceField>
            <div className="self-end">
              <WorkspaceButton
                className="w-full"
                variant="primary"
                loading={busy}
                icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                onClick={() => void addHolding()}
              >
                Add holding
              </WorkspaceButton>
            </div>
            <WorkspaceField label="Thesis or context" className="xl:col-span-4">
              <WorkspaceTextarea
                value={holdingForm.thesis}
                onChange={(event) =>
                  setHoldingForm((current) => ({
                    ...current,
                    thesis: event.target.value,
                  }))
                }
                placeholder="Why this security matters in the client plan…"
                className="min-h-20"
              />
            </WorkspaceField>
            <WorkspaceField
              label="Quick bulk symbols"
              description="Separate symbols with commas, spaces, or new lines. Position amounts are not stored by this shortcut."
              className="xl:col-span-3"
            >
              <WorkspaceTextarea
                value={bulkSymbols}
                onChange={(event) => setBulkSymbols(event.target.value)}
                placeholder="SPY, QQQ, MSFT, TLT"
                className="min-h-20"
              />
            </WorkspaceField>
            <div className="self-end">
              <WorkspaceButton
                className="w-full"
                variant="secondary"
                loading={busy}
                onClick={() => void addBulkHoldings()}
              >
                Add symbols
              </WorkspaceButton>
            </div>
          </div>
        ) : null}

        {section === "notes" ? (
          <div className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 sm:grid-cols-[1fr_220px]">
            <WorkspaceField label="Note title" required>
              <WorkspaceInput
                value={noteForm.title}
                onChange={(event) =>
                  setNoteForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Planning follow-up"
              />
            </WorkspaceField>
            <WorkspaceField label="Note type">
              <WorkspaceSelect
                value={noteForm.noteType}
                onChange={(event) =>
                  setNoteForm((current) => ({ ...current, noteType: event.target.value }))
                }
              >
                {[
                  "General",
                  "Meeting",
                  "Planning",
                  "Investment",
                  "Compliance",
                  "Service",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </WorkspaceSelect>
            </WorkspaceField>
            <WorkspaceField label="Private advisor note" required className="sm:col-span-2">
              <WorkspaceTextarea
                value={noteForm.body}
                onChange={(event) =>
                  setNoteForm((current) => ({ ...current, body: event.target.value }))
                }
                placeholder="Record concise context, next steps, and decision rationale…"
              />
            </WorkspaceField>
            <WorkspaceButton
              variant="primary"
              loading={busy}
              icon={<NotebookPen className="h-4 w-4" aria-hidden="true" />}
              onClick={() => void addNote()}
            >
              Save note
            </WorkspaceButton>
          </div>
        ) : null}

        {section === "tasks" ? (
          <div className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_180px_180px]">
            <WorkspaceField label="Task title" required>
              <WorkspaceInput
                value={taskForm.title}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Prepare review meeting"
              />
            </WorkspaceField>
            <WorkspaceField label="Description">
              <WorkspaceInput
                value={taskForm.description}
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Specific next step"
              />
            </WorkspaceField>
            <WorkspaceField label="Due date">
              <WorkspaceInput
                type="date"
                value={taskForm.dueDate}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                }
              />
            </WorkspaceField>
            <WorkspaceField label="Priority">
              <WorkspaceSelect
                value={taskForm.priority}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, priority: event.target.value }))
                }
              >
                {[
                  "Low",
                  "Medium",
                  "High",
                  "Critical",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </WorkspaceSelect>
            </WorkspaceField>
            <WorkspaceButton
              variant="primary"
              loading={busy}
              icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
              onClick={() => void addTask()}
            >
              Add task
            </WorkspaceButton>
          </div>
        ) : null}

        {section === "risk-reviews" ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-white">Create a current suitability review</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                Slice derives a bounded review from the client profile and currently stored holdings.
              </p>
            </div>
            <WorkspaceButton
              variant="primary"
              loading={busy}
              icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              onClick={() =>
                void runMutation(
                  { action: "addRiskReview", clientId },
                  "Risk review created.",
                )
              }
            >
              Run review
            </WorkspaceButton>
          </div>
        ) : null}

        {section === "documents" ? (
          <WorkspaceAlert
            tone="info"
            title="Secure files are managed in the Document Center"
            action={
              <WorkspaceButton
                href={`/workspace/documents?clientId=${encodeURIComponent(clientId)}`}
                size="sm"
                variant="primary"
              >
                Open documents
              </WorkspaceButton>
            }
          >
            Private uploads, fingerprint verification, processing, approval, signed access, and audit history remain in the Phase 9 secure workflow.
          </WorkspaceAlert>
        ) : null}

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                <WorkspaceSkeleton lines={3} />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !items.length ? (
          <WorkspaceEmptyState
            title={`No ${sectionTitle(section).toLowerCase()} found`}
            description={
              query || status
                ? "No records match the current search and filters."
                : "This section is ready when the advisor adds the first record."
            }
          />
        ) : null}

        {!loading && items.length ? (
          <div className="grid gap-3">
            {section === "holdings"
              ? (items as ClientHoldingItem[]).map((holding) => (
                  <article
                    key={holding.id}
                    className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-black text-white">{holding.symbol}</h4>
                          <WorkspacePill tone="cyan">{holding.assetClass}</WorkspacePill>
                          <WorkspacePill
                            tone={holding.riskLevel === "High" ? "amber" : "slate"}
                          >
                            {holding.riskLevel} risk
                          </WorkspacePill>
                        </div>
                        <p className="mt-1 text-sm font-bold text-slate-300">
                          {holding.assetName}
                        </p>
                        {holding.thesis ? (
                          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                            {holding.thesis}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                          <span>Value {holding.value || "Not stored"}</span>
                          <span>Allocation {holding.allocationPct || "Not stored"}</span>
                          <span>Added {dateLabel(holding.createdAt)}</span>
                        </div>
                      </div>
                      <WorkspaceButton
                        variant="danger"
                        size="sm"
                        icon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                        loading={busy}
                        onClick={() =>
                          void runMutation(
                            {
                              action: "removeHolding",
                              clientId,
                              holdingId: holding.id,
                            },
                            `${holding.symbol} removed.`,
                            `Remove ${holding.symbol} from ${clientName}?`,
                          )
                        }
                      >
                        Remove
                      </WorkspaceButton>
                    </div>
                  </article>
                ))
              : null}

            {section === "notes"
              ? (items as ClientNoteItem[]).map((note) => (
                  <article
                    key={note.id}
                    className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-black text-white">{note.title}</h4>
                      <WorkspacePill tone="violet">{note.noteType}</WorkspacePill>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-400">
                      {note.body}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-slate-600">
                      {dateLabel(note.createdAt)}
                    </p>
                  </article>
                ))
              : null}

            {section === "tasks"
              ? (items as ClientTaskItem[]).map((task) => {
                  const complete = task.status === "Done" || task.status === "Complete";

                  return (
                    <article
                      key={task.id}
                      className={cx(
                        "rounded-2xl border p-4",
                        complete
                          ? "border-emerald-400/16 bg-emerald-500/[0.045]"
                          : "border-white/8 bg-white/[0.025]",
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className={cx("text-base font-black", complete ? "text-slate-400 line-through" : "text-white")}>
                              {task.title}
                            </h4>
                            <WorkspacePill tone={complete ? "emerald" : task.priority === "High" || task.priority === "Critical" ? "amber" : "slate"}>
                              {task.status}
                            </WorkspacePill>
                            <WorkspacePill tone="slate">{task.priority}</WorkspacePill>
                          </div>
                          {task.description ? (
                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                              {task.description}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs font-semibold text-slate-600">
                            Due {dateLabel(task.dueDate)} · Created {dateLabel(task.createdAt)}
                          </p>
                        </div>
                        <WorkspaceButton
                          variant={complete ? "secondary" : "primary"}
                          size="sm"
                          loading={busy}
                          icon={<Check className="h-3.5 w-3.5" aria-hidden="true" />}
                          onClick={() =>
                            void runMutation(
                              {
                                action: "completeTask",
                                clientId,
                                taskId: task.id,
                                status: complete ? "Open" : "Done",
                              },
                              complete ? "Task reopened." : "Task completed.",
                            )
                          }
                        >
                          {complete ? "Reopen" : "Complete"}
                        </WorkspaceButton>
                      </div>
                    </article>
                  );
                })
              : null}

            {section === "risk-reviews"
              ? (items as ClientRiskReviewItem[]).map((review) => (
                  <article
                    key={review.id}
                    className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <WorkspacePill tone={review.score >= 75 ? "emerald" : review.score >= 55 ? "amber" : "violet"}>
                            Score {review.score}/100
                          </WorkspacePill>
                          <WorkspacePill tone="slate">{review.suitabilityStatus}</WorkspacePill>
                        </div>
                        <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
                          {review.summary}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {flags(review.flagsJson).map((flag) => (
                            <WorkspacePill key={flag} tone="amber">
                              {flag}
                            </WorkspacePill>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-slate-600">
                        {dateLabel(review.createdAt)}
                      </p>
                    </div>
                  </article>
                ))
              : null}

            {section === "documents"
              ? (items as ClientDocumentItem[]).map((document) => (
                  <article
                    key={document.id}
                    className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <FileText className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                          <h4 className="text-base font-black text-white">{document.fileName}</h4>
                          <WorkspacePill tone="slate">{document.documentType}</WorkspacePill>
                          <WorkspacePill tone={document.status.includes("Approved") ? "emerald" : "amber"}>
                            {document.status}
                          </WorkspacePill>
                        </div>
                        {document.notes ? (
                          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                            {document.notes}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-xs font-semibold text-slate-600">
                        {dateLabel(document.createdAt)}
                      </p>
                    </div>
                  </article>
                ))
              : null}

            {section === "briefings"
              ? (items as ClientBriefingItem[]).map((briefing) => (
                  <article
                    key={briefing.id}
                    className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                      <h4 className="text-base font-black text-white">{briefing.title}</h4>
                      <WorkspacePill tone="cyan">{briefing.briefType}</WorkspacePill>
                      <WorkspacePill tone="slate">{briefing.status}</WorkspacePill>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
                      {briefing.executiveSummary}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-slate-600">
                      {briefing.audience} · {dateLabel(briefing.createdAt)}
                    </p>
                  </article>
                ))
              : null}
          </div>
        ) : null}

        {hasMore ? (
          <WorkspaceButton
            className="w-full"
            variant="secondary"
            loading={loadingMore}
            onClick={() => void load({ append: true, cursor: nextCursor })}
          >
            Load more records
          </WorkspaceButton>
        ) : null}
      </div>
    </section>
  );
}