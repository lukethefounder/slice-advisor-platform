"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
};

type Task = {
  id: string;
  projectId: string | null;
  title: string;
  detail: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  delayReason: string | null;
  inquiry: string | null;
  ownerName?: string;
  ownerColor?: string;
  ownerId?: string;
  ownerUserId?: string;
  weekStart?: string;
  agendaTitle?: string;
  project?: Project | null;
  comments?: Array<{
    id: string;
    body: string;
    commentType: string;
    createdAt: string;
    user: User;
  }>;
};

type FirmPost = {
  id: string;
  title: string;
  body: string;
  postType: string;
  createdAt: string;
  project: Project | null;
  authorMembership: Membership | null;
  fileLinks?: string[];
  mentions?: string[];
  ideaStatus?: string;
  votes?: number;
};

type FirmWorkspacePayload = {
  firms: Array<Firm & { membership: Membership }>;
  firm: Firm | null;
  membership: Membership | null;
  members: Membership[];
  invites: Array<{
    id: string;
    email: string;
    role: string;
    inviteCode: string;
    status: string;
    expiresAt: string | null;
    createdAt: string;
    sentBy: User;
  }>;
  projects: Project[];
  agendas: Array<{
    id: string;
    weekStart: string;
    title: string;
    focus: string | null;
    blockers: string | null;
    status: string;
    membership: Membership;
    tasks: Task[];
  }>;
  posts: FirmPost[];
  operations?: {
    scrumStatuses: string[];
    allTasks: Task[];
    calendarTasks: Task[];
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
    openNotifications: Array<{
      id: string;
      title: string;
      body: string;
      urgency: string;
      score: number;
      status: string;
      createdAt: string;
    }>;
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

type InternalView = "delegate" | "ideas" | "workspace" | "my-work";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";

const EMPTY: FirmWorkspacePayload = {
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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shortDate(value: string | null | undefined) {
  if (!value) return "No date";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
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

function toneFor(value: string | null | undefined): Tone {
  const lower = String(value ?? "").toLowerCase();

  if (
    lower.includes("blocked") ||
    lower.includes("failed") ||
    lower.includes("overdue") ||
    lower.includes("critical") ||
    lower.includes("high")
  ) {
    return "red";
  }

  if (
    lower.includes("complete") ||
    lower.includes("done") ||
    lower.includes("active") ||
    lower.includes("approved") ||
    lower.includes("delivered")
  ) {
    return "green";
  }

  if (
    lower.includes("review") ||
    lower.includes("pending") ||
    lower.includes("progress") ||
    lower.includes("medium") ||
    lower.includes("soon") ||
    lower.includes("today") ||
    lower.includes("to do")
  ) {
    return "amber";
  }

  if (lower.includes("idea") || lower.includes("project") || lower.includes("sprint")) {
    return "purple";
  }

  if (lower.includes("chat") || lower.includes("file") || lower.includes("message")) {
    return "cyan";
  }

  return "slate";
}

function memberName(member: Membership | null | undefined) {
  if (!member) return "Anonymous Contributor";
  return member.user?.name || member.user?.email || "Team member";
}

function isLeader(member: Membership | null | undefined) {
  if (!member) return false;

  return (
    member.role === "Owner" ||
    member.role === "Admin" ||
    member.canManageFirm ||
    member.canManageProjects
  );
}

function ideaAuthor(post: FirmPost) {
  if (!post.authorMembership) return "Anonymous Contributor";
  return memberName(post.authorMembership);
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
        "inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function MiniMetric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string | number;
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
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
      </div>
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4", className)}>
      {children}
    </div>
  );
}

export default function TeamBoardEmbedded() {
  const [workspace, setWorkspace] = useState<FirmWorkspacePayload>(EMPTY);
  const [activeView, setActiveView] = useState<InternalView>("delegate");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [taskForm, setTaskForm] = useState({
    title: "",
    detail: "",
    priority: "Medium",
    status: "To Do",
    dueDate: ymd(new Date()),
    reminderAt: "",
    reminderNote: "",
    projectId: "",
  });

  const [workspaceMessage, setWorkspaceMessage] = useState({
    title: "",
    body: "",
    postType: "Chat",
    fileLinks: "",
    projectId: "",
  });

  const [ideaForm, setIdeaForm] = useState({
    title: "",
    body: "",
    category: "Growth",
    impact: "Medium",
    effort: "Medium",
    ownerHint: "",
    projectId: "",
    fileLinks: "",
    anonymous: true,
  });

  const firm = workspace.firm;
  const membership = workspace.membership;
  const members = workspace.members;
  const projects = workspace.projects;
  const operations = workspace.operations ?? EMPTY.operations!;
  const allTasks = operations.allTasks;
  const selectedTask = allTasks.find((item) => item.id === selectedTaskId) ?? allTasks[0] ?? null;

  const myTasks = useMemo(() => {
    if (!membership) return [];

    return allTasks.filter((task) => task.ownerUserId === membership.userId);
  }, [allTasks, membership]);

  const taskColumns = useMemo(() => {
    const statuses = operations.scrumStatuses.length
      ? operations.scrumStatuses
      : ["Backlog", "To Do", "In Progress", "Review", "Blocked", "Complete"];

    return statuses.map((status) => ({
      status,
      tasks: allTasks.filter((task) => {
        if (status === "To Do") return task.status === "To Do" || task.status === "Open";
        if (status === "Complete") return task.status === "Complete" || task.status === "Done";
        return task.status === status;
      }),
    }));
  }, [allTasks, operations.scrumStatuses]);

  async function loadWorkspace() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/firm-workspace", {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to load team board.");
        return;
      }

      setWorkspace(payload);

      if (!selectedMemberId && payload.members?.[0]) {
        setSelectedMemberId(payload.members[0].id);
      }

      if (!selectedTaskId && payload.operations?.allTasks?.[0]) {
        setSelectedTaskId(payload.operations.allTasks[0].id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load team board.");
    } finally {
      setLoading(false);
    }
  }

  async function postFirmAction(body: Record<string, unknown>) {
    if (!firm?.id) {
      setMessage("Create or connect to a firm first.");
      return null;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/firm-workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": String(body.action ?? "firm-workspace"),
        },
        body: JSON.stringify({
          firmId: firm.id,
          ...body,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Action failed.");
        return null;
      }

      setWorkspace(payload);
      return payload as FirmWorkspacePayload;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function createDelegatedTask(event: FormEvent) {
    event.preventDefault();

    if (!taskForm.title.trim()) {
      setMessage("Task title is required.");
      return;
    }

    const result = await postFirmAction({
      action: "createDelegatedTask",
      targetMembershipId: selectedMemberId || members[0]?.id,
      title: taskForm.title,
      detail: taskForm.detail,
      priority: taskForm.priority,
      status: taskForm.status,
      dueDate: taskForm.dueDate,
      reminderAt: taskForm.reminderAt,
      reminderNote: taskForm.reminderNote,
      projectId: taskForm.projectId || null,
    });

    if (result) {
      setTaskForm((current) => ({
        ...current,
        title: "",
        detail: "",
        reminderAt: "",
        reminderNote: "",
      }));
      setMessage("Task delegated. The assigned person was notified.");
    }
  }

  async function moveTask(task: Task, status: string) {
    const result = await postFirmAction({
      action: "moveTask",
      taskId: task.id,
      status,
    });

    if (result) {
      setSelectedTaskId(task.id);
      setMessage(`Task moved to ${status}.`);
    }
  }

  async function createTimedReminder(event: FormEvent) {
    event.preventDefault();

    if (!selectedTask) {
      setMessage("Select a task first.");
      return;
    }

    const result = await postFirmAction({
      action: "createTimedReminder",
      taskId: selectedTask.id,
      targetMembershipId: selectedTask.ownerId || selectedMemberId,
      reminderAt: taskForm.reminderAt || "today",
      reminderNote:
        taskForm.reminderNote ||
        "Please review this task and update the project workspace.",
    });

    if (result) {
      setTaskForm((current) => ({
        ...current,
        reminderAt: "",
        reminderNote: "",
      }));
      setMessage("Reminder created. Cron will continue reminders until work is complete.");
    }
  }

  async function createUniversalMessage(event: FormEvent) {
    event.preventDefault();

    if (!workspaceMessage.body.trim()) {
      setMessage("Message body is required.");
      return;
    }

    const fileLinks = workspaceMessage.fileLinks
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    const result = await postFirmAction({
      action: "createWorkspaceMessage",
      title: workspaceMessage.title,
      body: workspaceMessage.body,
      postType: workspaceMessage.postType,
      projectId: workspaceMessage.projectId || null,
      fileLinks,
    });

    if (result) {
      setWorkspaceMessage({
        title: "",
        body: "",
        postType: "Chat",
        fileLinks: "",
        projectId: "",
      });
      setMessage("Workspace message posted. Tagged users were notified.");
    }
  }

  async function createIdea(event: FormEvent) {
    event.preventDefault();

    if (!firm?.id) {
      setMessage("Create or connect to a firm first.");
      return;
    }

    if (!ideaForm.title.trim()) {
      setMessage("Idea title is required.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/firm-workspace/anonymous-ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "create-firm-idea",
        },
        body: JSON.stringify({
          action: "createIdea",
          firmId: firm.id,
          ...ideaForm,
          fileLinks: ideaForm.fileLinks
            .split(/\n|,/)
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to submit idea.");
        return;
      }

      setIdeaForm({
        title: "",
        body: "",
        category: "Growth",
        impact: "Medium",
        effort: "Medium",
        ownerHint: "",
        projectId: "",
        fileLinks: "",
        anonymous: true,
      });

      await loadWorkspace();
      setMessage("Idea submitted to the firm idea board.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit idea.");
    } finally {
      setLoading(false);
    }
  }

  async function voteIdea(ideaId: string, anonymous = true) {
    if (!firm?.id) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/firm-workspace/anonymous-ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "vote-firm-idea",
        },
        body: JSON.stringify({
          action: "voteIdea",
          firmId: firm.id,
          ideaId,
          anonymous,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to vote.");
        return;
      }

      await loadWorkspace();
      setMessage("Vote recorded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to vote.");
    } finally {
      setLoading(false);
    }
  }

  async function updateIdeaStatus(ideaId: string, status: string) {
    const result = await postFirmAction({
      action: "updateIdeaStatus",
      ideaId,
      status,
      note: `Moved to ${status}.`,
    });

    if (result) setMessage(`Idea moved to ${status}.`);
  }

  useEffect(() => {
    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!firm) {
    return (
      <section className="grid gap-5">
        <div className="rounded-[2rem] border border-amber-500/25 bg-amber-500/10 p-6">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
            Team Board
          </div>
          <h2 className="mt-2 text-3xl font-black text-white">
            Connect this account to a firm workspace first.
          </h2>
          <p className="mt-3 text-sm leading-7 text-amber-100/80">
            Once a firm is created or the user accepts an invite, this tab becomes the shared operating workspace for delegation, anonymous ideas, reminders, tasks, and team collaboration.
          </p>
          <a
            href="/workspace/firm-command-center"
            className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
          >
            Open Firm Command Center
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-[2rem] border border-white/10 bg-zinc-950/72 p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
              Team Board · Firm Operating Workspace
            </div>
            <h2 className="mt-2 text-4xl font-black tracking-tight text-white md:text-5xl">
              Delegate, brainstorm, remind, and execute as one firm.
            </h2>
            <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400">
              The person in charge can delegate tasks, rank importance, set deadlines, and create reminders.
              Every connected user can manage their own work and share growth ideas, including anonymously.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/workspace/firm-command-center"
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
            >
              Open Full Command Center
            </a>
            <button
              type="button"
              onClick={() => void loadWorkspace()}
              className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <MiniMetric label="Total Tasks" value={operations.sprintMetrics.total} tone="cyan" />
          <MiniMetric label="Open" value={operations.sprintMetrics.open} tone="amber" />
          <MiniMetric label="In Progress" value={operations.sprintMetrics.inProgress} tone="purple" />
          <MiniMetric label="Blocked" value={operations.sprintMetrics.blocked} tone={operations.sprintMetrics.blocked ? "red" : "green"} />
          <MiniMetric label="Complete" value={operations.sprintMetrics.complete} tone="green" />
          <MiniMetric label="Ideas" value={operations.sprintMetrics.ideas} tone="purple" />
          <MiniMetric label="Reminders" value={operations.sprintMetrics.timedReminders} tone="amber" />
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
          {message}
        </div>
      ) : null}

      <div className="grid gap-2 rounded-[1.5rem] border border-white/10 bg-black/45 p-2 md:grid-cols-4">
        {[
          ["delegate", "Delegate"],
          ["ideas", "Idea Board"],
          ["workspace", "Universal Workspace"],
          ["my-work", "My Work"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveView(key as InternalView)}
            className={cx(
              "rounded-2xl px-4 py-3 text-sm font-black transition",
              activeView === key
                ? "bg-white text-slate-950"
                : "bg-white/5 text-white hover:bg-white/10"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeView === "delegate" ? (
        <div className="grid gap-5 xl:grid-cols-[370px_minmax(0,1fr)]">
          <Panel>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
              Delegate Work
            </div>
            <h3 className="mt-2 text-2xl font-black text-white">
              Assign, rank, deadline, remind
            </h3>

            <form onSubmit={createDelegatedTask} className="mt-5 grid gap-3">
              <select
                value={selectedMemberId}
                onChange={(event) => setSelectedMemberId(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {memberName(member)} · {member.role}
                  </option>
                ))}
              </select>

              <input
                value={taskForm.title}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Task title"
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              />

              <textarea
                value={taskForm.detail}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, detail: event.target.value }))
                }
                placeholder="Task detail. Use @Name to tag someone."
                className="min-h-28 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              />

              <div className="grid gap-2 md:grid-cols-2">
                <select
                  value={taskForm.priority}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, priority: event.target.value }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>

                <select
                  value={taskForm.status}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, status: event.target.value }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none"
                >
                  {operations.scrumStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>

              <input
                type="date"
                value={taskForm.dueDate}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                }
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none"
              />

              <select
                value={taskForm.projectId}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, projectId: event.target.value }))
                }
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none"
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>

              <input
                value={taskForm.reminderAt}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, reminderAt: event.target.value }))
                }
                placeholder="Reminder: today, tomorrow 9am, Friday 2pm, or 2026-05-21T09:00:00"
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              />

              <textarea
                value={taskForm.reminderNote}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, reminderNote: event.target.value }))
                }
                placeholder="Reminder note"
                className="min-h-20 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              />

              <button
                disabled={loading}
                className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                Delegate + Notify
              </button>
            </form>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
            {taskColumns.map((column) => (
              <Panel key={column.status} className="p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-sm font-black text-white">{column.status}</div>
                  <Pill tone={toneFor(column.status)}>{column.tasks.length}</Pill>
                </div>

                <div className="grid max-h-[640px] gap-3 overflow-y-auto pr-1">
                  {column.tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      className={cx(
                        "rounded-2xl border p-4 text-left transition hover:bg-white/[0.08]",
                        selectedTask?.id === task.id
                          ? "border-cyan-400/50 bg-cyan-500/10"
                          : "border-white/10 bg-black/35"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-black text-white">{task.title}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {task.ownerName} · {shortDate(task.dueDate)}
                          </div>
                        </div>
                        <span
                          className="mt-1 h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: task.ownerColor ?? "#64748b" }}
                        />
                      </div>

                      <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400">
                        {task.detail || "No task detail."}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill tone={toneFor(task.priority)}>{task.priority}</Pill>
                        {task.project ? <Pill tone="purple">{task.project.title}</Pill> : null}
                        {task.comments?.some((comment) => comment.commentType === "Timed Reminder") ? (
                          <Pill tone="amber">Reminder</Pill>
                        ) : null}
                      </div>
                    </button>
                  ))}

                  {!column.tasks.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs font-bold text-slate-500">
                      Empty
                    </div>
                  ) : null}
                </div>
              </Panel>
            ))}
          </div>
        </div>
      ) : null}

      {activeView === "ideas" ? (
        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Panel>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
              Anonymous Brainstorm
            </div>
            <h3 className="mt-2 text-2xl font-black text-white">
              Share ideas safely
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Anyone connected to the firm can submit ideas. Anonymous mode removes the author from the idea card so people can suggest growth ideas freely.
            </p>

            <form onSubmit={createIdea} className="mt-5 grid gap-3">
              <input
                value={ideaForm.title}
                onChange={(event) =>
                  setIdeaForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Idea title"
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              />

              <textarea
                value={ideaForm.body}
                onChange={(event) =>
                  setIdeaForm((current) => ({ ...current, body: event.target.value }))
                }
                placeholder="Describe the idea. Use @Name if you want to tag a reviewer."
                className="min-h-32 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              />

              <div className="grid gap-2 md:grid-cols-3">
                <input
                  value={ideaForm.category}
                  onChange={(event) =>
                    setIdeaForm((current) => ({ ...current, category: event.target.value }))
                  }
                  placeholder="Category"
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                />

                <select
                  value={ideaForm.impact}
                  onChange={(event) =>
                    setIdeaForm((current) => ({ ...current, impact: event.target.value }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>

                <select
                  value={ideaForm.effort}
                  onChange={(event) =>
                    setIdeaForm((current) => ({ ...current, effort: event.target.value }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>

              <input
                value={ideaForm.ownerHint}
                onChange={(event) =>
                  setIdeaForm((current) => ({ ...current, ownerHint: event.target.value }))
                }
                placeholder="Suggested owner/reviewer, optional"
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              />

              <textarea
                value={ideaForm.fileLinks}
                onChange={(event) =>
                  setIdeaForm((current) => ({ ...current, fileLinks: event.target.value }))
                }
                placeholder="Optional file/support links, one per line"
                className="min-h-20 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              />

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={ideaForm.anonymous}
                  onChange={(event) =>
                    setIdeaForm((current) => ({ ...current, anonymous: event.target.checked }))
                  }
                />
                Submit anonymously
              </label>

              <button
                disabled={loading}
                className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                Submit Idea
              </button>
            </form>
          </Panel>

          <div className="grid gap-3 md:grid-cols-2">
            {operations.ideaBoard.map((idea) => (
              <Panel key={idea.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-white">{idea.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {ideaAuthor(idea)} · {formatDateTime(idea.createdAt)}
                    </div>
                  </div>
                  <Pill tone={toneFor(idea.ideaStatus)}>{idea.ideaStatus ?? "Proposed"}</Pill>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                  {idea.body}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="purple">{idea.votes ?? 0} votes</Pill>
                  {idea.project ? <Pill tone="cyan">{idea.project.title}</Pill> : null}

                  <button
                    type="button"
                    onClick={() => voteIdea(idea.id, true)}
                    className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white hover:bg-white/10"
                  >
                    Anonymous Vote
                  </button>

                  {!idea.authorMembership ? <Pill tone="amber">Anonymous</Pill> : null}

                  {isLeader(membership) ? (
                    <>
                      {["Review", "Approved", "Backlog", "Rejected"].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateIdeaStatus(idea.id, status)}
                          className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white hover:bg-white/10"
                        >
                          {status}
                        </button>
                      ))}
                    </>
                  ) : null}
                </div>
              </Panel>
            ))}

            {!operations.ideaBoard.length ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                No ideas yet. Be the first to suggest a growth idea.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeView === "workspace" ? (
        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Panel>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
              Universal Workspace
            </div>
            <h3 className="mt-2 text-2xl font-black text-white">
              Chat, files, mentions
            </h3>

            <form onSubmit={createUniversalMessage} className="mt-5 grid gap-3">
              <input
                value={workspaceMessage.title}
                onChange={(event) =>
                  setWorkspaceMessage((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Optional title"
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              />

              <select
                value={workspaceMessage.postType}
                onChange={(event) =>
                  setWorkspaceMessage((current) => ({ ...current, postType: event.target.value }))
                }
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none"
              >
                <option>Chat</option>
                <option>Announcement</option>
                <option>File</option>
                <option>Decision</option>
                <option>Update</option>
              </select>

              <textarea
                value={workspaceMessage.body}
                onChange={(event) =>
                  setWorkspaceMessage((current) => ({ ...current, body: event.target.value }))
                }
                placeholder="Message body. Tag people with @Name."
                className="min-h-28 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              />

              <textarea
                value={workspaceMessage.fileLinks}
                onChange={(event) =>
                  setWorkspaceMessage((current) => ({ ...current, fileLinks: event.target.value }))
                }
                placeholder="File links, one per line"
                className="min-h-20 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              />

              <button
                disabled={loading}
                className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                Post + Notify Mentions
              </button>
            </form>
          </Panel>

          <div className="grid max-h-[840px] gap-3 overflow-y-auto pr-2">
            {operations.unifiedMessages.map((post) => (
              <Panel key={post.id}>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-black text-white">{post.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {post.authorMembership ? memberName(post.authorMembership) : "Anonymous Contributor"} · {formatDateTime(post.createdAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={toneFor(post.postType)}>{post.postType}</Pill>
                    {post.project ? <Pill tone="purple">{post.project.title}</Pill> : null}
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{post.body}</p>

                {post.fileLinks?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {post.fileLinks.map((link) => (
                      <a
                        key={link}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100"
                      >
                        Open file
                      </a>
                    ))}
                  </div>
                ) : null}
              </Panel>
            ))}
          </div>
        </div>
      ) : null}

      {activeView === "my-work" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-green-400">
              Individual Workspace
            </div>
            <h3 className="mt-2 text-2xl font-black text-white">
              My assigned work
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Everyone can use Slice freely for their own work while still staying connected to the firm’s shared board.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {myTasks.map((task) => (
                <Panel key={task.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{task.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Due {shortDate(task.dueDate)}
                      </div>
                    </div>
                    <Pill tone={toneFor(task.status)}>{task.status}</Pill>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {task.detail || "No detail provided."}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => moveTask(task, "In Progress")}
                      className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-black text-white hover:bg-white/10"
                    >
                      Start
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTask(task, "Complete")}
                      className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-950"
                    >
                      Complete
                    </button>
                  </div>
                </Panel>
              ))}

              {!myTasks.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                  No assigned work yet.
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
              Selected Task
            </div>

            {selectedTask ? (
              <div className="mt-4 grid gap-4">
                <div>
                  <h3 className="text-2xl font-black text-white">{selectedTask.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {selectedTask.detail || "No detail provided."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Pill tone={toneFor(selectedTask.status)}>{selectedTask.status}</Pill>
                  <Pill tone={toneFor(selectedTask.priority)}>{selectedTask.priority}</Pill>
                  <Pill tone="cyan">{selectedTask.ownerName}</Pill>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {operations.scrumStatuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => moveTask(selectedTask, status)}
                      className={cx(
                        "rounded-2xl border px-3 py-3 text-xs font-black",
                        selectedTask.status === status
                          ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                          : "border-white/10 bg-white/[0.045] text-white hover:bg-white/10"
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <form onSubmit={createTimedReminder} className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                    Reminder Until Complete
                  </div>
                  <input
                    value={taskForm.reminderAt}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, reminderAt: event.target.value }))
                    }
                    placeholder="today, tomorrow 9am, Friday 2pm, or exact date"
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                  />
                  <textarea
                    value={taskForm.reminderNote}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, reminderNote: event.target.value }))
                    }
                    placeholder="Reminder note"
                    className="min-h-20 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                  />
                  <button
                    disabled={loading}
                    className="rounded-2xl bg-amber-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
                  >
                    Add Reminder
                  </button>
                </form>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Select a task to view details.</p>
            )}
          </Panel>
        </div>
      ) : null}
    </section>
  );
}