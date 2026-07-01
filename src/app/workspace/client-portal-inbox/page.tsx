"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";

type InboxType =
  | "Message"
  | "Request"
  | "Document"
  | "Risk Update"
  | "Holding Update"
  | "Meeting"
  | "Approval"
  | "Profile Update";

type Priority = "Critical" | "High" | "Medium" | "Low";
type Status = "Unread" | "Needs Review" | "Assigned" | "In Progress" | "Resolved";

type Holding = {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  allocationPct: number;
  value: string;
  riskLevel: string;
  note: string;
};

type ClientProfile = {
  id: string;
  fullName: string;
  householdName: string;
  email: string;
  phone: string;
  clientType: string;
  tier: string;
  status: string;
  hasPortalAccount: boolean;
  riskScore: number;
  riskProfile: string;
  liquidityNeeds: string;
  timeHorizon: string;
  objective: string;
  portfolioValue: string;
  notes: string;
  holdings: Holding[];
  updatedAt: string;
};

type ClientInboxItem = {
  id: string;
  clientId: string;
  type: InboxType;
  title: string;
  body: string;
  submittedAt: string;
  priority: Priority;
  status: Status;
  assignedTo?: string;
  relatedSymbol?: string;
  source: "Client Portal" | "Client Account" | "Profile Update" | "Account Update" | "Document Upload" | "Advisor Routing";
};

type DelegatedTask = {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  owner: string;
  ownerRole: string;
  status: "Open" | "In Progress" | "Waiting" | "Done";
  priority: Priority;
  due: string;
  source: "Client Portal Inbox";
  sourceItemId: string;
  createdAt: string;
  detail: string;
};

type CommunicationRecord = {
  id: string;
  clientId: string;
  type: "Client Message" | "Advisor Note" | "Assignment" | "Email Draft" | "Profile Change";
  title: string;
  body: string;
  createdAt: string;
  owner: string;
  source: string;
};

const CLIENTS_KEY = "slice-client-profiles-v2";
const INBOX_KEY = "slice-client-portal-inbox-v2";
const TEAM_DELEGATIONS_KEY = "slice-team-board-delegations-v1";
const COMMUNICATIONS_KEY = "slice-client-communications-v1";

const TEAM = [
  { id: "founder", name: "Founder", role: "Founder / Principal", email: "founder@slice.ai" },
  { id: "lead-advisor", name: "Lead Advisor", role: "Advisor", email: "advisor@slice.ai" },
  { id: "service-advisor", name: "Service Advisor", role: "Client Service", email: "service@slice.ai" },
  { id: "ops", name: "Ops", role: "Operations", email: "ops@slice.ai" },
];

