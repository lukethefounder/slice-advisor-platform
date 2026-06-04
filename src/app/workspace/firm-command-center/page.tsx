"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
};

type Firm = {
  id: string;
  name: string;
  firmEmail: string | null;
  firmCode: string;
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
  user?: User;
  firm?: Firm;
};

type CreatedInvitePayload = {
  id: string;
  firmId: string;
  email: string;
  role: string;
  status: string;
  inviteCode: string;
  sentByUserId?: string;
  createdAt?: string;
  expiresAt?: string | null;
  acceptedAt?: string | null;
};

type ProjectAssignment = {
  id: string;
  projectId: string;
  membershipId: string;
  projectRole: string;
  membership: Membership;
};

type Project = {
  id: string;
  firmId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt?: string;
  updatedAt?: string;
  assignments?: ProjectAssignment[];
  agendaTasks?: Array<{
    id: string;
    status: string;
  }>;
};

type AgendaComment = {
  id: string;
  agendaId: string | null;
  taskId: string | null;
  userId: string;
  body: string;
  commentType: string;
  createdAt: string;
  user: User;
};

type AgendaTask = {
  id: string;
  firmId?: string;
  agendaId: string;
  projectId: string | null;
  title: string;
  detail: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  delayReason?: string | null;
  inquiry?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  project?: Project | null;
  comments?: AgendaComment[];
};

type CalendarTask = AgendaTask & {
  agendaTitle?: string;
  weekStart?: string;
  ownerName?: string;
  ownerColor?: string;
  ownerId?: string;
  ownerUserId?: string;
};

type Agenda = {
  id: string;
  firmId: string;
  membershipId: string;
  weekStart: string;
  title: string;
  focus: string | null;
  blockers: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  membership: Membership;
  tasks: AgendaTask[];
};

type FirmPost = {
  id: string;
  firmId: string;
  projectId: string | null;
  authorMembershipId: string | null;
  title: string;
  body: string;
  postType: string;
  createdAt: string;
  updatedAt?: string;
  project: Project | null;
  authorMembership: Membership | null;
};

type FirmWorkspacePayload = {
  firms: Array<Firm & { membership: Membership }>;
  firm: Firm | null;
  membership: Membership | null;
  members: Membership[];
  invites: CreatedInvitePayload[];
  projects: Project[];
  agendas: Agenda[];
  posts: FirmPost[];
  createdInvite?: CreatedInvitePayload | null;
  inviteLink?: string | null;
  operations?: {
    scrumStatuses: string[];
    allTasks: CalendarTask[];
    calendarTasks: CalendarTask[];
    unifiedMessages: FirmPost[];
    ideaBoard: FirmPost[];
    projectDeadlines: Array<
      Project & {
        dueStatus: string;
        assignedNames: string[];
      }
    >;
    timedReminders: Array<{
      id: string;
      body: string;
      commentType: string;
      createdAt: string;
      taskId: string;
      taskTitle: string;
      ownerName?: string;
      dueDate?: string | null;
    }>;
    openNotifications: unknown[];
    sprintMetrics: {
      total: number;
      open: number;
      inProgress: number;
      review: number;
      blocked: number;
      complete: number;
      overdue: number;
      ideas: number;
      deadlines: number;
      timedReminders: number;
    };
  };
};

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";

const EMPTY_WORKSPACE: FirmWorkspacePayload = {
  firms: [],
  firm: null,
  membership: null,
  members: [],
  invites: [],
  projects: [],
  agendas: [],
  posts: [],
  operations: {
    scrumStatuses: ["Backlog", "To Do", "In Progress", "Review", "Blocked", "Complete"],
    allTasks: [],
    calendarTasks: [],
    unifiedMessages: [],
    ideaBoard: [],
    projectDeadlines: [],
    timedReminders: [],
    openNotifications: [],
    sprintMetrics: {
      total: 0,
      open: 0,
      inProgress: 0,
      review: 0,
      blocked: 0,
      complete: 0,
      overdue: 0,
      ideas: 0,
      deadlines: 0,
      timedReminders: 0,
    },
  },
};

