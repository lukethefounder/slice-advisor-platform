"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ClientEmail = {
  id: string;
  fullName: string;
  householdName: string | null;
  email: string | null;
  emailMissing: boolean;
  clientType: string;
  riskProfile: string;
  status: string;
  holdings: Array<{
    id: string;
    symbol: string;
    assetName: string;
    assetClass: string;
    value: string | null;
    allocationPct: string | null;
    riskLevel: string;
  }>;
};

type Draft = {
  id: string;
  clientName: string | null;
  channel: string;
  audience: string;
  title: string;
  body: string;
  status: string;
  tone: string;
  createdAt: string;
  updatedAt: string;
  sourceSummary?: {
    topic?: string;
    purpose?: string;
    editable?: boolean;
    manualDraft?: boolean;
    ai?: {
      polished?: boolean;
      provider?: string;
      status?: string;
      error?: string | null;
    };
    aiPolish?: {
      mode?: string;
      provider?: string;
      status?: string;
      error?: string | null;
      polishedAt?: string;
    };
    editHistory?: Array<{
      editedAt: string;
      editedBy: string;
      editType?: string;
    }>;
    holdings?: Array<{
      symbol: string;
      assetName: string;
      assetClass: string;
      value: string | null;
      allocationPct: string | null;
      riskLevel: string;
    }>;
  };
  complianceNotes?: string[];
};

type Approval = {
  id: string;
  title: string;
  actionType: string;
  riskLevel: string;
  summary: string;
  status: string;
  requestedBy: string | null;
  approvedBy: string | null;
  approvalNotes: string | null;
  decidedAt: string | null;
  createdAt: string;
  payload?: {
    draftIds?: string[];
    topic?: string;
    purpose?: string;
    selectedDraftApproval?: boolean;
  };
};

type EmailCenterPayload = {
  clients: ClientEmail[];
  drafts: Draft[];
  archivedDrafts?: Draft[];
  approvals: Approval[];
  metrics: {
    clientCount: number;
    clientsWithEmail: number;
    clientsMissingEmail: number;
    draftCount: number;
    archivedDraftCount?: number;
    pendingApprovalCount: number;
    sentCount?: number;
  };
};

