"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  CLIENT_PORTAL_SESSION_KEY,
  ClientPortalConversationThread,
  ClientPortalDocument,
  ClientPortalDocumentPacket,
  ClientPortalEvent,
  ClientPortalEventType,
  ClientPortalProfile,
  ClientPortalRiskSurvey,
  ClientPortalUrgency,
  DEFAULT_CLIENT_PROFILE,
  INVESTMENT_OPTIONS,
  RISK_SURVEY_OPTIONS,
  addClientPortalEvent,
  addClientPortalMessage,
  addClientPortalThread,
  allocationByCategory,
  allocationTotal,
  clearClientPortalSession,
  createMessage,
  createPortalEvent,
  createThread,
  formatDocumentSize,
  formatPortalDate,
  loadClientPortalDocumentPackets,
  loadClientPortalEvents,
  loadClientPortalProfile,
  loadClientPortalSession,
  loadClientPortalThreads,
  normalizeAllocation,
  removeClientPortalDocumentPacket,
  revokeAdvisorDocumentAccess,
  saveClientPortalProfile,
  signClientPortalDocumentPacket,
} from "@/lib/client-portal-demo-store";

type PortalTab =
  | "dashboard"
  | "conversations"
  | "requests"
  | "documents"
  | "allocation"
  | "permissions"
  | "risk"
  | "access";

type RequestForm = {
  type: ClientPortalEventType;
  title: string;
  message: string;
  urgency: ClientPortalUrgency;
  symbol: string;
  action: string;
  estimatedAmount: string;
  targetAllocation: string;
  meetingWindow: string;
};

type PermissionRow = {
  symbol: string;
  allowed: boolean;
  maxPercent: string;
  maxDollar: string;
  note: string;
};

const chartColors = [
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
  "#22c55e",
  "#f59e0b",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
  "#a855f7",
  "#84cc16",
];

const defaultRequest: RequestForm = {
  type: "Meeting Request",
  title: "",
  message: "",
  urgency: "Normal",
  symbol: "",
  action: "Discuss",
  estimatedAmount: "",
  targetAllocation: "",
  meetingWindow: "This week",
};

