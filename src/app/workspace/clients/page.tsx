"use client";

import dynamic from "next/dynamic";
import {
  FileUp,
  Mic,
  RefreshCw,
  UserPlus,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  fetchClientDetail,
  fetchClientList,
} from "@/lib/clients/client-api";
import type {
  ClientDetail,
  ClientDirectoryMetrics,
  ClientListItem,
  ClientListSort,
} from "@/lib/clients/contracts";
import ClientDirectory from "@/components/clients/client-directory";
import ClientProfileWorkspace, {
  type ClientProfileTab,
} from "@/components/clients/client-profile-workspace";
import {
  WorkspaceAlert,
  WorkspaceButton,
  WorkspacePageHeader,
  WorkspacePill,
  WorkspaceSkeleton,
  WorkspaceSurface,
  cx,
} from "@/components/workspace/core/workspace-ui";

const ClientImportDialog = dynamic(
  () => import("@/components/clients/client-import-dialog"),
  { ssr: false },
);

const ClientVoiceAssistant = dynamic(
  () => import("@/components/clients/client-voice-assistant"),
  { ssr: false },
);

const VALID_TABS: ClientProfileTab[] = [
  "overview",
  "portfolio",
  "risk",
  "tasks",
  "notes",
  "documents",
  "communications",
  "activity",
  "scheduling",
];