type ClientFilterMode = "with-email" | "all" | "missing-email" | "selected";
type DraftFilterMode =
  | "active"
  | "needs-approval"
  | "draft"
  | "edited"
  | "sent"
  | "failed"
  | "archived"
  | "all";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneFor(value: string): "red" | "green" | "amber" | "purple" | "cyan" | "slate" {
  const lower = value.toLowerCase();

  if (lower.includes("failed") || lower.includes("missing") || lower.includes("high")) return "red";
  if (
    lower.includes("sent") ||
    lower.includes("approved") ||
    lower.includes("delivered") ||
    lower.includes("active") ||
    lower.includes("ready")
  ) {
    return "green";
  }
  if (
    lower.includes("pending") ||
    lower.includes("draft") ||
    lower.includes("approval") ||
    lower.includes("simulated") ||
    lower.includes("edited")
  ) {
    return "amber";
  }
  if (lower.includes("client") || lower.includes("email") || lower.includes("briefing")) return "purple";
  if (lower.includes("ai") || lower.includes("polished") || lower.includes("preview")) return "cyan";

  return "slate";
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "red" | "green" | "amber" | "purple" | "cyan" | "slate";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-zinc-950/84 p-5 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "red" | "green" | "amber" | "purple" | "cyan" | "slate";
}) {
  const glows = {
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
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

function emailParagraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function readingTime(value: string) {
  const words = wordCount(value);
  return Math.max(1, Math.ceil(words / 180));
}

function canEditDraft(draft: Draft | null) {
  if (!draft) return false;
  return draft.status !== "Sent" && draft.status !== "Simulated";
}

function draftStatusOptions(currentStatus: string) {
  if (currentStatus === "Sent" || currentStatus === "Simulated") return [currentStatus];

  return ["Draft", "Edited", "Needs Advisor Approval"];
}

export default function ClientEmailsPage() {
  const [payload, setPayload] = useState<EmailCenterPayload>({
    clients: [],
    drafts: [],
    archivedDrafts: [],
    approvals: [],
    metrics: {
      clientCount: 0,
      clientsWithEmail: 0,
      clientsMissingEmail: 0,
      draftCount: 0,
      archivedDraftCount: 0,
      pendingApprovalCount: 0,
      sentCount: 0,
    },
  });

  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [activeDraftId, setActiveDraftId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [holdingFilter, setHoldingFilter] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [clientFilterMode, setClientFilterMode] = useState<ClientFilterMode>("with-email");
  const [draftFilterMode, setDraftFilterMode] = useState<DraftFilterMode>("active");
  const [previewMode, setPreviewMode] = useState<"email" | "plain">("email");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [aiForm, setAiForm] = useState({
    topic: "",
    purpose: "keep the client informed and reassured",
    tone: "Professional, calm, polished, and reassuring",
    advisorInstructions: "",
    callToAction: "",
    includeAllClients: false,
    queueImmediately: false,
  });

  const [manualForm, setManualForm] = useState({
    subject: "",
    body: "",
    tone: "Professional",
    queueImmediately: false,
  });

  const [editForm, setEditForm] = useState({
    subject: "",
    body: "",
    status: "Edited",
  });

  const [polishForm, setPolishForm] = useState({
    polishMode: "Professional polish",
    advisorInstructions: "",
  });

  const clientsWithEmail = useMemo(
    () => payload.clients.filter((client) => client.email),
    [payload.clients]
  );

  const clientsMissingEmail = useMemo(
    () => payload.clients.filter((client) => !client.email),
    [payload.clients]
  );

  const pendingApprovals = useMemo(
    () => payload.approvals.filter((approval) => approval.status === "Pending"),
    [payload.approvals]
  );

  const allDrafts = useMemo(
    () => [...payload.drafts, ...(payload.archivedDrafts ?? [])],
    [payload.drafts, payload.archivedDrafts]
  );

  const activeDraft = useMemo(
    () => allDrafts.find((draft) => draft.id === activeDraftId) ?? null,
    [allDrafts, activeDraftId]
  );

  const selectedClients = useMemo(
    () => payload.clients.filter((client) => selectedClientIds.includes(client.id)),
    [payload.clients, selectedClientIds]
  );

  const filteredClients = useMemo(() => {
    const search = clientSearch.trim().toLowerCase();
    const holding = holdingFilter.trim().toLowerCase();

    return payload.clients.filter((client) => {
      if (clientFilterMode === "with-email" && !client.email) return false;
      if (clientFilterMode === "missing-email" && client.email) return false;
      if (clientFilterMode === "selected" && !selectedClientIds.includes(client.id)) return false;

      const clientText = [
        client.fullName,
        client.householdName,
        client.email,
        client.clientType,
        client.riskProfile,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const holdingText = client.holdings
        .map((item) => `${item.symbol} ${item.assetName} ${item.assetClass}`)
        .join(" ")
        .toLowerCase();

      if (search && !clientText.includes(search) && !holdingText.includes(search)) return false;
      if (holding && !holdingText.includes(holding)) return false;

      return true;
    });
  }, [payload.clients, clientSearch, holdingFilter, clientFilterMode, selectedClientIds]);

  const filteredDrafts = useMemo(() => {
    const search = draftSearch.trim().toLowerCase();

    return allDrafts.filter((draft) => {
      if (draftFilterMode === "active" && draft.status === "Archived") return false;
      if (draftFilterMode === "archived" && draft.status !== "Archived") return false;
      if (draftFilterMode === "needs-approval" && draft.status !== "Needs Advisor Approval") return false;
      if (draftFilterMode === "draft" && draft.status !== "Draft") return false;
      if (draftFilterMode === "edited" && draft.status !== "Edited") return false;
      if (draftFilterMode === "sent" && draft.status !== "Sent" && draft.status !== "Simulated") return false;
      if (draftFilterMode === "failed" && draft.status !== "Delivery Failed") return false;

      if (!search) return true;

      const text = [
        draft.title,
        draft.body,
        draft.clientName,
        draft.status,
        draft.sourceSummary?.topic,
        draft.sourceSummary?.purpose,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(search);
    });
  }, [allDrafts, draftSearch, draftFilterMode]);

  async function loadEmailCenter(nextActiveDraftId = activeDraftId) {
    const response = await fetch("/api/client-emails", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Unable to load client email center.");
      return;
    }

    setPayload(data);

    const allLoadedDrafts = [...(data.drafts ?? []), ...(data.archivedDrafts ?? [])];
    const nextActive =
      allLoadedDrafts.find((draft: Draft) => draft.id === nextActiveDraftId) ??
      allLoadedDrafts[0] ??
      null;

    if (nextActive) {
      setActiveDraftId(nextActive.id);
      setEditForm({
        subject: nextActive.title,
        body: nextActive.body,
        status:
          nextActive.status === "Sent" || nextActive.status === "Simulated"
            ? nextActive.status
            : nextActive.status === "Needs Advisor Approval"
              ? "Needs Advisor Approval"
              : "Edited",
      });
    }
  }

  function toggleClient(id: string) {
    setSelectedClientIds((current) =>
      current.includes(id)
        ? current.filter((clientId) => clientId !== id)
        : [...current, id]
    );
  }

  function toggleDraft(id: string) {
    setSelectedDraftIds((current) =>
      current.includes(id)
        ? current.filter((draftId) => draftId !== id)
        : [...current, id]
    );
  }

  function selectAllWithEmails() {
    setSelectedClientIds(clientsWithEmail.map((client) => client.id));
  }

  function selectFilteredWithEmails() {
    setSelectedClientIds(
      Array.from(
        new Set([
          ...selectedClientIds,
          ...filteredClients.filter((client) => client.email).map((client) => client.id),
        ])
      )
    );
  }

  function selectByHoldingFilter() {
    const holding = holdingFilter.trim().toLowerCase();

    if (!holding) {
      setMessage("Enter a holding, ticker, or fund keyword first.");
      return;
    }

    const matching = payload.clients.filter((client) => {
      if (!client.email) return false;

      return client.holdings.some((item) =>
        `${item.symbol} ${item.assetName} ${item.assetClass}`.toLowerCase().includes(holding)
      );
    });

    setSelectedClientIds(matching.map((client) => client.id));
    setMessage(`${matching.length} client(s) selected by holding filter.`);
  }

  function invertFilteredSelection() {
    const filteredSelectable = filteredClients.filter((client) => client.email).map((client) => client.id);
    const selected = new Set(selectedClientIds);

    for (const id of filteredSelectable) {
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
    }

    setSelectedClientIds(Array.from(selected));
  }

  function clearSelection() {
    setSelectedClientIds([]);
  }

  function selectAllVisibleDrafts() {
    setSelectedDraftIds(
      Array.from(
        new Set([
          ...selectedDraftIds,
          ...filteredDrafts
            .filter((draft) => draft.status !== "Sent" && draft.status !== "Simulated")
            .map((draft) => draft.id),
        ])
      )
    );
  }

  function clearDraftSelection() {
    setSelectedDraftIds([]);
  }

  function openDraftEditor(draft: Draft) {
    setActiveDraftId(draft.id);
    setEditForm({
      subject: draft.title,
      body: draft.body,
      status:
        draft.status === "Sent" || draft.status === "Simulated"
          ? draft.status
          : draft.status === "Needs Advisor Approval"
            ? "Needs Advisor Approval"
            : "Edited",
    });

    setPolishForm((current) => ({
      ...current,
      advisorInstructions: "",
    }));
  }

  async function createAiDrafts(event: FormEvent) {
    event.preventDefault();

    if (!aiForm.includeAllClients && !selectedClientIds.length) {
      setMessage("Select at least one client or choose all clients.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/client-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "create-ai-client-email-drafts",
        },
        body: JSON.stringify({
          action: "createAiDrafts",
          clientIds: selectedClientIds,
          includeAllClients: aiForm.includeAllClients,
          topic: aiForm.topic,
          purpose: aiForm.purpose,
          tone: aiForm.tone,
          advisorInstructions: aiForm.advisorInstructions,
          callToAction: aiForm.callToAction,
          queueForApproval: aiForm.queueImmediately,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Unable to create AI email drafts.");
        return;
      }

      setMessage(data.message ?? "AI email drafts created.");
      setSelectedDraftIds(data.drafts?.map((draft: { id: string }) => draft.id) ?? []);
      await loadEmailCenter(data.drafts?.[0]?.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create AI email drafts.");
    } finally {
      setLoading(false);
    }
  }

  async function createManualDrafts(event: FormEvent) {
    event.preventDefault();

    if (!selectedClientIds.length) {
      setMessage("Select at least one client.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/client-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "create-manual-client-email-drafts",
        },
        body: JSON.stringify({
          action: "createManualDrafts",
          clientIds: selectedClientIds,
          subject: manualForm.subject,
          body: manualForm.body,
          tone: manualForm.tone,
          queueForApproval: manualForm.queueImmediately,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Unable to create manual email drafts.");
        return;
      }

      setMessage(data.message ?? "Manual email drafts created.");
      setSelectedDraftIds(data.drafts?.map((draft: { id: string }) => draft.id) ?? []);
      await loadEmailCenter(data.drafts?.[0]?.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create manual email drafts.");
    } finally {
      setLoading(false);
    }
  }

  async function saveEditedDraft(event?: FormEvent) {
    event?.preventDefault();

    if (!activeDraft) {
      setMessage("Select a draft to edit first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/client-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "edit-client-email-draft",
        },
        body: JSON.stringify({
          action: "updateDraft",
          draftId: activeDraft.id,
          subject: editForm.subject,
          body: editForm.body,
          status: editForm.status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Unable to save draft.");
        return;
      }

      setMessage(data.message ?? "Draft updated.");
      await loadEmailCenter(activeDraft.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save draft.");
    } finally {
      setLoading(false);
    }
  }

  async function polishActiveDraft(polishMode?: string) {
    if (!activeDraft) {
      setMessage("Select a draft to polish first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/client-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "polish-client-email-draft",
        },
        body: JSON.stringify({
          action: "polishDraft",
          draftId: activeDraft.id,
          polishMode: polishMode ?? polishForm.polishMode,
          advisorInstructions: polishForm.advisorInstructions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Unable to polish draft.");
        return;
      }

      setMessage(data.message ?? "Draft polished.");
      await loadEmailCenter(activeDraft.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to polish draft.");
    } finally {
      setLoading(false);
    }
  }

  async function queueSelectedDrafts() {
    if (!selectedDraftIds.length) {
      setMessage("Select at least one draft to queue for approval.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/client-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "queue-client-email-drafts",
        },
        body: JSON.stringify({
          action: "queueDraftsForApproval",
          draftIds: selectedDraftIds,
          approvalTitle: "Approve selected client email drafts",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Unable to queue selected drafts.");
        return;
      }

      setMessage(data.message ?? "Drafts queued for approval.");
      await loadEmailCenter(activeDraftId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to queue selected drafts.");
    } finally {
      setLoading(false);
    }
  }

  async function archiveSelectedDrafts(restore = false) {
    if (!selectedDraftIds.length) {
      setMessage(`Select at least one draft to ${restore ? "restore" : "archive"}.`);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/client-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": restore ? "restore-client-email-drafts" : "archive-client-email-drafts",
        },
        body: JSON.stringify({
          action: "archiveDrafts",
          draftIds: selectedDraftIds,
          restore,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Unable to update selected drafts.");
        return;
      }

      setMessage(data.message ?? "Drafts updated.");
      setSelectedDraftIds([]);
      await loadEmailCenter(activeDraftId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update selected drafts.");
    } finally {
      setLoading(false);
    }
  }

  async function approveAndSend(approvalId: string) {
    const notes = window.prompt(
      "Approval note for the compliance trail:",
      "Reviewed and approved by advisor for client delivery."
    );

    if (notes === null) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/client-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "approve-client-email-draft",
        },
        body: JSON.stringify({
          action: "approveAndSend",
          approvalId,
          approvalNotes: notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Unable to approve and send emails.");
        return;
      }

      setMessage(
        `Approval processed. Delivered: ${data.delivered}. Simulated: ${data.simulated}. Failed: ${data.failed}.`
      );

      await loadEmailCenter(activeDraftId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to approve and send emails.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEmailCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.38),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.13),_transparent_30%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-5 text-white">
      <div className="mx-auto grid max-w-[1800px] gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Slice Client Email Center
              </div>
              <h1 className="mt-2 text-4xl font-black md:text-6xl">
                Beautiful advisor emails, easier editing, safer sending.
              </h1>
              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400">
                Choose recipients, generate polished AI drafts, edit them manually, polish again with AI, preview the final email, queue for approval, and send from the platform.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href="/workspace" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
                Workspace
              </a>
              <a href="/workspace/client-briefings" className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100">
                Holding Briefings
              </a>
              <a href="/security" className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100">
                Security
              </a>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Metric label="Clients" value={payload.metrics.clientCount} helper="Active records" tone="slate" />
          <Metric label="Email Ready" value={payload.metrics.clientsWithEmail} helper="Can receive emails" tone="green" />
          <Metric label="Missing Email" value={payload.metrics.clientsMissingEmail} helper="Needs cleanup" tone={payload.metrics.clientsMissingEmail ? "red" : "green"} />
          <Metric label="Drafts" value={payload.metrics.draftCount} helper="Editable active drafts" tone="purple" />
          <Metric label="Approvals" value={payload.metrics.pendingApprovalCount} helper="Pending send approval" tone={payload.metrics.pendingApprovalCount ? "amber" : "green"} />
          <Metric label="Sent" value={payload.metrics.sentCount ?? 0} helper="Delivered or simulated" tone="cyan" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                  Recipients
                </div>
                <h2 className="mt-2 text-2xl font-black">Who receives it?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Include or exclude clients instantly. Use the holding filter to target specific stocks or funds.
                </p>
              </div>
              <Pill tone="cyan">{selectedClientIds.length} selected</Pill>
            </div>

            {selectedClients.length ? (
              <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
                  Included Recipients
                </div>
                <div className="mt-2 flex max-h-[94px] flex-wrap gap-1.5 overflow-y-auto pr-1">
                  {selectedClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => toggleClient(client.id)}
                      className="rounded-full bg-black/35 px-3 py-1 text-[11px] font-bold text-cyan-100 ring-1 ring-cyan-400/20 hover:bg-red-500/15 hover:text-red-100"
                      title="Click to remove"
                    >
                      {client.fullName} ×
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2">
              <input
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                placeholder="Search client, household, email, or holding..."
              />

              <input
                value={holdingFilter}
                onChange={(event) => setHoldingFilter(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                placeholder="Filter by holding/ticker, e.g. NVDA, SPY, QQQ..."
              />

              <select
                value={clientFilterMode}
                onChange={(event) => setClientFilterMode(event.target.value as ClientFilterMode)}
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
              >
                <option value="with-email">Clients with email</option>
                <option value="all">All clients</option>
                <option value="missing-email">Missing email</option>
                <option value="selected">Selected only</option>
              </select>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={selectAllWithEmails} className="rounded-2xl bg-white px-4 py-3 text-xs font-black text-slate-950">
                Select All Ready
              </button>
              <button type="button" onClick={selectFilteredWithEmails} className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs font-black text-cyan-100">
                Add Filtered
              </button>
              <button type="button" onClick={selectByHoldingFilter} className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-xs font-black text-purple-100">
                Select Holding
              </button>
              <button type="button" onClick={invertFilteredSelection} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-black text-amber-100">
                Invert Filter
              </button>
              <button type="button" onClick={clearSelection} className="col-span-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white hover:bg-white/10">
                Clear Recipients
              </button>
            </div>

            <div className="mt-4 grid max-h-[760px] gap-3 overflow-y-auto pr-2">
              {filteredClients.map((client) => (
                <label
                  key={client.id}
                  className={cx(
                    "cursor-pointer rounded-[1.4rem] border p-4 transition",
                    selectedClientIds.includes(client.id)
                      ? "border-cyan-400/50 bg-cyan-500/10"
                      : "border-white/10 bg-white/[0.045] hover:bg-white/[0.065]",
                    !client.email && "cursor-not-allowed opacity-70"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedClientIds.includes(client.id)}
                      onChange={() => toggleClient(client.id)}
                      disabled={!client.email}
                      className="mt-1"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="truncate font-black text-white">{client.fullName}</div>
                      <div className="mt-1 truncate text-xs text-slate-400">
                        {client.email || "No email on file"}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <Pill tone={client.email ? "green" : "red"}>
                          {client.email ? "Email Ready" : "Missing Email"}
                        </Pill>
                        <Pill tone="purple">{client.riskProfile}</Pill>
                        <Pill tone="slate">{client.holdings.length} holdings</Pill>
                      </div>

                      {client.holdings.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {client.holdings.slice(0, 8).map((holding) => (
                            <span
                              key={holding.id}
                              className="rounded-full bg-black/35 px-2 py-1 text-[10px] font-black text-slate-300 ring-1 ring-white/10"
                            >
                              {holding.symbol}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </label>
              ))}

              {!filteredClients.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                  No clients match this filter.
                </div>
              ) : null}
            </div>
          </Card>

          <div className="grid gap-6">
            <section className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
              <Card>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                  Draft Creation
                </div>
                <h2 className="mt-2 text-2xl font-black">Create polished drafts</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Create drafts first, edit them, polish them, preview them, then queue for approval.
                </p>

                <form onSubmit={createAiDrafts} className="mt-5 grid gap-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-300">
                      <input
                        type="checkbox"
                        checked={aiForm.includeAllClients}
                        onChange={(event) =>
                          setAiForm((current) => ({ ...current, includeAllClients: event.target.checked }))
                        }
                      />
                      Draft for all email-ready clients
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-300">
                      <input
                        type="checkbox"
                        checked={aiForm.queueImmediately}
                        onChange={(event) =>
                          setAiForm((current) => ({ ...current, queueImmediately: event.target.checked }))
                        }
                      />
                      Queue immediately
                    </label>
                  </div>

                  <input
                    value={aiForm.topic}
                    onChange={(event) => setAiForm((current) => ({ ...current, topic: event.target.value }))}
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                    placeholder="Topic, e.g. Market volatility update, NVDA earnings, review reminder..."
                  />

                  <input
                    value={aiForm.purpose}
                    onChange={(event) => setAiForm((current) => ({ ...current, purpose: event.target.value }))}
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                    placeholder="Purpose of the email..."
                  />

                  <textarea
                    value={aiForm.advisorInstructions}
                    onChange={(event) => setAiForm((current) => ({ ...current, advisorInstructions: event.target.value }))}
                    className="min-h-[105px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                    placeholder="Advisor instructions, talking points, client sensitivity, or details AI should include..."
                  />

                  <textarea
                    value={aiForm.callToAction}
                    onChange={(event) => setAiForm((current) => ({ ...current, callToAction: event.target.value }))}
                    className="min-h-[82px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                    placeholder="Optional call to action..."
                  />

                  <button
                    disabled={loading || !aiForm.topic.trim()}
                    className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
                  >
                    {loading ? "Drafting..." : "Create AI Drafts"}
                  </button>
                </form>

                <div className="my-5 h-px bg-white/10" />

                <form onSubmit={createManualDrafts} className="grid gap-3">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                    Manual Draft
                  </div>

                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={manualForm.queueImmediately}
                      onChange={(event) =>
                        setManualForm((current) => ({ ...current, queueImmediately: event.target.checked }))
                      }
                    />
                    Queue immediately
                  </label>

                  <input
                    value={manualForm.subject}
                    onChange={(event) => setManualForm((current) => ({ ...current, subject: event.target.value }))}
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                    placeholder="Subject"
                  />

                  <textarea
                    value={manualForm.body}
                    onChange={(event) => setManualForm((current) => ({ ...current, body: event.target.value }))}
                    className="min-h-[160px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                    placeholder="Write your email draft..."
                  />

                  <button
                    disabled={loading || !manualForm.subject.trim() || !manualForm.body.trim()}
                    className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                  >
                    Create Manual Draft
                  </button>
                </form>
              </Card>

              <Card>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
                      Edit & Polish
                    </div>
                    <h2 className="mt-2 text-2xl font-black">Draft editor</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Edit directly, save quickly, then use AI polish buttons for grammar, warmth, brevity, or professional tone.
                    </p>
                  </div>
                  {activeDraft ? <Pill tone={toneFor(activeDraft.status)}>{activeDraft.status}</Pill> : null}
                </div>

                {activeDraft ? (
                  <form onSubmit={saveEditedDraft} className="grid gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone="purple">{activeDraft.clientName || "Client"}</Pill>
                        <Pill tone="cyan">{wordCount(editForm.body)} words</Pill>
                        <Pill tone="slate">{readingTime(editForm.body)} min read</Pill>
                        {activeDraft.sourceSummary?.ai?.polished ? <Pill tone="cyan">AI generated</Pill> : null}
                        {activeDraft.sourceSummary?.aiPolish?.mode ? (
                          <Pill tone="green">Polished: {activeDraft.sourceSummary.aiPolish.mode}</Pill>
                        ) : null}
                      </div>
                    </div>

                    <input
                      value={editForm.subject}
                      onChange={(event) => setEditForm((current) => ({ ...current, subject: event.target.value }))}
                      disabled={!canEditDraft(activeDraft)}
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2 disabled:opacity-50"
                      placeholder="Subject"
                    />

                    <textarea
                      value={editForm.body}
                      onChange={(event) => setEditForm((current) => ({ ...current, body: event.target.value }))}
                      disabled={!canEditDraft(activeDraft)}
                      className="min-h-[360px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold leading-7 text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2 disabled:opacity-50"
                      placeholder="Email body"
                    />

                    <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                      <select
                        value={editForm.status}
                        onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                        disabled={!canEditDraft(activeDraft)}
                        className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2 disabled:opacity-50"
                      >
                        {draftStatusOptions(activeDraft.status).map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>

                      <button
                        disabled={loading || !canEditDraft(activeDraft)}
                        className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-950/40 disabled:opacity-50"
                      >
                        Save Draft
                      </button>
                    </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-3">
                      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
                        AI Polish Tools
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        {[
                          "Grammar and formatting cleanup",
                          "Warmer and more reassuring",
                          "More concise",
                          "More professional",
                          "More client-friendly",
                          "Compliance-safe polish",
                        ].map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => polishActiveDraft(mode)}
                            disabled={loading || !canEditDraft(activeDraft)}
                            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50"
                          >
                            {mode}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 grid gap-2">
                        <input
                          value={polishForm.polishMode}
                          onChange={(event) => setPolishForm((current) => ({ ...current, polishMode: event.target.value }))}
                          className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-cyan-500 placeholder:text-slate-600 focus:ring-2"
                          placeholder="Custom polish mode"
                        />
                        <textarea
                          value={polishForm.advisorInstructions}
                          onChange={(event) => setPolishForm((current) => ({ ...current, advisorInstructions: event.target.value }))}
                          className="min-h-[80px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-cyan-500 placeholder:text-slate-600 focus:ring-2"
                          placeholder="Optional polish instructions..."
                        />
                        <button
                          type="button"
                          onClick={() => polishActiveDraft()}
                          disabled={loading || !canEditDraft(activeDraft)}
                          className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-100 disabled:opacity-50"
                        >
                          Run Custom AI Polish
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                    Select a draft to edit.
                  </div>
                )}
              </Card>
            </section>

            <section className="grid gap-6 2xl:grid-cols-[0.82fr_1.18fr]">
              <Card>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                      Approval Queue
                    </div>
                    <h2 className="mt-2 text-2xl font-black">Approve and send</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Queue edited drafts for advisor approval, then send only after approval.
                    </p>
                  </div>
                  <Pill tone="amber">{pendingApprovals.length} pending</Pill>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={queueSelectedDrafts}
                    disabled={loading || !selectedDraftIds.length}
                    className="rounded-2xl bg-white px-4 py-3 text-xs font-black text-slate-950 disabled:opacity-50"
                  >
                    Queue Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => archiveSelectedDrafts(false)}
                    disabled={loading || !selectedDraftIds.length}
                    className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-black text-red-100 disabled:opacity-50"
                  >
                    Archive Selected
                  </button>
                </div>

                <div className="grid max-h-[500px] gap-3 overflow-y-auto pr-2">
                  {pendingApprovals.map((approval) => (
                    <div key={approval.id} className="rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-4">
                      <div className="font-black text-white">{approval.title}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{approval.summary}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill tone={toneFor(approval.status)}>{approval.status}</Pill>
                        <Pill tone={toneFor(approval.riskLevel)}>{approval.riskLevel}</Pill>
                        <Pill tone="cyan">{formatDate(approval.createdAt)}</Pill>
                        <Pill tone="purple">{approval.payload?.draftIds?.length ?? 0} drafts</Pill>
                      </div>

                      <button
                        type="button"
                        onClick={() => approveAndSend(approval.id)}
                        disabled={loading}
                        className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                      >
                        Approve & Send
                      </button>
                    </div>
                  ))}

                  {!pendingApprovals.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                      No pending email approvals.
                    </div>
                  ) : null}
                </div>
              </Card>

              <Card>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                      Final Preview
                    </div>
                    <h2 className="mt-2 text-2xl font-black">See what the client sees</h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("email")}
                      className={cx(
                        "rounded-2xl px-3 py-2 text-xs font-black ring-1",
                        previewMode === "email"
                          ? "bg-white text-slate-950 ring-white"
                          : "bg-white/5 text-white ring-white/10"
                      )}
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("plain")}
                      className={cx(
                        "rounded-2xl px-3 py-2 text-xs font-black ring-1",
                        previewMode === "plain"
                          ? "bg-white text-slate-950 ring-white"
                          : "bg-white/5 text-white ring-white/10"
                      )}
                    >
                      Plain
                    </button>
                  </div>
                </div>

                {activeDraft ? (
                  previewMode === "email" ? (
                    <div className="overflow-hidden rounded-[1.5rem] bg-slate-100 p-4 text-slate-900">
                      <div className="overflow-hidden rounded-[1.3rem] border border-slate-200 bg-white shadow-xl">
                        <div className="bg-gradient-to-br from-red-950 via-red-800 to-slate-950 p-6">
                          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-red-200">
                            Advisor Communication
                          </div>
                          <h3 className="mt-2 text-2xl font-black leading-tight text-white">
                            {editForm.subject || activeDraft.title}
                          </h3>
                          <div className="mt-2 text-sm text-red-100">
                            Prepared for {activeDraft.clientName || "Client"}
                          </div>
                        </div>
                        <div className="max-h-[620px] overflow-y-auto p-6">
                          {emailParagraphs(editForm.body || activeDraft.body).map((paragraph, index) => (
                            <p key={`${paragraph.slice(0, 20)}-${index}`} className="mb-4 text-[15px] leading-7 text-slate-700">
                              {paragraph}
                            </p>
                          ))}

                          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-800">
                              Important note
                            </div>
                            <p className="mt-2 text-sm leading-6 text-amber-900">
                              This message is intended for informational advisor-client communication. It is not a guarantee, trade instruction, or standalone recommendation.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-[700px] overflow-y-auto whitespace-pre-wrap rounded-[1.5rem] border border-white/10 bg-black/35 p-5 text-sm leading-7 text-slate-300">
                      <div className="mb-4 text-lg font-black text-white">{editForm.subject || activeDraft.title}</div>
                      {editForm.body || activeDraft.body}
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                    Select a draft to preview it.
                  </div>
                )}
              </Card>
            </section>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_400px]">
          <Card>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
                  Draft Library
                </div>
                <h2 className="mt-2 text-2xl font-black">Manage every draft</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <Pill tone="cyan">{selectedDraftIds.length} selected</Pill>
                <button
                  type="button"
                  onClick={selectAllVisibleDrafts}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:bg-white/10"
                >
                  Select Visible
                </button>
                <button
                  type="button"
                  onClick={clearDraftSelection}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:bg-white/10"
                >
                  Clear Drafts
                </button>
                {draftFilterMode === "archived" ? (
                  <button
                    type="button"
                    onClick={() => archiveSelectedDrafts(true)}
                    disabled={loading || !selectedDraftIds.length}
                    className="rounded-2xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-black text-green-100 disabled:opacity-50"
                  >
                    Restore Selected
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mb-4 grid gap-2 md:grid-cols-[1fr_220px]">
              <input
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                placeholder="Search drafts by client, subject, topic, or body..."
              />

              <select
                value={draftFilterMode}
                onChange={(event) => setDraftFilterMode(event.target.value as DraftFilterMode)}
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
              >
                <option value="active">Active drafts</option>
                <option value="needs-approval">Needs approval</option>
                <option value="draft">Draft</option>
                <option value="edited">Edited</option>
                <option value="sent">Sent / simulated</option>
                <option value="failed">Delivery failed</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className="grid max-h-[900px] gap-3 overflow-y-auto pr-2">
              {filteredDrafts.map((draft) => (
                <article
                  key={draft.id}
                  className={cx(
                    "rounded-[1.4rem] border p-4 transition",
                    activeDraftId === draft.id
                      ? "border-cyan-400/50 bg-cyan-500/10"
                      : "border-white/10 bg-white/[0.045]"
                  )}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <input
                        type="checkbox"
                        checked={selectedDraftIds.includes(draft.id)}
                        onChange={() => toggleDraft(draft.id)}
                        disabled={draft.status === "Sent" || draft.status === "Simulated"}
                        className="mt-1"
                      />

                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => openDraftEditor(draft)}
                          className="truncate text-left text-lg font-black text-white hover:text-cyan-200"
                        >
                          {draft.title}
                        </button>
                        <div className="mt-1 text-xs font-bold text-slate-500">
                          {draft.clientName || "Client"} · Updated {formatDate(draft.updatedAt || draft.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Pill tone={toneFor(draft.status)}>{draft.status}</Pill>
                      {draft.sourceSummary?.ai?.polished ? <Pill tone="cyan">AI generated</Pill> : null}
                      {draft.sourceSummary?.aiPolish?.mode ? <Pill tone="green">AI polished</Pill> : null}
                    </div>
                  </div>

                  <div className="mt-4 max-h-[150px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-slate-300">
                    {draft.body}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openDraftEditor(draft)}
                      className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-950"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openDraftEditor(draft);
                        setTimeout(() => void polishActiveDraft("Grammar and formatting cleanup"), 50);
                      }}
                      disabled={loading || !canEditDraft(draft)}
                      className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 disabled:opacity-50"
                    >
                      Quick Polish
                    </button>
                  </div>
                </article>
              ))}

              {!filteredDrafts.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                  No drafts match this filter.
                </div>
              ) : null}
            </div>
          </Card>

          <div className="grid content-start gap-6">
            <Card className="border-amber-500/20 bg-amber-500/5">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                Missing Emails
              </div>
              <h2 className="mt-2 text-2xl font-black">Clients not reachable yet</h2>
              <p className="mt-2 text-sm leading-6 text-amber-100/80">
                These clients cannot receive emails until an email address is added to their profile.
              </p>

              <div className="mt-4 grid max-h-[420px] gap-2 overflow-y-auto pr-2">
                {clientsMissingEmail.map((client) => (
                  <div key={client.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="font-black text-white">{client.fullName}</div>
                    <div className="mt-1 text-xs text-amber-100/80">No email on file</div>
                  </div>
                ))}

                {!clientsMissingEmail.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-emerald-200">
                    Every active client has an email on file.
                  </div>
                ) : null}
              </div>
            </Card>

            <Card>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                Edit History
              </div>
              <h2 className="mt-2 text-2xl font-black">Draft trail</h2>

              {activeDraft?.sourceSummary?.editHistory?.length ? (
                <div className="mt-4 grid max-h-[340px] gap-2 overflow-y-auto pr-2">
                  {activeDraft.sourceSummary.editHistory.slice().reverse().map((entry, index) => (
                    <div key={`${entry.editedAt}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                      <div className="text-sm font-black text-white">{entry.editType || "Edit"}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatDate(entry.editedAt)} · {entry.editedBy}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                  No edit history for the selected draft yet.
                </div>
              )}
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}