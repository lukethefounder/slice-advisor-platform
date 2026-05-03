"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";

type User = {
  id: string;
  name: string;
  email: string;
};

type Tab =
  | "overview"
  | "firm-calendar"
  | "team-board"
  | "clients"
  | "portfolio"
  | "intelligence"
  | "notifications"
  | "briefings"
  | "security"
  | "system";

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
  assignments?: Array<{
    id: string;
    projectRole: string;
    membership: Membership;
  }>;
  agendaTasks?: Array<{
    id: string;
    status: string;
  }>;
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

function statusTone(status: string): "red" | "green" | "amber" | "slate" {
  if (
    ["Complete", "Done", "Delivered", "Accepted", "Ready", "Active"].includes(
      status
    )
  ) {
    return "green";
  }

  if (
    ["Delayed", "Blocked", "Removed", "Critical", "Suppressed"].includes(status)
  ) {
    return "red";
  }

  if (["Open", "Pending", "Queued", "High", "Needs Review"].includes(status)) {
    return "amber";
  }

  return "slate";
}

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
        "rounded-[2rem] border border-white/10 bg-zinc-950/70 shadow-xl shadow-red-950/20 backdrop-blur-xl",
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
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
          Advisor Platform
        </div>
      </div>
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
    <Card className="p-6">
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>

      {stats?.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {stats.map(([label, value]) => (
            <div
              key={label}
              className="rounded-3xl border border-white/10 bg-white/5 p-4"
            >
              <div className="text-xs font-black uppercase text-slate-500">
                {label}
              </div>
              <div className="mt-1 text-2xl font-black">{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {primaryHref ? (
        <a
          href={primaryHref}
          className="mt-5 inline-flex rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
        >
          {primaryLabel ?? "Open"}
        </a>
      ) : null}
    </Card>
  );
}

export default function WorkspacePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [message, setMessage] = useState("");
  const [inviteOutput, setInviteOutput] = useState("");

  const [command, setCommand] = useState<CommandOverview | null>(null);
  const [firmWorkspace, setFirmWorkspace] = useState<FirmWorkspace | null>(null);

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [firmForm, setFirmForm] = useState({
    name: "",
    firmEmail: "",
  });

  const [joinForm, setJoinForm] = useState({
    inviteCode: "",
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

  const firm = firmWorkspace?.firm;
  const membership = firmWorkspace?.membership;

  const canManageFirm =
    membership?.role === "Owner" || membership?.canManageFirm;
  const canInvite =
    membership?.role === "Owner" ||
    membership?.canInviteMembers ||
    membership?.canManageFirm;
  const canManageProjects =
    membership?.role === "Owner" ||
    membership?.canManageProjects ||
    membership?.canManageFirm;

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

  const unscheduledTasks = useMemo(() => {
    return firmTasks.filter((task) => !task.dueDate);
  }, [firmTasks]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "firm-calendar", label: "Firm Calendar" },
    { id: "team-board", label: "Team Board" },
    { id: "clients", label: "Clients / Wealth" },
    { id: "portfolio", label: "Portfolio Lab" },
    { id: "intelligence", label: "Intelligence" },
    { id: "notifications", label: "Notifications" },
    { id: "briefings", label: "Briefings" },
    { id: "security", label: "Security" },
    { id: "system", label: "System" },
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
      setFirmWorkspace(await response.json());
    }
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    const endpoint =
      authMode === "register" ? "/api/auth/register" : "/api/auth/login";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(authForm),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Authentication failed.");
      return;
    }

    setUser(data.user);
    setAuthForm({ name: "", email: "", password: "" });
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

  async function createFirm(event: FormEvent) {
    event.preventDefault();

    const data = await postFirmAction({
      action: "createFirm",
      ...firmForm,
    });

    if (data) {
      setFirmForm({ name: "", firmEmail: "" });
      setMessage("Firm workspace created.");
    }
  }

  async function acceptInvite(event: FormEvent) {
    event.preventDefault();

    const data = await postFirmAction({
      action: "acceptInvite",
      inviteCode: joinForm.inviteCode,
    });

    if (data) {
      setJoinForm({ inviteCode: "" });
      setMessage("Invite accepted.");
    }
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
      setMessage("Invite created.");
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
        agendaId: "",
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
    patch: {
      status?: string;
      delayReason?: string;
      inquiry?: string;
    }
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
      headers: body
        ? {
            "Content-Type": "application/json",
          }
        : undefined,
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
      setJoinForm({ inviteCode: invite });
      setActiveTab("team-board");
    }

    void loadMe();
  }, []);

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <Logo />
          <div className="mt-8 text-sm font-semibold text-slate-400">
            Loading advisor platform...
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
              <Pill tone="red">Advisor and wealth manager access only</Pill>
            </div>

            <h1 className="mt-8 text-5xl font-black leading-tight tracking-tight md:text-7xl">
              One platform. One login. Advisor-only control.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Slice is not an investor-facing login portal. It is a singular
              advisor and wealth-manager platform where authorized firm members
              manage clients, portfolios, intelligence, reports, calendars,
              projects, audit logs, and security from one workspace.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Pill tone="green">Firm calendar</Pill>
              <Pill tone="amber">Portfolio lab</Pill>
              <Pill tone="purple">Client intelligence</Pill>
              <Pill tone="red">Security and audit</Pill>
            </div>
          </div>

          <Card className="p-6">
            <div className="flex gap-3">
              <button
                onClick={() => setAuthMode("login")}
                className={cx(
                  "flex-1 rounded-2xl px-4 py-3 font-black",
                  authMode === "login"
                    ? "bg-red-600 text-white"
                    : "bg-white/5 text-slate-400"
                )}
              >
                Login
              </button>

              <button
                onClick={() => setAuthMode("register")}
                className={cx(
                  "flex-1 rounded-2xl px-4 py-3 font-black",
                  authMode === "register"
                    ? "bg-red-600 text-white"
                    : "bg-white/5 text-slate-400"
                )}
              >
                Register Advisor
              </button>
            </div>

            <form onSubmit={submitAuth} className="mt-6 space-y-4">
              {authMode === "register" ? (
                <input
                  value={authForm.name}
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                  placeholder="Full name"
                />
              ) : null}

              <input
                value={authForm.email}
                onChange={(event) =>
                  setAuthForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Advisor / firm email"
              />

              <input
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                type="password"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Password"
              />

              <button className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-4 font-black text-white shadow-lg shadow-red-950/40">
                {authMode === "register"
                  ? "Create Advisor Account"
                  : "Enter Advisor Platform"}
              </button>

              {message ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
                  {message}
                </div>
              ) : null}
            </form>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="sticky top-4 z-40 rounded-[2rem] border border-white/10 bg-black/70 p-4 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <Logo />

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <div className="text-xs font-black uppercase text-slate-500">
                  Advisor
                </div>
                <div className="font-black">{user.name}</div>
              </div>

              {firm ? (
                <div className="rounded-2xl bg-white/5 px-4 py-3">
                  <div className="text-xs font-black uppercase text-slate-500">
                    Firm
                  </div>
                  <div className="font-black">{firm.name}</div>
                </div>
              ) : null}

              <button
                onClick={logout}
                className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cx(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-black transition",
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-red-600 to-red-950 text-white shadow-lg shadow-red-950/40"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        {activeTab === "overview" ? (
          <section className="mt-6 grid gap-6">
            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="p-6">
                <Pill>Advisor-only operating system</Pill>
                <h1 className="mt-4 text-5xl font-black tracking-tight">
                  Everything lives inside this one platform.
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
                  Investors do not access this system. Advisors, wealth managers,
                  and authorized firm team members use this single workspace to
                  manage client intelligence, calendars, projects, portfolios,
                  reports, notifications, and compliance.
                </p>

                <div className="mt-8 grid gap-4 md:grid-cols-4">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm text-slate-400">Readiness</div>
                    <div className="mt-1 text-4xl font-black">
                      {command?.readinessScore ?? "—"}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm text-slate-400">Portfolio</div>
                    <div className="mt-1 text-3xl font-black">
                      {money(command?.counts.portfolioTotalValue ?? 0)}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm text-slate-400">Clients</div>
                    <div className="mt-1 text-4xl font-black">
                      {command?.counts.clientCount ?? 0}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm text-slate-400">Firm Tasks</div>
                    <div className="mt-1 text-4xl font-black">
                      {firmTasks.length}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="text-2xl font-black">Quick Actions</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Run platform workflows without leaving this platform shell.
                </p>

                <div className="mt-5 grid gap-3">
                  <button
                    onClick={() =>
                      runPlatformAction(
                        "Advisor Pulse",
                        "/api/intelligence/pulse?demo=1"
                      )
                    }
                    className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 text-left font-black text-white"
                  >
                    Run Advisor Pulse
                  </button>

                  <button
                    onClick={() =>
                      runPlatformAction(
                        "Run Demo Triage",
                        "/api/intelligence/triage/run?demo=1"
                      )
                    }
                    className="rounded-2xl bg-red-500/10 px-4 py-3 text-left font-black text-red-300 ring-1 ring-red-500/30"
                  >
                    Run Demo Triage
                  </button>

                  <button
                    onClick={() =>
                      runPlatformAction("Queue Notifications", "/api/notifications", {
                        action: "queue",
                      })
                    }
                    className="rounded-2xl bg-amber-500/10 px-4 py-3 text-left font-black text-amber-300 ring-1 ring-amber-500/30"
                  >
                    Queue Notifications
                  </button>

                  <button
                    onClick={() =>
                      runPlatformAction("Generate Briefing", "/api/briefings", {
                        audience: "Advisor",
                        briefType: "Daily",
                      })
                    }
                    className="rounded-2xl bg-purple-500/10 px-4 py-3 text-left font-black text-purple-300 ring-1 ring-purple-500/30"
                  >
                    Generate Advisor Briefing
                  </button>

                  <button
                    onClick={() =>
                      runPlatformAction("Security Review", "/api/security/review")
                    }
                    className="rounded-2xl bg-white/10 px-4 py-3 text-left font-black text-white ring-1 ring-white/10"
                  >
                    Run Security Review
                  </button>
                </div>
              </Card>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <ModuleCard
                title="Advisor Live Feed"
                description="The consolidated feed of source-backed opportunity signals, AI-style briefings, alerts, credibility scores, and portfolio impact."
                stats={[
                  ["Source-backed", "Yes"],
                  ["Pulse", "Live / Demo"],
                ]}
                primaryHref="/opportunity-radar"
                primaryLabel="Open Live Feed"
              />

              <ModuleCard
                title="Command Center"
                description="A direct operating console for system actions, readiness, source health, alerts, briefings, audit logs, and recent activity."
                stats={[
                  ["Readiness", `${command?.readinessScore ?? "—"}/100`],
                  ["Alerts", command?.counts.totalAlertCount ?? 0],
                  ["Briefings", command?.counts.briefingCount ?? 0],
                  ["Audit Logs", command?.counts.auditLogCount ?? 0],
                ]}
                primaryHref="/command"
                primaryLabel="Open Command Center"
              />
            </section>
          </section>
        ) : null}

        {activeTab === "firm-calendar" ? (
          <section className="mt-6 grid gap-6">
            <Card className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Pill>Calendar Board</Pill>
                  <h1 className="mt-4 text-4xl font-black">
                    Weekly Firm Calendar
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                    Every team member has a color. Tasks appear in a
                    calendar-like format by due date, with checkboxes, delays,
                    inquiries, and project labels.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {firmWorkspace?.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-xs font-black ring-1 ring-white/10"
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ background: member.calendarColor }}
                      />
                      {member.user?.name ?? "Member"}
                    </div>
                  ))}
                </div>
              </div>

              {!firm ? (
                <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
                  Create or join a firm in the Team Board tab to use the calendar.
                </div>
              ) : (
                <>
                  <div className="mt-6 grid gap-4 lg:grid-cols-7">
                    {weekDays.map((day) => {
                      const tasksForDay = firmTasks.filter(
                        (task) => task.dueDate === day
                      );

                      return (
                        <div
                          key={day}
                          className="min-h-72 rounded-3xl border border-white/10 bg-black/30 p-4"
                        >
                          <div className="mb-4 border-b border-white/10 pb-3">
                            <div className="font-black">{dayLabel(day)}</div>
                            <div className="text-xs text-slate-500">{day}</div>
                          </div>

                          <div className="space-y-3">
                            {tasksForDay.length ? (
                              tasksForDay.map((task) => (
                                <div
                                  key={task.id}
                                  className="rounded-2xl border border-white/10 bg-white/5 p-3"
                                  style={{
                                    borderLeft: `5px solid ${task.ownerColor}`,
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="text-sm font-black">
                                        {task.title}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-400">
                                        {task.ownerName}
                                      </div>
                                    </div>

                                    <input
                                      type="checkbox"
                                      checked={task.status === "Complete"}
                                      onChange={() =>
                                        updateTask(task.id, {
                                          status:
                                            task.status === "Complete"
                                              ? "Open"
                                              : "Complete",
                                        })
                                      }
                                      className="h-5 w-5 accent-red-600"
                                    />
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-1">
                                    <Pill tone={statusTone(task.status)}>
                                      {task.status}
                                    </Pill>
                                    <Pill tone="amber">{task.priority}</Pill>
                                  </div>

                                  {task.project ? (
                                    <div className="mt-2 text-xs text-red-300">
                                      {task.project.title}
                                    </div>
                                  ) : null}

                                  {task.delayReason ? (
                                    <div className="mt-2 text-xs text-amber-300">
                                      Delay: {task.delayReason}
                                    </div>
                                  ) : null}

                                  {task.inquiry ? (
                                    <div className="mt-2 text-xs text-purple-300">
                                      Inquiry: {task.inquiry}
                                    </div>
                                  ) : null}

                                  <div className="mt-3 flex gap-2">
                                    <button
                                      onClick={() =>
                                        updateTask(task.id, {
                                          status: "Delayed",
                                          delayReason:
                                            window.prompt("Delay reason?") ||
                                            "Delayed without details.",
                                        })
                                      }
                                      className="rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-black text-amber-300 ring-1 ring-amber-500/30"
                                    >
                                      Delay
                                    </button>

                                    <button
                                      onClick={() =>
                                        updateTask(task.id, {
                                          inquiry:
                                            window.prompt("Inquiry/question?") ||
                                            "Inquiry added without details.",
                                        })
                                      }
                                      className="rounded-lg bg-purple-500/10 px-2 py-1 text-xs font-black text-purple-300 ring-1 ring-purple-500/30"
                                    >
                                      Inquiry
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-xs text-slate-500">
                                No tasks
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {unscheduledTasks.length ? (
                    <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
                      <h2 className="text-xl font-black">Unscheduled Tasks</h2>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {unscheduledTasks.map((task) => (
                          <div
                            key={task.id}
                            className="rounded-2xl border border-white/10 bg-black/30 p-4"
                            style={{
                              borderLeft: `5px solid ${task.ownerColor}`,
                            }}
                          >
                            <div className="font-black">{task.title}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              {task.ownerName}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Pill tone={statusTone(task.status)}>
                                {task.status}
                              </Pill>
                              <Pill tone="amber">{task.priority}</Pill>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </Card>

            {firm ? (
              <Card className="p-6">
                <h2 className="text-2xl font-black">Post Weekly Agenda</h2>

                <form
                  onSubmit={createAgenda}
                  className="mt-5 grid gap-3 lg:grid-cols-3"
                >
                  <input
                    type="date"
                    value={agendaForm.weekStart}
                    onChange={(event) =>
                      setAgendaForm((current) => ({
                        ...current,
                        weekStart: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                  />

                  <input
                    value={agendaForm.title}
                    onChange={(event) =>
                      setAgendaForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Agenda title"
                  />

                  <input
                    value={agendaForm.focus}
                    onChange={(event) =>
                      setAgendaForm((current) => ({
                        ...current,
                        focus: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Weekly focus"
                  />

                  <input
                    value={agendaForm.task1}
                    onChange={(event) =>
                      setAgendaForm((current) => ({
                        ...current,
                        task1: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
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
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
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
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Task 3"
                  />

                  <textarea
                    value={agendaForm.blockers}
                    onChange={(event) =>
                      setAgendaForm((current) => ({
                        ...current,
                        blockers: event.target.value,
                      }))
                    }
                    className="min-h-20 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2 lg:col-span-2"
                    placeholder="Blockers or delays"
                  />

                  <button className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 font-black text-white">
                    Post Agenda
                  </button>
                </form>
              </Card>
            ) : null}
          </section>
        ) : null}

        {activeTab === "team-board" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-2xl font-black">Firm Access</h2>

                <form onSubmit={createFirm} className="mt-5 space-y-3">
                  <input
                    value={firmForm.name}
                    onChange={(event) =>
                      setFirmForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Firm name"
                  />

                  <input
                    value={firmForm.firmEmail}
                    onChange={(event) =>
                      setFirmForm((current) => ({
                        ...current,
                        firmEmail: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Firm email"
                  />

                  <button className="w-full rounded-2xl bg-red-600 px-5 py-3 font-black text-white">
                    Create Firm
                  </button>
                </form>

                <form onSubmit={acceptInvite} className="mt-5 space-y-3">
                  <input
                    value={joinForm.inviteCode}
                    onChange={(event) =>
                      setJoinForm({ inviteCode: event.target.value })
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold uppercase text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Invite code"
                  />

                  <button className="w-full rounded-2xl bg-white px-5 py-3 font-black text-slate-950">
                    Accept Invite
                  </button>
                </form>
              </Card>

              {firm && canInvite ? (
                <Card className="p-6">
                  <h2 className="text-2xl font-black">Invite Members</h2>

                  <form onSubmit={createInvite} className="mt-5 space-y-3">
                    <input
                      value={inviteForm.email}
                      onChange={(event) =>
                        setInviteForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                      placeholder="Team member email"
                    />

                    <select
                      value={inviteForm.role}
                      onChange={(event) =>
                        setInviteForm((current) => ({
                          ...current,
                          role: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                    >
                      <option>Member</option>
                      <option>Advisor</option>
                      <option>Admin</option>
                      <option>Viewer</option>
                    </select>

                    <button className="w-full rounded-2xl bg-red-600 px-5 py-3 font-black text-white">
                      Create Invite
                    </button>
                  </form>

                  {inviteOutput ? (
                    <textarea
                      value={inviteOutput}
                      readOnly
                      className="mt-4 min-h-24 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-red-200 outline-none"
                    />
                  ) : null}
                </Card>
              ) : null}

              {firm && canManageProjects ? (
                <Card className="p-6">
                  <h2 className="text-2xl font-black">Create Project</h2>

                  <form onSubmit={createProject} className="mt-5 space-y-3">
                    <input
                      value={projectForm.title}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
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
                      className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                      placeholder="Description"
                    />

                    <button className="w-full rounded-2xl bg-red-600 px-5 py-3 font-black text-white">
                      Create Project
                    </button>
                  </form>
                </Card>
              ) : null}
            </div>

            <div className="space-y-6">
              <Card className="p-6">
                <h1 className="text-3xl font-black">
                  {firm ? firm.name : "No Firm Selected"}
                </h1>

                {firm ? (
                  <p className="mt-2 text-sm text-slate-400">
                    {firm.firmCode} · role: {membership?.role}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">
                    Create a firm or join one with an invite code.
                  </p>
                )}
              </Card>

              {firm ? (
                <>
                  <Card className="p-6">
                    <h2 className="text-2xl font-black">Members</h2>

                    <div className="mt-5 space-y-3">
                      {firmWorkspace?.members.map((member) => (
                        <div
                          key={member.id}
                          className="rounded-3xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap gap-2">
                                <span
                                  className="h-4 w-4 rounded-full"
                                  style={{ background: member.calendarColor }}
                                />
                                <Pill tone={statusTone(member.status)}>
                                  {member.status}
                                </Pill>
                                <Pill tone="red">{member.role}</Pill>
                              </div>

                              <div className="mt-3 font-black">
                                {member.user?.name}
                              </div>
                              <div className="text-sm text-slate-400">
                                {member.user?.email}
                              </div>
                            </div>

                            {canManageFirm && member.role !== "Owner" ? (
                              <div className="flex flex-wrap gap-2">
                                <input
                                  type="color"
                                  value={member.calendarColor}
                                  onChange={(event) =>
                                    updateMember(member, {
                                      calendarColor: event.target.value,
                                    })
                                  }
                                  className="h-10 w-12 rounded-xl border border-white/10 bg-black"
                                />

                                <button
                                  onClick={() =>
                                    updateMember(member, {
                                      canAccessPortfolios:
                                        !member.canAccessPortfolios,
                                    })
                                  }
                                  className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white"
                                >
                                  Portfolios:{" "}
                                  {member.canAccessPortfolios ? "On" : "Off"}
                                </button>

                                <button
                                  onClick={() => removeMember(member)}
                                  className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 ring-1 ring-red-500/30"
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

                  <Card className="p-6">
                    <h2 className="text-2xl font-black">Projects</h2>

                    <div className="mt-5 space-y-3">
                      {firmWorkspace?.projects.length ? (
                        firmWorkspace.projects.map((project) => (
                          <div
                            key={project.id}
                            className="rounded-3xl border border-white/10 bg-white/5 p-5"
                          >
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={statusTone(project.status)}>
                                {project.status}
                              </Pill>
                              <Pill tone="amber">{project.priority}</Pill>
                            </div>

                            <div className="mt-3 text-xl font-black">
                              {project.title}
                            </div>

                            {project.description ? (
                              <p className="mt-2 text-sm text-slate-400">
                                {project.description}
                              </p>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
                          No projects yet.
                        </div>
                      )}
                    </div>
                  </Card>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === "clients" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <ModuleCard
              title="Clients / Wealth Workspace"
              description="Manage advisor-side client records, holdings, meeting notes, tasks, and risk reviews. Clients do not log into Slice directly."
              stats={[
                ["Clients", command?.counts.clientCount ?? 0],
                ["Open Tasks", command?.counts.openTaskCount ?? 0],
              ]}
              primaryHref="/wealth"
              primaryLabel="Open Wealth Tools"
            />

            <ModuleCard
              title="Client Intelligence"
              description="Former investor-facing concepts are now advisor-managed client intelligence records: goals, research, alerts, and portfolio insights."
              stats={[
                ["Goals", command?.counts.goalCount ?? 0],
                ["Research Notes", command?.counts.researchCount ?? 0],
                ["Unread Alerts", command?.counts.unreadAlertCount ?? 0],
                ["Total Alerts", command?.counts.totalAlertCount ?? 0],
              ]}
              primaryHref="/investor"
              primaryLabel="Open Client Intelligence"
            />
          </section>
        ) : null}

        {activeTab === "portfolio" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <ModuleCard
              title="Portfolio Lab"
              description="Manual holdings, accounts, allocation models, rebalancing, and scenario testing."
              stats={[
                ["Portfolio Value", money(command?.counts.portfolioTotalValue ?? 0)],
                ["Accounts", command?.counts.accountCount ?? 0],
                ["Holdings", command?.counts.holdingCount ?? 0],
                ["Models", command?.counts.modelCount ?? 0],
              ]}
              primaryHref="/portfolio-lab"
              primaryLabel="Open Portfolio Lab"
            />

            <ModuleCard
              title="Private Alternatives"
              description="Track private ventures, crypto exposure, and higher-risk opportunities separately from core portfolio decisions."
              stats={[
                ["Private Ventures", command?.counts.ventureCount ?? 0],
                ["Watchlist Assets", command?.counts.watchlistCount ?? 0],
              ]}
              primaryHref="/investor"
              primaryLabel="Open Alternative Records"
            />
          </section>
        ) : null}

        {activeTab === "intelligence" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <ModuleCard
              title="Advisor Live Feed"
              description="The consolidated feed of source-backed opportunity signals, AI-style briefings, alerts, credibility scores, and portfolio impact."
              stats={[
                ["Source-backed", "Yes"],
                ["Pulse", "Live / Demo"],
              ]}
              primaryHref="/opportunity-radar"
              primaryLabel="Open Live Feed"
            />

            <ModuleCard
              title="Opportunity Radar"
              description="Portfolio-first opportunity and risk signals generated from retained news, headlines, client holdings, firm holdings, watchlists, and research notes."
              stats={[
                ["Focus", "Portfolio-first"],
                ["Type", "Opportunity / Risk"],
              ]}
              primaryHref="/opportunity-radar"
              primaryLabel="Open Opportunity Radar"
            />

            <ModuleCard
              title="Intelligence Triage"
              description="Headline scoring, source controls, retained decisions, and free-source scanner foundation."
              stats={[
                ["Triage Runs", command?.counts.triageRunCount ?? 0],
                ["Retained Decisions", command?.counts.retainedDecisionCount ?? 0],
              ]}
              primaryHref="/triage"
              primaryLabel="Open Triage"
            />

            <ModuleCard
              title="Source Settings"
              description="Control thresholds, source quality, cleanup, and retention limits so the database stays efficient."
              stats={[
                ["Audit Logs", command?.counts.auditLogCount ?? 0],
                ["Deliveries", command?.counts.deliveryCount ?? 0],
              ]}
              primaryHref="/intelligence-settings"
              primaryLabel="Open Source Controls"
            />

            <Card className="p-6 lg:col-span-2">
              <h2 className="text-2xl font-black">Intelligence Actions</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Run a full pulse to scan, rank, brief, and queue important
                portfolio-centered intelligence.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <button
                  onClick={() =>
                    runPlatformAction(
                      "Advisor Pulse",
                      "/api/intelligence/pulse?demo=1"
                    )
                  }
                  className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 text-left font-black text-white"
                >
                  Run Advisor Pulse
                </button>

                <button
                  onClick={() =>
                    runPlatformAction(
                      "Run Live Triage",
                      "/api/intelligence/triage/run"
                    )
                  }
                  className="rounded-2xl bg-red-500/10 px-4 py-3 text-left font-black text-red-300 ring-1 ring-red-500/30"
                >
                  Run Live Triage
                </button>

                <button
                  onClick={() =>
                    runPlatformAction("Generate Opportunities", "/api/opportunities", {
                      action: "generate",
                    })
                  }
                  className="rounded-2xl bg-purple-500/10 px-4 py-3 text-left font-black text-purple-300 ring-1 ring-purple-500/30"
                >
                  Generate Opportunity Signals
                </button>
              </div>
            </Card>
          </section>
        ) : null}

        {activeTab === "notifications" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <ModuleCard
              title="Notification Center"
              description="Queue, suppress, digest, and simulate alert delivery before email/SMS variables are connected."
              stats={[
                ["Deliveries", command?.counts.deliveryCount ?? 0],
                ["Digests", command?.counts.digestCount ?? 0],
              ]}
              primaryHref="/notifications"
              primaryLabel="Open Notifications"
            />

            <Card className="p-6">
              <h2 className="text-2xl font-black">Notification Actions</h2>
              <div className="mt-5 grid gap-3">
                <button
                  onClick={() =>
                    runPlatformAction("Queue Notifications", "/api/notifications", {
                      action: "queue",
                    })
                  }
                  className="rounded-2xl bg-amber-500/10 px-4 py-3 text-left font-black text-amber-300 ring-1 ring-amber-500/30"
                >
                  Queue Notifications
                </button>

                <button
                  onClick={() =>
                    runPlatformAction("Process Queue", "/api/notifications", {
                      action: "process",
                    })
                  }
                  className="rounded-2xl bg-green-500/10 px-4 py-3 text-left font-black text-green-300 ring-1 ring-green-500/30"
                >
                  Process Queue
                </button>

                <button
                  onClick={() =>
                    runPlatformAction("Generate Digest", "/api/notifications", {
                      action: "digest",
                    })
                  }
                  className="rounded-2xl bg-purple-500/10 px-4 py-3 text-left font-black text-purple-300 ring-1 ring-purple-500/30"
                >
                  Generate Digest
                </button>
              </div>
            </Card>
          </section>
        ) : null}

        {activeTab === "briefings" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <ModuleCard
              title="Briefing Center"
              description="Generate advisor/client-ready reports from alerts, research, portfolios, goals, risk reviews, and triage decisions."
              stats={[
                ["Briefings", command?.counts.briefingCount ?? 0],
                ["Client Records", command?.counts.clientCount ?? 0],
              ]}
              primaryHref="/briefings"
              primaryLabel="Open Briefings"
            />

            <Card className="p-6">
              <h2 className="text-2xl font-black">Generate Advisor Brief</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Create a daily advisor briefing from stored platform data.
              </p>
              <button
                onClick={() =>
                  runPlatformAction("Generate Advisor Briefing", "/api/briefings", {
                    audience: "Advisor",
                    briefType: "Daily",
                  })
                }
                className="mt-5 rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 font-black text-white"
              >
                Generate Briefing
              </button>
            </Card>
          </section>
        ) : null}

        {activeTab === "security" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <ModuleCard
              title="Security + Audit"
              description="Disclosures, audit logs, security review, and governance settings for the advisor platform."
              stats={[
                ["Audit Logs", command?.counts.auditLogCount ?? 0],
                [
                  "Disclosures",
                  `${command?.counts.acceptedDisclosures ?? 0}/${
                    command?.counts.requiredDisclosures ?? 0
                  }`,
                ],
              ]}
              primaryHref="/security"
              primaryLabel="Open Security Center"
            />

            <Card className="p-6">
              <h2 className="text-2xl font-black">Run Security Review</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Check local security flags, disclosure status, and platform readiness.
              </p>
              <button
                onClick={() =>
                  runPlatformAction("Security Review", "/api/security/review")
                }
                className="mt-5 rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 font-black text-white"
              >
                Run Review
              </button>
            </Card>
          </section>
        ) : null}

        {activeTab === "system" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <ModuleCard
              title="System Readiness"
              description="Health checks, seed/reset tools, database counts, and final pre-variable readiness."
              stats={[
                ["Readiness", `${command?.readinessScore ?? "—"}/100`],
                ["Audit Logs", command?.counts.auditLogCount ?? 0],
              ]}
              primaryHref="/system"
              primaryLabel="Open System"
            />

            <Card className="p-6">
              <h2 className="text-2xl font-black">System Actions</h2>
              <div className="mt-5 grid gap-3">
                <button
                  onClick={() =>
                    runPlatformAction("Seed Demo Data", "/api/system/seed")
                  }
                  className="rounded-2xl bg-green-500/10 px-4 py-3 text-left font-black text-green-300 ring-1 ring-green-500/30"
                >
                  Seed Demo Data
                </button>

                <button
                  onClick={() =>
                    runPlatformAction("Run Cleanup", "/api/intelligence/cleanup")
                  }
                  className="rounded-2xl bg-amber-500/10 px-4 py-3 text-left font-black text-amber-300 ring-1 ring-amber-500/30"
                >
                  Run Intelligence Cleanup
                </button>
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}