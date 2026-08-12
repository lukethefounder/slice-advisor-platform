"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  CalendarDays,
  FileText,
  History,
  Mail,
  MessageSquareText,
  Save,
  ShieldCheck,
  Trash2,
  UserRoundCog,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  deleteClient,
  mutateClient,
  type ClientMutationResponse,
} from "@/lib/clients/client-api";
import type {
  ClientDetail,
  ClientSectionName,
} from "@/lib/clients/contracts";
import {
  WorkspaceAlert,
  WorkspaceButton,
  WorkspaceEmptyState,
  WorkspaceField,
  WorkspaceInput,
  WorkspacePill,
  WorkspaceSelect,
  WorkspaceSurface,
  WorkspaceTabs,
  WorkspaceTextarea,
} from "@/components/workspace/core/workspace-ui";

const ClientSectionPanel = dynamic(
  () => import("@/components/clients/client-section-panel"),
  {
    loading: () => (
      <div className="p-5" role="status" aria-label="Loading client section">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-white/[0.07]" />
        <div className="mt-4 grid gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-2xl border border-white/8 bg-white/[0.035]"
            />
          ))}
        </div>
      </div>
    ),
  },
);

export type ClientProfileTab =
  | "overview"
  | "portfolio"
  | "risk"
  | "tasks"
  | "notes"
  | "documents"
  | "communications"
  | "activity"
  | "scheduling";

type ClientForm = {
  fullName: string;
  email: string;
  phone: string;
  householdName: string;
  preferredContactMethod: string;
  clientType: string;
  riskProfile: string;
  liquidityNeeds: string;
  timeHorizon: string;
  objective: string;
  portfolioValue: string;
  status: string;
  notes: string;
};

type RoutingActivity = {
  assignmentHistory: Array<{
    id: string;
    reason?: string | null;
    createdAt: string;
    changedBy?: string;
    previousAdvisor?: { name?: string } | null;
    nextAdvisor?: { name?: string } | null;
  }>;
  inbox: Array<{
    id: string;
    title: string;
    kind: string;
    status: string;
    priority: string;
    createdAt: string;
    historical?: boolean;
    readOnly?: boolean;
  }>;
};

const EMPTY_FORM: ClientForm = {
  fullName: "",
  email: "",
  phone: "",
  householdName: "",
  preferredContactMethod: "Portal + email",
  clientType: "Private Client",
  riskProfile: "Balanced",
  liquidityNeeds: "Moderate",
  timeHorizon: "5-10 years",
  objective: "Long-term wealth growth",
  portfolioValue: "",
  status: "Active",
  notes: "",
};

function formFromClient(client: ClientDetail | null): ClientForm {
  if (!client) return EMPTY_FORM;

  return {
    fullName: client.fullName,
    email: client.email || "",
    phone: client.phone || "",
    householdName: client.householdName || "",
    preferredContactMethod: client.preferredContactMethod,
    clientType: client.clientType,
    riskProfile: client.riskProfile,
    liquidityNeeds: client.liquidityNeeds,
    timeHorizon: client.timeHorizon,
    objective: client.objective,
    portfolioValue: client.portfolioValue || "",
    status: client.status,
    notes: client.notes || "",
  };
}

function dateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function sectionForTab(tab: ClientProfileTab): ClientSectionName | null {
  if (tab === "portfolio") return "holdings";
  if (tab === "risk") return "risk-reviews";
  if (tab === "tasks") return "tasks";
  if (tab === "notes") return "notes";
  if (tab === "documents") return "documents";
  return null;
}

