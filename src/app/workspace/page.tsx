"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type User = { id: string; name: string; email: string };

type Tab =
  | "overview"
  | "watchlists"
  | "firm-calendar"
  | "team-board"
  | "comparison"
  | "alternatives"
  | "clients"
  | "portfolio"
  | "intelligence"
  | "notifications"
  | "briefings"
  | "security"
  | "system";

type AuthMode = "login" | "firm-signup" | "invite-signup";

type Firm = {
  id: string;
  name: string;
  firmEmail: string | null;
  firmCode: string;
};

type Membership = {
  id: string;
  firmId: string;
  userId: string;
  role: string;
  status: string;
  calendarColor: string;
  canAccessPortfolios: boolean;
  canManageProjects: boolean;
  canInviteMembers: boolean;
  canManageFirm: boolean;
  user?: User;
  firm?: Firm;
};

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  agendaTasks?: Array<{ id: string; status: string }>;
};

type AgendaTask = {
  id: string;
  projectId: string | null;
  title: string;
  detail: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  delayReason: string | null;
  inquiry: string | null;
  project: Project | null;
  comments: Array<{
    id: string;
    body: string;
    commentType: string;
    createdAt: string;
    user: User;
  }>;
};

type Agenda = {
  id: string;
  weekStart: string;
  title: string;
  focus: string | null;
  blockers: string | null;
  status: string;
  membership: Membership;
  tasks: AgendaTask[];
};

type Invite = {
  id: string;
  email: string;
  role: string;
  inviteCode: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  sentBy: User;
};

type FirmPost = {
  id: string;
  title: string;
  body: string;
  postType: string;
  createdAt: string;
  project: Project | null;
  authorMembership: Membership | null;
};

type FirmWorkspace = {
  firms: Array<Firm & { membership: Membership }>;
  firm: Firm | null;
  membership: Membership | null;
  members: Membership[];
  invites: Invite[];
  projects: Project[];
  agendas: Agenda[];
  posts: FirmPost[];
  inviteCode?: string;
  inviteLink?: string;
};