const DEFAULT_CLIENTS: ClientProfile[] = [
  {
    id: "c-royal",
    fullName: "Royal Family Trust",
    householdName: "Royal Household",
    email: "royal.client@example.com",
    phone: "(480) 555-0138",
    clientType: "Trust",
    tier: "Premier",
    status: "Active",
    hasPortalAccount: true,
    riskScore: 72,
    riskProfile: "Moderate Growth",
    liquidityNeeds: "Medium",
    timeHorizon: "10+ years",
    objective: "Long-term growth with tax-aware concentration management.",
    portfolioValue: "$2.8M",
    notes: "Client is sensitive to taxable gains and concentrated AAPL exposure.",
    updatedAt: "Today",
    holdings: [
      {
        id: "h-spy",
        symbol: "SPY",
        name: "S&P 500 ETF",
        assetClass: "ETF",
        allocationPct: 24,
        value: "$672,000",
        riskLevel: "Medium",
        note: "Core equity exposure",
      },
      {
        id: "h-aapl",
        symbol: "AAPL",
        name: "Apple",
        assetClass: "Stock",
        allocationPct: 8,
        value: "$224,000",
        riskLevel: "High",
        note: "Concentrated taxable position",
      },
      {
        id: "h-tlt",
        symbol: "TLT",
        name: "20+ Year Treasury ETF",
        assetClass: "ETF",
        allocationPct: 11,
        value: "$308,000",
        riskLevel: "Medium",
        note: "Rate-sensitive allocation",
      },
      {
        id: "h-cash",
        symbol: "CASH",
        name: "Cash Reserve",
        assetClass: "Cash",
        allocationPct: 7,
        value: "$196,000",
        riskLevel: "Low",
        note: "Liquidity reserve",
      },
    ],
  },
  {
    id: "c-desert",
    fullName: "Desert Capital LLC",
    householdName: "Desert Capital",
    email: "desert@example.com",
    phone: "(602) 555-0144",
    clientType: "Business Owner",
    tier: "Business Owner",
    status: "Active",
    hasPortalAccount: true,
    riskScore: 84,
    riskProfile: "Growth",
    liquidityNeeds: "Low",
    timeHorizon: "15+ years",
    objective: "Growth-focused allocation with liquidity event planning.",
    portfolioValue: "$4.1M",
    notes: "Client wants more structured AI exposure review.",
    updatedAt: "Yesterday",
    holdings: [
      {
        id: "h-qqq",
        symbol: "QQQ",
        name: "Nasdaq 100 ETF",
        assetClass: "ETF",
        allocationPct: 18,
        value: "$738,000",
        riskLevel: "High",
        note: "Growth tilt",
      },
      {
        id: "h-nvda",
        symbol: "NVDA",
        name: "NVIDIA",
        assetClass: "Stock",
        allocationPct: 6,
        value: "$246,000",
        riskLevel: "High",
        note: "AI exposure request",
      },
      {
        id: "h-bnd",
        symbol: "BND",
        name: "Total Bond Market ETF",
        assetClass: "ETF",
        allocationPct: 9,
        value: "$369,000",
        riskLevel: "Low",
        note: "Stability sleeve",
      },
    ],
  },
  {
    id: "c-saguaro",
    fullName: "Saguaro Retirement Plan",
    householdName: "Saguaro Family",
    email: "saguaro@example.com",
    phone: "(520) 555-0199",
    clientType: "Retirement",
    tier: "Retirement",
    status: "Active",
    hasPortalAccount: true,
    riskScore: 48,
    riskProfile: "Balanced Income",
    liquidityNeeds: "High",
    timeHorizon: "5–7 years",
    objective: "Retirement income stability with controlled drawdown risk.",
    portfolioValue: "$1.2M",
    notes: "Client is focused on income confidence and downside control.",
    updatedAt: "3 days ago",
    holdings: [
      {
        id: "h-schd",
        symbol: "SCHD",
        name: "Dividend Equity ETF",
        assetClass: "ETF",
        allocationPct: 20,
        value: "$240,000",
        riskLevel: "Medium",
        note: "Income equity sleeve",
      },
      {
        id: "h-agg",
        symbol: "AGG",
        name: "Aggregate Bond ETF",
        assetClass: "ETF",
        allocationPct: 22,
        value: "$264,000",
        riskLevel: "Low",
        note: "Core fixed income",
      },
      {
        id: "h-gld",
        symbol: "GLD",
        name: "Gold ETF",
        assetClass: "ETF",
        allocationPct: 4,
        value: "$48,000",
        riskLevel: "Medium",
        note: "Diversifier",
      },
    ],
  },
];

