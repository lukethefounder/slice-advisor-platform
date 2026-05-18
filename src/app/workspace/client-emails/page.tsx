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
    scratchDraft?: boolean;
    clientId?: string | null;
    clientName?: string;
    topic?: string;
    purpose?: string;
    tone?: string;
    editable?: boolean;
    manualDraft?: boolean;
    ai?: {
      polished?: boolean;
      provider?: string;
      status?: string;
      error?: string | null;
      strategy?: string;
    };
    aiPolish?: {
      mode?: string;
      provider?: string;
      status?: string;
      error?: string | null;
      polishedAt?: string;
      strategy?: string;
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

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";

const EMPTY_PAYLOAD: EmailCenterPayload = {
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
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneFor(value: string | null | undefined): Tone {
  const lower = String(value ?? "").toLowerCase();

  if (
    lower.includes("failed") ||
    lower.includes("missing") ||
    lower.includes("high") ||
    lower.includes("error")
  ) {
    return "red";
  }

  if (
    lower.includes("sent") ||
    lower.includes("approved") ||
    lower.includes("delivered") ||
    lower.includes("active") ||
    lower.includes("ready") ||
    lower.includes("complete")
  ) {
    return "green";
  }

  if (
    lower.includes("pending") ||
    lower.includes("draft") ||
    lower.includes("approval") ||
    lower.includes("simulated") ||
    lower.includes("edited") ||
    lower.includes("queued")
  ) {
    return "amber";
  }

  if (
    lower.includes("client") ||
    lower.includes("email") ||
    lower.includes("briefing")
  ) {
    return "purple";
  }

  if (
    lower.includes("ai") ||
    lower.includes("polished") ||
    lower.includes("preview") ||
    lower.includes("scratch")
  ) {
    return "cyan";
  }

  return "slate";
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  const tones: Record<Tone, string> = {
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
  tone?: Tone;
}) {
  const glows: Record<Tone, string> = {
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-4">
      <div
        className={cx(
          "absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent",
          glows[tone]
        )}
      />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">
          {value}
        </div>
        {helper ? (
          <div className="mt-1 truncate text-xs text-slate-500">{helper}</div>
        ) : null}
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
  if (currentStatus === "Sent" || currentStatus === "Simulated") {
    return [currentStatus];
  }

  return ["Draft", "Edited", "Needs Advisor Approval"];
}

function getDraftRecipientLabel(draft: Draft | null) {
  if (!draft) return "No draft selected";
  if (draft.sourceSummary?.scratchDraft) return "Scratch Draft";
  return draft.clientName || draft.sourceSummary?.clientName || "Client Draft";
}

export default function ClientEmailsPage() {
  const [payload, setPayload] = useState<EmailCenterPayload>(EMPTY_PAYLOAD);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [activeDraftId, setActiveDraftId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [holdingFilter, setHoldingFilter] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [clientFilterMode, setClientFilterMode] =
    useState<ClientFilterMode>("with-email");
  const [draftFilterMode, setDraftFilterMode] =
    useState<DraftFilterMode>("active");
  const [previewMode, setPreviewMode] = useState<"email" | "plain">("email");
  const [activePanel, setActivePanel] = useState<
    "ai" | "manual" | "drafts" | "approvals"
  >("ai");
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
    () =>
      payload.clients.filter((client) => selectedClientIds.includes(client.id)),
    [payload.clients, selectedClientIds]
  );

  const selectedDrafts = useMemo(
    () => allDrafts.filter((draft) => selectedDraftIds.includes(draft.id)),
    [allDrafts, selectedDraftIds]
  );

  const filteredClients = useMemo(() => {
    const search = clientSearch.trim().toLowerCase();
    const holding = holdingFilter.trim().toLowerCase();

    return payload.clients.filter((client) => {
      if (clientFilterMode === "with-email" && !client.email) return false;
      if (clientFilterMode === "missing-email" && client.email) return false;
      if (
        clientFilterMode === "selected" &&
        !selectedClientIds.includes(client.id)
      ) {
        return false;
      }

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

      if (search && !clientText.includes(search) && !holdingText.includes(search)) {
        return false;
      }

      if (holding && !holdingText.includes(holding)) {
        return false;
      }

      return true;
    });
  }, [
    payload.clients,
    clientSearch,
    holdingFilter,
    clientFilterMode,
    selectedClientIds,
  ]);

  const filteredDrafts = useMemo(() => {
    const search = draftSearch.trim().toLowerCase();

    return allDrafts.filter((draft) => {
      if (draftFilterMode === "active" && draft.status === "Archived") return false;
      if (draftFilterMode === "archived" && draft.status !== "Archived") return false;
      if (
        draftFilterMode === "needs-approval" &&
        draft.status !== "Needs Advisor Approval"
      ) {
        return false;
      }
      if (draftFilterMode === "draft" && draft.status !== "Draft") return false;
      if (draftFilterMode === "edited" && draft.status !== "Edited") return false;
      if (
        draftFilterMode === "sent" &&
        draft.status !== "Sent" &&
        draft.status !== "Simulated"
      ) {
        return false;
      }
      if (draftFilterMode === "failed" && draft.status !== "Delivery Failed") {
        return false;
      }

      if (!search) return true;

      const text = [
        draft.title,
        draft.body,
        draft.clientName,
        draft.status,
        draft.sourceSummary?.topic,
        draft.sourceSummary?.purpose,
        draft.sourceSummary?.ai?.strategy,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(search);
    });
  }, [allDrafts, draftSearch, draftFilterMode]);

  async function loadEmailCenter(nextActiveDraftId = activeDraftId) {
    try {
      const response = await fetch("/api/client-emails", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Unable to load client email center.");
        return;
      }

      setPayload(data);

      const allLoadedDrafts = [
        ...(data.drafts ?? []),
        ...(data.archivedDrafts ?? []),
      ];

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
      } else {
        setActiveDraftId("");
        setEditForm({
          subject: "",
          body: "",
          status: "Edited",
        });
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load client email center."
      );
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
          ...filteredClients
            .filter((client) => client.email)
            .map((client) => client.id),
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
        `${item.symbol} ${item.assetName} ${item.assetClass}`
          .toLowerCase()
          .includes(holding)
      );
    });

    setSelectedClientIds(matching.map((client) => client.id));
    setMessage(`${matching.length} client(s) selected by holding filter.`);
  }

  function invertFilteredSelection() {
    const filteredSelectable = filteredClients
      .filter((client) => client.email)
      .map((client) => client.id);

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
            .filter(
              (draft) =>
                draft.status !== "Sent" &&
                draft.status !== "Simulated" &&
                draft.status !== "Archived"
            )
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

    setActivePanel("drafts");
  }

  async function createAiDrafts(event: FormEvent) {
    event.preventDefault();

    if (!aiForm.topic.trim()) {
      setMessage("Enter a prompt/topic first. You can create a scratch draft without selecting clients.");
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
          queueForApproval:
            aiForm.queueImmediately &&
            (aiForm.includeAllClients || selectedClientIds.length > 0),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Unable to create AI email drafts.");
        return;
      }

      setMessage(data.message ?? "AI email drafts created.");
      setSelectedDraftIds(data.drafts?.map((draft: { id: string }) => draft.id) ?? []);
      setActivePanel("drafts");
      await loadEmailCenter(data.drafts?.[0]?.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create AI email drafts."
      );
    } finally {
      setLoading(false);
    }
  }

  async function createManualDrafts(event: FormEvent) {
    event.preventDefault();

    if (!manualForm.subject.trim()) {
      setMessage("Subject is required.");
      return;
    }

    if (!manualForm.body.trim()) {
      setMessage("Body is required.");
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
          queueForApproval:
            manualForm.queueImmediately && selectedClientIds.length > 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Unable to create manual email drafts.");
        return;
      }

      setMessage(data.message ?? "Manual email drafts created.");
      setSelectedDraftIds(data.drafts?.map((draft: { id: string }) => draft.id) ?? []);
      setActivePanel("drafts");
      await loadEmailCenter(data.drafts?.[0]?.id);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create manual email drafts."
      );
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

    const scratchCount = selectedDrafts.filter(
      (draft) => draft.sourceSummary?.scratchDraft
    ).length;

    if (scratchCount) {
      setMessage(
        "Scratch drafts are editable working drafts. Assign/adapt them to clients before queueing for sending."
      );
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
      setActivePanel("approvals");
      await loadEmailCenter(activeDraftId);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to queue selected drafts."
      );
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
          "x-slice-sensitive-action": restore
            ? "restore-client-email-drafts"
            : "archive-client-email-drafts",
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
      setMessage(
        error instanceof Error ? error.message : "Unable to update selected drafts."
      );
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
      setMessage(
        error instanceof Error ? error.message : "Unable to approve and send emails."
      );
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
                AI-drafted emails, scratch drafts, bulk workflows, and approval-safe sending.
              </h1>
              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400">
                Create one scratch draft from a prompt, draft many client emails at once,
                edit manually, polish with AI, queue for approval, and send through Resend
                when live email is configured.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Workspace
              </a>
              <a
                href="/workspace/client-briefings"
                className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100"
              >
                Holding Briefings
              </a>
              <a
                href="/security"
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100"
              >
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
          <Metric
            label="Clients"
            value={payload.metrics.clientCount}
            helper="Active records"
            tone="slate"
          />
          <Metric
            label="Email Ready"
            value={payload.metrics.clientsWithEmail}
            helper="Can receive drafts"
            tone="green"
          />
          <Metric
            label="Missing Email"
            value={payload.metrics.clientsMissingEmail}
            helper="Needs cleanup"
            tone={payload.metrics.clientsMissingEmail ? "red" : "green"}
          />
          <Metric
            label="Active Drafts"
            value={payload.metrics.draftCount}
            helper="Working queue"
            tone="cyan"
          />
          <Metric
            label="Approvals"
            value={payload.metrics.pendingApprovalCount}
            helper="Pending send approval"
            tone={payload.metrics.pendingApprovalCount ? "amber" : "green"}
          />
          <Metric
            label="Sent/Simulated"
            value={payload.metrics.sentCount ?? 0}
            helper="Processed emails"
            tone="purple"
          />
        </section>

        <section className="grid gap-3 rounded-[1.75rem] border border-white/10 bg-black/45 p-3 md:grid-cols-4">
          {[
            ["ai", "AI Draft Desk", "Prompt-based and bulk drafts"],
            ["manual", "Manual Drafts", "Scratch or client-specific"],
            ["drafts", "Draft Workspace", "Edit, polish, queue"],
            ["approvals", "Send Queue", "Approve and send"],
          ].map(([key, label, helper]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActivePanel(key as typeof activePanel)}
              className={cx(
                "rounded-2xl px-4 py-3 text-left transition",
                activePanel === key
                  ? "bg-white text-slate-950"
                  : "bg-white/[0.055] text-white hover:bg-white/10"
              )}
            >
              <div className="text-sm font-black">{label}</div>
              <div
                className={cx(
                  "mt-1 text-xs font-semibold",
                  activePanel === key ? "text-slate-600" : "text-slate-500"
                )}
              >
                {helper}
              </div>
            </button>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)_480px]">
          <Card className="min-h-[760px]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                  Recipients
                </div>
                <h2 className="mt-2 text-2xl font-black">Client Selector</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Select clients for bulk drafts. Leave empty to create a scratch draft.
                </p>
              </div>
              <Pill tone="cyan">{selectedClientIds.length} selected</Pill>
            </div>

            <div className="mt-4 grid gap-2">
              <input
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                placeholder="Search clients, emails, holdings..."
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              />

              <input
                value={holdingFilter}
                onChange={(event) => setHoldingFilter(event.target.value)}
                placeholder="Holding filter, e.g. NVDA, ETF, bond..."
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              />

              <select
                value={clientFilterMode}
                onChange={(event) =>
                  setClientFilterMode(event.target.value as ClientFilterMode)
                }
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
              >
                <option value="with-email">With email</option>
                <option value="all">All clients</option>
                <option value="missing-email">Missing email</option>
                <option value="selected">Selected only</option>
              </select>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={selectFilteredWithEmails}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-3 text-xs font-black text-white hover:bg-white/10"
                >
                  Select Filtered
                </button>
                <button
                  type="button"
                  onClick={selectAllWithEmails}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-3 text-xs font-black text-white hover:bg-white/10"
                >
                  Select All Email
                </button>
                <button
                  type="button"
                  onClick={selectByHoldingFilter}
                  className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-xs font-black text-cyan-100 hover:bg-cyan-500/20"
                >
                  Select By Holding
                </button>
                <button
                  type="button"
                  onClick={invertFilteredSelection}
                  className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-3 py-3 text-xs font-black text-purple-100 hover:bg-purple-500/20"
                >
                  Invert Filter
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="col-span-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs font-black text-red-100 hover:bg-red-500/20"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-[460px] space-y-3 overflow-y-auto pr-2">
              {filteredClients.map((client) => {
                const selected = selectedClientIds.includes(client.id);

                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => toggleClient(client.id)}
                    className={cx(
                      "w-full rounded-[1.25rem] border p-4 text-left transition",
                      selected
                        ? "border-cyan-400/50 bg-cyan-500/12"
                        : "border-white/10 bg-white/[0.045] hover:bg-white/[0.075]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-white">
                          {client.fullName}
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {client.email ?? "No email on file"}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <Pill tone={client.email ? "green" : "red"}>
                          {client.email ? "Ready" : "Missing"}
                        </Pill>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill tone={toneFor(client.riskProfile)}>
                        {client.riskProfile}
                      </Pill>
                      <Pill tone="slate">{client.clientType}</Pill>
                      {client.holdings.slice(0, 3).map((holding) => (
                        <Pill key={holding.id} tone="purple">
                          {holding.symbol}
                        </Pill>
                      ))}
                    </div>
                  </button>
                );
              })}

              {!filteredClients.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                  No clients match the current filter.
                </div>
              ) : null}
            </div>

            {selectedClients.length ? (
              <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                  Selected recipients
                </div>
                <div className="mt-2 max-h-28 overflow-y-auto text-sm leading-6 text-cyan-50">
                  {selectedClients.map((client) => client.fullName).join(", ")}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                No clients selected. AI and manual creation will make a scratch draft.
              </div>
            )}
          </Card>

          <div className="grid gap-6">
            {activePanel === "ai" ? (
              <Card>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                      AI Draft Desk
                    </div>
                    <h2 className="mt-2 text-3xl font-black">
                      Create one draft or many at once
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                      Enter a prompt. With no clients selected, Slice creates a scratch draft.
                      With selected clients, it creates tailored drafts for each recipient.
                    </p>
                  </div>
                  <Pill tone="cyan">Scratch + bulk enabled</Pill>
                </div>

                <form onSubmit={createAiDrafts} className="mt-5 grid gap-3">
                  <textarea
                    value={aiForm.topic}
                    onChange={(event) =>
                      setAiForm((current) => ({
                        ...current,
                        topic: event.target.value,
                      }))
                    }
                    placeholder="Prompt/topic: e.g. Draft a reassuring email to clients about recent market volatility and explain that we are monitoring risk carefully..."
                    className="min-h-[140px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  />

                  <div className="grid gap-3 lg:grid-cols-2">
                    <input
                      value={aiForm.purpose}
                      onChange={(event) =>
                        setAiForm((current) => ({
                          ...current,
                          purpose: event.target.value,
                        }))
                      }
                      placeholder="Purpose"
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                    />

                    <input
                      value={aiForm.tone}
                      onChange={(event) =>
                        setAiForm((current) => ({
                          ...current,
                          tone: event.target.value,
                        }))
                      }
                      placeholder="Tone"
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                    />
                  </div>

                  <textarea
                    value={aiForm.advisorInstructions}
                    onChange={(event) =>
                      setAiForm((current) => ({
                        ...current,
                        advisorInstructions: event.target.value,
                      }))
                    }
                    placeholder="Advisor instructions: specific wording, things to avoid, client concerns, compliance reminders..."
                    className="min-h-[90px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  />

                  <textarea
                    value={aiForm.callToAction}
                    onChange={(event) =>
                      setAiForm((current) => ({
                        ...current,
                        callToAction: event.target.value,
                      }))
                    }
                    placeholder="Optional call to action: e.g. Reply with any questions, schedule a review, no action required..."
                    className="min-h-[80px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  />

                  <div className="grid gap-2 lg:grid-cols-2">
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-slate-300">
                      <input
                        type="checkbox"
                        checked={aiForm.includeAllClients}
                        onChange={(event) =>
                          setAiForm((current) => ({
                            ...current,
                            includeAllClients: event.target.checked,
                          }))
                        }
                      />
                      Draft for all clients with emails
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-slate-300">
                      <input
                        type="checkbox"
                        checked={aiForm.queueImmediately}
                        onChange={(event) =>
                          setAiForm((current) => ({
                            ...current,
                            queueImmediately: event.target.checked,
                          }))
                        }
                      />
                      Queue client-specific drafts for approval
                    </label>
                  </div>

                  <button
                    disabled={loading}
                    className="rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
                  >
                    {loading
                      ? "Creating..."
                      : selectedClientIds.length || aiForm.includeAllClients
                        ? "Create AI Drafts"
                        : "Create Scratch AI Draft"}
                  </button>
                </form>
              </Card>
            ) : null}

            {activePanel === "manual" ? (
              <Card>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
                      Manual Drafts
                    </div>
                    <h2 className="mt-2 text-3xl font-black">
                      Create editable emails manually
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                      With no selected clients, this creates a scratch draft. With selected clients,
                      it creates one draft per selected recipient.
                    </p>
                  </div>
                  <Pill tone="purple">Scratch + bulk enabled</Pill>
                </div>

                <form onSubmit={createManualDrafts} className="mt-5 grid gap-3">
                  <input
                    value={manualForm.subject}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        subject: event.target.value,
                      }))
                    }
                    placeholder="Subject"
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  />

                  <textarea
                    value={manualForm.body}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    placeholder="Email body..."
                    className="min-h-[220px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  />

                  <div className="grid gap-2 lg:grid-cols-2">
                    <input
                      value={manualForm.tone}
                      onChange={(event) =>
                        setManualForm((current) => ({
                          ...current,
                          tone: event.target.value,
                        }))
                      }
                      placeholder="Tone"
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                    />

                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-slate-300">
                      <input
                        type="checkbox"
                        checked={manualForm.queueImmediately}
                        onChange={(event) =>
                          setManualForm((current) => ({
                            ...current,
                            queueImmediately: event.target.checked,
                          }))
                        }
                      />
                      Queue client-specific drafts for approval
                    </label>
                  </div>

                  <button
                    disabled={loading}
                    className="rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
                  >
                    {loading
                      ? "Creating..."
                      : selectedClientIds.length
                        ? "Create Manual Drafts"
                        : "Create Scratch Manual Draft"}
                  </button>
                </form>
              </Card>
            ) : null}

            {activePanel === "drafts" ? (
              <Card>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                      Draft Workspace
                    </div>
                    <h2 className="mt-2 text-3xl font-black">
                      Edit, polish, select, and queue
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                      Work on many emails at once. Pick drafts on the left list, edit the active draft,
                      polish with AI, then queue selected client-specific drafts for approval.
                    </p>
                  </div>
                  <Pill tone="amber">{selectedDraftIds.length} selected</Pill>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="grid gap-3">
                    <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
                      <input
                        value={draftSearch}
                        onChange={(event) => setDraftSearch(event.target.value)}
                        placeholder="Search drafts..."
                        className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                      />

                      <select
                        value={draftFilterMode}
                        onChange={(event) =>
                          setDraftFilterMode(event.target.value as DraftFilterMode)
                        }
                        className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                      >
                        <option value="active">Active</option>
                        <option value="all">All</option>
                        <option value="draft">Draft</option>
                        <option value="edited">Edited</option>
                        <option value="needs-approval">Needs approval</option>
                        <option value="sent">Sent/simulated</option>
                        <option value="failed">Failed</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={selectAllVisibleDrafts}
                        className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-3 text-xs font-black text-white hover:bg-white/10"
                      >
                        Select Visible
                      </button>
                      <button
                        type="button"
                        onClick={clearDraftSelection}
                        className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-3 text-xs font-black text-white hover:bg-white/10"
                      >
                        Clear Drafts
                      </button>
                      <button
                        type="button"
                        onClick={queueSelectedDrafts}
                        className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs font-black text-amber-100 hover:bg-amber-500/20"
                      >
                        Queue Selected
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveSelectedDrafts(draftFilterMode === "archived")}
                        className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs font-black text-red-100 hover:bg-red-500/20"
                      >
                        {draftFilterMode === "archived" ? "Restore Selected" : "Archive Selected"}
                      </button>
                    </div>

                    <div className="max-h-[560px] space-y-3 overflow-y-auto pr-2">
                      {filteredDrafts.map((draft) => {
                        const selected = selectedDraftIds.includes(draft.id);
                        const active = activeDraftId === draft.id;

                        return (
                          <div
                            key={draft.id}
                            className={cx(
                              "rounded-[1.25rem] border p-4",
                              active
                                ? "border-cyan-400/50 bg-cyan-500/10"
                                : "border-white/10 bg-white/[0.045]"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleDraft(draft.id)}
                                className="mt-1"
                              />

                              <button
                                type="button"
                                onClick={() => openDraftEditor(draft)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <div className="truncate text-sm font-black text-white">
                                  {draft.title}
                                </div>
                                <div className="mt-1 truncate text-xs text-slate-500">
                                  {getDraftRecipientLabel(draft)} · {formatDate(draft.updatedAt)}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Pill tone={toneFor(draft.status)}>
                                    {draft.status}
                                  </Pill>
                                  <Pill
                                    tone={
                                      draft.sourceSummary?.scratchDraft
                                        ? "cyan"
                                        : "purple"
                                    }
                                  >
                                    {draft.sourceSummary?.scratchDraft
                                      ? "Scratch"
                                      : "Client"}
                                  </Pill>
                                  {draft.sourceSummary?.ai?.polished ? (
                                    <Pill tone="cyan">AI Drafted</Pill>
                                  ) : null}
                                </div>
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {!filteredDrafts.length ? (
                        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                          No drafts match the current filter.
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    {activeDraft ? (
                      <form onSubmit={saveEditedDraft} className="grid gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                              Active Draft
                            </div>
                            <h3 className="mt-1 text-xl font-black">
                              {getDraftRecipientLabel(activeDraft)}
                            </h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Pill tone={toneFor(activeDraft.status)}>
                              {activeDraft.status}
                            </Pill>
                            <Pill
                              tone={
                                activeDraft.sourceSummary?.scratchDraft
                                  ? "cyan"
                                  : "purple"
                              }
                            >
                              {activeDraft.sourceSummary?.scratchDraft
                                ? "Scratch"
                                : "Client-specific"}
                            </Pill>
                          </div>
                        </div>

                        <input
                          value={editForm.subject}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              subject: event.target.value,
                            }))
                          }
                          disabled={!canEditDraft(activeDraft)}
                          className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 disabled:opacity-60 focus:ring-2"
                          placeholder="Subject"
                        />

                        <textarea
                          value={editForm.body}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              body: event.target.value,
                            }))
                          }
                          disabled={!canEditDraft(activeDraft)}
                          className="min-h-[300px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold leading-7 text-white outline-none ring-red-500 placeholder:text-slate-600 disabled:opacity-60 focus:ring-2"
                          placeholder="Body"
                        />

                        <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto]">
                          <select
                            value={editForm.status}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                status: event.target.value,
                              }))
                            }
                            disabled={!canEditDraft(activeDraft)}
                            className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 disabled:opacity-60 focus:ring-2"
                          >
                            {draftStatusOptions(activeDraft.status).map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>

                          <button
                            type="submit"
                            disabled={loading || !canEditDraft(activeDraft)}
                            className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
                          >
                            Save Draft
                          </button>

                          <button
                            type="button"
                            onClick={() => setPreviewMode((current) => current === "email" ? "plain" : "email")}
                            className="rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3 text-sm font-black text-white hover:bg-white/10"
                          >
                            {previewMode === "email" ? "Plain Preview" : "Email Preview"}
                          </button>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                            AI Polish
                          </div>

                          <div className="mt-3 grid gap-2">
                            <select
                              value={polishForm.polishMode}
                              onChange={(event) =>
                                setPolishForm((current) => ({
                                  ...current,
                                  polishMode: event.target.value,
                                }))
                              }
                              className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                            >
                              <option>Professional polish</option>
                              <option>More reassuring</option>
                              <option>Shorter and cleaner</option>
                              <option>More premium advisor tone</option>
                              <option>Compliance-safe rewrite</option>
                              <option>Warmer client tone</option>
                            </select>

                            <textarea
                              value={polishForm.advisorInstructions}
                              onChange={(event) =>
                                setPolishForm((current) => ({
                                  ...current,
                                  advisorInstructions: event.target.value,
                                }))
                              }
                              placeholder="Optional polish instructions..."
                              className="min-h-[80px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                            />

                            <div className="grid gap-2 md:grid-cols-3">
                              <button
                                type="button"
                                onClick={() => polishActiveDraft()}
                                disabled={loading || !canEditDraft(activeDraft)}
                                className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs font-black text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
                              >
                                Polish
                              </button>
                              <button
                                type="button"
                                onClick={() => polishActiveDraft("Shorter and cleaner")}
                                disabled={loading || !canEditDraft(activeDraft)}
                                className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50"
                              >
                                Shorten
                              </button>
                              <button
                                type="button"
                                onClick={() => polishActiveDraft("Compliance-safe rewrite")}
                                disabled={loading || !canEditDraft(activeDraft)}
                                className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-black text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
                              >
                                Compliance Safe
                              </button>
                            </div>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                        Select or create a draft to start editing.
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ) : null}

            {activePanel === "approvals" ? (
              <Card>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-green-400">
                      Send Queue
                    </div>
                    <h2 className="mt-2 text-3xl font-black">
                      Approval-gated email sending
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                      Approve pending email batches here. Live sending uses Resend when configured;
                      otherwise sends are safely simulated.
                    </p>
                  </div>
                  <Pill tone={pendingApprovals.length ? "amber" : "green"}>
                    {pendingApprovals.length} pending
                  </Pill>
                </div>

                <div className="mt-5 grid gap-3">
                  {payload.approvals.map((approval) => {
                    const ids = approval.payload?.draftIds ?? [];

                    return (
                      <div
                        key={approval.id}
                        className="rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="font-black text-white">
                              {approval.title}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatDate(approval.createdAt)} · {ids.length} draft(s)
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-400">
                              {approval.summary}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <Pill tone={toneFor(approval.status)}>
                              {approval.status}
                            </Pill>
                            <Pill tone={toneFor(approval.riskLevel)}>
                              {approval.riskLevel}
                            </Pill>
                          </div>
                        </div>

                        {approval.status === "Pending" ? (
                          <button
                            type="button"
                            onClick={() => approveAndSend(approval.id)}
                            disabled={loading}
                            className="mt-4 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                          >
                            Approve and Send
                          </button>
                        ) : null}
                      </div>
                    );
                  })}

                  {!payload.approvals.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                      No approval items yet.
                    </div>
                  ) : null}
                </div>
              </Card>
            ) : null}
          </div>

          <Card className="min-h-[760px]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                  Preview
                </div>
                <h2 className="mt-2 text-2xl font-black">
                  {activeDraft ? activeDraft.title : "No draft selected"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {activeDraft
                    ? `${getDraftRecipientLabel(activeDraft)} · ${wordCount(activeDraft.body)} words · ${readingTime(activeDraft.body)} min read`
                    : "Create or select a draft to preview it here."}
                </p>
              </div>

              {activeDraft ? (
                <div className="flex flex-wrap gap-2">
                  <Pill tone={toneFor(activeDraft.status)}>{activeDraft.status}</Pill>
                  <Pill
                    tone={
                      activeDraft.sourceSummary?.scratchDraft ? "cyan" : "purple"
                    }
                  >
                    {activeDraft.sourceSummary?.scratchDraft ? "Scratch" : "Client"}
                  </Pill>
                </div>
              ) : null}
            </div>

            {activeDraft ? (
              <div className="mt-5 grid gap-4">
                {activeDraft.sourceSummary?.ai?.strategy ? (
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                      AI Draft Strategy
                    </div>
                    <p className="mt-2 text-sm leading-6 text-cyan-50">
                      {activeDraft.sourceSummary.ai.strategy}
                    </p>
                  </div>
                ) : null}

                {previewMode === "email" ? (
                  <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-100 text-slate-950">
                    <div className="bg-gradient-to-br from-red-950 via-red-800 to-slate-950 p-6">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-red-200">
                        Advisor Communication
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-white">
                        {activeDraft.title}
                      </h3>
                      <div className="mt-2 text-sm font-semibold text-red-100">
                        Prepared for {getDraftRecipientLabel(activeDraft)}
                      </div>
                    </div>

                    <div className="space-y-4 p-6">
                      {emailParagraphs(activeDraft.body).map((paragraph, index) => (
                        <p key={`${paragraph}-${index}`} className="text-sm leading-7 text-slate-700">
                          {paragraph}
                        </p>
                      ))}

                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                          Important note
                        </div>
                        <p className="mt-2 text-xs leading-6 text-amber-800">
                          This message is intended for informational advisor-client communication.
                          It is not a guarantee, trade instruction, or standalone recommendation.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.6rem] border border-white/10 bg-black/45 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Subject
                    </div>
                    <div className="mt-2 text-lg font-black text-white">
                      {activeDraft.title}
                    </div>

                    <div className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Body
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                      {activeDraft.body}
                    </div>
                  </div>
                )}

                {activeDraft.complianceNotes?.length ? (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                      Compliance Notes
                    </div>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-50">
                      {activeDraft.complianceNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {activeDraft.sourceSummary?.holdings?.length ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-300">
                      Context Used
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeDraft.sourceSummary.holdings.slice(0, 10).map((holding) => (
                        <Pill key={`${holding.symbol}-${holding.assetName}`} tone="purple">
                          {holding.symbol}
                        </Pill>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm font-bold text-slate-500">
                The preview will appear after a draft is created or selected.
              </div>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}