function currentSearchState() {
  if (typeof window === "undefined") {
    return {
      clientId: "",
      tab: "overview" as ClientProfileTab,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab") as ClientProfileTab | null;

  return {
    clientId: params.get("clientId") || "",
    tab: tab && VALID_TABS.includes(tab) ? tab : ("overview" as const),
  };
}

export default function ClientProfilesPage() {
  const initial = useMemo(currentSearchState, []);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [metrics, setMetrics] = useState<ClientDirectoryMetrics | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(initial.clientId);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<ClientProfileTab>(initial.tab);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [risk, setRisk] = useState("");
  const [sort, setSort] = useState<ClientListSort>("updatedAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [prefillHoldingSymbol, setPrefillHoldingSymbol] = useState("");
  const [prefillNoteBody, setPrefillNoteBody] = useState("");
  const [mobilePane, setMobilePane] = useState<"directory" | "profile">(
    initial.clientId ? "profile" : "directory",
  );
  const [profileDirty, setProfileDirty] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 350);
  const selectedClientIdRef = useRef(selectedClientId);
  const creatingRef = useRef(creating);
  const initialClientIdRef = useRef(initial.clientId);
  const profileDirtyRef = useRef(profileDirty);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    selectedClientIdRef.current = selectedClientId;
  }, [selectedClientId]);

  useEffect(() => {
    creatingRef.current = creating;
  }, [creating]);

  useEffect(() => {
    profileDirtyRef.current = profileDirty;
  }, [profileDirty]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const loadList = useCallback(
    async (input: {
      append?: boolean;
      cursor?: string | null;
      preferredClientId?: string | null;
      allowOutsidePage?: boolean;
    } = {}) => {
      const append = input.append === true;
      append ? setLoadingMore(true) : setListLoading(true);
      setError("");

      try {
        const result = await fetchClientList({
          q: debouncedQuery,
          status,
          risk,
          sort,
          direction,
          limit: 25,
          cursor: input.cursor || null,
          metrics: true,
        });

        setClients((current) =>
          append
            ? [
                ...current,
                ...result.clients.filter(
                  (candidate) =>
                    !current.some((existing) => existing.id === candidate.id),
                ),
              ]
            : result.clients,
        );
        if (result.metrics) setMetrics(result.metrics);
        setNextCursor(result.pagination.nextCursor);
        setHasMore(result.pagination.hasMore);

        if (!append) {
          const requestedPreferred =
            input.preferredClientId === undefined
              ? selectedClientIdRef.current
              : input.preferredClientId || "";
          const preferredIsVisible = result.clients.some(
            (candidate) => candidate.id === requestedPreferred,
          );
          const preferred =
            profileDirtyRef.current && selectedClientIdRef.current
              ? selectedClientIdRef.current
              : requestedPreferred && (preferredIsVisible || input.allowOutsidePage)
                ? requestedPreferred
                : result.clients[0]?.id || "";

          if (!creatingRef.current) {
            setSelectedClientId(preferred);
            if (!preferred) setClient(null);
          }
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The client directory could not be loaded.",
        );
      } finally {
        setListLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, direction, risk, sort, status],
  );

  useEffect(() => {
    const initialClientId = initialClientIdRef.current;
    initialClientIdRef.current = "";

    void loadList({
      preferredClientId: initialClientId || selectedClientIdRef.current,
      allowOutsidePage: Boolean(initialClientId),
    });
  }, [loadList]);

  useEffect(() => {
    function handleHistoryNavigation() {
      if (
        profileDirtyRef.current &&
        !window.confirm("Discard the unsaved client-profile changes?")
      ) {
        updateUrl(selectedClientIdRef.current, activeTabRef.current, "push");
        return;
      }

      const next = currentSearchState();
      setCreating(false);
      setSelectedClientId(next.clientId);
      setActiveTab(next.tab);
      setMobilePane(next.clientId ? "profile" : "directory");
      setNotice("");
      setProfileDirty(false);

      if (next.clientId) {
        window.dispatchEvent(
          new CustomEvent("slice-client-selected", {
            detail: { clientId: next.clientId },
          }),
        );
      }
    }

    window.addEventListener("popstate", handleHistoryNavigation);
    return () => window.removeEventListener("popstate", handleHistoryNavigation);
  }, []);

  useEffect(() => {
    if (!selectedClientId || creating) {
      if (!creating) setClient(null);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setDetailLoading(true);
    setError("");

    fetchClientDetail(selectedClientId, controller.signal)
      .then((result) => {
        if (active) setClient(result.client);
      })
      .catch((detailError: unknown) => {
        if (!active || (detailError as { name?: string })?.name === "AbortError") {
          return;
        }
        setError(
          detailError instanceof Error
            ? detailError.message
            : "The client profile could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [creating, selectedClientId, refreshToken]);

  function updateUrl(
    clientId: string,
    tab = activeTab,
    mode: "push" | "replace" = "replace",
  ) {
    const url = new URL(window.location.href);

    if (clientId) url.searchParams.set("clientId", clientId);
    else url.searchParams.delete("clientId");

    if (tab !== "overview") url.searchParams.set("tab", tab);
    else url.searchParams.delete("tab");

    window.history[mode === "push" ? "pushState" : "replaceState"](
      {},
      "",
      url.toString(),
    );
  }

  function selectClient(clientId: string) {
    if (
      clientId !== selectedClientIdRef.current &&
      profileDirtyRef.current &&
      !window.confirm("Discard the unsaved client-profile changes?")
    ) {
      return;
    }

    setProfileDirty(false);
    setCreating(false);
    setSelectedClientId(clientId);
    setMobilePane("profile");
    setNotice("");
    updateUrl(clientId, activeTab, "push");
    window.dispatchEvent(
      new CustomEvent("slice-client-selected", {
        detail: { clientId },
      }),
    );
  }

  function selectTab(tab: ClientProfileTab) {
    setActiveTab(tab);
    if (selectedClientId) updateUrl(selectedClientId, tab, "push");
  }

  function startCreate(defaults: Record<string, string> = {}) {
    if (
      profileDirtyRef.current &&
      !window.confirm("Discard the unsaved client-profile changes?")
    ) {
      return;
    }

    setProfileDirty(false);
    setCreateDefaults(defaults);
    setCreating(true);
    setClient(null);
    setActiveTab("overview");
    setMobilePane("profile");
    updateUrl("", "overview", "push");
  }

  async function refreshAfterChange(preferredClientId?: string | null) {
    setRefreshToken((current) => current + 1);
    await loadList({
      preferredClientId:
        preferredClientId === undefined
          ? selectedClientIdRef.current
          : preferredClientId,
    });
  }

  const visibleClientIds = useMemo(
    () => new Set(clients.map((item) => item.id)),
    [clients],
  );

  return (
    <main className="min-h-[calc(100dvh-4rem)] p-3 sm:p-4 lg:p-5">
      <div className="mx-auto grid max-w-[1900px] gap-4">
        <WorkspaceSurface className="p-5 sm:p-6">
          <WorkspacePageHeader
            eyebrow="Client relationships"
            title="Client profiles without the information overload."
            description="Search and filter on the server, keep identity and advisor assignment visible, and load portfolio, risk, tasks, notes, documents, and activity only when the advisor opens that section."
            badges={
              <>
                <WorkspacePill tone="emerald">
                  {metrics?.totalClients ?? clients.length} total clients
                </WorkspacePill>
                <WorkspacePill tone={metrics?.unassignedClients ? "amber" : "slate"}>
                  {metrics?.unassignedClients ?? 0} unassigned
                </WorkspacePill>
                <WorkspacePill tone="cyan">
                  {metrics?.openTasks ?? 0} open tasks
                </WorkspacePill>
                <WorkspacePill tone={metrics?.documentsNeedingReview ? "amber" : "slate"}>
                  {metrics?.documentsNeedingReview ?? 0} document reviews
                </WorkspacePill>
              </>
            }
            actions={
              <>
                <WorkspaceButton
                  variant="secondary"
                  icon={<Mic className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => setVoiceOpen(true)}
                >
                  Voice entry
                </WorkspaceButton>
                <WorkspaceButton
                  variant="secondary"
                  icon={<FileUp className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => setImportOpen(true)}
                >
                  AI import
                </WorkspaceButton>
                <WorkspaceButton
                  variant="primary"
                  icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => startCreate()}
                >
                  Add client
                </WorkspaceButton>
              </>
            }
          />
        </WorkspaceSurface>

        {error ? (
          <WorkspaceAlert
            tone="error"
            action={
              <WorkspaceButton
                variant="quiet"
                size="sm"
                icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => void loadList()}
              >
                Retry
              </WorkspaceButton>
            }
          >
            {error}
          </WorkspaceAlert>
        ) : null}

        {notice ? <WorkspaceAlert tone="success">{notice}</WorkspaceAlert> : null}

        <div className="grid grid-cols-2 gap-2 lg:hidden">
          <WorkspaceButton
            variant={mobilePane === "directory" ? "primary" : "secondary"}
            icon={<UsersRound className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setMobilePane("directory")}
          >
            Directory
          </WorkspaceButton>
          <WorkspaceButton
            variant={mobilePane === "profile" ? "primary" : "secondary"}
            onClick={() => setMobilePane("profile")}
            disabled={!creating && !selectedClientId}
          >
            {creating ? "New client" : client?.fullName || "Profile"}
          </WorkspaceButton>
        </div>

        <WorkspaceSurface className="min-h-[720px] lg:grid lg:grid-cols-[370px_minmax(0,1fr)]">
          <div className={cx("min-h-[620px] lg:block", mobilePane === "profile" && "hidden lg:block")}>
            <ClientDirectory
              clients={clients}
              metrics={metrics}
              selectedClientId={selectedClientId}
              loading={listLoading}
              loadingMore={loadingMore}
              query={query}
              status={status}
              risk={risk}
              sort={sort}
              direction={direction}
              hasMore={hasMore}
              onQueryChange={setQuery}
              onStatusChange={setStatus}
              onRiskChange={setRisk}
              onSortChange={setSort}
              onDirectionChange={setDirection}
              onSelect={selectClient}
              onLoadMore={() =>
                void loadList({ append: true, cursor: nextCursor })
              }
              onCreate={() => startCreate()}
              onImport={() => setImportOpen(true)}
              onVoice={() => setVoiceOpen(true)}
            />
          </div>

          <div className={cx("min-w-0", mobilePane === "directory" && "hidden lg:block")}>
            {detailLoading && !creating ? (
              <div className="p-5 sm:p-6">
                <WorkspaceSkeleton lines={14} />
              </div>
            ) : (
              <ClientProfileWorkspace
                client={client}
                creating={creating}
                createDefaults={createDefaults}
                activeTab={activeTab}
                onTabChange={selectTab}
                refreshToken={refreshToken}
                prefillHoldingSymbol={prefillHoldingSymbol}
                prefillNoteBody={prefillNoteBody}
                onPrefillConsumed={() => {
                  setPrefillHoldingSymbol("");
                  setPrefillNoteBody("");
                }}
                onDirtyChange={setProfileDirty}
                onCreated={(clientId, createdClient) => {
                  setProfileDirty(false);
                  setCreating(false);
                  setSelectedClientId(clientId);
                  setClient(createdClient);
                  setNotice("Client profile created. Assignment and portal controls are available in the routing dock.");
                  updateUrl(clientId, "overview");
                  void refreshAfterChange(clientId);
                  window.dispatchEvent(
                    new CustomEvent("slice-client-selected", {
                      detail: { clientId },
                    }),
                  );
                }}
                onUpdated={(updatedClient) => {
                  setProfileDirty(false);
                  setClient(updatedClient);
                  setNotice("Client profile saved.");
                  void refreshAfterChange(updatedClient.id);
                }}
                onDeleted={(clientId) => {
                  setProfileDirty(false);
                  setClients((current) => current.filter((item) => item.id !== clientId));
                  setClient(null);
                  setSelectedClientId("");
                  setNotice("Client profile removed. Retained document audit records were preserved by the Phase 9 policy.");
                  setMobilePane("directory");
                  updateUrl("");
                  void refreshAfterChange(null);
                }}
                onCancelCreate={() => {
                  if (
                    profileDirtyRef.current &&
                    !window.confirm("Discard the unsaved client-profile changes?")
                  ) {
                    return;
                  }
                  setProfileDirty(false);
                  setCreating(false);
                  setCreateDefaults({});
                  if (selectedClientId && visibleClientIds.has(selectedClientId)) {
                    setMobilePane("profile");
                    updateUrl(selectedClientId, activeTab, "replace");
                  } else {
                    setMobilePane("directory");
                    updateUrl("", "overview", "replace");
                  }
                }}
              />
            )}
          </div>
        </WorkspaceSurface>
      </div>

      {importOpen ? (
        <ClientImportDialog
          open
          onClose={() => setImportOpen(false)}
          onImported={(clientId) => {
            setImportOpen(false);
            setNotice("Reviewed client records imported successfully.");
            void refreshAfterChange(clientId);
            if (clientId) selectClient(clientId);
          }}
        />
      ) : null}

      {voiceOpen ? (
        <ClientVoiceAssistant
          open
          clients={clients}
          onClose={() => setVoiceOpen(false)}
          onCreateDraft={(values) => startCreate(values as Record<string, string>)}
          onSelectClient={selectClient}
          onPrepareHolding={(symbol, clientId) => {
            if (clientId) selectClient(clientId);
            const targetClientId = clientId || selectedClientIdRef.current;
            setPrefillHoldingSymbol(symbol);
            setPrefillNoteBody("");
            setActiveTab("portfolio");
            setMobilePane("profile");
            if (targetClientId) updateUrl(targetClientId, "portfolio", "replace");
          }}
          onPrepareNote={(body, clientId) => {
            if (clientId) selectClient(clientId);
            const targetClientId = clientId || selectedClientIdRef.current;
            setPrefillNoteBody(body);
            setPrefillHoldingSymbol("");
            setActiveTab("notes");
            setMobilePane("profile");
            if (targetClientId) updateUrl(targetClientId, "notes", "replace");
          }}
        />
      ) : null}
    </main>
  );
}