const defaultPermissions: PermissionRow[] = [
  {
    symbol: "SPY",
    allowed: true,
    maxPercent: "20",
    maxDollar: "50000",
    note: "Broad market ETF discussion allowed.",
  },
  {
    symbol: "QQQ",
    allowed: true,
    maxPercent: "12",
    maxDollar: "30000",
    note: "Growth exposure review only.",
  },
  {
    symbol: "NVDA",
    allowed: false,
    maxPercent: "5",
    maxDollar: "10000",
    note: "Client wants advisor approval before concentration discussion.",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneForStatus(status: string) {
  const lower = status.toLowerCase();

  if (lower.includes("new")) {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
  }

  if (lower.includes("review") || lower.includes("waiting")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }

  if (
    lower.includes("approved") ||
    lower.includes("scheduled") ||
    lower.includes("completed") ||
    lower.includes("returned")
  ) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }

  if (
    lower.includes("declined") ||
    lower.includes("revoked") ||
    lower.includes("removed")
  ) {
    return "border-red-500/30 bg-red-500/10 text-red-100";
  }

  return "border-white/10 bg-white/[0.055] text-slate-100";
}

function Pill({
  children,
  tone = "red",
}: {
  children: React.ReactNode;
  tone?: "red" | "green" | "amber" | "cyan" | "purple" | "blue" | "slate";
}) {
  const tones = {
    red: "border-red-500/30 bg-red-500/10 text-red-200",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-200",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-200",
    slate: "border-white/10 bg-white/[0.055] text-slate-200",
  };

  return (
    <span
      className={cx(
        "inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
        tones[tone],
      )}
    >
      {children}
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
        "rounded-[1.75rem] border border-white/10 bg-zinc-950/82 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
      {children}
    </span>
  );
}

export default function ClientPortalPage() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [session, setSession] = useState<ReturnType<typeof loadClientPortalSession>>(null);
  const [profile, setProfile] = useState<ClientPortalProfile>(DEFAULT_CLIENT_PROFILE);
  const [events, setEvents] = useState<ClientPortalEvent[]>([]);
  const [threads, setThreads] = useState<ClientPortalConversationThread[]>([]);
  const [documentPackets, setDocumentPackets] = useState<ClientPortalDocumentPacket[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [tab, setTab] = useState<PortalTab>("dashboard");
  const [request, setRequest] = useState<RequestForm>(defaultRequest);
  const [permissions, setPermissions] = useState<PermissionRow[]>(defaultPermissions);
  const [documents, setDocuments] = useState<ClientPortalDocument[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [newThreadSubject, setNewThreadSubject] = useState("");
  const [newThreadMessage, setNewThreadMessage] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedInvestmentId, setSelectedInvestmentId] = useState("us-large-cap");

  useEffect(() => {
    const activeSession = loadClientPortalSession();
    const activeProfile = loadClientPortalProfile();
    const loadedThreads = loadClientPortalThreads();
    const params = new URLSearchParams(window.location.search);

    setSession(activeSession);
    setProfile(activeProfile);
    setEvents(loadClientPortalEvents());
    setThreads(loadedThreads);
    setDocumentPackets(loadClientPortalDocumentPackets());
    setActiveThreadId(loadedThreads[0]?.id ?? "");

    if (params.get("onboarding") === "risk" || !activeSession?.riskSurveyComplete) {
      setTab("risk");
    }

    setHasHydrated(true);
  }, []);

  const clientEvents = useMemo(() => {
    if (!session) return [];
    return events.filter((event) => event.clientId === session.clientId);
  }, [events, session]);

  const clientThreads = useMemo(() => {
    if (!session) return [];

    return threads
      .filter((thread) => thread.clientId === session.clientId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [threads, session]);

  const activeThread =
    clientThreads.find((thread) => thread.id === activeThreadId) ?? clientThreads[0];

  const clientDocumentPackets = useMemo(() => {
    if (!session) return [];

    return documentPackets
      .filter((packet) => packet.clientId === session.clientId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [documentPackets, session]);

  const allocationTotalValue = allocationTotal(profile.allocation);
  const categoryAllocation = allocationByCategory(profile.allocation);

  const newCount = clientEvents.filter((event) => event.status === "New").length;
  const reviewCount = clientEvents.filter((event) => event.status === "Advisor Review").length;
  const openThreads = clientThreads.filter(
    (thread) => thread.status !== "Closed" && thread.status !== "Archived",
  ).length;
  const pendingDocs = clientDocumentPackets.filter(
    (packet) => packet.status === "Sent" || packet.status === "Viewed",
  ).length;

  function persistProfile(nextProfile: ClientPortalProfile) {
    setProfile(nextProfile);
    saveClientPortalProfile(nextProfile);
  }

  function refresh() {
    setEvents(loadClientPortalEvents());
    setThreads(loadClientPortalThreads());
    setDocumentPackets(loadClientPortalDocumentPackets());
  }

  function submitPortalEvent(event: ClientPortalEvent) {
    addClientPortalEvent(event);
    refresh();
    setSuccess("Submitted to your advisor for review.");
  }

  function sessionEventBase() {
    if (!session) return null;

    return {
      clientId: session.clientId,
      clientName: session.clientName,
      clientEmail: session.clientEmail,
      advisorId: session.advisorId,
      advisorName: session.advisorName,
      firmId: session.firmId,
      firmName: session.firmName,
    };
  }

  function submitRequest(event: FormEvent) {
    event.preventDefault();

    const base = sessionEventBase();
    if (!base) return;

    if (!request.title.trim() || !request.message.trim()) {
      setSuccess("Add a title and message before submitting.");
      return;
    }

    submitPortalEvent(
      createPortalEvent({
        ...base,
        type: request.type,
        title: request.title,
        message: request.message,
        urgency: request.urgency,
        payload: {
          symbol: request.symbol,
          action: request.action,
          estimatedAmount: request.estimatedAmount,
          targetAllocation: request.targetAllocation,
          meetingWindow: request.meetingWindow,
          reviewOnly:
            "Client request only. Advisor must review before any recommendation or trade execution.",
        },
      }),
    );

    const thread = createThread({
      ...base,
      subject: request.title,
      firstMessage: request.message,
      senderRole: "Client",
      senderName: profile.clientName,
      category:
        request.type === "Meeting Request"
          ? "Meeting"
          : request.type.includes("Request")
            ? "Trade Discussion"
            : "General",
      priority: request.urgency,
      status: "Waiting on Advisor",
    });

    addClientPortalThread(thread);
    setRequest(defaultRequest);
    refresh();
  }

  function submitRiskSurvey() {
    const base = sessionEventBase();
    if (!base || !session) return;

    const nextProfile = {
      ...profile,
      onboardingStep: "Portal Ready" as const,
      updatedAt: new Date().toISOString(),
    };

    const nextSession = {
      ...session,
      riskSurveyComplete: true,
    };

    persistProfile(nextProfile);
    window.localStorage.setItem(CLIENT_PORTAL_SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);

    submitPortalEvent(
      createPortalEvent({
        ...base,
        type: "Risk Tolerance Update",
        title: "Client updated risk tolerance and investment preferences",
        message: "Client submitted an updated dropdown-based investing survey for advisor review.",
        urgency: "High",
        payload: nextProfile.riskSurvey,
      }),
    );
  }

  function updateRisk<K extends keyof ClientPortalRiskSurvey>(
    key: K,
    value: ClientPortalRiskSurvey[K],
  ) {
    persistProfile({
      ...profile,
      riskSurvey: {
        ...profile.riskSurvey,
        [key]: value,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  function addInvestmentType() {
    const option = INVESTMENT_OPTIONS.find((item) => item.id === selectedInvestmentId);
    if (!option) return;

    if (profile.allocation.some((item) => item.id === option.id)) {
      setSuccess("That investment type is already in the allocation chart.");
      return;
    }

    persistProfile({
      ...profile,
      allocation: [
        ...profile.allocation,
        {
          id: option.id,
          label: option.label,
          category: option.category,
          percent: 5,
        },
      ],
    });
  }

  function updateAllocation(id: string, percent: number) {
    persistProfile({
      ...profile,
      allocation: profile.allocation.map((item) =>
        item.id === id
          ? {
              ...item,
              percent: Math.max(0, Math.min(100, Number(percent) || 0)),
            }
          : item,
      ),
    });
  }

  function removeAllocation(id: string) {
    persistProfile({
      ...profile,
      allocation: profile.allocation.filter((item) => item.id !== id),
    });
  }

  function normalizeClientAllocation() {
    persistProfile({
      ...profile,
      allocation: normalizeAllocation(profile.allocation),
    });
  }

  function submitAllocationPreference() {
    const base = sessionEventBase();
    if (!base) return;

    submitPortalEvent(
      createPortalEvent({
        ...base,
        type: "Portfolio Preference Update",
        title: "Client submitted preferred allocation pie chart",
        message:
          "Client created or updated the preferred investment-type allocation for advisor discussion.",
        urgency: allocationTotalValue === 100 ? "Normal" : "High",
        payload: {
          allocation: profile.allocation,
          categoryAllocation,
          total: allocationTotalValue,
          reviewOnly:
            "Client preference only. Advisor must review before recommendation or implementation.",
        },
      }),
    );
  }

  function submitPermissions() {
    const base = sessionEventBase();
    if (!base) return;

    submitPortalEvent(
      createPortalEvent({
        ...base,
        type: "Holdings Permission",
        title: "Client updated holding and allocation permissions",
        message:
          "Client updated the stock/ETF discussion permissions and holding limits they are comfortable discussing with the advisor.",
        urgency: "Normal",
        payload: {
          permissions,
          reviewOnly:
            "Permissions are client preferences and do not authorize automatic trading.",
        },
      }),
    );
  }

  function submitDocuments() {
    const base = sessionEventBase();
    if (!base) return;

    if (!documents.length) {
      setSuccess("Choose at least one document first.");
      return;
    }

    submitPortalEvent(
      createPortalEvent({
        ...base,
        type: "Document Upload",
        title: `${documents.length} document(s) submitted`,
        message:
          "Client submitted document metadata for advisor review. Production should wire this to secure file storage.",
        urgency: "Normal",
        documents,
        payload: {
          documentCount: documents.length,
          storageNote:
            "Demo stores metadata only. Production should use encrypted secure storage.",
        },
      }),
    );

    setDocuments([]);
  }

  function createNewThread(event: FormEvent) {
    event.preventDefault();

    const base = sessionEventBase();
    if (!base) return;

    if (!newThreadSubject.trim() || !newThreadMessage.trim()) {
      setSuccess("Add a conversation subject and message.");
      return;
    }

    const thread = createThread({
      ...base,
      subject: newThreadSubject,
      firstMessage: newThreadMessage,
      senderRole: "Client",
      senderName: profile.clientName,
      category: "General",
      priority: "Normal",
      status: "Waiting on Advisor",
    });

    addClientPortalThread(thread);
    addClientPortalEvent(
      createPortalEvent({
        ...base,
        type: "Secure Message",
        title: newThreadSubject,
        message: newThreadMessage,
        urgency: "Normal",
        payload: {
          threadId: thread.id,
        },
      }),
    );

    setNewThreadSubject("");
    setNewThreadMessage("");
    setActiveThreadId(thread.id);
    refresh();
    setSuccess("Conversation sent to your advisor.");
  }

  function replyToThread(event: FormEvent) {
    event.preventDefault();

    if (!activeThread || !messageDraft.trim()) {
      setSuccess("Type a message first.");
      return;
    }

    addClientPortalMessage(
      activeThread.id,
      createMessage(activeThread.id, {
        senderRole: "Client",
        senderName: profile.clientName,
        senderEmail: profile.clientEmail,
        body: messageDraft,
      }),
    );

    setMessageDraft("");
    refresh();
  }

  function signPacket(packet: ClientPortalDocumentPacket) {
    const name = signatureName.trim() || profile.clientName;
    signClientPortalDocumentPacket(packet.id, name, profile.clientName);

    const base = sessionEventBase();
    if (base) {
      addClientPortalEvent(
        createPortalEvent({
          ...base,
          type: "Document Signed",
          title: `${packet.title} signed and returned`,
          message:
            "Client signed and returned the advisor-sent document packet through the portal demo workflow.",
          urgency: "High",
          documents: packet.files,
          payload: {
            packetId: packet.id,
            signatureName: name,
            demoSignatureOnly: true,
          },
        }),
      );
    }

    setSignatureName("");
    refresh();
    setSuccess("Document signed and returned to your advisor.");
  }

  function removePacket(packet: ClientPortalDocumentPacket) {
    removeClientPortalDocumentPacket(packet.id, profile.clientName);

    const base = sessionEventBase();
    if (base) {
      addClientPortalEvent(
        createPortalEvent({
          ...base,
          type: "Document Removed",
          title: `${packet.title} removed by client`,
          message: "Client removed this document packet from their portal access view.",
          urgency: "Normal",
          payload: {
            packetId: packet.id,
          },
        }),
      );
    }

    refresh();
  }

  function revokePacketAccess(packet: ClientPortalDocumentPacket) {
    revokeAdvisorDocumentAccess(packet.id, profile.clientName);

    const base = sessionEventBase();
    if (base) {
      addClientPortalEvent(
        createPortalEvent({
          ...base,
          type: "Advisor Access Revoked",
          title: `Advisor access revoked for ${packet.title}`,
          message:
            "Client revoked advisor access to a specific document packet in the portal demo workflow.",
          urgency: "High",
          payload: {
            packetId: packet.id,
          },
        }),
      );
    }

    refresh();
  }

  function revokeAdvisorAccess() {
    const nextProfile = {
      ...profile,
      advisorAccessStatus: "Revoked" as const,
      advisorAccessNote:
        "Client revoked advisor access from the portal. Advisor should contact client before further portal use.",
      updatedAt: new Date().toISOString(),
    };

    persistProfile(nextProfile);

    const base = sessionEventBase();
    if (base) {
      addClientPortalEvent(
        createPortalEvent({
          ...base,
          type: "Advisor Access Revoked",
          title: "Client revoked advisor portal access",
          message:
            "Client revoked advisor access to portal-submitted materials. Advisor follow-up required before relying on portal data.",
          urgency: "Urgent",
          payload: {
            advisorAccessStatus: "Revoked",
          },
        }),
      );
    }

    setSuccess("Advisor access revoked in the demo portal.");
  }

  function signOut() {
    clearClientPortalSession();
    window.location.href = "/client-login";
  }

  if (!hasHydrated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.34),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_28%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-5 text-white">
        <Card className="max-w-xl text-center">
          <Pill tone="cyan">Client Portal</Pill>
          <h1 className="mt-4 text-4xl font-black">Loading portal...</h1>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Preparing your secure client workspace.
          </p>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.34),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_28%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-5 text-white">
        <Card className="max-w-xl text-center">
          <Pill tone="red">Client Portal</Pill>
          <h1 className="mt-4 text-4xl font-black">Client login required</h1>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Enter through your advisor email invite.
          </p>
          <a
            href="/client-login"
            className="mt-5 inline-flex rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white"
          >
            Go to Client Login
          </a>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.34),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_28%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-5 text-white">
      <div className="mx-auto grid max-w-[1800px] gap-5">
        <header className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-black/70 p-5 shadow-2xl shadow-red-950/30 backdrop-blur-xl">
          <div className="absolute right-[-140px] top-[-180px] hidden h-[420px] w-[420px] rounded-full border border-red-500/10 xl:block">
            <div className="absolute inset-12 rounded-full border border-cyan-500/10" />
            <div className="absolute inset-24 rounded-full border border-white/10" />
          </div>

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="red">Client Portal</Pill>
                <Pill tone="cyan">Advisor Connected</Pill>
                <Pill tone={session.riskSurveyComplete ? "green" : "amber"}>
                  {session.riskSurveyComplete ? "Risk Complete" : "Risk Needed"}
                </Pill>
                <Pill tone={profile.advisorAccessStatus === "Revoked" ? "red" : "green"}>
                  Advisor Access {profile.advisorAccessStatus}
                </Pill>
              </div>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">
                Welcome, {profile.clientName}.
              </h1>
              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400">
                Message your advisor, track conversations, review documents, sign and return
                packets, update risk preferences with dropdowns, and build your desired portfolio
                allocation for advisor review.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/client-login"
                className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white"
              >
                Login Page
              </a>
              <button
                onClick={signOut}
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {success ? (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">
            {success}
          </div>
        ) : null}

        {!session.riskSurveyComplete ? (
          <Card className="border-amber-500/30 bg-amber-500/10">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                  Next step
                </div>
                <h2 className="mt-2 text-2xl font-black">Complete your risk profile</h2>
                <p className="mt-2 text-sm leading-6 text-amber-50">
                  Your advisor needs your risk tolerance, preferences, and investment goals before reviewing requests.
                </p>
              </div>
              <button
                onClick={() => setTab("risk")}
                className="rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-950"
              >
                Complete Risk Survey
              </button>
            </div>
          </Card>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Open Conversations
            </div>
            <div className="mt-2 text-4xl font-black">{openThreads}</div>
            <p className="mt-1 text-sm text-slate-400">Tracked threads</p>
          </Card>
          <Card>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Pending Documents
            </div>
            <div className="mt-2 text-4xl font-black">{pendingDocs}</div>
            <p className="mt-1 text-sm text-slate-400">Need action</p>
          </Card>
          <Card>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Advisor Review
            </div>
            <div className="mt-2 text-4xl font-black">{reviewCount}</div>
            <p className="mt-1 text-sm text-slate-400">Under review</p>
          </Card>
          <Card>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              New Items
            </div>
            <div className="mt-2 text-4xl font-black">{newCount}</div>
            <p className="mt-1 text-sm text-slate-400">Waiting for advisor</p>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="h-fit">
            <div className="grid gap-2">
              {[
                ["dashboard", "Dashboard", "Start here"],
                ["conversations", "Conversations", "Tracked messages"],
                ["documents", "Documents", "Sign / return"],
                ["allocation", "Portfolio Pie", "Desired mix"],
                ["requests", "Requests", "Meetings / buy-sell"],
                ["permissions", "Permissions", "Holding limits"],
                ["risk", "Risk Survey", "Dropdown answers"],
                ["access", "Access", "Control sharing"],
              ].map(([id, label, helper]) => (
                <button
                  key={id}
                  onClick={() => setTab(id as PortalTab)}
                  className={cx(
                    "rounded-2xl border p-4 text-left",
                    tab === id
                      ? "border-white bg-white text-slate-950"
                      : "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.075]",
                  )}
                >
                  <div className="text-sm font-black">{label}</div>
                  <div
                    className={cx(
                      "mt-1 text-xs",
                      tab === id ? "text-slate-600" : "text-slate-500",
                    )}
                  >
                    {helper}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <div className="grid gap-5">
            {tab === "dashboard" ? (
              <div className="grid gap-5">
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
                  <Card>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
                      Portal Activity
                    </div>
                    <h2 className="mt-2 text-3xl font-black">Recent advisor submissions</h2>
                    <div className="mt-5 grid gap-3">
                      {clientEvents.slice(0, 7).map((event) => (
                        <div
                          key={event.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="text-sm font-black text-white">{event.title}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {event.type} · {formatPortalDate(event.createdAt)}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-400">
                                {event.message}
                              </p>
                            </div>
                            <span
                              className={cx(
                                "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                                toneForStatus(event.status),
                              )}
                            >
                              {event.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">
                      Action Center
                    </div>
                    <h2 className="mt-2 text-3xl font-black">Make life easier</h2>
                    <div className="mt-5 grid gap-3">
                      <button
                        onClick={() => setTab("conversations")}
                        className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 text-left"
                      >
                        <div className="font-black text-white">Continue conversation</div>
                        <p className="mt-1 text-sm text-purple-100">
                          Tracked messages stay in threads.
                        </p>
                      </button>
                      <button
                        onClick={() => setTab("documents")}
                        className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-left"
                      >
                        <div className="font-black text-white">Review documents</div>
                        <p className="mt-1 text-sm text-cyan-100">
                          Sign, return, remove, or revoke access.
                        </p>
                      </button>
                      <button
                        onClick={() => setTab("allocation")}
                        className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-left"
                      >
                        <div className="font-black text-white">Update portfolio pie</div>
                        <p className="mt-1 text-sm text-green-100">
                          Set preferred allocation by investment type.
                        </p>
                      </button>
                      <button
                        onClick={() => setTab("risk")}
                        className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left"
                      >
                        <div className="font-black text-white">Update risk survey</div>
                        <p className="mt-1 text-sm text-amber-100">
                          Dropdown-only answers for easy updates.
                        </p>
                      </button>
                    </div>
                  </Card>
                </section>
              </div>
            ) : null}

            {tab === "conversations" ? (
              <Card>
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-400">
                      Conversations
                    </div>
                    <h2 className="mt-2 text-3xl font-black">Tracked advisor messages</h2>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                      Conversations are stored as persistent threads and do not disappear.
                    </p>
                  </div>
                  <Pill tone="purple">{clientThreads.length} threads</Pill>
                </div>

                <section className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                  <div className="grid gap-3">
                    <form
                      onSubmit={createNewThread}
                      className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
                    >
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                        New conversation
                      </div>
                      <input
                        value={newThreadSubject}
                        onChange={(event) => setNewThreadSubject(event.target.value)}
                        placeholder="Subject"
                        className="mt-3 w-full rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm font-bold text-white"
                      />
                      <textarea
                        value={newThreadMessage}
                        onChange={(event) => setNewThreadMessage(event.target.value)}
                        placeholder="Message"
                        className="mt-2 min-h-[90px] w-full rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm font-bold text-white"
                      />
                      <button className="mt-3 w-full rounded-xl bg-red-600 px-4 py-3 text-xs font-black text-white">
                        Start Thread
                      </button>
                    </form>

                    <div className="grid max-h-[520px] gap-2 overflow-y-auto pr-1">
                      {clientThreads.map((thread) => (
                        <button
                          key={thread.id}
                          onClick={() => setActiveThreadId(thread.id)}
                          className={cx(
                            "rounded-2xl border p-4 text-left",
                            activeThread?.id === thread.id
                              ? "border-white bg-white text-slate-950"
                              : "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.075]",
                          )}
                        >
                          <div className="truncate text-sm font-black">{thread.subject}</div>
                          <div
                            className={cx(
                              "mt-1 text-xs",
                              activeThread?.id === thread.id
                                ? "text-slate-600"
                                : "text-slate-500",
                            )}
                          >
                            {thread.category} · {thread.status}
                          </div>
                          <div
                            className={cx(
                              "mt-1 text-xs",
                              activeThread?.id === thread.id
                                ? "text-slate-600"
                                : "text-slate-500",
                            )}
                          >
                            Assigned: {thread.assignedToName ?? "Unassigned"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
                    {activeThread ? (
                      <>
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-2xl font-black">{activeThread.subject}</h3>
                            <div className="mt-1 text-xs text-slate-500">
                              {activeThread.category} · {activeThread.status} · Assigned to{" "}
                              {activeThread.assignedToName ?? "Unassigned"}
                            </div>
                          </div>
                          <Pill tone="purple">{activeThread.priority}</Pill>
                        </div>

                        <div className="mt-5 grid max-h-[520px] gap-3 overflow-y-auto pr-1">
                          {activeThread.messages.map((message) => (
                            <div
                              key={message.id}
                              className={cx(
                                "max-w-[88%] rounded-2xl border p-4",
                                message.senderRole === "Client"
                                  ? "justify-self-end border-red-500/25 bg-red-500/10"
                                  : "justify-self-start border-cyan-500/25 bg-cyan-500/10",
                              )}
                            >
                              <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                                {message.senderName} · {message.senderRole}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-white">
                                {message.body}
                              </p>
                              <div className="mt-2 text-[11px] text-slate-500">
                                {formatPortalDate(message.createdAt)}
                              </div>
                            </div>
                          ))}
                        </div>

                        <form onSubmit={replyToThread} className="mt-4 grid gap-3">
                          <textarea
                            value={messageDraft}
                            onChange={(event) => setMessageDraft(event.target.value)}
                            placeholder="Reply to this thread..."
                            className="min-h-[100px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                          />
                          <button className="rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white">
                            Send Reply
                          </button>
                        </form>
                      </>
                    ) : (
                      <div className="p-10 text-center text-slate-400">
                        No conversation selected.
                      </div>
                    )}
                  </div>
                </section>
              </Card>
            ) : null}

            {tab === "documents" ? (
              <Card>
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">
                      Advisor Documents
                    </div>
                    <h2 className="mt-2 text-3xl font-black">Review, sign, return, or remove</h2>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                      Advisor-sent documents remain labeled and tracked. Demo signatures are local
                      acknowledgements; production should integrate approved e-signature and secure
                      document storage.
                    </p>
                  </div>
                  <Pill tone="cyan">{clientDocumentPackets.length} packets</Pill>
                </div>

                <div className="mt-5 grid gap-4">
                  {clientDocumentPackets.map((packet) => (
                    <div
                      key={packet.id}
                      className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={cx(
                                "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                                toneForStatus(packet.status),
                              )}
                            >
                              {packet.status}
                            </span>
                            <Pill tone="cyan">{packet.documentType}</Pill>
                            {packet.requiresSignature ? (
                              <Pill tone="amber">Signature Required</Pill>
                            ) : null}
                          </div>
                          <h3 className="mt-4 text-2xl font-black">{packet.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {packet.description}
                          </p>
                          <div className="mt-2 text-xs text-slate-500">
                            Sent by {packet.advisorName} · Assigned to{" "}
                            {packet.assignedToName ?? "Unassigned"} ·{" "}
                            {formatPortalDate(packet.createdAt)}
                          </div>

                          <div className="mt-4 grid gap-2">
                            {packet.files.map((file) => (
                              <div
                                key={file.id}
                                className="rounded-2xl border border-white/10 bg-black/35 p-3"
                              >
                                <div className="font-black text-white">{file.name}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {file.type} · {formatDocumentSize(file.size)}
                                </div>
                              </div>
                            ))}
                          </div>

                          {packet.signatureName ? (
                            <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                              Signed by {packet.signatureName} on{" "}
                              {formatPortalDate(packet.signatureDate)}
                            </div>
                          ) : null}
                        </div>

                        <div className="grid min-w-[260px] gap-2">
                          <input
                            value={signatureName}
                            onChange={(event) => setSignatureName(event.target.value)}
                            placeholder="Signature name"
                            className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                          />
                          <button
                            onClick={() => signPacket(packet)}
                            className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white"
                          >
                            Sign & Return
                          </button>
                          <button
                            onClick={() => removePacket(packet)}
                            className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100"
                          >
                            Remove from My Portal
                          </button>
                          <button
                            onClick={() => revokePacketAccess(packet)}
                            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100"
                          >
                            Revoke Advisor Access
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-[1.5rem] border border-purple-500/25 bg-purple-500/10 p-5">
                  <h3 className="text-xl font-black">Submit your own documents</h3>
                  <p className="mt-2 text-sm leading-6 text-purple-100">
                    You can still upload document metadata for your advisor to review.
                  </p>

                  <input
                    type="file"
                    multiple
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      setDocuments(
                        files.map((file) => ({
                          id: `${file.name}-${file.lastModified}`,
                          name: file.name,
                          size: file.size,
                          type: file.type || "Unknown",
                          uploadedAt: new Date().toISOString(),
                        })),
                      );
                    }}
                    className="mt-5 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                  />

                  <div className="mt-4 grid gap-3">
                    {documents.map((document) => (
                      <div
                        key={document.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
                      >
                        <div className="font-black text-white">{document.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {document.type} · {formatDocumentSize(document.size)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={submitDocuments}
                    className="mt-5 rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white"
                  >
                    Submit Documents
                  </button>
                </div>
              </Card>
            ) : null}

            {tab === "allocation" ? (
              <Card>
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">
                      Portfolio Preference Builder
                    </div>
                    <h2 className="mt-2 text-3xl font-black">
                      Build your desired allocation pie chart
                    </h2>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                      Choose investment types and percentages you would like your advisor to
                      review. This is a preference tool, not an instruction to trade.
                    </p>
                  </div>
                  <Pill tone={allocationTotalValue === 100 ? "green" : "amber"}>
                    {allocationTotalValue.toFixed(1)}% total
                  </Pill>
                </div>

                <section className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
                  <div>
                    <div className="h-[360px] rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={profile.allocation}
                            dataKey="percent"
                            nameKey="label"
                            outerRadius={140}
                            innerRadius={78}
                            paddingAngle={3}
                          >
                            {profile.allocation.map((entry, index) => (
                              <Cell
                                key={entry.id}
                                fill={chartColors[index % chartColors.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "#09090b",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 16,
                              color: "#fff",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <select
                        value={selectedInvestmentId}
                        onChange={(event) => setSelectedInvestmentId(event.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                      >
                        {INVESTMENT_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label} · {option.category} · {option.risk}
                          </option>
                        ))}
                      </select>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={addInvestmentType}
                          className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100"
                        >
                          Add Type
                        </button>
                        <button
                          onClick={normalizeClientAllocation}
                          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100"
                        >
                          Normalize to 100%
                        </button>
                      </div>

                      <button
                        onClick={submitAllocationPreference}
                        className="rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white"
                      >
                        Submit Allocation to Advisor
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {profile.allocation.map((item, index) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <span
                                className="h-4 w-4 rounded-full"
                                style={{ backgroundColor: chartColors[index % chartColors.length] }}
                              />
                              <div>
                                <div className="font-black text-white">{item.label}</div>
                                <div className="text-xs text-slate-500">{item.category}</div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={item.percent}
                              onChange={(event) =>
                                updateAllocation(item.id, Number(event.target.value))
                              }
                              className="w-28 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm font-bold text-white"
                            />
                            <span className="text-sm font-black text-slate-400">%</span>
                            <button
                              onClick={() => removeAllocation(item.id)}
                              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        By category
                      </div>
                      <div className="mt-3 grid gap-2">
                        {categoryAllocation.map((item) => (
                          <div key={item.category} className="flex items-center justify-between text-sm">
                            <span className="font-bold text-slate-300">{item.category}</span>
                            <span className="font-black text-white">
                              {item.percent.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </Card>
            ) : null}

            {tab === "requests" ? (
              <Card>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
                  Submit Request
                </div>
                <h2 className="mt-2 text-3xl font-black">Advisor review request</h2>

                <form onSubmit={submitRequest} className="mt-5 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <select
                      value={request.type}
                      onChange={(event) =>
                        setRequest((current) => ({
                          ...current,
                          type: event.target.value as ClientPortalEventType,
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                    >
                      <option>Meeting Request</option>
                      <option>Buy Request</option>
                      <option>Sell Request</option>
                      <option>Secure Message</option>
                    </select>
                    <select
                      value={request.urgency}
                      onChange={(event) =>
                        setRequest((current) => ({
                          ...current,
                          urgency: event.target.value as ClientPortalUrgency,
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                    >
                      <option>Low</option>
                      <option>Normal</option>
                      <option>High</option>
                      <option>Urgent</option>
                    </select>
                    <input
                      value={request.meetingWindow}
                      onChange={(event) =>
                        setRequest((current) => ({
                          ...current,
                          meetingWindow: event.target.value,
                        }))
                      }
                      placeholder="Meeting window"
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                    />
                  </div>

                  <input
                    value={request.title}
                    onChange={(event) =>
                      setRequest((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Request title"
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                  />

                  <div className="grid gap-3 md:grid-cols-4">
                    <input
                      value={request.symbol}
                      onChange={(event) =>
                        setRequest((current) => ({
                          ...current,
                          symbol: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="Symbol / ETF"
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                    />
                    <input
                      value={request.action}
                      onChange={(event) =>
                        setRequest((current) => ({ ...current, action: event.target.value }))
                      }
                      placeholder="Action"
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                    />
                    <input
                      value={request.estimatedAmount}
                      onChange={(event) =>
                        setRequest((current) => ({
                          ...current,
                          estimatedAmount: event.target.value,
                        }))
                      }
                      placeholder="$ amount"
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                    />
                    <input
                      value={request.targetAllocation}
                      onChange={(event) =>
                        setRequest((current) => ({
                          ...current,
                          targetAllocation: event.target.value,
                        }))
                      }
                      placeholder="Target %"
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                    />
                  </div>

                  <textarea
                    value={request.message}
                    onChange={(event) =>
                      setRequest((current) => ({ ...current, message: event.target.value }))
                    }
                    placeholder="Explain what you want your advisor to review..."
                    className="min-h-[160px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                  />

                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-50">
                    Requests involving stocks or ETFs are submitted for advisor review and are not automatic orders.
                  </div>

                  <button className="rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white">
                    Submit to Advisor
                  </button>
                </form>
              </Card>
            ) : null}

            {tab === "permissions" ? (
              <Card>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-400">
                  Permissions
                </div>
                <h2 className="mt-2 text-3xl font-black">Holding discussion permissions</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  These are client preferences for advisor review. They do not authorize automatic trading.
                </p>

                <div className="mt-5 grid gap-3">
                  {permissions.map((row, index) => (
                    <div
                      key={`${row.symbol}-${index}`}
                      className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 md:grid-cols-[110px_110px_130px_1fr_80px] md:items-center"
                    >
                      <input
                        value={row.symbol}
                        onChange={(event) =>
                          setPermissions((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, symbol: event.target.value.toUpperCase() }
                                : item,
                            ),
                          )
                        }
                        className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm font-bold text-white"
                      />
                      <input
                        value={row.maxPercent}
                        onChange={(event) =>
                          setPermissions((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, maxPercent: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="Max %"
                        className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm font-bold text-white"
                      />
                      <input
                        value={row.maxDollar}
                        onChange={(event) =>
                          setPermissions((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, maxDollar: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="$ max"
                        className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm font-bold text-white"
                      />
                      <input
                        value={row.note}
                        onChange={(event) =>
                          setPermissions((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, note: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="Permission note"
                        className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm font-bold text-white"
                      />
                      <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-300">
                        <input
                          type="checkbox"
                          checked={row.allowed}
                          onChange={(event) =>
                            setPermissions((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, allowed: event.target.checked }
                                  : item,
                              ),
                            )
                          }
                        />
                        Allow
                      </label>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setPermissions((current) => [
                        ...current,
                        { symbol: "", allowed: true, maxPercent: "", maxDollar: "", note: "" },
                      ])
                    }
                    className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white"
                  >
                    Add Holding
                  </button>
                  <button
                    onClick={submitPermissions}
                    className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white"
                  >
                    Submit Permissions
                  </button>
                </div>
              </Card>
            ) : null}

            {tab === "risk" ? (
              <Card>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
                  Risk Survey
                </div>
                <h2 className="mt-2 text-3xl font-black">Update risk tolerance</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  This can be changed at any time and uses dropdowns so you do not need to type manually.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {(Object.keys(profile.riskSurvey) as Array<keyof ClientPortalRiskSurvey>).map((key) => (
                    <label key={key} className="grid gap-2">
                      <FieldLabel>{key.replace(/([A-Z])/g, " $1")}</FieldLabel>
                      <select
                        value={profile.riskSurvey[key]}
                        onChange={(event) => updateRisk(key, event.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white"
                      >
                        {RISK_SURVEY_OPTIONS[key].map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                <button
                  onClick={submitRiskSurvey}
                  className="mt-5 rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white"
                >
                  Submit Risk Update
                </button>
              </Card>
            ) : null}

            {tab === "access" ? (
              <Card>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
                  Access Control
                </div>
                <h2 className="mt-2 text-3xl font-black">Control advisor access</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                  Clients can remove document packets or revoke advisor portal access in this demo.
                  Production should enforce this with secure permissions and auditable records.
                </p>

                <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="text-sm font-black text-white">Advisor access status</div>
                      <div className="mt-1 text-2xl font-black">
                        {profile.advisorAccessStatus}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {profile.advisorAccessNote}
                      </p>
                    </div>
                    <button
                      onClick={revokeAdvisorAccess}
                      className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-black text-red-100"
                    >
                      Revoke Advisor Access
                    </button>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}