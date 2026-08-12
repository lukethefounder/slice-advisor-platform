"use client";

import {
  ChevronDown,
  FileUp,
  Mic,
  Plus,
  Search,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";

import type {
  ClientDirectoryMetrics,
  ClientListItem,
  ClientListSort,
} from "@/lib/clients/contracts";
import {
  WorkspaceButton,
  WorkspaceEmptyState,
  WorkspaceInput,
  WorkspaceMetric,
  WorkspacePill,
  WorkspaceSelect,
  WorkspaceSkeleton,
  cx,
} from "@/components/workspace/core/workspace-ui";

const STATUS_OPTIONS = ["", "Active", "Needs Review", "Inactive", "Prospect"];
const RISK_OPTIONS = ["", "Conservative", "Balanced", "Moderate", "Growth", "Aggressive"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("active")) return "emerald" as const;
  if (normalized.includes("review")) return "amber" as const;
  return "slate" as const;
}

export default function ClientDirectory({
  clients,
  metrics,
  selectedClientId,
  loading,
  loadingMore,
  query,
  status,
  risk,
  sort,
  direction,
  hasMore,
  onQueryChange,
  onStatusChange,
  onRiskChange,
  onSortChange,
  onDirectionChange,
  onSelect,
  onLoadMore,
  onCreate,
  onImport,
  onVoice,
}: {
  clients: ClientListItem[];
  metrics: ClientDirectoryMetrics | null;
  selectedClientId: string;
  loading: boolean;
  loadingMore: boolean;
  query: string;
  status: string;
  risk: string;
  sort: ClientListSort;
  direction: "asc" | "desc";
  hasMore: boolean;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onRiskChange: (value: string) => void;
  onSortChange: (value: ClientListSort) => void;
  onDirectionChange: (value: "asc" | "desc") => void;
  onSelect: (clientId: string) => void;
  onLoadMore: () => void;
  onCreate: () => void;
  onImport: () => void;
  onVoice: () => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col border-b border-white/8 bg-black/28 lg:border-b-0 lg:border-r">
      <div className="border-b border-white/8 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
              Client directory
            </p>
            <h2 className="mt-1 text-xl font-black text-white">
              {metrics?.filteredClients ?? clients.length} visible clients
            </h2>
          </div>
          <WorkspaceButton
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={onCreate}
          >
            New
          </WorkspaceButton>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <WorkspaceButton
            variant="secondary"
            size="sm"
            icon={<FileUp className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={onImport}
          >
            AI import
          </WorkspaceButton>
          <WorkspaceButton
            variant="secondary"
            size="sm"
            icon={<Mic className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={onVoice}
          >
            Voice
          </WorkspaceButton>
        </div>

        <label className="relative mt-3 block">
          <span className="sr-only">Search client directory</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <WorkspaceInput
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search names, households, status…"
            className="pl-10"
            autoComplete="off"
          />
        </label>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <label>
            <span className="sr-only">Filter by status</span>
            <WorkspaceSelect
              value={status}
              onChange={(event) => onStatusChange(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All statuses"}
                </option>
              ))}
            </WorkspaceSelect>
          </label>
          <label>
            <span className="sr-only">Filter by risk profile</span>
            <WorkspaceSelect
              value={risk}
              onChange={(event) => onRiskChange(event.target.value)}
            >
              {RISK_OPTIONS.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All risk profiles"}
                </option>
              ))}
            </WorkspaceSelect>
          </label>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <label>
            <span className="sr-only">Sort clients</span>
            <WorkspaceSelect
              value={sort}
              onChange={(event) => onSortChange(event.target.value as ClientListSort)}
            >
              <option value="updatedAt">Recently updated</option>
              <option value="createdAt">Recently created</option>
              <option value="fullName">Client name</option>
              <option value="status">Client status</option>
            </WorkspaceSelect>
          </label>
          <button
            type="button"
            onClick={() => onDirectionChange(direction === "asc" ? "desc" : "asc")}
            className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400/45"
            aria-label={`Sort ${direction === "asc" ? "descending" : "ascending"}`}
            title={`Sort ${direction === "asc" ? "descending" : "ascending"}`}
          >
            <ChevronDown
              className={cx(
                "h-4 w-4 transition-transform",
                direction === "asc" && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {metrics ? (
        <div className="grid grid-cols-2 gap-2 border-b border-white/8 p-3">
          <WorkspaceMetric
            label="Active"
            value={metrics.activeClients}
            helper="current relationships"
            tone="emerald"
            icon={<UserRoundCheck className="h-4 w-4" aria-hidden="true" />}
          />
          <WorkspaceMetric
            label="Unassigned"
            value={metrics.unassignedClients}
            helper="need routing"
            tone={metrics.unassignedClients ? "amber" : "slate"}
            icon={<UsersRound className="h-4 w-4" aria-hidden="true" />}
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5" aria-live="polite">
        {loading && !clients.length ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
                <WorkspaceSkeleton lines={2} />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !clients.length ? (
          <WorkspaceEmptyState
            compact
            title="No clients matched"
            description="Adjust the search or filters, or create the first client profile."
            action={
              <WorkspaceButton variant="primary" size="sm" onClick={onCreate}>
                Create client
              </WorkspaceButton>
            }
          />
        ) : null}

        <div className="grid gap-1.5" role="listbox" aria-label="Client profiles">
          {clients.map((client) => {
            const selected = client.id === selectedClientId;

            return (
              <button
                key={client.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(client.id)}
                className={cx(
                  "flex w-full min-w-0 items-start gap-3 rounded-2xl border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-emerald-400/45",
                  selected
                    ? "border-emerald-400/25 bg-emerald-500/[0.085]"
                    : "border-transparent bg-white/[0.025] hover:border-white/10 hover:bg-white/[0.045]",
                )}
              >
                <span
                  className={cx(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-xs font-black",
                    selected
                      ? "border-emerald-400/25 bg-emerald-500/12 text-emerald-100"
                      : "border-white/10 bg-black/30 text-slate-300",
                  )}
                >
                  {initials(client.fullName) || "CL"}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate text-sm font-black text-white">
                      {client.fullName}
                    </span>
                    <WorkspacePill tone={statusTone(client.status)}>
                      {client.status}
                    </WorkspacePill>
                  </span>
                  <span className="mt-1 block truncate text-xs font-semibold text-slate-500">
                    {client.householdName || client.clientType}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500">
                    <span>{client.riskProfile}</span>
                    <span>{client.counts.holdings} holdings</span>
                    <span>{client.counts.tasks} tasks</span>
                  </span>
                  <span className="mt-2 block truncate text-[10px] font-semibold text-slate-600">
                    {client.assignedAdvisor?.name || "Unassigned advisor"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {hasMore ? (
          <WorkspaceButton
            className="mt-3 w-full"
            variant="secondary"
            loading={loadingMore}
            onClick={onLoadMore}
          >
            Load more clients
          </WorkspaceButton>
        ) : clients.length ? (
          <p className="py-4 text-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
            End of client results
          </p>
        ) : null}
      </div>
    </aside>
  );
}