const DEFAULT_INBOX: ClientInboxItem[] = [
  {
    id: "i-1",
    clientId: "c-royal",
    type: "Risk Update",
    title: "Risk profile update submitted",
    body:
      "Client updated risk tolerance from Moderate to Moderate Growth and added a note about wanting more upside while avoiding overconcentration.",
    submittedAt: "8 minutes ago",
    priority: "High",
    status: "Unread",
    assignedTo: "lead-advisor",
    source: "Client Account",
  },
  {
    id: "i-2",
    clientId: "c-royal",
    type: "Holding Update",
    title: "Question about AAPL concentration",
    body:
      "Client asked whether they should reduce Apple exposure after seeing the position as a large part of taxable holdings.",
    submittedAt: "22 minutes ago",
    priority: "High",
    status: "Needs Review",
    relatedSymbol: "AAPL",
    assignedTo: "founder",
    source: "Client Portal",
  },
  {
    id: "i-3",
    clientId: "c-desert",
    type: "Request",
    title: "Discuss AI exposure",
    body:
      "Client wants to discuss NVDA and whether current AI exposure is appropriate for their business-owner portfolio.",
    submittedAt: "1 hour ago",
    priority: "Medium",
    status: "Assigned",
    relatedSymbol: "NVDA",
    assignedTo: "lead-advisor",
    source: "Client Portal",
  },
  {
    id: "i-4",
    clientId: "c-saguaro",
    type: "Meeting",
    title: "Income planning meeting request",
    body:
      "Client requested a meeting to review expected retirement income, bond allocation, and liquidity needs for the next 12 months.",
    submittedAt: "2 hours ago",
    priority: "Medium",
    status: "Needs Review",
    assignedTo: "service-advisor",
    source: "Client Portal",
  },
  {
    id: "i-5",
    clientId: "c-royal",
    type: "Document",
    title: "Trust document uploaded",
    body:
      "Client uploaded an updated trust document and requested confirmation that beneficiary notes are reflected in planning records.",
    submittedAt: "Today",
    priority: "Critical",
    status: "Unread",
    assignedTo: "ops",
    source: "Document Upload",
  },
];