const toneClasses: Record<Tone, string> = {
  red: "border-red-500/25 bg-red-500/10 text-red-100",
  green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-100",
  purple: "border-purple-500/25 bg-purple-500/10 text-purple-100",
  cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
  slate: "border-slate-500/25 bg-slate-500/10 text-slate-100",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function nextMondayString() {
  const now = new Date();
  const day = now.getDay();
  const distance = day === 0 ? 1 : 8 - day;
  const date = new Date(now);
  date.setDate(now.getDate() + distance);
  return date.toISOString().slice(0, 10);
}

function shortDate(value?: string | null) {
  if (!value) return "No date";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function priorityTone(priority?: string | null): Tone {
  const clean = String(priority ?? "").toLowerCase();

  if (clean.includes("critical") || clean.includes("urgent") || clean.includes("high")) return "red";
  if (clean.includes("medium")) return "amber";
  if (clean.includes("low")) return "green";
  return "slate";
}

function statusTone(status?: string | null): Tone {
  const clean = String(status ?? "").toLowerCase();

  if (clean.includes("complete") || clean.includes("done") || clean.includes("active")) return "green";
  if (clean.includes("blocked") || clean.includes("overdue") || clean.includes("removed")) return "red";
  if (clean.includes("progress") || clean.includes("review") || clean.includes("pending")) return "amber";
  return "slate";
}

function completeStatus(status?: string | null) {
  return status === "Complete" || status === "Done";
}

function isOverdue(dueDate?: string | null, status?: string | null) {
  return Boolean(dueDate && dueDate < todayString() && !completeStatus(status));
}

function canManageProjects(membership: Membership | null) {
  return Boolean(
    membership &&
      (membership.role === "Owner" ||
        membership.canManageProjects ||
        membership.canManageFirm)
  );
}

function canInviteMembers(membership: Membership | null) {
  return Boolean(
    membership &&
      (membership.role === "Owner" ||
        membership.canInviteMembers ||
        membership.canManageFirm)
  );
}

function canManageFirm(membership: Membership | null) {
  return Boolean(membership && (membership.role === "Owner" || membership.canManageFirm));
}

function inviteSuccessMessage(result: FirmWorkspacePayload) {
  const directInviteLink =
    typeof result.inviteLink === "string" && result.inviteLink.trim()
      ? result.inviteLink.trim()
      : "";

  if (directInviteLink) {
    return `Invite created: ${directInviteLink}`;
  }

  const inviteCode =
    typeof result.createdInvite?.inviteCode === "string" &&
    result.createdInvite.inviteCode.trim()
      ? result.createdInvite.inviteCode.trim()
      : "";

  if (inviteCode) {
    return `Invite created. Share invite code: ${inviteCode}`;
  }

  return "Invite created.";
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
        "rounded-[2rem] border border-white/10 bg-zinc-950/72 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
        toneClasses[tone]
      )}
    >
      {children}
    </span>
  );
}