type CommandOverview = {
  readinessScore: number;
  counts: {
    watchlistCount: number;
    ventureCount: number;
    goalCount: number;
    researchCount: number;
    unreadAlertCount: number;
    totalAlertCount: number;
    clientCount: number;
    openTaskCount: number;
    briefingCount: number;
    retainedDecisionCount: number;
    triageRunCount: number;
    deliveryCount: number;
    digestCount: number;
    auditLogCount: number;
    accountCount: number;
    holdingCount: number;
    modelCount: number;
    portfolioTotalValue: number;
    firmCount?: number;
    ownedFirmCount?: number;
    firmProjectCount?: number;
    firmAgendaCount?: number;
    firmAgendaTaskCount?: number;
    firmPostCount?: number;
    acceptedDisclosures?: number;
    requiredDisclosures?: number;
  };
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function percent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function weekStartToday() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayLabel(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function shortDate(dateString: string | null) {
  if (!dateString) return "No date set";

  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toneFor(status: string): "red" | "green" | "amber" | "slate" | "purple" {
  if (
    [
      "Complete",
      "Done",
      "Delivered",
      "Accepted",
      "Ready",
      "Active",
      "On Track",
      "Named",
      "Live",
      "Yes",
      "Highest",
    ].includes(status)
  ) {
    return "green";
  }

  if (
    [
      "Delayed",
      "Blocked",
      "Removed",
      "Critical",
      "Suppressed",
      "At Risk",
      "High risk",
      "High",
    ].includes(status)
  ) {
    return "red";
  }

  if (["Open", "Pending", "Queued", "Needs Review", "Watchlist"].includes(status)) {
    return "amber";
  }

  if (["Crypto", "Scan", "Portfolio", "Alternative", "Named Watchlists"].includes(status)) {
    return "purple";
  }

  return "slate";
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2";

const selectClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition focus:ring-2";

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/72 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function SoftCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "red",
}: {
  children: ReactNode;
  tone?: "red" | "green" | "amber" | "slate" | "purple";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full px-3 py-1 text-[11px] font-black ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="truncate text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
          Firm Workspace
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function MetricBubble({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "red" | "green" | "amber" | "slate" | "purple";
}) {
  const glows = {
    red: "from-red-500/18 to-transparent",
    green: "from-emerald-500/18 to-transparent",
    amber: "from-amber-500/18 to-transparent",
    slate: "from-slate-400/10 to-transparent",
    purple: "from-purple-500/18 to-transparent",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b",
          glows[tone]
        )}
      />
      <div className="relative">
        <div className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">
          {value}
        </div>
        {helper ? (
          <div className="mt-1 truncate text-xs font-semibold text-slate-500">
            {helper}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CompactStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/24 p-3">
      <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 truncate text-xl font-black text-white">{value}</div>
      {helper ? (
        <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function ProgressBar({
  value,
  tone = "red",
}: {
  value: number;
  tone?: "red" | "green" | "amber" | "purple";
}) {
  const fills = {
    red: "from-red-700 to-red-400",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    purple: "from-purple-700 to-purple-300",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/50">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r", fills[tone])}
        style={{ width: percent(value) }}
      />
    </div>
  );
}

function ModuleCard({
  title,
  description,
  stats,
  primaryHref,
  primaryLabel,
}: {
  title: string;
  description: string;
  stats?: Array<[string, string | number]>;
  primaryHref?: string;
  primaryLabel?: string;
}) {
  return (
    <Card className="p-5">
      <div className="min-h-[112px]">
        <h2 className="truncate text-xl font-black">{title}</h2>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>

      {stats?.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {stats.map(([label, value]) => (
            <CompactStat key={label} label={label} value={value} />
          ))}
        </div>
      ) : null}

      {primaryHref ? (
        <a
          href={primaryHref}
          className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.01]"
        >
          {primaryLabel ?? "Open"}
        </a>
      ) : null}
    </Card>
  );
}

function ActionBubble({
  title,
  description,
  href,
  buttonLabel,
  tone = "red",
}: {
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  tone?: "red" | "green" | "amber" | "purple";
}) {
  const accents = {
    red: "from-red-600/25",
    green: "from-emerald-600/25",
    amber: "from-amber-600/25",
    purple: "from-purple-600/25",
  };

  return (
    <a
      href={href}
      className="group relative block overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.075]"
    >
      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent",
          accents[tone]
        )}
      />
      <div className="relative">
        <h3 className="truncate text-base font-black text-white">{title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
          {description}
        </p>
        <div className="mt-4 inline-flex rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-950">
          {buttonLabel}
        </div>
      </div>
    </a>
  );
}

function GenericModule({
  eyebrow,
  title,
  description,
  cards,
}: {
  eyebrow: string;
  title: string;
  description: string;
  cards: Array<{
    title: string;
    description: string;
    href?: string;
    button?: string;
    tone?: "red" | "green" | "amber" | "purple";
    stats?: Array<[string, string | number]>;
  }>;
}) {
  return (
    <section className="grid gap-5">
      <Card className="p-5 md:p-6">
        <SectionTitle eyebrow={eyebrow} title={title} description={description} />
      </Card>

      <div className="grid gap-5 xl:grid-cols-3 md:grid-cols-2">
        {cards.map((card) => (
          <ModuleCard
            key={card.title}
            title={card.title}
            description={card.description}
            stats={card.stats}
            primaryHref={card.href}
            primaryLabel={card.button}
          />
        ))}
      </div>
    </section>
  );
}

export default function WorkspacePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [message, setMessage] = useState("");
  const [inviteOutput, setInviteOutput] = useState("");

  const [command, setCommand] = useState<CommandOverview | null>(null);
  const [firmWorkspace, setFirmWorkspace] = useState<FirmWorkspace | null>(null);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [firmSignupForm, setFirmSignupForm] = useState({
    firmName: "",
    firmEmail: "",
    name: "",
    email: "",
    password: "",
  });

  const [inviteSignupForm, setInviteSignupForm] = useState({
    inviteCode: "",
    name: "",
    password: "",
  });

  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "Member",
  });

  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    priority: "Medium",
    dueDate: "",
  });

  const [agendaForm, setAgendaForm] = useState({
    weekStart: weekStartToday(),
    title: "Weekly Agenda",
    focus: "",
    blockers: "",
    task1: "",
    task2: "",
    task3: "",
  });

  const [taskForm, setTaskForm] = useState({
    agendaId: "",
    projectId: "",
    title: "",
    detail: "",
    priority: "Medium",
    dueDate: "",
  });

  const firm = firmWorkspace?.firm ?? null;
  const membership = firmWorkspace?.membership ?? null;
  const members = firmWorkspace?.members ?? [];
  const invites = firmWorkspace?.invites ?? [];
  const projects = firmWorkspace?.projects ?? [];
  const agendas = firmWorkspace?.agendas ?? [];
  const posts = firmWorkspace?.posts ?? [];

  const canManageFirm =
    membership?.role === "Owner" || Boolean(membership?.canManageFirm);

  const canInvite =
    membership?.role === "Owner" ||
    Boolean(membership?.canInviteMembers) ||
    Boolean(membership?.canManageFirm);

  const canManageProjects =
    membership?.role === "Owner" ||
    Boolean(membership?.canManageProjects) ||
    Boolean(membership?.canManageFirm);

  const weekDays = useMemo(() => {
    const start = agendaForm.weekStart || weekStartToday();
    return Array.from({ length: 7 }).map((_, index) => addDays(start, index));
  }, [agendaForm.weekStart]);

  const firmTasks = useMemo(() => {
    return (
      firmWorkspace?.agendas
        .flatMap((agenda) =>
          agenda.tasks.map((task) => ({
            ...task,
            agendaTitle: agenda.title,
            weekStart: agenda.weekStart,
            ownerName: agenda.membership.user?.name ?? "Team member",
            ownerColor: agenda.membership.calendarColor || "#ef4444",
            ownerId: agenda.membership.id,
          }))
        )
        .sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        }) ?? []
    );
  }, [firmWorkspace]);

  const openFirmTasks = useMemo(
    () =>
      firmTasks.filter(
        (task) => task.status !== "Complete" && task.status !== "Done"
      ),
    [firmTasks]
  );

  const completedFirmTasks = useMemo(
    () =>
      firmTasks.filter(
        (task) => task.status === "Complete" || task.status === "Done"
      ),
    [firmTasks]
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, typeof firmTasks>();

    for (const task of firmTasks) {
      if (!task.dueDate) continue;
      const existing = map.get(task.dueDate) ?? [];
      existing.push(task);
      map.set(task.dueDate, existing);
    }

    return map;
  }, [firmTasks]);

  const unscheduledTasks = useMemo(
    () => firmTasks.filter((task) => !task.dueDate),
    [firmTasks]
  );

  const firmGoalProjects = useMemo(() => {
    return projects.filter((project) => {
      const description = project.description ?? "";
      return (
        description.includes("Timeframe:") ||
        ["On Track", "At Risk", "Paused", "Complete"].includes(project.status)
      );
    });
  }, [projects]);

  const calendarCompletionRate = firmTasks.length
    ? (completedFirmTasks.length / firmTasks.length) * 100
    : 0;

  const portfolioModelCount = command?.counts.modelCount ?? 0;
  const portfolioHoldingCount = command?.counts.holdingCount ?? 0;
  const portfolioAccountCount = command?.counts.accountCount ?? 0;
  const portfolioValue = command?.counts.portfolioTotalValue ?? 0;
  const readinessScore = command?.readinessScore ?? 0;

  const tabs: Array<{ id: Tab; label: string; description: string }> = [
    { id: "overview", label: "Overview", description: "Main command center" },
    {
      id: "watchlists",
      label: "Named Watchlists",
      description: "Saved alerts and scan ideas",
    },
    {
      id: "firm-calendar",
      label: "Firm Calendar",
      description: "Weekly and monthly execution",
    },
    {
      id: "team-board",
      label: "Team Board",
      description: "Members, invites, and projects",
    },
    {
      id: "comparison",
      label: "Compare",
      description: "Investment risk/reward comparison",
    },
    {
      id: "alternatives",
      label: "Alternative Investments",
      description: "Crypto, penny stocks, venture",
    },
    {
      id: "clients",
      label: "Clients / Wealth",
      description: "Client and wealth workspace",
    },
    {
      id: "portfolio",
      label: "Portfolio Lab",
      description: "Holdings and allocation work",
    },
    {
      id: "intelligence",
      label: "Intelligence",
      description: "Opportunity and news scanning",
    },
    {
      id: "notifications",
      label: "Notifications",
      description: "Alerts, digests, and delivery",
    },
    {
      id: "briefings",
      label: "Briefings",
      description: "Advisor and client reports",
    },
    {
      id: "security",
      label: "Security",
      description: "Audit, disclosures, governance",
    },
    { id: "system", label: "System", description: "Health and setup tools" },
  ];

  async function loadMe() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await response.json();

      if (data.user) {
        setUser(data.user);
        await Promise.all([loadCommand(), loadFirmWorkspace()]);
      }
    } finally {
      setCheckingSession(false);
    }
  }

  async function loadCommand() {
    const response = await fetch("/api/command/overview", {
      cache: "no-store",
    });

    if (response.ok) {
      setCommand(await response.json());
    }
  }

  async function loadFirmWorkspace(firmId?: string) {
    const query = firmId ? `?firmId=${firmId}` : "";
    const response = await fetch(`/api/firm-workspace${query}`, {
      cache: "no-store",
    });

    if (response.ok) {
      const data = await response.json();
      setFirmWorkspace(data);

      if (data.agendas?.length && !taskForm.agendaId) {
        setTaskForm((current) => ({
          ...current,
          agendaId: data.agendas[0].id,
        }));
      }
    }
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginForm),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Login failed.");
      return;
    }

    setUser(data.user);
    setLoginForm({ email: "", password: "" });
    await Promise.all([loadCommand(), loadFirmWorkspace()]);
  }

  async function submitFirmSignup(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(firmSignupForm),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Firm signup failed.");
      return;
    }

    setUser(data.user);
    setFirmSignupForm({
      firmName: "",
      firmEmail: "",
      name: "",
      email: "",
      password: "",
    });

    await Promise.all([loadCommand(), loadFirmWorkspace()]);
  }

  async function submitInviteSignup(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/auth/invite-register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(inviteSignupForm),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Invite acceptance failed.");
      return;
    }

    setUser(data.user);
    setInviteSignupForm({
      inviteCode: "",
      name: "",
      password: "",
    });

    await Promise.all([loadCommand(), loadFirmWorkspace()]);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setCommand(null);
    setFirmWorkspace(null);
    setActiveTab("overview");
  }

  async function postFirmAction(body: Record<string, unknown>) {
    setMessage("");

    const response = await fetch("/api/firm-workspace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Firm workspace action failed.");
      return null;
    }

    setFirmWorkspace(data);

    if (data.inviteCode || data.inviteLink) {
      setInviteOutput(
        `Invite code: ${data.inviteCode}\nInvite link: ${data.inviteLink}`
      );
    }

    await loadCommand();
    return data;
  }

  async function createInvite(event: FormEvent) {
    event.preventDefault();

    if (!firm) return;

    const data = await postFirmAction({
      action: "createInvite",
      firmId: firm.id,
      ...inviteForm,
    });

    if (data) {
      setInviteForm({ email: "", role: "Member" });
      setMessage(
        "Invite created. The recipient must use this invite to create their login."
      );
    }
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();

    if (!firm) return;

    const data = await postFirmAction({
      action: "createProject",
      firmId: firm.id,
      ...projectForm,
    });

    if (data) {
      setProjectForm({
        title: "",
        description: "",
        priority: "Medium",
        dueDate: "",
      });
      setMessage("Project created.");
    }
  }

  async function createAgenda(event: FormEvent) {
    event.preventDefault();

    if (!firm) return;

    const tasks = [agendaForm.task1, agendaForm.task2, agendaForm.task3]
      .filter((title) => title.trim())
      .map((title) => ({
        title,
        priority: "Medium",
      }));

    const data = await postFirmAction({
      action: "createAgenda",
      firmId: firm.id,
      weekStart: agendaForm.weekStart,
      title: agendaForm.title,
      focus: agendaForm.focus,
      blockers: agendaForm.blockers,
      tasks,
    });

    if (data) {
      setAgendaForm({
        weekStart: weekStartToday(),
        title: "Weekly Agenda",
        focus: "",
        blockers: "",
        task1: "",
        task2: "",
        task3: "",
      });
      setMessage("Weekly agenda posted.");
    }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();

    if (!firm) return;

    const data = await postFirmAction({
      action: "addAgendaTask",
      firmId: firm.id,
      ...taskForm,
      projectId: taskForm.projectId || null,
    });

    if (data) {
      setTaskForm({
        agendaId: data.agendas?.[0]?.id ?? "",
        projectId: "",
        title: "",
        detail: "",
        priority: "Medium",
        dueDate: "",
      });
      setMessage("Task added.");
    }
  }

  async function updateTask(
    taskId: string,
    patch: { status?: string; delayReason?: string; inquiry?: string }
  ) {
    if (!firm) return;

    await postFirmAction({
      action: "updateTask",
      firmId: firm.id,
      taskId,
      ...patch,
    });
  }

  async function updateMember(member: Membership, patch: Partial<Membership>) {
    if (!firm) return;

    await postFirmAction({
      action: "updateMember",
      firmId: firm.id,
      membershipId: member.id,
      ...patch,
    });
  }

  async function removeMember(member: Membership) {
    if (!firm) return;

    await postFirmAction({
      action: "removeMember",
      firmId: firm.id,
      membershipId: member.id,
    });
  }

  async function runPlatformAction(label: string, url: string, body?: unknown) {
    setMessage("");

    const response = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? `${label} failed.`);
      return;
    }

    setMessage(`${label} complete.`);
    await Promise.all([loadCommand(), loadFirmWorkspace()]);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");

    if (invite) {
      setInviteSignupForm((current) => ({ ...current, inviteCode: invite }));
      setAuthMode("invite-signup");
    }

    void loadMe();
  }, []);

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <Logo />
          <div className="mt-8 text-sm font-semibold text-slate-400">
            Loading firm workspace...
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <Logo />

            <div className="mt-8">
              <Pill tone="red">Firm-only signup · Invite-only team access</Pill>
            </div>

            <h1 className="mt-8 max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
              Slice is now a firm workspace first.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">
              Only firms can sign up for the platform. Team members cannot
              self-register; they must be invited by an existing firm owner,
              admin, or approved firm manager.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Pill tone="green">Shared firm workspace</Pill>
              <Pill tone="amber">Invite-only members</Pill>
              <Pill tone="purple">Named watchlists</Pill>
              <Pill tone="red">Portfolio-aware intelligence</Pill>
            </div>
          </div>

          <Card className="p-6">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["login", "Firm Login"],
                ["firm-signup", "Firm Signup"],
                ["invite-signup", "Accept Invite"],
              ].map(([mode, label]) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setAuthMode(mode as AuthMode)}
                  className={cx(
                    "rounded-2xl px-4 py-3 text-sm font-black",
                    authMode === mode
                      ? "bg-red-600 text-white"
                      : "bg-white/5 text-slate-400"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {authMode === "login" ? (
              <form onSubmit={submitLogin} className="mt-6 space-y-4">
                <Pill tone="green">Firm member login</Pill>

                <input
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Firm user email"
                />

                <input
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  type="password"
                  className={inputClass}
                  placeholder="Password"
                />

                <button className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40">
                  Enter Firm Workspace
                </button>
              </form>
            ) : null}

            {authMode === "firm-signup" ? (
              <form onSubmit={submitFirmSignup} className="mt-6 space-y-4">
                <Pill tone="red">Firm owner signup only</Pill>

                <input
                  value={firmSignupForm.firmName}
                  onChange={(event) =>
                    setFirmSignupForm((current) => ({
                      ...current,
                      firmName: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Firm name"
                />

                <input
                  value={firmSignupForm.firmEmail}
                  onChange={(event) =>
                    setFirmSignupForm((current) => ({
                      ...current,
                      firmEmail: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Firm email"
                />

                <input
                  value={firmSignupForm.name}
                  onChange={(event) =>
                    setFirmSignupForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Owner full name"
                />

                <input
                  value={firmSignupForm.email}
                  onChange={(event) =>
                    setFirmSignupForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Owner email"
                />

                <input
                  value={firmSignupForm.password}
                  onChange={(event) =>
                    setFirmSignupForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  type="password"
                  className={inputClass}
                  placeholder="Owner password"
                />

                <button className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40">
                  Create Firm Workspace
                </button>
              </form>
            ) : null}

            {authMode === "invite-signup" ? (
              <form onSubmit={submitInviteSignup} className="mt-6 space-y-4">
                <Pill tone="amber">Invite-only team access</Pill>

                <input
                  value={inviteSignupForm.inviteCode}
                  onChange={(event) =>
                    setInviteSignupForm((current) => ({
                      ...current,
                      inviteCode: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Invite code"
                />

                <input
                  value={inviteSignupForm.name}
                  onChange={(event) =>
                    setInviteSignupForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Full name"
                />

                <input
                  value={inviteSignupForm.password}
                  onChange={(event) =>
                    setInviteSignupForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  type="password"
                  className={inputClass}
                  placeholder="Password"
                />

                <button className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40">
                  Accept Invite & Join Firm
                </button>
              </form>
            ) : null}

            {message ? (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
                {message}
              </div>
            ) : null}
          </Card>
        </section>
      </main>
    );
  }

  if (!firm || !membership) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
        <div className="mx-auto max-w-4xl">
          <Logo />

          <Card className="mt-8 p-6">
            <Pill tone="amber">Firm access required</Pill>
            <h1 className="mt-4 text-3xl font-black">
              This account is not connected to a firm.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Slice requires firm-based access. Ask a firm owner or admin to
              invite you, or log out and create a firm-owner account.
            </p>

            <button
              type="button"
              onClick={logout}
              className="mt-6 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Logout
            </button>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto max-w-[1500px]">
        <header className="sticky top-4 z-40 rounded-[1.75rem] border border-white/10 bg-black/70 p-4 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <Logo />

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <div className="text-[10px] font-black uppercase text-slate-500">
                  Firm
                </div>
                <div className="max-w-[180px] truncate text-sm font-black">
                  {firm.name}
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <div className="text-[10px] font-black uppercase text-slate-500">
                  Member
                </div>
                <div className="max-w-[180px] truncate text-sm font-black">
                  {user.name}
                </div>
              </div>

              <a
                href="/watchlists"
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40"
              >
                Watchlists
              </a>

              <a
                href="/firm-planning"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
              >
                Firm Planning
              </a>

              <button
                type="button"
                onClick={logout}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit rounded-[1.75rem] border border-white/10 bg-black/55 p-4 shadow-xl shadow-red-950/20 backdrop-blur-xl lg:sticky lg:top-32">
            <div className="px-2">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Shared Workspace
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                Firm-wide platform access
              </div>
            </div>

            <div className="mt-5 grid gap-2">
              {tabs.map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cx(
                    "group w-full rounded-2xl border px-4 py-3 text-left transition",
                    activeTab === tab.id
                      ? "border-red-500/40 bg-gradient-to-r from-red-600/95 to-red-950/95 text-white shadow-lg shadow-red-950/35"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black">
                        {tab.label}
                      </div>
                      <div
                        className={cx(
                          "mt-1 truncate text-[11px] font-semibold",
                          activeTab === tab.id
                            ? "text-red-100/80"
                            : "text-slate-500 group-hover:text-slate-400"
                        )}
                      >
                        {tab.description}
                      </div>
                    </div>

                    <span
                      className={cx(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        activeTab === tab.id ? "bg-white" : "bg-red-500/40"
                      )}
                    />
                  </div>
                </button>
              ))}
            </div>

            <SoftCard className="mt-5">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Fast access
              </div>
              <div className="mt-3 grid gap-2">
                <a
                  href="/watchlists"
                  className="rounded-2xl bg-red-600 px-3 py-2 text-center text-xs font-black text-white"
                >
                  Named Watchlists
                </a>
                <a
                  href="/triage"
                  className="rounded-2xl bg-white/10 px-3 py-2 text-center text-xs font-black text-white hover:bg-white/20"
                >
                  Ranked Triage
                </a>
                <a
                  href="/opportunity-radar"
                  className="rounded-2xl bg-white/10 px-3 py-2 text-center text-xs font-black text-white hover:bg-white/20"
                >
                  Opportunity Radar
                </a>
              </div>
            </SoftCard>
          </aside>

          <div className="min-w-0">
            {message ? (
              <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
                {message}
              </div>
            ) : null}

            {activeTab === "overview" ? (
              <section className="grid gap-5">
                <Card className="relative p-5 md:p-6">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-red-600/18 to-transparent" />

                  <div className="relative grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                    <div>
                      <SectionTitle
                        eyebrow="Firm command center"
                        title="One shared workspace for the whole team."
                        description="Slice is organized around the firm. Named watchlists now sit directly in the workspace so advisors can save alerts, scans, stocks, and crypto into watchlists that influence future triage priority."
                      />

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricBubble
                          label="Readiness"
                          value={command?.readinessScore ?? "—"}
                          helper="Platform score"
                          tone="red"
                        />
                        <MetricBubble
                          label="Watchlist"
                          value="Named"
                          helper="Saved alert emphasis"
                          tone="purple"
                        />
                        <MetricBubble
                          label="Portfolio"
                          value={money(portfolioValue)}
                          helper="Tracked value"
                          tone="green"
                        />
                        <MetricBubble
                          label="Open Tasks"
                          value={openFirmTasks.length}
                          helper="Firm execution"
                          tone="amber"
                        />
                      </div>
                    </div>

                    <SoftCard className="flex flex-col justify-between p-5">
                      <div>
                        <Pill tone="purple">Watchlist emphasis</Pill>
                        <h2 className="mt-4 text-2xl font-black">
                          Save what matters.
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          When a stock or crypto alert looks promising, save it
                          into a named watchlist. Future scans put additional
                          emphasis on names in watchlists and the strongest
                          emphasis on actual portfolio holdings.
                        </p>
                      </div>

                      <div className="mt-5 grid gap-3">
                        <a
                          href="/watchlists"
                          className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950"
                        >
                          Open Named Watchlists
                        </a>
                        <a
                          href="/triage"
                          className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/20"
                        >
                          Open Ranked Triage
                        </a>
                      </div>
                    </SoftCard>
                  </div>
                </Card>

                <section className="grid gap-4 xl:grid-cols-5 md:grid-cols-2">
                  <ActionBubble
                    title="Named Watchlists"
                    description="Save alerts and scan results into watchlists that boost future scoring."
                    href="/watchlists"
                    buttonLabel="Open watchlists"
                    tone="red"
                  />
                  <ActionBubble
                    title="Portfolio Lab"
                    description="Holdings, allocation models, scenarios, rebalancing, and portfolio work."
                    href="/portfolio-lab"
                    buttonLabel="Open lab"
                    tone="green"
                  />
                  <ActionBubble
                    title="Firm Calendar"
                    description="Daily tasks, month planning, two-month lookback, and completion celebrations."
                    href="/firm-planning"
                    buttonLabel="Open calendar"
                    tone="purple"
                  />
                  <ActionBubble
                    title="Compare Investments"
                    description="Side-by-side risk/reward analysis for stocks, bonds, ETFs, and funds."
                    href="/investment-comparison"
                    buttonLabel="Compare now"
                    tone="amber"
                  />
                  <ActionBubble
                    title="Opportunity Radar"
                    description="Important headlines, credibility scoring, and AI opportunity briefings."
                    href="/opportunity-radar"
                    buttonLabel="Open radar"
                    tone="red"
                  />
                </section>

                <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                  <Card className="p-5">
                    <SectionTitle
                      eyebrow="Operating pulse"
                      title="Firm execution"
                      description="Compact snapshot of the current firm workload and completion pace."
                    />

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <CompactStat label="Members" value={members.length} />
                      <CompactStat label="Projects" value={projects.length} />
                      <CompactStat
                        label="Completed"
                        value={completedFirmTasks.length}
                      />
                      <CompactStat label="Open" value={openFirmTasks.length} />
                    </div>

                    <div className="mt-5 rounded-3xl border border-white/10 bg-black/30 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                            Task completion
                          </div>
                          <div className="mt-1 text-2xl font-black">
                            {percent(calendarCompletionRate)}
                          </div>
                        </div>
                        <Pill tone="green">Execution</Pill>
                      </div>
                      <div className="mt-4">
                        <ProgressBar value={calendarCompletionRate} tone="green" />
                      </div>
                    </div>
                  </Card>

                  <Card className="p-5">
                    <SectionTitle
                      eyebrow="Advisor dashboard"
                      title="Shared firm modules"
                      description="Every invited team member can access the shared workspace based on role and permissions."
                    />

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <ModuleCard
                        title="Named Watchlists"
                        description="Create watchlists by theme, save alerts and scans, and influence future scan scoring."
                        stats={[
                          ["Mode", "Named"],
                          ["Boost", "Triage"],
                        ]}
                        primaryHref="/watchlists"
                        primaryLabel="Open Watchlists"
                      />

                      <ModuleCard
                        title="Triage Ranking"
                        description="Rank scan results by score, fruit potential, materiality, relevance, and trust."
                        stats={[
                          ["Decisions", command?.counts.retainedDecisionCount ?? 0],
                          ["Runs", command?.counts.triageRunCount ?? 0],
                        ]}
                        primaryHref="/triage"
                        primaryLabel="Open Triage"
                      />

                      <ModuleCard
                        title="Firm Goals"
                        description="Track major firm objectives, timelines, strategic priorities, and linked execution tasks."
                        stats={[
                          ["Goals", firmGoalProjects.length],
                          ["Posts", posts.length],
                        ]}
                        primaryHref="/firm-planning"
                        primaryLabel="Open Goals"
                      />

                      <ModuleCard
                        title="Alternative Investments"
                        description="Monitor crypto markets, penny stocks, and firm-added venture opportunities."
                        stats={[
                          ["Markets", "Crypto / VC"],
                          ["Risk", "High"],
                        ]}
                        primaryHref="/alternative-investments"
                        primaryLabel="Open Alternatives"
                      />
                    </div>
                  </Card>
                </section>
              </section>
            ) : null}

            {activeTab === "watchlists" ? (
              <GenericModule
                eyebrow="Named Watchlists"
                title="Save alerts and scans into user-named watchlists."
                description="Advisors can create watchlists around themes, clients, risk level, conviction, or market segments. Saved stocks and crypto receive additional emphasis in future scan scoring."
                cards={[
                  {
                    title: "Open Watchlists",
                    description:
                      "Create named watchlists and view every saved stock, crypto, alert, and scan.",
                    href: "/watchlists",
                    button: "Open watchlists",
                    stats: [
                      ["Save", "Alerts"],
                      ["Save", "Scans"],
                    ],
                  },
                  {
                    title: "Save From Alerts",
                    description:
                      "Review alerts and save interesting stocks or crypto names into a named watchlist.",
                    href: "/watchlists",
                    button: "Save alerts",
                    stats: [
                      ["Alert capture", "Yes"],
                      ["Ticker prompt", "Yes"],
                    ],
                  },
                  {
                    title: "Algorithm Boost",
                    description:
                      "Future scans now pay more attention to holdings and named watchlist symbols.",
                    href: "/triage",
                    button: "Run triage",
                    stats: [
                      ["Portfolio boost", "Highest"],
                      ["Watchlist boost", "Strong"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "team-board" ? (
              <section className="grid gap-5">
                <Card className="p-5">
                  <SectionTitle
                    eyebrow="Invite-only team access"
                    title="Control who can join the firm workspace."
                    description="Team members cannot create accounts directly. They must be invited by the firm, and the invite creates their membership, permissions, and access path."
                  />
                </Card>

                <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
                  <Card className="p-5">
                    <SectionTitle
                      eyebrow="Team"
                      title="Members"
                      description="Manage firm access and permissions."
                    />

                    <div className="mt-5 space-y-3">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="rounded-3xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-3">
                                <span
                                  className="h-4 w-4 rounded-full"
                                  style={{
                                    backgroundColor: member.calendarColor,
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="truncate font-black">
                                    {member.user?.name ?? "Team member"}
                                  </div>
                                  <div className="truncate text-xs text-slate-500">
                                    {member.user?.email}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <Pill tone="slate">{member.role}</Pill>
                                <Pill tone={toneFor(member.status)}>
                                  {member.status}
                                </Pill>
                              </div>
                            </div>

                            {canManageFirm && member.role !== "Owner" ? (
                              <div className="flex shrink-0 flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void updateMember(member, {
                                      canManageProjects:
                                        !member.canManageProjects,
                                    })
                                  }
                                  className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-slate-200"
                                >
                                  {member.canManageProjects
                                    ? "Remove project access"
                                    : "Project access"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void removeMember(member)}
                                  className="rounded-2xl bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 ring-1 ring-red-500/30"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-5">
                    <SectionTitle
                      eyebrow="Invites"
                      title="Create team-member invite"
                      description="The invite is the only way a new team member can create a Slice login."
                    />

                    {canInvite ? (
                      <form onSubmit={createInvite} className="mt-5 space-y-3">
                        <input
                          value={inviteForm.email}
                          onChange={(event) =>
                            setInviteForm((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="Invitee email"
                        />

                        <select
                          value={inviteForm.role}
                          onChange={(event) =>
                            setInviteForm((current) => ({
                              ...current,
                              role: event.target.value,
                            }))
                          }
                          className={selectClass}
                        >
                          <option>Member</option>
                          <option>Advisor</option>
                          <option>Admin</option>
                          <option>Viewer</option>
                        </select>

                        <button className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950">
                          Create Invite
                        </button>
                      </form>
                    ) : (
                      <div className="mt-5 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm font-bold text-amber-200">
                        You do not have permission to invite members.
                      </div>
                    )}

                    {inviteOutput ? (
                      <pre className="mt-5 max-h-44 overflow-auto whitespace-pre-wrap rounded-3xl border border-white/10 bg-black/40 p-4 text-sm font-bold text-emerald-200">
                        {inviteOutput}
                      </pre>
                    ) : null}

                    {invites.length ? (
                      <div className="mt-5">
                        <h3 className="text-lg font-black">Recent invites</h3>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {invites.slice(0, 6).map((invite) => (
                            <div
                              key={invite.id}
                              className="rounded-2xl border border-white/10 bg-white/5 p-3"
                            >
                              <div className="truncate font-black">
                                {invite.email}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Pill tone="slate">{invite.role}</Pill>
                                <Pill tone={toneFor(invite.status)}>
                                  {invite.status}
                                </Pill>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </Card>
                </section>

                <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
                  <Card className="p-5">
                    <SectionTitle
                      eyebrow="Projects"
                      title="Create project"
                      description="Projects can represent firm goals, client initiatives, research assignments, internal improvements, or investment workstreams."
                    />

                    {canManageProjects ? (
                      <form onSubmit={createProject} className="mt-5 space-y-3">
                        <input
                          value={projectForm.title}
                          onChange={(event) =>
                            setProjectForm((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="Project title"
                        />

                        <textarea
                          value={projectForm.description}
                          onChange={(event) =>
                            setProjectForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          className={cx(inputClass, "min-h-24")}
                          placeholder="Description"
                        />

                        <div className="grid gap-3 md:grid-cols-2">
                          <select
                            value={projectForm.priority}
                            onChange={(event) =>
                              setProjectForm((current) => ({
                                ...current,
                                priority: event.target.value,
                              }))
                            }
                            className={selectClass}
                          >
                            <option>Critical</option>
                            <option>High</option>
                            <option>Medium</option>
                            <option>Low</option>
                          </select>

                          <input
                            type="date"
                            value={projectForm.dueDate}
                            onChange={(event) =>
                              setProjectForm((current) => ({
                                ...current,
                                dueDate: event.target.value,
                              }))
                            }
                            className={inputClass}
                          />
                        </div>

                        <button className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40">
                          Create Project
                        </button>
                      </form>
                    ) : (
                      <div className="mt-5 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm font-bold text-amber-200">
                        You do not have permission to create projects.
                      </div>
                    )}
                  </Card>

                  <Card className="p-5">
                    <SectionTitle
                      eyebrow="Project board"
                      title="Projects and goals"
                      description="Compact project cards with linked task progress."
                    />

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {projects.length ? (
                        projects.map((project) => {
                          const totalTasks = project.agendaTasks?.length ?? 0;
                          const completedTasks =
                            project.agendaTasks?.filter(
                              (task) =>
                                task.status === "Complete" ||
                                task.status === "Done"
                            ).length ?? 0;

                          const completion = totalTasks
                            ? Math.round((completedTasks / totalTasks) * 100)
                            : 0;

                          return (
                            <div
                              key={project.id}
                              className="rounded-3xl border border-white/10 bg-white/5 p-4"
                            >
                              <div className="flex flex-wrap gap-2">
                                <Pill tone={toneFor(project.status)}>
                                  {project.status}
                                </Pill>
                                <Pill tone={toneFor(project.priority)}>
                                  {project.priority}
                                </Pill>
                              </div>

                              <h3 className="mt-3 truncate text-base font-black">
                                {project.title}
                              </h3>

                              {project.description ? (
                                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">
                                  {project.description}
                                </p>
                              ) : null}

                              <div className="mt-4">
                                <div className="mb-2 flex justify-between text-[10px] font-black uppercase text-slate-500">
                                  <span>Progress</span>
                                  <span>{completion}%</span>
                                </div>
                                <ProgressBar value={completion} tone="green" />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-500">
                          No projects yet.
                        </div>
                      )}
                    </div>
                  </Card>
                </section>
              </section>
            ) : null}

            {activeTab === "firm-calendar" ? (
              <section className="grid gap-5">
                <Card className="relative p-5 md:p-6">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-purple-600/15 to-transparent" />
                  <div className="relative">
                    <SectionTitle
                      eyebrow="Firm execution calendar"
                      title="Shared firm execution calendar."
                      description="Every team member sees the same firm workspace. The full monthly calendar handles scheduling, future planning, two-month history, task checkoffs, and celebration animations."
                      action={
                        <a
                          href="/firm-planning"
                          className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
                        >
                          Open Monthly Calendar
                        </a>
                      }
                    />

                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                      <MetricBubble
                        label="Open Tasks"
                        value={openFirmTasks.length}
                        helper="Needs action"
                        tone="amber"
                      />
                      <MetricBubble
                        label="Completed"
                        value={completedFirmTasks.length}
                        helper="Finished"
                        tone="green"
                      />
                      <MetricBubble
                        label="Agendas"
                        value={agendas.length}
                        helper="Weekly plans"
                        tone="purple"
                      />
                      <MetricBubble
                        label="Completion"
                        value={percent(calendarCompletionRate)}
                        helper="All tracked firm tasks"
                        tone="red"
                      />
                    </div>
                  </div>
                </Card>

                <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
                  <Card className="p-5">
                    <SectionTitle
                      eyebrow="Weekly agenda"
                      title="Create focus"
                      description="Add a compact weekly agenda that feeds the firm calendar and execution board."
                    />

                    <form onSubmit={createAgenda} className="mt-5 space-y-3">
                      <input
                        type="date"
                        value={agendaForm.weekStart}
                        onChange={(event) =>
                          setAgendaForm((current) => ({
                            ...current,
                            weekStart: event.target.value,
                          }))
                        }
                        className={inputClass}
                      />

                      <input
                        value={agendaForm.title}
                        onChange={(event) =>
                          setAgendaForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Agenda title"
                      />

                      <textarea
                        value={agendaForm.focus}
                        onChange={(event) =>
                          setAgendaForm((current) => ({
                            ...current,
                            focus: event.target.value,
                          }))
                        }
                        className={cx(inputClass, "min-h-20")}
                        placeholder="Main focus"
                      />

                      <textarea
                        value={agendaForm.blockers}
                        onChange={(event) =>
                          setAgendaForm((current) => ({
                            ...current,
                            blockers: event.target.value,
                          }))
                        }
                        className={cx(inputClass, "min-h-20")}
                        placeholder="Blockers or risks"
                      />

                      <div className="grid gap-2">
                        <input
                          value={agendaForm.task1}
                          onChange={(event) =>
                            setAgendaForm((current) => ({
                              ...current,
                              task1: event.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="Task 1"
                        />

                        <input
                          value={agendaForm.task2}
                          onChange={(event) =>
                            setAgendaForm((current) => ({
                              ...current,
                              task2: event.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="Task 2"
                        />

                        <input
                          value={agendaForm.task3}
                          onChange={(event) =>
                            setAgendaForm((current) => ({
                              ...current,
                              task3: event.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="Task 3"
                        />
                      </div>

                      <button className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950">
                        Post Weekly Agenda
                      </button>
                    </form>
                  </Card>

                  <Card className="p-5">
                    <SectionTitle
                      eyebrow="This week"
                      title="Compact execution board"
                      description="Each day is intentionally contained. Use the monthly calendar for deeper planning and longer task detail."
                    />

                    <div className="mt-5 grid gap-3 md:grid-cols-7">
                      {weekDays.map((day) => {
                        const dayTasks = tasksByDay.get(day) ?? [];

                        return (
                          <div
                            key={day}
                            className="flex min-h-[170px] flex-col rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-[11px] font-black uppercase text-slate-500">
                                  {dayLabel(day)}
                                </div>
                                <div className="mt-1 text-xs font-semibold text-slate-600">
                                  {dayTasks.length} item
                                  {dayTasks.length === 1 ? "" : "s"}
                                </div>
                              </div>
                              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500/70" />
                            </div>

                            <div className="mt-3 grid flex-1 content-start gap-2">
                              {dayTasks.slice(0, 2).map((task) => {
                                const complete =
                                  task.status === "Complete" ||
                                  task.status === "Done";

                                return (
                                  <div
                                    key={task.id}
                                    className={cx(
                                      "overflow-hidden rounded-2xl border p-2",
                                      complete
                                        ? "border-emerald-500/30 bg-emerald-500/10"
                                        : "border-white/10 bg-black/30"
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void updateTask(task.id, {
                                          status: complete ? "Open" : "Complete",
                                        })
                                      }
                                      className={cx(
                                        "mb-1 rounded-full px-2 py-1 text-[10px] font-black",
                                        complete
                                          ? "bg-emerald-400 text-slate-950"
                                          : "bg-white/10 text-slate-300"
                                      )}
                                    >
                                      {complete ? "✓ Done" : "Done"}
                                    </button>
                                    <div
                                      className={cx(
                                        "truncate text-xs font-black",
                                        complete &&
                                          "text-emerald-200 line-through"
                                      )}
                                    >
                                      {task.title}
                                    </div>
                                    <div className="mt-1 truncate text-[10px] font-semibold text-slate-500">
                                      {task.ownerName}
                                    </div>
                                  </div>
                                );
                              })}

                              {dayTasks.length > 2 ? (
                                <div className="rounded-2xl bg-white/5 px-3 py-2 text-[11px] font-black text-slate-500">
                                  +{dayTasks.length - 2} more
                                </div>
                              ) : null}

                              {!dayTasks.length ? (
                                <div className="rounded-2xl border border-dashed border-white/10 p-3 text-xs font-bold text-slate-600">
                                  Clear.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </section>

                <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
                  <Card className="p-5">
                    <SectionTitle
                      eyebrow="Add task"
                      title="Quick task entry"
                      description="For quick weekly capture. Use Firm Planning for day-by-day plus-button entry."
                    />

                    <form onSubmit={addTask} className="mt-5 space-y-3">
                      <select
                        value={taskForm.agendaId}
                        onChange={(event) =>
                          setTaskForm((current) => ({
                            ...current,
                            agendaId: event.target.value,
                          }))
                        }
                        className={selectClass}
                      >
                        <option value="">Select agenda</option>
                        {agendas.map((agenda) => (
                          <option key={agenda.id} value={agenda.id}>
                            {agenda.title} — {shortDate(agenda.weekStart)}
                          </option>
                        ))}
                      </select>

                      <input
                        value={taskForm.title}
                        onChange={(event) =>
                          setTaskForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Task title"
                      />

                      <textarea
                        value={taskForm.detail}
                        onChange={(event) =>
                          setTaskForm((current) => ({
                            ...current,
                            detail: event.target.value,
                          }))
                        }
                        className={cx(inputClass, "min-h-20")}
                        placeholder="Task details"
                      />

                      <div className="grid gap-3 md:grid-cols-3">
                        <select
                          value={taskForm.priority}
                          onChange={(event) =>
                            setTaskForm((current) => ({
                              ...current,
                              priority: event.target.value,
                            }))
                          }
                          className={selectClass}
                        >
                          <option>Critical</option>
                          <option>High</option>
                          <option>Medium</option>
                          <option>Low</option>
                        </select>

                        <input
                          type="date"
                          value={taskForm.dueDate}
                          onChange={(event) =>
                            setTaskForm((current) => ({
                              ...current,
                              dueDate: event.target.value,
                            }))
                          }
                          className={inputClass}
                        />

                        <select
                          value={taskForm.projectId}
                          onChange={(event) =>
                            setTaskForm((current) => ({
                              ...current,
                              projectId: event.target.value,
                            }))
                          }
                          className={selectClass}
                        >
                          <option value="">No project</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40">
                        Add Task
                      </button>
                    </form>
                  </Card>

                  <Card className="p-5">
                    <SectionTitle
                      eyebrow="Outstanding work"
                      title="Unscheduled and upcoming"
                      description="A controlled list that stays inside its panel and avoids oversized task cards."
                    />

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {firmTasks.slice(0, 8).map((task) => {
                        const complete =
                          task.status === "Complete" ||
                          task.status === "Done";

                        return (
                          <div
                            key={task.id}
                            className="rounded-[1.35rem] border border-white/10 bg-white/[0.05] p-4"
                          >
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={toneFor(task.status)}>
                                {task.status}
                              </Pill>
                              <Pill tone={toneFor(task.priority)}>
                                {task.priority}
                              </Pill>
                            </div>

                            <div
                              className={cx(
                                "mt-3 truncate text-sm font-black",
                                complete && "text-emerald-200 line-through"
                              )}
                            >
                              {task.title}
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
                              <span className="truncate">{task.ownerName}</span>
                              <span className="shrink-0">
                                {shortDate(task.dueDate)}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {!firmTasks.length ? (
                        <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-500">
                          No firm tasks yet.
                        </div>
                      ) : null}
                    </div>

                    {unscheduledTasks.length ? (
                      <div className="mt-5 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4">
                        <div className="text-sm font-black text-amber-100">
                          {unscheduledTasks.length} unscheduled task
                          {unscheduledTasks.length === 1 ? "" : "s"}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-amber-200/75">
                          Add due dates in the monthly calendar so they appear
                          on the correct day.
                        </p>
                      </div>
                    ) : null}
                  </Card>
                </section>
              </section>
            ) : null}

            {activeTab === "comparison" ? (
              <GenericModule
                eyebrow="Investment comparison"
                title="Compare any two investments side by side."
                description="Compare stocks, bonds, ETFs, funds, and other options by risk, reward, liquidity, income profile, and holding term."
                cards={[
                  {
                    title: "Investment Comparison",
                    description:
                      "Open the dedicated comparison engine for side-by-side decision support.",
                    href: "/investment-comparison",
                    button: "Open Comparison",
                    stats: [
                      ["Short term", "Liquidity"],
                      ["Long term", "Compounding"],
                    ],
                  },
                  {
                    title: "Risk Profile",
                    description:
                      "Compare volatility, duration, credit risk, liquidity, and downside exposure.",
                    stats: [
                      ["Risk", "Detailed"],
                      ["Use", "Advisor"],
                    ],
                  },
                  {
                    title: "Reward Profile",
                    description:
                      "Compare capital appreciation, yield, defensive value, and compounding potential.",
                    stats: [
                      ["Reward", "Potential"],
                      ["Term", "Selectable"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "alternatives" ? (
              <GenericModule
                eyebrow="Alternative investments"
                title="High-risk markets for less risk-averse strategies."
                description="Monitor crypto markets, penny stocks, and firm-added venture opportunities separately from core portfolio workflows."
                cards={[
                  {
                    title: "Alternative Dashboard",
                    description:
                      "Open the full high-risk investment workspace with crypto, penny stocks, ventures, and risk controls.",
                    href: "/alternative-investments",
                    button: "Open Alternatives",
                    stats: [
                      ["Crypto", "Live"],
                      ["Risk", "High"],
                    ],
                  },
                  {
                    title: "Watchlist Capture",
                    description:
                      "Save interesting stock or crypto alerts into named lists for future scan emphasis.",
                    href: "/watchlists",
                    button: "Open Watchlists",
                    stats: [
                      ["Save", "Alerts"],
                      ["Save", "Scans"],
                    ],
                  },
                  {
                    title: "Venture Monitor",
                    description:
                      "Track only ventures the firm adds, including problem solved, equity offered, and tentative valuation.",
                    href: "/alternative-investments",
                    button: "Open Venture",
                    stats: [
                      ["Scope", "Firm"],
                      ["Data", "Manual"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "clients" ? (
              <GenericModule
                eyebrow="Clients and wealth"
                title="Client, wealth, and briefing workspace."
                description="Manage client profiles, holdings, advisor notes, reports, and client-facing investment briefings."
                cards={[
                  {
                    title: "Clients / Wealth Workspace",
                    description:
                      "Manage clients, holdings, notes, meeting tasks, suitability work, and document tracking.",
                    href: "/wealth",
                    button: "Open Wealth Workspace",
                    stats: [
                      ["Clients", command?.counts.clientCount ?? 0],
                      ["Open Tasks", command?.counts.openTaskCount ?? 0],
                    ],
                  },
                  {
                    title: "Client Briefings",
                    description:
                      "Create advisor and client-facing reports with market context, alerts, and action items.",
                    href: "/briefings",
                    button: "Open Briefings",
                    stats: [["Reports", command?.counts.briefingCount ?? 0]],
                  },
                  {
                    title: "Opportunity Radar",
                    description:
                      "Review source-backed opportunities and AI briefings tied to client or portfolio relevance.",
                    href: "/opportunity-radar",
                    button: "Open Radar",
                    stats: [
                      ["Unread", command?.counts.unreadAlertCount ?? 0],
                      ["Alerts", command?.counts.totalAlertCount ?? 0],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "portfolio" ? (
              <section className="grid gap-5">
                <Card className="relative p-5 md:p-6">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-emerald-600/14 to-transparent" />

                  <div className="relative">
                    <SectionTitle
                      eyebrow="Portfolio lab"
                      title="A premium command surface for portfolio work."
                      description="Use portfolio holdings, allocation models, watchlists, and comparison tools to keep advisor decisions organized."
                      action={
                        <a
                          href="/portfolio-lab"
                          className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
                        >
                          Open Full Lab
                        </a>
                      }
                    />

                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                      <MetricBubble
                        label="Portfolio Value"
                        value={money(portfolioValue)}
                        helper="Tracked value"
                        tone="green"
                      />
                      <MetricBubble
                        label="Accounts"
                        value={portfolioAccountCount}
                        helper="Custody / account view"
                        tone="purple"
                      />
                      <MetricBubble
                        label="Holdings"
                        value={portfolioHoldingCount}
                        helper="Strongest alert boost"
                        tone="red"
                      />
                      <MetricBubble
                        label="Models"
                        value={portfolioModelCount}
                        helper="Allocation targets"
                        tone="amber"
                      />
                    </div>
                  </div>
                </Card>

                <div className="grid gap-5 xl:grid-cols-4 md:grid-cols-2">
                  <ActionBubble
                    title="Portfolio Lab"
                    description="Holdings, accounts, allocation models, rebalancing, and scenario shocks."
                    href="/portfolio-lab"
                    buttonLabel="Open lab"
                    tone="green"
                  />
                  <ActionBubble
                    title="Named Watchlists"
                    description="Watchlist names get triage emphasis; portfolio holdings get the strongest boost."
                    href="/watchlists"
                    buttonLabel="Open watchlists"
                    tone="red"
                  />
                  <ActionBubble
                    title="Investment Comparison"
                    description="Compare stocks, bonds, ETFs, funds, and other investment options."
                    href="/investment-comparison"
                    buttonLabel="Compare"
                    tone="purple"
                  />
                  <ActionBubble
                    title="Opportunity Radar"
                    description="Review source-backed opportunities and AI briefings tied to portfolio relevance."
                    href="/opportunity-radar"
                    buttonLabel="Open radar"
                    tone="amber"
                  />
                </div>
              </section>
            ) : null}

            {activeTab === "intelligence" ? (
              <GenericModule
                eyebrow="Intelligence"
                title="Opportunity scanning and ranked triage."
                description="Review source-backed opportunities, triage scores, noise filters, signal rankings, and saved watchlist ideas."
                cards={[
                  {
                    title: "Opportunity Radar",
                    description:
                      "Review important news, source credibility, AI opportunity briefings, and impact scores.",
                    href: "/opportunity-radar",
                    button: "Open Radar",
                    stats: [
                      ["Unread", command?.counts.unreadAlertCount ?? 0],
                      ["Total", command?.counts.totalAlertCount ?? 0],
                    ],
                  },
                  {
                    title: "Ranked Triage",
                    description:
                      "Rank scans by score, fruit potential, materiality, relevance, and source trust.",
                    href: "/triage",
                    button: "Open Triage",
                    stats: [
                      ["Decisions", command?.counts.retainedDecisionCount ?? 0],
                      ["Runs", command?.counts.triageRunCount ?? 0],
                    ],
                  },
                  {
                    title: "Named Watchlists",
                    description:
                      "Save promising signals into lists that influence future scan relevance.",
                    href: "/watchlists",
                    button: "Open Watchlists",
                    stats: [
                      ["Save", "Alerts"],
                      ["Boost", "Algorithm"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "notifications" ? (
              <GenericModule
                eyebrow="Notifications"
                title="Alerts, digests, and delivery control."
                description="Manage alert delivery, digest records, queues, and future text/email notification behavior."
                cards={[
                  {
                    title: "Notifications",
                    description:
                      "Control delivery rules, simulated alerts, queues, digests, and cooldowns.",
                    href: "/notifications",
                    button: "Open Notifications",
                    stats: [
                      ["Deliveries", command?.counts.deliveryCount ?? 0],
                      ["Digests", command?.counts.digestCount ?? 0],
                    ],
                  },
                  {
                    title: "Opportunity Radar",
                    description:
                      "Review unread alerts and source-backed opportunity briefings.",
                    href: "/opportunity-radar",
                    button: "Open Radar",
                    stats: [
                      ["Unread", command?.counts.unreadAlertCount ?? 0],
                      ["Total", command?.counts.totalAlertCount ?? 0],
                    ],
                  },
                  {
                    title: "Watchlist Capture",
                    description:
                      "Save useful stock or crypto alerts into named watchlists.",
                    href: "/watchlists",
                    button: "Save Alerts",
                    stats: [
                      ["Capture", "Enabled"],
                      ["Boost", "Future scans"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "briefings" ? (
              <GenericModule
                eyebrow="Briefings"
                title="Advisor and client-ready reports."
                description="Create professional reports with sources, risk summaries, market context, alerts, and action items."
                cards={[
                  {
                    title: "Briefings",
                    description:
                      "Create professional briefing reports for advisors and clients.",
                    href: "/briefings",
                    button: "Open Briefings",
                    stats: [["Reports", command?.counts.briefingCount ?? 0]],
                  },
                  {
                    title: "Digest Reports",
                    description:
                      "Review generated digest reports and summarize market, portfolio, and opportunity activity.",
                    href: "/notifications",
                    button: "Open Digests",
                    stats: [["Digests", command?.counts.digestCount ?? 0]],
                  },
                  {
                    title: "Saved Watchlist Ideas",
                    description:
                      "Use saved watchlist items as input for future briefings and advisor review.",
                    href: "/watchlists",
                    button: "Open Watchlists",
                    stats: [
                      ["Ideas", "Saved"],
                      ["Source", "Attached"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "security" ? (
              <GenericModule
                eyebrow="Security"
                title="Governance, audit, and sensitive workflow controls."
                description="Review disclosures, audit logs, security settings, and sensitive platform controls."
                cards={[
                  {
                    title: "Security",
                    description:
                      "Review disclosures, audit logs, advisor security settings, and governance records.",
                    href: "/security",
                    button: "Open Security",
                    stats: [
                      ["Audit Logs", command?.counts.auditLogCount ?? 0],
                      [
                        "Disclosures",
                        `${command?.counts.acceptedDisclosures ?? 0}/${
                          command?.counts.requiredDisclosures ?? 0
                        }`,
                      ],
                    ],
                  },
                  {
                    title: "Founder Governance",
                    description:
                      "Founder-level governance is available from the founder portal.",
                    href: "/founder-login",
                    button: "Founder Login",
                    stats: [
                      ["Access", "Founder"],
                      ["Control", "Governance"],
                    ],
                  },
                  {
                    title: "Firm Access",
                    description:
                      "Team members can only join the firm workspace through firm invites.",
                    stats: [
                      ["Signup", "Firm-only"],
                      ["Members", "Invite-only"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "system" ? (
              <section className="grid gap-5 lg:grid-cols-2">
                <Card className="p-5">
                  <SectionTitle
                    eyebrow="System readiness"
                    title="Platform health and controls"
                    description="Use the system area for readiness checks, seed data, resets, and operational status."
                  />

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <a
                      href="/system"
                      className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950"
                    >
                      Open System
                    </a>

                    <button
                      type="button"
                      onClick={() =>
                        void runPlatformAction(
                          "Seed demo data",
                          "/api/system/seed"
                        )
                      }
                      className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
                    >
                      Seed Demo Data
                    </button>
                  </div>
                </Card>

                <Card className="p-5">
                  <SectionTitle
                    eyebrow="Counts"
                    title="System snapshot"
                    description="Compact operating metrics for the current workspace."
                  />

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <MetricBubble
                      label="Readiness"
                      value={command?.counts ? readinessScore : "—"}
                      helper="Current score"
                      tone="red"
                    />
                    <MetricBubble
                      label="Firm Count"
                      value={command?.counts.firmCount ?? 0}
                      helper="Memberships"
                      tone="purple"
                    />
                    <MetricBubble
                      label="Owned Firms"
                      value={command?.counts.ownedFirmCount ?? 0}
                      helper="Created by you"
                      tone="green"
                    />
                    <MetricBubble
                      label="Firm Posts"
                      value={command?.counts.firmPostCount ?? 0}
                      helper="Internal updates"
                      tone="amber"
                    />
                  </div>
                </Card>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}