const DEFAULT_COMMUNICATIONS: CommunicationRecord[] = [
  {
    id: "comm-1",
    clientId: "c-royal",
    type: "Client Message",
    title: "AAPL concentration question",
    body: "Client asked whether their AAPL position is too concentrated.",
    createdAt: "22 minutes ago",
    owner: "Client",
    source: "Client Portal",
  },
  {
    id: "comm-2",
    clientId: "c-desert",
    type: "Advisor Note",
    title: "AI exposure review",
    body: "Prepare talking points for NVDA and QQQ exposure.",
    createdAt: "1 hour ago",
    owner: "Lead Advisor",
    source: "Advisor Note",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const toneClasses: Record<Tone, string> = {
  red: "border-red-500/30 bg-red-500/10 text-red-100",
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-100",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  slate: "border-slate-500/20 bg-slate-500/10 text-slate-100",
};

function typeTone(type: InboxType): Tone {
  if (type === "Risk Update") return "red";
  if (type === "Holding Update") return "cyan";
  if (type === "Document") return "amber";
  if (type === "Meeting") return "purple";
  if (type === "Approval") return "green";
  if (type === "Request") return "blue";
  if (type === "Profile Update") return "purple";
  return "slate";
}

function priorityTone(priority: Priority): Tone {
  if (priority === "Critical") return "red";
  if (priority === "High") return "amber";
  if (priority === "Medium") return "cyan";
  return "slate";
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/82 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
        toneClasses[tone],
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function ActionButton({
  children,
  tone = "red",
  onClick,
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-black transition hover:-translate-y-0.5",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

function LinkButton({
  href,
  children,
  tone = "red",
  className = "",
}: {
  href: string;
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cx(
        "inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-black transition hover:-translate-y-0.5",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </Link>
  );
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getClient(clients: ClientProfile[], clientId: string) {
  return clients.find((client) => client.id === clientId) ?? clients[0];
}

function getTeamMember(memberId?: string) {
  if (!memberId) return undefined;
  return TEAM.find((member) => member.id === memberId);
}

function nowLabel() {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ClientPortalInboxPage() {
  const [clients, setClients] = useState<ClientProfile[]>(DEFAULT_CLIENTS);
  const [items, setItems] = useState<ClientInboxItem[]>(DEFAULT_INBOX);
  const [delegations, setDelegations] = useState<DelegatedTask[]>([]);
  const [communications, setCommunications] = useState<CommunicationRecord[]>(DEFAULT_COMMUNICATIONS);
  const [selectedItemId, setSelectedItemId] = useState(DEFAULT_INBOX[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<InboxType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<Status | "All">("All");
  const [assignmentMemberId, setAssignmentMemberId] = useState("lead-advisor");
  const [clientUpdateTitle, setClientUpdateTitle] = useState("");
  const [clientUpdateBody, setClientUpdateBody] = useState("");

  useEffect(() => {
    const storedClients = loadJson<ClientProfile[]>(CLIENTS_KEY, DEFAULT_CLIENTS);
    const storedInbox = loadJson<ClientInboxItem[]>(INBOX_KEY, DEFAULT_INBOX);
    const storedDelegations = loadJson<DelegatedTask[]>(TEAM_DELEGATIONS_KEY, []);
    const storedComms = loadJson<CommunicationRecord[]>(COMMUNICATIONS_KEY, DEFAULT_COMMUNICATIONS);

    setClients(storedClients);
    setItems(storedInbox);
    setDelegations(storedDelegations);
    setCommunications(storedComms);

    const params = new URLSearchParams(window.location.search);
    const clientId = params.get("clientId");
    const itemId = params.get("itemId");

    if (itemId && storedInbox.some((item) => item.id === itemId)) {
      setSelectedItemId(itemId);
    } else if (clientId) {
      const clientItem = storedInbox.find((item) => item.clientId === clientId);
      if (clientItem) setSelectedItemId(clientItem.id);
      setQuery(getClient(storedClients, clientId).fullName);
    }
  }, []);

  useEffect(() => {
    saveJson(CLIENTS_KEY, clients);
  }, [clients]);

  useEffect(() => {
    saveJson(INBOX_KEY, items);
  }, [items]);

  useEffect(() => {
    saveJson(TEAM_DELEGATIONS_KEY, delegations);
  }, [delegations]);

  useEffect(() => {
    saveJson(COMMUNICATIONS_KEY, communications);
  }, [communications]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return [...items]
      .filter((item) => {
        const client = getClient(clients, item.clientId);
        const matchesType = typeFilter === "All" || item.type === typeFilter;
        const matchesStatus = statusFilter === "All" || item.status === statusFilter;

        const haystack = [
          item.title,
          item.body,
          item.type,
          item.priority,
          item.status,
          item.relatedSymbol ?? "",
          item.source,
          client.fullName,
          client.householdName,
          client.email,
          client.riskProfile,
          ...client.holdings.map((holding) => `${holding.symbol} ${holding.name}`),
        ]
          .join(" ")
          .toLowerCase();

        return matchesType && matchesStatus && (!normalized || haystack.includes(normalized));
      })
      .sort((a, b) => {
        const priorityOrder: Record<Priority, number> = {
          Critical: 4,
          High: 3,
          Medium: 2,
          Low: 1,
        };

        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
  }, [clients, items, query, statusFilter, typeFilter]);

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? filteredItems[0] ?? items[0];
  const selectedClient = selectedItem ? getClient(clients, selectedItem.clientId) : clients[0];
  const selectedClientComms = communications.filter((comm) => comm.clientId === selectedClient.id);
  const selectedClientInboxItems = items.filter((item) => item.clientId === selectedClient.id);

  const unreadCount = items.filter((item) => item.status === "Unread").length;
  const highPriorityCount = items.filter((item) => item.priority === "Critical" || item.priority === "High").length;
  const openDelegations = delegations.filter((task) => task.status !== "Done").length;

  function updateItemStatus(itemId: string, status: Status) {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, status } : item)),
    );
  }

  function assignItem(itemId: string, memberId: string) {
    const item = items.find((entry) => entry.id === itemId);
    const member = getTeamMember(memberId);

    if (!item || !member) return;

    const client = getClient(clients, item.clientId);

    const delegatedTask: DelegatedTask = {
      id: `delegation-${Date.now()}`,
      title: `${item.type}: ${item.title}`,
      clientId: item.clientId,
      clientName: client.fullName,
      owner: member.name,
      ownerRole: member.role,
      status: "Open",
      priority: item.priority,
      due: item.priority === "Critical" ? "Today" : "This Week",
      source: "Client Portal Inbox",
      sourceItemId: item.id,
      createdAt: nowLabel(),
      detail: item.body,
    };

    const communication: CommunicationRecord = {
      id: `comm-${Date.now()}`,
      clientId: item.clientId,
      type: "Assignment",
      title: `Assigned to ${member.name}`,
      body: `${item.title} was assigned to ${member.name} from the Client Portal Inbox.`,
      createdAt: nowLabel(),
      owner: "Lead Advisor",
      source: "Client Portal Inbox",
    };

    setItems((current) =>
      current.map((entry) =>
        entry.id === itemId
          ? { ...entry, assignedTo: member.id, status: "Assigned" }
          : entry,
      ),
    );

    setDelegations((current) => [delegatedTask, ...current]);
    setCommunications((current) => [communication, ...current]);
  }

  function receiveClientUpdate() {
    const title = clientUpdateTitle.trim() || "New client portal update";
    const body =
      clientUpdateBody.trim() ||
      "Client submitted an account update from their designated portal account.";

    const newItem: ClientInboxItem = {
      id: `inbox-${Date.now()}`,
      clientId: selectedClient.id,
      type: "Message",
      title,
      body,
      submittedAt: nowLabel(),
      priority: "Medium",
      status: "Unread",
      source: "Client Account",
    };

    const communication: CommunicationRecord = {
      id: `comm-${Date.now()}`,
      clientId: selectedClient.id,
      type: "Client Message",
      title,
      body,
      createdAt: nowLabel(),
      owner: selectedClient.fullName,
      source: "Client Account",
    };

    setItems((current) => [newItem, ...current]);
    setCommunications((current) => [communication, ...current]);
    setSelectedItemId(newItem.id);
    setClientUpdateTitle("");
    setClientUpdateBody("");
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-16%] top-[-18%] h-[34rem] w-[34rem] rounded-full bg-red-700/25 blur-3xl" />
        <div className="absolute right-[-12%] top-[8%] h-[32rem] w-[32rem] rounded-full bg-purple-700/14 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[28%] h-[30rem] w-[30rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative mx-auto grid h-screen max-w-[1900px] grid-rows-[auto_minmax(0,1fr)] gap-3 p-3">
        <header className="rounded-[1.75rem] border border-white/10 bg-black/70 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="purple">Client Portal Inbox</Pill>
                <Pill tone="green">Client account updates</Pill>
                <Pill tone="amber">{unreadCount} unread</Pill>
                <Pill tone="red">{highPriorityCount} high priority</Pill>
              </div>

              <h1 className="mt-3 text-3xl font-black leading-tight text-white md:text-5xl">
                Consolidated client inbox for advisor action.
              </h1>

              <p className="mt-2 max-w-5xl text-sm font-semibold leading-7 text-slate-400">
                Every client message, request, risk update, holding question, document upload, and account update lands here. Lead advisors can delegate responses directly to the team board.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <LinkButton href="/workspace" tone="slate">Workspace</LinkButton>
              <LinkButton href={`/workspace/clients?clientId=${selectedClient.id}`} tone="purple">Open Profile</LinkButton>
              <LinkButton href="/workspace/team-board" tone="green">Team Board</LinkButton>
              <LinkButton href="/workspace/client-emails" tone="green">Email Center</LinkButton>
            </div>
          </div>
        </header>

        <section className="grid min-h-0 gap-3 xl:grid-cols-[370px_minmax(0,1fr)_410px]">
          <Card className="min-h-0 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                  Live Intake
                </div>
                <h2 className="mt-1 text-2xl font-black text-white">Client feed</h2>
              </div>
              <Pill tone="purple">{filteredItems.length} items</Pill>
            </div>

            <div className="mt-4 grid gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search clients, messages, holdings..."
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-purple-500"
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as InboxType | "All")}
                  className="rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-xs font-bold text-white outline-none"
                >
                  <option>All</option>
                  <option>Message</option>
                  <option>Request</option>
                  <option>Document</option>
                  <option>Risk Update</option>
                  <option>Holding Update</option>
                  <option>Meeting</option>
                  <option>Approval</option>
                  <option>Profile Update</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as Status | "All")}
                  className="rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-xs font-bold text-white outline-none"
                >
                  <option>All</option>
                  <option>Unread</option>
                  <option>Needs Review</option>
                  <option>Assigned</option>
                  <option>In Progress</option>
                  <option>Resolved</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid max-h-[calc(100vh-308px)] gap-2 overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const client = getClient(clients, item.clientId);
                const active = selectedItem?.id === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedItemId(item.id);
                      if (item.status === "Unread") updateItemStatus(item.id, "Needs Review");
                    }}
                    className={cx(
                      "rounded-3xl border p-4 text-left transition hover:-translate-y-0.5",
                      active
                        ? toneClasses[typeTone(item.type)]
                        : "border-white/10 bg-white/[0.045] hover:bg-white/[0.075]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-white">{item.title}</div>
                        <div className="mt-1 truncate text-xs font-semibold text-slate-500">{client.fullName}</div>
                      </div>
                      <Pill tone={priorityTone(item.priority)}>{item.priority}</Pill>
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-400">
                      {item.body}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Pill tone={typeTone(item.type)}>{item.type}</Pill>
                      <Pill tone="slate">{item.status}</Pill>
                      {item.relatedSymbol ? <Pill tone="cyan">{item.relatedSymbol}</Pill> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="min-h-0 p-5">
            {selectedItem ? (
              <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={typeTone(selectedItem.type)}>{selectedItem.type}</Pill>
                    <Pill tone={priorityTone(selectedItem.priority)}>{selectedItem.priority}</Pill>
                    <Pill tone="slate">{selectedItem.source}</Pill>
                    <Pill tone="green">{selectedItem.status}</Pill>
                  </div>

                  <h2 className="mt-3 text-3xl font-black leading-tight text-white">
                    {selectedItem.title}
                  </h2>

                  <p className="mt-3 text-sm font-semibold leading-7 text-slate-400">
                    {selectedItem.body}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Client</div>
                    <div className="mt-1 truncate text-sm font-black text-white">{selectedClient.fullName}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Risk</div>
                    <div className="mt-1 truncate text-sm font-black text-white">{selectedClient.riskProfile}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Assigned</div>
                    <div className="mt-1 truncate text-sm font-black text-white">{getTeamMember(selectedItem.assignedTo)?.name ?? "Unassigned"}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Submitted</div>
                    <div className="mt-1 truncate text-sm font-black text-white">{selectedItem.submittedAt}</div>
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto pr-1">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                        Client Snapshot
                      </div>

                      <div className="mt-4 grid gap-3">
                        <div>
                          <div className="text-sm font-black text-white">{selectedClient.fullName}</div>
                          <div className="text-xs font-semibold text-slate-500">{selectedClient.householdName} · {selectedClient.tier}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Risk Score</div>
                            <div className="mt-1 text-2xl font-black text-white">{selectedClient.riskScore}</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Time Horizon</div>
                            <div className="mt-1 text-sm font-black text-white">{selectedClient.timeHorizon}</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Liquidity</div>
                            <div className="mt-1 text-sm font-black text-white">{selectedClient.liquidityNeeds}</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Portal</div>
                            <div className="mt-1 text-sm font-black text-white">{selectedClient.hasPortalAccount ? "Active" : "No Account"}</div>
                          </div>
                        </div>

                        <p className="text-sm font-semibold leading-6 text-slate-400">{selectedClient.objective}</p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                        Held Securities
                      </div>

                      <div className="mt-4 grid gap-2">
                        {selectedClient.holdings.map((holding) => (
                          <Link
                            key={holding.id}
                            href={`/workspace/custom-board?symbol=${encodeURIComponent(holding.symbol)}`}
                            prefetch={false}
                            className="rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:bg-cyan-500/10"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-black text-white">{holding.symbol}</div>
                                <div className="text-xs font-semibold text-slate-500">{holding.name}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-black text-white">{holding.allocationPct}%</div>
                                <div className="text-xs font-semibold text-slate-500">{holding.value}</div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs font-semibold text-slate-400">{holding.note}</div>
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="xl:col-span-2 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-green-400">
                            Communication + Request Stream
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-400">
                            Every profile, inbox, assignment, and message event for this client.
                          </div>
                        </div>
                        <LinkButton href={`/workspace/clients?clientId=${selectedClient.id}`} tone="purple">
                          Open Profile
                        </LinkButton>
                      </div>

                      <div className="mt-4 grid max-h-[220px] gap-2 overflow-y-auto pr-1">
                        {[...selectedClientInboxItems.map((item) => ({
                          id: item.id,
                          title: item.title,
                          body: item.body,
                          meta: `${item.type} · ${item.status} · ${item.submittedAt}`,
                          href: `/workspace/client-portal-inbox?itemId=${item.id}`,
                        })), ...selectedClientComms.map((comm) => ({
                          id: comm.id,
                          title: comm.title,
                          body: comm.body,
                          meta: `${comm.type} · ${comm.owner} · ${comm.createdAt}`,
                          href: `/workspace/client-portal-inbox?clientId=${comm.clientId}`,
                        }))].map((entry) => (
                          <Link
                            key={entry.id}
                            href={entry.href}
                            prefetch={false}
                            className="rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:bg-white/[0.06]"
                          >
                            <div className="text-sm font-black text-white">{entry.title}</div>
                            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{entry.meta}</div>
                            <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-400">{entry.body}</p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </Card>

          <div className="grid min-h-0 gap-3">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-green-400">
                Delegate Client Response
              </div>

              <div className="mt-4 grid gap-3">
                <select
                  value={assignmentMemberId}
                  onChange={(event) => setAssignmentMemberId(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none"
                >
                  {TEAM.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} · {member.role}
                    </option>
                  ))}
                </select>

                <ActionButton
                  onClick={() => selectedItem && assignItem(selectedItem.id, assignmentMemberId)}
                  tone="green"
                >
                  Assign to Team Board
                </ActionButton>

                <LinkButton href="/workspace/team-board" tone="green">
                  View Team To-Do List
                </LinkButton>
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                Receive Client Account Update
              </div>

              <div className="mt-4 grid gap-3">
                <input
                  value={clientUpdateTitle}
                  onChange={(event) => setClientUpdateTitle(event.target.value)}
                  placeholder="Client update title"
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                />
                <textarea
                  value={clientUpdateBody}
                  onChange={(event) => setClientUpdateBody(event.target.value)}
                  placeholder="Client message/request body"
                  rows={3}
                  className="resize-none rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                />
                <ActionButton onClick={receiveClientUpdate} tone="cyan">
                  Simulate Client Update
                </ActionButton>
              </div>
            </Card>

            <Card className="min-h-0 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                    Notifications
                  </div>
                  <h2 className="mt-1 text-2xl font-black text-white">Advisor alerts</h2>
                </div>
                <Pill tone="amber">{highPriorityCount} high</Pill>
              </div>

              <div className="mt-4 grid gap-2">
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
                  <div className="text-sm font-black text-white">{unreadCount} unread client updates</div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">New portal activity requiring advisor review.</div>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <div className="text-sm font-black text-white">{openDelegations} open delegated tasks</div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">Tasks will appear in the Team Board bridge.</div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}