function MetricCard({
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
  return (
    <div className={cx("rounded-3xl border p-4", toneClasses[tone])}>
      <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">
        {label}
      </div>
      <div className="mt-1 text-3xl font-black text-white">{value}</div>
      {helper ? <div className="mt-1 text-xs font-semibold opacity-75">{helper}</div> : null}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">
          {eyebrow}
        </div>
        <h2 className="mt-1 text-2xl font-black text-white">{title}</h2>
        {description ? <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default function FirmCommandCenterPage() {
  const [workspace, setWorkspace] = useState<FirmWorkspacePayload>(EMPTY_WORKSPACE);
  const [activeFirmId, setActiveFirmId] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");

  const [firmForm, setFirmForm] = useState({
    name: "",
    firmEmail: "",
  });

  const [inviteCodeForm, setInviteCodeForm] = useState({
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
    projectRole: "Contributor",
    assignedMembershipIds: [] as string[],
  });

  const [agendaForm, setAgendaForm] = useState({
    weekStart: nextMondayString(),
    title: "",
    focus: "",
    blockers: "",
    firstTaskTitle: "",
    firstTaskDetail: "",
    firstTaskPriority: "Medium",
    firstTaskDueDate: "",
    firstTaskProjectId: "",
  });

  const [taskForm, setTaskForm] = useState({
    agendaId: "",
    projectId: "",
    title: "",
    detail: "",
    priority: "Medium",
    dueDate: "",
  });

  const [postForm, setPostForm] = useState({
    title: "",
    body: "",
    postType: "Update",
    projectId: "",
  });

  const currentFirm = workspace.firm;
  const membership = workspace.membership;
  const operations = workspace.operations ?? EMPTY_WORKSPACE.operations!;
  const metrics = operations.sprintMetrics;
  const openTasks = operations.allTasks.filter((task) => !completeStatus(task.status));
  const overdueTasks = operations.allTasks.filter((task) => isOverdue(task.dueDate, task.status));
  const activeFirmOptions = workspace.firms;

  const sortedProjects = useMemo(() => {
    return [...workspace.projects].sort((a, b) => {
      const aDue = a.dueDate ?? "9999-12-31";
      const bDue = b.dueDate ?? "9999-12-31";
      return aDue.localeCompare(bDue);
    });
  }, [workspace.projects]);

  const recentPosts = useMemo(() => {
    return [...workspace.posts].slice(0, 8);
  }, [workspace.posts]);

  async function loadWorkspace(firmId?: string) {
    setLoading(true);
    setMessage("");

    try {
      const query = firmId ? `?firmId=${encodeURIComponent(firmId)}` : "";
      const response = await fetch(`/api/firm-workspace${query}`, {
        cache: "no-store",
      });

      const result = (await response.json()) as FirmWorkspacePayload | { error?: string };

      if (!response.ok) {
        setMessage("error" in result && result.error ? result.error : "Unable to load firm workspace.");
        return;
      }

      const payload = result as FirmWorkspacePayload;
      setWorkspace(payload);

      const nextFirmId = payload.firm?.id ?? payload.firms[0]?.id ?? "";

      if (nextFirmId) {
        setActiveFirmId(nextFirmId);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load firm workspace.");
    } finally {
      setLoading(false);
    }
  }

  async function postFirmAction(body: Record<string, unknown>) {
    setWorking(String(body.action ?? "action"));
    setMessage("");

    try {
      const response = await fetch("/api/firm-workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": String(body.action ?? "firm-workspace"),
        },
        body: JSON.stringify(body),
      });

      const result = (await response.json()) as FirmWorkspacePayload | { error?: string };

      if (!response.ok) {
        setMessage("error" in result && result.error ? result.error : "Firm workspace action failed.");
        return null;
      }

      const payload = result as FirmWorkspacePayload;
      setWorkspace(payload);

      const nextFirmId = payload.firm?.id ?? payload.firms[0]?.id ?? activeFirmId;

      if (nextFirmId) {
        setActiveFirmId(nextFirmId);
      }

      return payload;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Firm workspace action failed.");
      return null;
    } finally {
      setWorking("");
    }
  }

  async function createFirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await postFirmAction({
      action: "createFirm",
      name: firmForm.name,
      firmEmail: firmForm.firmEmail,
    });

    if (result) {
      setFirmForm({ name: "", firmEmail: "" });
      setMessage("Firm created.");
    }
  }

  async function acceptInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await postFirmAction({
      action: "acceptInvite",
      inviteCode: inviteCodeForm.inviteCode,
    });

    if (result) {
      setInviteCodeForm({ inviteCode: "" });
      setMessage("Invite accepted.");
    }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await postFirmAction({
      action: "inviteMember",
      firmId: activeFirmId,
      email: inviteForm.email,
      role: inviteForm.role,
    });

    if (result) {
      setInviteForm({ email: "", role: "Member" });
      setMessage(inviteSuccessMessage(result));
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await postFirmAction({
      action: "createProject",
      firmId: activeFirmId,
      title: projectForm.title,
      description: projectForm.description,
      priority: projectForm.priority,
      dueDate: projectForm.dueDate,
      assignedMembershipIds: projectForm.assignedMembershipIds,
      projectRole: projectForm.projectRole,
    });

    if (result) {
      setProjectForm({
        title: "",
        description: "",
        priority: "Medium",
        dueDate: "",
        projectRole: "Contributor",
        assignedMembershipIds: [],
      });
      setMessage("Project created.");
    }
  }

  async function createAgenda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const tasks = agendaForm.firstTaskTitle.trim()
      ? [
          {
            title: agendaForm.firstTaskTitle,
            detail: agendaForm.firstTaskDetail,
            priority: agendaForm.firstTaskPriority,
            dueDate: agendaForm.firstTaskDueDate,
            projectId: agendaForm.firstTaskProjectId || null,
          },
        ]
      : [];

    const result = await postFirmAction({
      action: "createAgenda",
      firmId: activeFirmId,
      weekStart: agendaForm.weekStart,
      title: agendaForm.title,
      focus: agendaForm.focus,
      blockers: agendaForm.blockers,
      tasks,
    });

    if (result) {
      setAgendaForm({
        weekStart: nextMondayString(),
        title: "",
        focus: "",
        blockers: "",
        firstTaskTitle: "",
        firstTaskDetail: "",
        firstTaskPriority: "Medium",
        firstTaskDueDate: "",
        firstTaskProjectId: "",
      });
      setMessage("Agenda created.");
    }
  }

  async function addAgendaTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await postFirmAction({
      action: "addAgendaTask",
      firmId: activeFirmId,
      agendaId: taskForm.agendaId,
      projectId: taskForm.projectId || null,
      title: taskForm.title,
      detail: taskForm.detail,
      priority: taskForm.priority,
      dueDate: taskForm.dueDate,
    });

    if (result) {
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

  async function updateTaskStatus(taskId: string, status: string) {
    const result = await postFirmAction({
      action: "updateTask",
      firmId: activeFirmId,
      taskId,
      status,
    });

    if (result) {
      setMessage(`Task marked ${status}.`);
    }
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await postFirmAction({
      action: "createPost",
      firmId: activeFirmId,
      title: postForm.title,
      body: postForm.body,
      postType: postForm.postType,
      projectId: postForm.projectId || null,
    });

    if (result) {
      setPostForm({
        title: "",
        body: "",
        postType: "Update",
        projectId: "",
      });
      setMessage("Workspace post created.");
    }
  }

  function toggleAssignedMember(membershipId: string) {
    setProjectForm((current) => {
      const exists = current.assignedMembershipIds.includes(membershipId);

      return {
        ...current,
        assignedMembershipIds: exists
          ? current.assignedMembershipIds.filter((id) => id !== membershipId)
          : [...current.assignedMembershipIds, membershipId],
      };
    });
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.16),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1600px] gap-5">
        <header className="rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-2xl shadow-red-950/30 backdrop-blur-xl">
          <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-red-400">
                Slice Firm Command Center
              </div>
              <h1 className="mt-2 text-4xl font-black tracking-tight md:text-5xl">
                Team workspace, projects, agendas, and firm execution.
              </h1>
              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400">
                Manage the firm workspace, invite members, delegate projects, create weekly agendas,
                track task status, and keep ideas and updates centralized for the advisor team.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Workspace
              </a>
              <button
                type="button"
                onClick={() => loadWorkspace(activeFirmId)}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
              >
                Refresh
              </button>
            </div>
          </div>

          {message ? (
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
              {message}
            </div>
          ) : null}
        </header>

        {loading ? (
          <Card>
            <div className="py-12 text-center text-sm font-bold text-slate-400">
              Loading firm command center...
            </div>
          </Card>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="grid gap-5">
            <Card>
              <SectionHeader
                eyebrow="Firm Access"
                title="Create or join a firm"
                description="Create your advisor firm workspace or accept an invite code from another firm."
              />

              <form onSubmit={createFirm} className="mt-5 grid gap-3">
                <input
                  value={firmForm.name}
                  onChange={(event) => setFirmForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Firm name"
                  className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                />
                <input
                  value={firmForm.firmEmail}
                  onChange={(event) => setFirmForm((current) => ({ ...current, firmEmail: event.target.value }))}
                  placeholder="Firm email"
                  className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                />
                <button
                  disabled={working === "createFirm"}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                >
                  {working === "createFirm" ? "Creating..." : "Create Firm"}
                </button>
              </form>

              <form onSubmit={acceptInvite} className="mt-5 grid gap-3 border-t border-white/10 pt-5">
                <input
                  value={inviteCodeForm.inviteCode}
                  onChange={(event) => setInviteCodeForm({ inviteCode: event.target.value })}
                  placeholder="Invite code"
                  className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold uppercase text-white outline-none placeholder:text-slate-600"
                />
                <button
                  disabled={working === "acceptInvite"}
                  className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 disabled:opacity-50"
                >
                  {working === "acceptInvite" ? "Joining..." : "Accept Invite"}
                </button>
              </form>
            </Card>

            <Card>
              <SectionHeader
                eyebrow="Firm Selector"
                title="Active firm"
                description="Switch between connected firms."
              />

              <div className="mt-5 grid gap-3">
                <select
                  value={activeFirmId}
                  onChange={(event) => {
                    setActiveFirmId(event.target.value);
                    void loadWorkspace(event.target.value);
                  }}
                  className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-black text-white outline-none"
                >
                  <option value="">No firm selected</option>
                  {activeFirmOptions.map((firm) => (
                    <option key={firm.id} value={firm.id}>
                      {firm.name}
                    </option>
                  ))}
                </select>

                {currentFirm ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="text-xl font-black text-white">{currentFirm.name}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {currentFirm.firmEmail || "No firm email"}
                    </div>
                    <div className="mt-3">
                      <Pill tone="red">Code {currentFirm.firmCode}</Pill>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-5 text-center text-sm font-bold text-slate-500">
                    Create or join a firm to begin.
                  </div>
                )}

                {membership ? (
                  <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Your role
                    </div>
                    <div className="mt-1 text-lg font-black text-white">{membership.role}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {membership.canManageFirm ? <Pill tone="red">Firm admin</Pill> : null}
                      {membership.canManageProjects ? <Pill tone="green">Projects</Pill> : null}
                      {membership.canInviteMembers ? <Pill tone="cyan">Invites</Pill> : null}
                      {membership.canAccessPortfolios ? <Pill tone="purple">Portfolios</Pill> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>

            <Card>
              <SectionHeader
                eyebrow="Team"
                title="Members and invites"
                description="Invite members and review active firm access."
              />

              {canInviteMembers(membership) ? (
                <form onSubmit={inviteMember} className="mt-5 grid gap-3">
                  <input
                    value={inviteForm.email}
                    onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="Member email"
                    className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                  />
                  <select
                    value={inviteForm.role}
                    onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}
                    className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"
                  >
                    <option>Member</option>
                    <option>Advisor</option>
                    <option>Analyst</option>
                    <option>Operations</option>
                    <option>Manager</option>
                    <option>Admin</option>
                  </select>
                  <button
                    disabled={!activeFirmId || working === "inviteMember"}
                    className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100 disabled:opacity-50"
                  >
                    {working === "inviteMember" ? "Creating invite..." : "Create Invite"}
                  </button>
                </form>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                  You do not currently have invite permissions.
                </div>
              )}

              <div className="mt-5 grid gap-3">
                {workspace.members.map((member) => (
                  <div key={member.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-1 h-3 w-3 rounded-full"
                        style={{ backgroundColor: member.calendarColor }}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-black text-white">{member.user?.name || "Team member"}</div>
                        <div className="truncate text-xs text-slate-500">{member.user?.email || member.userId}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Pill tone={statusTone(member.status)}>{member.status}</Pill>
                          <Pill tone="slate">{member.role}</Pill>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {!workspace.members.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm font-bold text-slate-500">
                    No active members yet.
                  </div>
                ) : null}
              </div>

              {workspace.invites.length ? (
                <div className="mt-5 border-t border-white/10 pt-5">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Pending invites
                  </div>
                  <div className="mt-3 grid gap-3">
                    {workspace.invites.map((invite) => (
                      <div key={invite.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="font-black text-white">{invite.email}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Role: {invite.role} · Code: {invite.inviteCode}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          </div>

          <div className="grid gap-5">
            <section className="grid gap-3 md:grid-cols-5">
              <MetricCard label="Tasks" value={metrics.total} helper="All agenda tasks" tone="cyan" />
              <MetricCard label="Open" value={metrics.open} helper="Needs action" tone="amber" />
              <MetricCard label="Blocked" value={metrics.blocked} helper="Needs help" tone={metrics.blocked ? "red" : "green"} />
              <MetricCard label="Overdue" value={metrics.overdue} helper="Past due" tone={metrics.overdue ? "red" : "green"} />
              <MetricCard label="Ideas" value={metrics.ideas} helper="Brainstorm posts" tone="purple" />
            </section>

            <Card>
              <SectionHeader
                eyebrow="Projects"
                title="Create and delegate projects"
                description="Create projects, assign team members, prioritize work, and create firm-wide accountability."
              />

              {canManageProjects(membership) ? (
                <form onSubmit={createProject} className="mt-5 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={projectForm.title}
                      onChange={(event) => setProjectForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Project title"
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                    />
                    <input
                      type="date"
                      value={projectForm.dueDate}
                      onChange={(event) => setProjectForm((current) => ({ ...current, dueDate: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"
                    />
                  </div>

                  <textarea
                    value={projectForm.description}
                    onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Project description"
                    className="min-h-24 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                  />

                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      value={projectForm.priority}
                      onChange={(event) => setProjectForm((current) => ({ ...current, priority: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>Critical</option>
                    </select>
                    <input
                      value={projectForm.projectRole}
                      onChange={(event) => setProjectForm((current) => ({ ...current, projectRole: event.target.value }))}
                      placeholder="Project role"
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Assign members
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {workspace.members.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleAssignedMember(member.id)}
                          className={cx(
                            "rounded-full border px-3 py-2 text-xs font-black",
                            projectForm.assignedMembershipIds.includes(member.id)
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                              : "border-white/10 bg-white/[0.04] text-slate-300"
                          )}
                        >
                          {member.user?.name || member.role}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={!activeFirmId || working === "createProject"}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                  >
                    {working === "createProject" ? "Creating..." : "Create Project"}
                  </button>
                </form>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                  You do not currently have project management permissions.
                </div>
              )}

              <div className="mt-6 grid gap-3 lg:grid-cols-2">
                {sortedProjects.map((project) => (
                  <article key={project.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black text-white">{project.title}</h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                          {project.description || "No project description."}
                        </p>
                      </div>
                      <Pill tone={priorityTone(project.priority)}>{project.priority}</Pill>
                    </div>

                    <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-500">
                      <div>Due: {shortDate(project.dueDate)}</div>
                      <div>Status: {project.status}</div>
                    </div>

                    {project.assignments?.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {project.assignments.map((assignment) => (
                          <Pill key={assignment.id} tone="cyan">
                            {assignment.membership.user?.name || assignment.projectRole}
                          </Pill>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}

                {!sortedProjects.length ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500 lg:col-span-2">
                    No projects yet.
                  </div>
                ) : null}
              </div>
            </Card>

            <section className="grid gap-5 xl:grid-cols-2">
              <Card>
                <SectionHeader
                  eyebrow="Weekly Agenda"
                  title="Create agenda"
                  description="Create a weekly agenda for your own workstream and optionally add the first task."
                />

                <form onSubmit={createAgenda} className="mt-5 grid gap-3">
                  <input
                    type="date"
                    value={agendaForm.weekStart}
                    onChange={(event) => setAgendaForm((current) => ({ ...current, weekStart: event.target.value }))}
                    className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"
                  />
                  <input
                    value={agendaForm.title}
                    onChange={(event) => setAgendaForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Agenda title"
                    className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                  />
                  <textarea
                    value={agendaForm.focus}
                    onChange={(event) => setAgendaForm((current) => ({ ...current, focus: event.target.value }))}
                    placeholder="Main focus"
                    className="min-h-20 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                  />
                  <textarea
                    value={agendaForm.blockers}
                    onChange={(event) => setAgendaForm((current) => ({ ...current, blockers: event.target.value }))}
                    placeholder="Blockers"
                    className="min-h-20 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                  />

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Optional first task
                    </div>
                    <div className="mt-3 grid gap-3">
                      <input
                        value={agendaForm.firstTaskTitle}
                        onChange={(event) => setAgendaForm((current) => ({ ...current, firstTaskTitle: event.target.value }))}
                        placeholder="First task title"
                        className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                      />
                      <textarea
                        value={agendaForm.firstTaskDetail}
                        onChange={(event) => setAgendaForm((current) => ({ ...current, firstTaskDetail: event.target.value }))}
                        placeholder="Task detail"
                        className="min-h-20 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                      />
                      <div className="grid gap-3 md:grid-cols-2">
                        <select
                          value={agendaForm.firstTaskPriority}
                          onChange={(event) => setAgendaForm((current) => ({ ...current, firstTaskPriority: event.target.value }))}
                          className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"
                        >
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                          <option>Critical</option>
                        </select>
                        <input
                          type="date"
                          value={agendaForm.firstTaskDueDate}
                          onChange={(event) => setAgendaForm((current) => ({ ...current, firstTaskDueDate: event.target.value }))}
                          className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"
                        />
                      </div>
                      <select
                        value={agendaForm.firstTaskProjectId}
                        onChange={(event) => setAgendaForm((current) => ({ ...current, firstTaskProjectId: event.target.value }))}
                        className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"
                      >
                        <option value="">No project</option>
                        {workspace.projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    disabled={!activeFirmId || working === "createAgenda"}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                  >
                    {working === "createAgenda" ? "Creating..." : "Create Agenda"}
                  </button>
                </form>
              </Card>

              <Card>
                <SectionHeader
                  eyebrow="Tasks"
                  title="Add task"
                  description="Add a task to an existing agenda and optionally connect it to a project."
                />

                <form onSubmit={addAgendaTask} className="mt-5 grid gap-3">
                  <select
                    value={taskForm.agendaId}
                    onChange={(event) => setTaskForm((current) => ({ ...current, agendaId: event.target.value }))}
                    className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"
                  >
                    <option value="">Select agenda</option>
                    {workspace.agendas.map((agenda) => (
                      <option key={agenda.id} value={agenda.id}>
                        {agenda.title} · {shortDate(agenda.weekStart)}
                      </option>
                    ))}
                  </select>
                  <input
                    value={taskForm.title}
                    onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Task title"
                    className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                  />
                  <textarea
                    value={taskForm.detail}
                    onChange={(event) => setTaskForm((current) => ({ ...current, detail: event.target.value }))}
                    placeholder="Task detail"
                    className="min-h-24 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      value={taskForm.priority}
                      onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>Critical</option>
                    </select>
                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"
                    />
                  </div>
                  <select
                    value={taskForm.projectId}
                    onChange={(event) => setTaskForm((current) => ({ ...current, projectId: event.target.value }))}
                    className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"
                  >
                    <option value="">No project</option>
                    {workspace.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!activeFirmId || !taskForm.agendaId || working === "addAgendaTask"}
                    className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 disabled:opacity-50"
                  >
                    {working === "addAgendaTask" ? "Adding..." : "Add Task"}
                  </button>
                </form>
              </Card>
            </section>

            <Card>
              <SectionHeader
                eyebrow="Execution Board"
                title="Open and overdue tasks"
                description="Review what needs attention and mark items complete as work moves forward."
              />

              <div className="mt-5 grid gap-3">
                {[...overdueTasks, ...openTasks.filter((task) => !overdueTasks.some((overdue) => overdue.id === task.id))]
                  .slice(0, 12)
                  .map((task) => (
                    <article key={task.id} className="rounded-3xl border border-white/10 bg-black/30 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
                            <Pill tone={isOverdue(task.dueDate, task.status) ? "red" : statusTone(task.status)}>
                              {isOverdue(task.dueDate, task.status) ? "Overdue" : task.status}
                            </Pill>
                            {task.ownerName ? <Pill tone="cyan">{task.ownerName}</Pill> : null}
                          </div>
                          <h3 className="mt-3 text-lg font-black text-white">{task.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {task.detail || "No task detail."}
                          </p>
                          <div className="mt-3 text-xs font-semibold text-slate-500">
                            Due {shortDate(task.dueDate)} · Agenda {task.agendaTitle || task.agendaId}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => updateTaskStatus(task.id, "In Progress")}
                            className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-100"
                          >
                            In Progress
                          </button>
                          <button
                            type="button"
                            onClick={() => updateTaskStatus(task.id, "Review")}
                            className="rounded-2xl border border-purple-500/25 bg-purple-500/10 px-3 py-2 text-xs font-black text-purple-100"
                          >
                            Review
                          </button>
                          <button
                            type="button"
                            onClick={() => updateTaskStatus(task.id, "Complete")}
                            className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100"
                          >
                            Complete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}

                {!openTasks.length ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                    No open tasks.
                  </div>
                ) : null}
              </div>
            </Card>

            <section className="grid gap-5 xl:grid-cols-2">
              <Card>
                <SectionHeader
                  eyebrow="Universal Workspace"
                  title="Post update or idea"
                  description="Share updates, ideas, brainstorms, and notes with the firm."
                />

                <form onSubmit={createPost} className="mt-5 grid gap-3">
                  <input
                    value={postForm.title}
                    onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Post title"
                    className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                  />
                  <textarea
                    value={postForm.body}
                    onChange={(event) => setPostForm((current) => ({ ...current, body: event.target.value }))}
                    placeholder="Write an update, idea, or brainstorm..."
                    className="min-h-28 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      value={postForm.postType}
                      onChange={(event) => setPostForm((current) => ({ ...current, postType: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"
                    >
                      <option>Update</option>
                      <option>Idea</option>
                      <option>Brainstorm</option>
                      <option>Anonymous Idea</option>
                      <option>Client Service</option>
                      <option>Operations</option>
                    </select>
                    <select
                      value={postForm.projectId}
                      onChange={(event) => setPostForm((current) => ({ ...current, projectId: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"
                    >
                      <option value="">No project</option>
                      {workspace.projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    disabled={!activeFirmId || working === "createPost"}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                  >
                    {working === "createPost" ? "Posting..." : "Create Post"}
                  </button>
                </form>
              </Card>

              <Card>
                <SectionHeader
                  eyebrow="Activity"
                  title="Recent firm posts"
                  description="Latest updates and ideas from the universal workspace."
                />

                <div className="mt-5 grid gap-3">
                  {recentPosts.map((post) => (
                    <article key={post.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-black text-white">{post.title}</h3>
                          <div className="mt-1 text-xs font-semibold text-slate-500">
                            {post.postType} · {formatDateTime(post.createdAt)}
                          </div>
                        </div>
                        <Pill tone={post.postType.toLowerCase().includes("idea") ? "purple" : "slate"}>
                          {post.postType}
                        </Pill>
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{post.body}</p>
                    </article>
                  ))}

                  {!recentPosts.length ? (
                    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                      No posts yet.
                    </div>
                  ) : null}
                </div>
              </Card>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}