export default function ClientProfileWorkspace({
  client,
  creating,
  createDefaults,
  activeTab,
  onTabChange,
  refreshToken,
  prefillHoldingSymbol,
  prefillNoteBody,
  onPrefillConsumed,
  onCreated,
  onUpdated,
  onDeleted,
  onCancelCreate,
  onDirtyChange,
}: {
  client: ClientDetail | null;
  creating: boolean;
  createDefaults?: Partial<ClientForm>;
  activeTab: ClientProfileTab;
  onTabChange: (tab: ClientProfileTab) => void;
  refreshToken: number;
  prefillHoldingSymbol?: string;
  prefillNoteBody?: string;
  onPrefillConsumed?: () => void;
  onCreated: (clientId: string, client: ClientDetail | null) => void;
  onUpdated: (client: ClientDetail) => void;
  onDeleted: (clientId: string) => void;
  onCancelCreate: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [form, setForm] = useState<ClientForm>({
    ...EMPTY_FORM,
    ...createDefaults,
  });
  const [baseline, setBaseline] = useState<ClientForm>({
    ...EMPTY_FORM,
    ...createDefaults,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activity, setActivity] = useState<RoutingActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    const next = creating
      ? { ...EMPTY_FORM, ...createDefaults }
      : formFromClient(client);
    setForm(next);
    setBaseline(next);
    setError("");
    setSuccess("");
  }, [client, createDefaults, creating]);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;

    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!client || activeTab !== "activity") return;

    const controller = new AbortController();
    let active = true;
    setActivityLoading(true);

    fetch(
      `/api/advisor-routing?clientId=${encodeURIComponent(client.id)}&scope=mine`,
      {
        cache: "no-store",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as RoutingActivity;
      })
      .then((result) => {
        if (active && result) setActivity(result);
      })
      .catch((fetchError: unknown) => {
        if (
          active &&
          (fetchError as { name?: string })?.name !== "AbortError"
        ) {
          setActivity(null);
        }
      })
      .finally(() => {
        if (active) setActivityLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [activeTab, client]);

  const tabs = useMemo(
    () => [
      { value: "overview" as const, label: "Overview" },
      {
        value: "portfolio" as const,
        label: "Portfolio",
        count: client?.counts.holdings,
      },
      {
        value: "risk" as const,
        label: "Risk",
        count: client?.counts.reviews,
      },
      {
        value: "tasks" as const,
        label: "Tasks",
        count: client?.counts.tasks,
      },
      {
        value: "notes" as const,
        label: "Notes",
        count: client?.counts.notes,
      },
      {
        value: "documents" as const,
        label: "Documents",
        count: client?.counts.documents,
      },
      {
        value: "communications" as const,
        label: "Communications",
      },
      {
        value: "activity" as const,
        label: "Activity",
      },
      { value: "scheduling" as const, label: "Scheduling" },
    ],
    [client],
  );

  function update<K extends keyof ClientForm>(key: K, value: ClientForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSuccess("");
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.fullName.trim()) {
      setError("Client full name is required.");
      return;
    }

    setBusy(true);

    try {
      const result = await mutateClient({
        action: creating ? "createClient" : "updateClient",
        ...(creating ? {} : { clientId: client?.id }),
        ...form,
      });
      setSuccess(result.message);

      if (creating) {
        setBaseline(form);
        onCreated(result.clientId, result.client || null);
      } else if (result.client) {
        const next = formFromClient(result.client);
        setForm(next);
        setBaseline(next);
        onUpdated(result.client);
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The client profile could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeClient() {
    if (!client) return;
    const confirmation = window.prompt(
      `Type DELETE to remove ${client.fullName}. Active secure documents will block deletion until their retention workflow is complete.`,
    );
    if (confirmation !== "DELETE") return;

    setBusy(true);
    setError("");

    try {
      await deleteClient(client.id);
      onDeleted(client.id);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The client could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!creating && !client) {
    return (
      <div className="grid min-h-[560px] place-items-center p-5">
        <WorkspaceEmptyState
          title="Select a client profile"
          description="Choose a client from the directory to load only the overview and section you need."
          action={
            <WorkspaceButton variant="primary" onClick={onCancelCreate}>
              Return to directory
            </WorkspaceButton>
          }
        />
      </div>
    );
  }

  const currentClient = client;
  const section = sectionForTab(activeTab);

  return (
    <div className="min-w-0">
      <header className="border-b border-white/8 p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-emerald-400/22 bg-emerald-500/[0.08] text-base font-black text-emerald-100 sm:h-16 sm:w-16 sm:text-lg">
              {initials(form.fullName) || "CL"}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <WorkspacePill tone={creating ? "cyan" : "emerald"}>
                  {creating ? "New client" : currentClient?.status || "Client"}
                </WorkspacePill>
                {!creating && currentClient ? (
                  <>
                    <WorkspacePill tone="slate">{currentClient.riskProfile}</WorkspacePill>
                    <WorkspacePill
                      tone={currentClient.assignedAdvisor ? "teal" : "amber"}
                    >
                      {currentClient.assignedAdvisor?.name || "Unassigned"}
                    </WorkspacePill>
                  </>
                ) : null}
              </div>
              <h2 className="mt-3 truncate text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                {creating ? "Create client profile" : currentClient?.fullName}
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                {creating
                  ? "Create the relationship record first, then load portfolio, notes, tasks, risk, documents, and communications only as needed."
                  : `${currentClient?.householdName || currentClient?.clientType || "Client relationship"} · ${currentClient?.email || "No email on file"}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                {dirty ? <span className="text-amber-200">Unsaved changes</span> : null}
                {!creating && currentClient ? (
                  <>
                    <span>Updated {dateTime(currentClient.updatedAt)}</span>
                    <span>Portal {currentClient.portalOnboardingStatus}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {!creating && currentClient ? (
            <div className="flex flex-wrap gap-2">
              <WorkspaceButton
                href={`/workspace/client-emails?clientId=${encodeURIComponent(currentClient.id)}`}
                variant="secondary"
                icon={<Mail className="h-4 w-4" aria-hidden="true" />}
              >
                Email
              </WorkspaceButton>
              <WorkspaceButton
                href={`/workspace/client-portal-inbox?clientId=${encodeURIComponent(currentClient.id)}`}
                variant="secondary"
                icon={<MessageSquareText className="h-4 w-4" aria-hidden="true" />}
              >
                Portal inbox
              </WorkspaceButton>
              <WorkspaceButton
                href={`/workspace/documents?clientId=${encodeURIComponent(currentClient.id)}`}
                variant="secondary"
                icon={<FileText className="h-4 w-4" aria-hidden="true" />}
              >
                Documents
              </WorkspaceButton>
            </div>
          ) : null}
        </div>

        {!creating ? (
          <WorkspaceTabs
            className="mt-5"
            value={activeTab}
            options={tabs}
            onChange={onTabChange}
            label="Client profile sections"
          />
        ) : null}
      </header>

      <div className="p-4 sm:p-5 lg:p-6">
        {error ? <WorkspaceAlert tone="error" className="mb-4">{error}</WorkspaceAlert> : null}
        {success ? <WorkspaceAlert tone="success" className="mb-4">{success}</WorkspaceAlert> : null}

        {(creating || activeTab === "overview") ? (
          <form onSubmit={saveProfile} className="grid gap-4">
            <WorkspaceSurface className="p-4 sm:p-5" as="div">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
                    Identity and relationship
                  </p>
                  <h3 className="mt-1 text-xl font-black text-white">Client overview</h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    Important fields are validated on the server and encrypted where the existing data-vault policy requires it.
                  </p>
                </div>
                <WorkspaceButton
                  type="submit"
                  variant="primary"
                  loading={busy}
                  icon={<Save className="h-4 w-4" aria-hidden="true" />}
                  disabled={!dirty && !creating}
                >
                  {creating ? "Create client" : "Save profile"}
                </WorkspaceButton>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <WorkspaceField label="Full name" required>
                  <WorkspaceInput
                    value={form.fullName}
                    onChange={(event) => update("fullName", event.target.value)}
                    autoComplete="name"
                  />
                </WorkspaceField>
                <WorkspaceField label="Email">
                  <WorkspaceInput
                    type="email"
                    value={form.email}
                    onChange={(event) => update("email", event.target.value)}
                    autoComplete="email"
                  />
                </WorkspaceField>
                <WorkspaceField label="Phone">
                  <WorkspaceInput
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    autoComplete="tel"
                  />
                </WorkspaceField>
                <WorkspaceField label="Household">
                  <WorkspaceInput
                    value={form.householdName}
                    onChange={(event) => update("householdName", event.target.value)}
                  />
                </WorkspaceField>
                <WorkspaceField label="Client type">
                  <WorkspaceSelect
                    value={form.clientType}
                    onChange={(event) => update("clientType", event.target.value)}
                  >
                    {[
                      "Private Client",
                      "Household",
                      "Business Owner",
                      "Institutional",
                      "Prospect",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </WorkspaceSelect>
                </WorkspaceField>
                <WorkspaceField label="Status">
                  <WorkspaceSelect
                    value={form.status}
                    onChange={(event) => update("status", event.target.value)}
                  >
                    {["Active", "Needs Review", "Prospect", "Inactive"].map(
                      (value) => (
                        <option key={value}>{value}</option>
                      ),
                    )}
                  </WorkspaceSelect>
                </WorkspaceField>
              </div>
            </WorkspaceSurface>

            <WorkspaceSurface className="p-4 sm:p-5" as="div">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
                Financial context
              </p>
              <h3 className="mt-1 text-xl font-black text-white">Planning profile</h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <WorkspaceField label="Risk profile">
                  <WorkspaceSelect
                    value={form.riskProfile}
                    onChange={(event) => update("riskProfile", event.target.value)}
                  >
                    {[
                      "Conservative",
                      "Balanced",
                      "Moderate",
                      "Growth",
                      "Aggressive",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </WorkspaceSelect>
                </WorkspaceField>
                <WorkspaceField label="Liquidity needs">
                  <WorkspaceSelect
                    value={form.liquidityNeeds}
                    onChange={(event) => update("liquidityNeeds", event.target.value)}
                  >
                    {["Low", "Moderate", "High", "Immediate"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </WorkspaceSelect>
                </WorkspaceField>
                <WorkspaceField label="Time horizon">
                  <WorkspaceSelect
                    value={form.timeHorizon}
                    onChange={(event) => update("timeHorizon", event.target.value)}
                  >
                    {["0-2 years", "3-5 years", "5-10 years", "10+ years"].map(
                      (value) => (
                        <option key={value}>{value}</option>
                      ),
                    )}
                  </WorkspaceSelect>
                </WorkspaceField>
                <WorkspaceField label="Preferred contact method">
                  <WorkspaceSelect
                    value={form.preferredContactMethod}
                    onChange={(event) =>
                      update("preferredContactMethod", event.target.value)
                    }
                  >
                    {[
                      "Portal + email",
                      "Email",
                      "Phone",
                      "Text",
                      "Portal",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </WorkspaceSelect>
                </WorkspaceField>
                <WorkspaceField label="Portfolio value">
                  <WorkspaceInput
                    value={form.portfolioValue}
                    onChange={(event) => update("portfolioValue", event.target.value)}
                    placeholder="$1,250,000"
                    inputMode="decimal"
                  />
                </WorkspaceField>
                <WorkspaceField label="Primary objective" className="sm:col-span-2 xl:col-span-1">
                  <WorkspaceInput
                    value={form.objective}
                    onChange={(event) => update("objective", event.target.value)}
                  />
                </WorkspaceField>
                <WorkspaceField label="Advisor context" className="sm:col-span-2 xl:col-span-3">
                  <WorkspaceTextarea
                    value={form.notes}
                    onChange={(event) => update("notes", event.target.value)}
                    placeholder="Key facts, preferences, constraints, or relationship context…"
                  />
                </WorkspaceField>
              </div>
            </WorkspaceSurface>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              {creating ? (
                <WorkspaceButton variant="quiet" onClick={onCancelCreate}>
                  Cancel new client
                </WorkspaceButton>
              ) : (
                <WorkspaceButton
                  variant="danger"
                  loading={busy}
                  icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => void removeClient()}
                >
                  Delete client
                </WorkspaceButton>
              )}
              <WorkspaceButton
                type="submit"
                variant="primary"
                loading={busy}
                icon={<Save className="h-4 w-4" aria-hidden="true" />}
                disabled={!dirty && !creating}
              >
                {creating ? "Create client profile" : "Save changes"}
              </WorkspaceButton>
            </div>
          </form>
        ) : null}

        {!creating && currentClient && section ? (
          <WorkspaceSurface as="div">
            <ClientSectionPanel
              clientId={currentClient.id}
              clientName={currentClient.fullName}
              section={section}
              refreshToken={refreshToken}
              prefillHoldingSymbol={prefillHoldingSymbol}
              prefillNoteBody={prefillNoteBody}
              onPrefillConsumed={onPrefillConsumed}
              onChanged={(result: ClientMutationResponse) => {
                if (result.client) onUpdated(result.client);
              }}
            />
          </WorkspaceSurface>
        ) : null}

        {!creating && currentClient && activeTab === "communications" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <WorkspaceSurface className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-400/18 bg-cyan-500/[0.07] text-cyan-200">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Advisor email center</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Draft, review, approve, schedule, and inspect delivery history.
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                  <dt className="font-semibold text-slate-500">Recipient</dt>
                  <dd className="max-w-[65%] truncate font-black text-white">
                    {currentClient.email || "Email required"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                  <dt className="font-semibold text-slate-500">Assigned advisor</dt>
                  <dd className="max-w-[65%] truncate font-black text-white">
                    {currentClient.assignedAdvisor?.name || "Unassigned"}
                  </dd>
                </div>
              </dl>
              {!currentClient.email ? (
                <WorkspaceAlert tone="warning" className="mt-4">
                  Add a valid client email before preparing a deliverable communication.
                </WorkspaceAlert>
              ) : null}
              <WorkspaceButton
                className="mt-5 w-full"
                href={`/workspace/client-emails?clientId=${encodeURIComponent(currentClient.id)}`}
                variant="primary"
              >
                Open Email Center
              </WorkspaceButton>
            </WorkspaceSurface>

            <WorkspaceSurface className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-violet-400/18 bg-violet-500/[0.07] text-violet-200">
                  <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Secure portal conversation</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Review messages, requests, profile updates, and advisor replies.
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                  <dt className="font-semibold text-slate-500">Portal status</dt>
                  <dd className="font-black text-white">
                    {currentClient.portalOnboardingStatus}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                  <dt className="font-semibold text-slate-500">Last login</dt>
                  <dd className="text-right font-black text-white">
                    {dateTime(currentClient.portalLastLoginAt)}
                  </dd>
                </div>
              </dl>
              <WorkspaceButton
                className="mt-5 w-full"
                href={`/workspace/client-portal-inbox?clientId=${encodeURIComponent(currentClient.id)}`}
                variant="secondary"
                tone="violet"
              >
                Open Portal Inbox
              </WorkspaceButton>
            </WorkspaceSurface>
          </div>
        ) : null}

        {!creating && currentClient && activeTab === "activity" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <WorkspaceSurface className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
                    Assignment history
                  </p>
                  <h3 className="mt-1 text-xl font-black text-white">Advisor routing</h3>
                </div>
                <UserRoundCog className="h-5 w-5 text-emerald-300" aria-hidden="true" />
              </div>
              {activityLoading ? (
                <p className="mt-5 text-sm font-semibold text-slate-500">Loading activity…</p>
              ) : activity?.assignmentHistory?.length ? (
                <div className="mt-4 grid gap-3">
                  {activity.assignmentHistory.map((entry) => (
                    <article key={entry.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                      <p className="text-sm font-black text-white">
                        {entry.previousAdvisor?.name || "Unassigned"} → {entry.nextAdvisor?.name || "Advisor"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Changed by {entry.changedBy || "Firm administrator"} · {dateTime(entry.createdAt)}
                      </p>
                      {entry.reason ? (
                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
                          {entry.reason}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <WorkspaceEmptyState
                  compact
                  title="No assignment changes"
                  description="The current advisor assignment has no recorded reassignment history."
                  icon={<History className="h-5 w-5" aria-hidden="true" />}
                />
              )}
            </WorkspaceSurface>

            <WorkspaceSurface className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
                    Client portal activity
                  </p>
                  <h3 className="mt-1 text-xl font-black text-white">Recent routed items</h3>
                </div>
                <MessageSquareText className="h-5 w-5 text-emerald-300" aria-hidden="true" />
              </div>
              {activity?.inbox?.length ? (
                <div className="mt-4 grid gap-3">
                  {activity.inbox.slice(0, 12).map((item) => (
                    <Link
                      key={item.id}
                      href={`/workspace/client-portal-inbox?itemId=${encodeURIComponent(item.id)}`}
                      className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition hover:border-emerald-400/20 hover:bg-emerald-500/[0.045]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-black text-white">
                          {item.title}
                        </p>
                        <WorkspacePill tone={item.priority === "Critical" || item.priority === "High" ? "amber" : "slate"}>
                          {item.status}
                        </WorkspacePill>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        {item.kind} · {dateTime(item.createdAt)}
                        {item.historical ? " · Historical" : ""}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <WorkspaceEmptyState
                  compact
                  title="No portal activity"
                  description="Client messages and profile updates will appear here after secure routing."
                />
              )}
            </WorkspaceSurface>
          </div>
        ) : null}

        {!creating && currentClient && activeTab === "scheduling" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <WorkspaceSurface className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-400/18 bg-emerald-500/[0.07] text-emerald-200">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Assigned advisor</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {currentClient.assignedAdvisor?.name || "No advisor assigned"}
                  </p>
                </div>
              </div>

              {currentClient.assignedAdvisor?.calendlyUrl ? (
                <WorkspaceButton
                  className="mt-5"
                  href={currentClient.assignedAdvisor.calendlyUrl}
                  variant="primary"
                >
                  {currentClient.assignedAdvisor.calendlyLabel || "Schedule a meeting"}
                </WorkspaceButton>
              ) : (
                <WorkspaceAlert tone="warning" className="mt-5">
                  The assigned advisor has not published a scheduling link. The client can still use the secure portal meeting request.
                </WorkspaceAlert>
              )}
            </WorkspaceSurface>

            <WorkspaceSurface className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-400/18 bg-cyan-500/[0.07] text-cyan-200">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Portal and routing controls</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Portal status: {currentClient.portalOnboardingStatus}
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                  <dt className="font-semibold text-slate-500">Portal enabled</dt>
                  <dd className="font-black text-white">{currentClient.portalEnabled ? "Yes" : "No"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                  <dt className="font-semibold text-slate-500">Last client login</dt>
                  <dd className="text-right font-black text-white">{dateTime(currentClient.portalLastLoginAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                  <dt className="font-semibold text-slate-500">Assigned</dt>
                  <dd className="text-right font-black text-white">{dateTime(currentClient.assignedAdvisorAt)}</dd>
                </div>
              </dl>
              <WorkspaceAlert tone="info" className="mt-5">
                Use the advisor-routing dock on this page to assign or reassign the client, create a secure invite, revoke portal access, or update advisor scheduling.
              </WorkspaceAlert>
            </WorkspaceSurface>
          </div>
        ) : null}
      </div>
    </div>
  );
}