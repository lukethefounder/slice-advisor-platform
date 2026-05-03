"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";

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
  canAccessPortfolios: boolean;
  canManageProjects: boolean;
  canInviteMembers: boolean;
  canManageFirm: boolean;
  user?: User;
  firm?: Firm;
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

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignments: Array<{
    id: string;
    projectRole: string;
    membership: Membership;
  }>;
  agendaTasks: Array<{
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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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
          Firm Workspace
        </div>
      </div>
    </div>
  );
}

function weekStartToday() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function statusTone(status: string): "red" | "green" | "amber" | "slate" {
  if (["Active", "Open", "Pending"].includes(status)) return "amber";
  if (["Complete", "Done", "Accepted"].includes(status)) return "green";
  if (["Removed", "Revoked", "Blocked", "Delayed"].includes(status)) return "red";
  return "slate";
}

export default function FirmPage() {
  const [workspace, setWorkspace] = useState<FirmWorkspace | null>(null);
  const [selectedFirmId, setSelectedFirmId] = useState("");
  const [message, setMessage] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [inviteOutput, setInviteOutput] = useState("");

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

  const [commentForm, setCommentForm] = useState({
    taskId: "",
    body: "",
    commentType: "Inquiry",
  });

  const [postForm, setPostForm] = useState({
    title: "",
    body: "",
    postType: "Update",
    projectId: "",
  });

  const firm = workspace?.firm;
  const membership = workspace?.membership;

  const firmTasks = useMemo(() => {
    return (
      workspace?.agendas
        .flatMap((agenda) =>
          agenda.tasks.map((task) => ({
            ...task,
            agendaTitle: agenda.title,
            weekStart: agenda.weekStart,
            ownerName: agenda.membership.user?.name ?? "Team member",
          }))
        )
        .sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        }) ?? []
    );
  }, [workspace]);

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

  async function loadWorkspace(firmId?: string) {
    const query = firmId ? `?firmId=${firmId}` : "";
    const response = await fetch(`/api/firm-workspace${query}`, {
      cache: "no-store",
    });

    if (response.status === 401) {
      setUnauthorized(true);
      return;
    }

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as FirmWorkspace;
    setWorkspace(data);

    if (data.firm?.id) {
      setSelectedFirmId(data.firm.id);
    }
  }

  async function postAction(body: Record<string, unknown>) {
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

    setWorkspace(data);

    if (data.firm?.id) {
      setSelectedFirmId(data.firm.id);
    }

    if (data.inviteCode || data.inviteLink) {
      setInviteOutput(
        `Invite code: ${data.inviteCode}\nInvite link: ${data.inviteLink}`
      );
    }

    return data;
  }

  async function createFirm(event: FormEvent) {
    event.preventDefault();

    const data = await postAction({
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

    const data = await postAction({
      action: "acceptInvite",
      inviteCode: joinForm.inviteCode,
    });

    if (data) {
      setJoinForm({ inviteCode: "" });
      setMessage("Invite accepted. Firm joined.");
    }
  }

  async function createInvite(event: FormEvent) {
    event.preventDefault();

    if (!firm) return;

    const data = await postAction({
      action: "createInvite",
      firmId: firm.id,
      ...inviteForm,
    });

    if (data) {
      setInviteForm({ email: "", role: "Member" });
      setMessage("Invite created. Copy the invite code or link.");
    }
  }

  async function updateMember(
    member: Membership,
    patch: Partial<Membership>
  ) {
    if (!firm) return;

    await postAction({
      action: "updateMember",
      firmId: firm.id,
      membershipId: member.id,
      ...patch,
    });
  }

  async function removeMember(member: Membership) {
    if (!firm) return;

    await postAction({
      action: "removeMember",
      firmId: firm.id,
      membershipId: member.id,
    });
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();

    if (!firm) return;

    const data = await postAction({
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

  async function assignProject(projectId: string, membershipId: string) {
    if (!firm) return;

    await postAction({
      action: "assignProject",
      firmId: firm.id,
      projectId,
      membershipId,
      projectRole: "Contributor",
    });
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

    const data = await postAction({
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

    const data = await postAction({
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

    await postAction({
      action: "updateTask",
      firmId: firm.id,
      taskId,
      ...patch,
    });
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();

    if (!firm) return;

    const data = await postAction({
      action: "addComment",
      firmId: firm.id,
      taskId: commentForm.taskId || null,
      body: commentForm.body,
      commentType: commentForm.commentType,
    });

    if (data) {
      setCommentForm({
        taskId: "",
        body: "",
        commentType: "Inquiry",
      });
      setMessage("Comment added.");
    }
  }

  async function createPost(event: FormEvent) {
    event.preventDefault();

    if (!firm) return;

    const data = await postAction({
      action: "createPost",
      firmId: firm.id,
      ...postForm,
      projectId: postForm.projectId || null,
    });

    if (data) {
      setPostForm({
        title: "",
        body: "",
        postType: "Update",
        projectId: "",
      });
      setMessage("Team post published.");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");

    if (invite) {
      setJoinForm({ inviteCode: invite });
    }

    void loadWorkspace();
  }, []);

  if (unauthorized) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col items-center justify-center text-center">
          <Logo />
          <h1 className="mt-8 text-5xl font-black tracking-tight">
            Sign in to open Firm Workspace.
          </h1>
          <p className="mt-4 max-w-2xl text-slate-400">
            Register or log in through the portal first.
          </p>
          <a
            href="/portal"
            className="mt-8 rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-6 py-4 font-black text-white shadow-lg shadow-red-950/40"
          >
            Go to Login Portal
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <Logo />

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/command"
              className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
            >
              Command
            </a>

            <a
              href="/portfolio-lab"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Portfolio Lab
            </a>

            <a
              href="/wealth"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Wealth
            </a>

            <a
              href="/system"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              System
            </a>
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-6">
            <Card className="p-6">
              <h1 className="text-3xl font-black">Firm Access</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Create a firm workspace, accept an invite, or switch between firm
                workspaces you belong to.
              </p>

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
                  placeholder="Firm email, optional"
                />

                <button className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 font-black text-white">
                  Create Firm Workspace
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

              {workspace?.firms.length ? (
                <div className="mt-5 space-y-3">
                  {workspace.firms.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => loadWorkspace(item.id)}
                      className={cx(
                        "w-full rounded-3xl border p-4 text-left transition",
                        firm?.id === item.id
                          ? "border-red-500/40 bg-red-500/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className="font-black">{item.name}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {item.membership.role} · {item.firmCode}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </Card>

            {firm ? (
              <Card className="p-6">
                <h2 className="text-2xl font-black">Invite Team Members</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Invites are local copyable codes until email variables are added.
                </p>

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
                ) : (
                  <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">
                    You do not have invite permissions.
                  </div>
                )}

                {inviteOutput ? (
                  <textarea
                    value={inviteOutput}
                    readOnly
                    className="mt-4 min-h-24 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-red-200 outline-none"
                  />
                ) : null}
              </Card>
            ) : null}
          </div>

          <Card className="p-6">
            {firm ? (
              <>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <Pill tone="red">Firm Workspace</Pill>
                    <h1 className="mt-4 text-4xl font-black">{firm.name}</h1>
                    <p className="mt-2 text-sm text-slate-400">
                      {firm.firmCode} · {firm.firmEmail ?? "No firm email"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-right">
                    <div className="text-xs font-black uppercase text-red-300">
                      Your Role
                    </div>
                    <div className="text-2xl font-black">
                      {membership?.role}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm text-slate-400">Members</div>
                    <div className="mt-1 text-4xl font-black">
                      {workspace?.members.length ?? 0}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm text-slate-400">Projects</div>
                    <div className="mt-1 text-4xl font-black">
                      {workspace?.projects.length ?? 0}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm text-slate-400">Agendas</div>
                    <div className="mt-1 text-4xl font-black">
                      {workspace?.agendas.length ?? 0}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm text-slate-400">Tasks</div>
                    <div className="mt-1 text-4xl font-black">
                      {firmTasks.length}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
                <h1 className="text-3xl font-black">No firm selected yet.</h1>
                <p className="mt-3 text-slate-400">
                  Create a firm workspace or accept an invite code.
                </p>
              </div>
            )}
          </Card>
        </section>

        {firm ? (
          <>
            <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
              <Card className="p-6">
                <h2 className="text-2xl font-black">Team Members</h2>

                <div className="mt-5 space-y-3">
                  {workspace?.members.map((member) => (
                    <div
                      key={member.id}
                      className="rounded-3xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
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
                              onClick={() =>
                                updateMember(member, {
                                  canManageProjects: !member.canManageProjects,
                                })
                              }
                              className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white"
                            >
                              Projects:{" "}
                              {member.canManageProjects ? "On" : "Off"}
                            </button>

                            <button
                              onClick={() =>
                                updateMember(member, {
                                  canInviteMembers: !member.canInviteMembers,
                                })
                              }
                              className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white"
                            >
                              Invites:{" "}
                              {member.canInviteMembers ? "On" : "Off"}
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
                <h2 className="text-2xl font-black">Pending Invites</h2>

                <div className="mt-5 space-y-3">
                  {workspace?.invites.length ? (
                    workspace.invites.map((invite) => (
                      <div
                        key={invite.id}
                        className="rounded-3xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={statusTone(invite.status)}>
                                {invite.status}
                              </Pill>
                              <Pill tone="red">{invite.role}</Pill>
                            </div>

                            <div className="mt-3 font-black">{invite.email}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              Code: {invite.inviteCode}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
                      No invites yet.
                    </div>
                  )}
                </div>
              </Card>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <Card className="p-6">
                <h2 className="text-2xl font-black">Create Project</h2>

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
                      placeholder="Project description"
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
                        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                      >
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                        <option>Critical</option>
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
                        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                      />
                    </div>

                    <button className="w-full rounded-2xl bg-red-600 px-5 py-3 font-black text-white">
                      Create Project
                    </button>
                  </form>
                ) : (
                  <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">
                    You do not have project management permissions.
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h2 className="text-2xl font-black">Project Board</h2>

                <div className="mt-5 space-y-3">
                  {workspace?.projects.length ? (
                    workspace.projects.map((project) => (
                      <div
                        key={project.id}
                        className="rounded-3xl border border-white/10 bg-white/5 p-5"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
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

                            <div className="mt-3 text-xs text-slate-500">
                              {project.assignments.length} assigned ·{" "}
                              {project.agendaTasks.length} tasks
                            </div>
                          </div>

                          {canManageProjects ? (
                            <select
                              onChange={(event) => {
                                if (event.target.value) {
                                  assignProject(project.id, event.target.value);
                                }
                              }}
                              className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-semibold text-white outline-none"
                              defaultValue=""
                            >
                              <option value="">Assign member</option>
                              {workspace.members
                                .filter((member) => member.status === "Active")
                                .map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.user?.name}
                                  </option>
                                ))}
                            </select>
                          ) : null}
                        </div>

                        {project.assignments.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {project.assignments.map((assignment) => (
                              <Pill key={assignment.id} tone="green">
                                {assignment.membership.user?.name} ·{" "}
                                {assignment.projectRole}
                              </Pill>
                            ))}
                          </div>
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
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <Card className="p-6">
                <h2 className="text-2xl font-black">Post Weekly Agenda</h2>

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
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                  />

                  <input
                    value={agendaForm.title}
                    onChange={(event) =>
                      setAgendaForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
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
                    className="min-h-20 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Weekly focus"
                  />

                  <textarea
                    value={agendaForm.blockers}
                    onChange={(event) =>
                      setAgendaForm((current) => ({
                        ...current,
                        blockers: event.target.value,
                      }))
                    }
                    className="min-h-20 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Blockers or delays"
                  />

                  {[1, 2, 3].map((number) => (
                    <input
                      key={number}
                      value={agendaForm[`task${number}` as keyof typeof agendaForm]}
                      onChange={(event) =>
                        setAgendaForm((current) => ({
                          ...current,
                          [`task${number}`]: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                      placeholder={`Task ${number}`}
                    />
                  ))}

                  <button className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 font-black text-white">
                    Post Weekly Agenda
                  </button>
                </form>
              </Card>

              <Card className="p-6">
                <h2 className="text-2xl font-black">Calendar-Like Task Board</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Tasks are sorted by due date and can be checked off, delayed, or
                  escalated with inquiries.
                </p>

                <div className="mt-5 space-y-3">
                  {firmTasks.length ? (
                    firmTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-3xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={statusTone(task.status)}>
                                {task.status}
                              </Pill>
                              <Pill tone="amber">{task.priority}</Pill>
                              {task.dueDate ? (
                                <Pill tone="slate">Due {task.dueDate}</Pill>
                              ) : null}
                            </div>

                            <div className="mt-3 text-lg font-black">
                              {task.title}
                            </div>

                            <div className="mt-1 text-sm text-slate-400">
                              {task.ownerName} · {task.agendaTitle}
                            </div>

                            {task.project ? (
                              <div className="mt-2 text-xs text-red-300">
                                Project: {task.project.title}
                              </div>
                            ) : null}

                            {task.detail ? (
                              <p className="mt-2 text-sm text-slate-400">
                                {task.detail}
                              </p>
                            ) : null}

                            {task.delayReason ? (
                              <p className="mt-2 text-sm text-amber-300">
                                Delay: {task.delayReason}
                              </p>
                            ) : null}

                            {task.inquiry ? (
                              <p className="mt-2 text-sm text-purple-300">
                                Inquiry: {task.inquiry}
                              </p>
                            ) : null}

                            {task.comments.length ? (
                              <div className="mt-3 space-y-2">
                                {task.comments.map((comment) => (
                                  <div
                                    key={comment.id}
                                    className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-slate-300"
                                  >
                                    <strong>{comment.user.name}</strong>:{" "}
                                    {comment.body}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() =>
                                updateTask(task.id, {
                                  status:
                                    task.status === "Complete"
                                      ? "Open"
                                      : "Complete",
                                })
                              }
                              className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-300 ring-1 ring-emerald-500/30"
                            >
                              {task.status === "Complete" ? "Reopen" : "✓ Done"}
                            </button>

                            <button
                              onClick={() =>
                                updateTask(task.id, {
                                  status: "Delayed",
                                  delayReason:
                                    window.prompt("Why is this delayed?") ||
                                    "Delayed without details.",
                                })
                              }
                              className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-300 ring-1 ring-amber-500/30"
                            >
                              Delay
                            </button>

                            <button
                              onClick={() =>
                                updateTask(task.id, {
                                  inquiry:
                                    window.prompt(
                                      "What question or inquiry should be attached?"
                                    ) || "Inquiry added without details.",
                                })
                              }
                              className="rounded-xl bg-purple-500/10 px-3 py-2 text-xs font-black text-purple-300 ring-1 ring-purple-500/30"
                            >
                              Inquiry
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
                      No agenda tasks yet.
                    </div>
                  )}
                </div>
              </Card>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <Card className="p-6">
                <h2 className="text-2xl font-black">Add Task / Inquiry</h2>

                <form onSubmit={addTask} className="mt-5 space-y-3">
                  <select
                    value={taskForm.agendaId}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        agendaId: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                  >
                    <option value="">Select agenda</option>
                    {workspace?.agendas.map((agenda) => (
                      <option key={agenda.id} value={agenda.id}>
                        {agenda.title} · {agenda.membership.user?.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={taskForm.projectId}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        projectId: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                  >
                    <option value="">No project</option>
                    {workspace?.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
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
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Task title"
                  />

                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                  />

                  <textarea
                    value={taskForm.detail}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        detail: event.target.value,
                      }))
                    }
                    className="min-h-20 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Task detail"
                  />

                  <button className="w-full rounded-2xl bg-red-600 px-5 py-3 font-black text-white">
                    Add Task
                  </button>
                </form>

                <form onSubmit={addComment} className="mt-6 space-y-3">
                  <select
                    value={commentForm.taskId}
                    onChange={(event) =>
                      setCommentForm((current) => ({
                        ...current,
                        taskId: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                  >
                    <option value="">Select task for inquiry/comment</option>
                    {firmTasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={commentForm.body}
                    onChange={(event) =>
                      setCommentForm((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    className="min-h-20 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Add inquiry, blocker, or comment"
                  />

                  <button className="w-full rounded-2xl bg-white px-5 py-3 font-black text-slate-950">
                    Add Inquiry / Comment
                  </button>
                </form>
              </Card>

              <Card className="p-6">
                <h2 className="text-2xl font-black">Team Updates Board</h2>

                <form onSubmit={createPost} className="mt-5 space-y-3">
                  <input
                    value={postForm.title}
                    onChange={(event) =>
                      setPostForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Update title"
                  />

                  <select
                    value={postForm.projectId}
                    onChange={(event) =>
                      setPostForm((current) => ({
                        ...current,
                        projectId: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                  >
                    <option value="">General firm update</option>
                    {workspace?.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={postForm.body}
                    onChange={(event) =>
                      setPostForm((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Post an update, request, blocker, or weekly note"
                  />

                  <button className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 font-black text-white">
                    Post Update
                  </button>
                </form>

                <div className="mt-6 space-y-3">
                  {workspace?.posts.length ? (
                    workspace.posts.map((post) => (
                      <div
                        key={post.id}
                        className="rounded-3xl border border-white/10 bg-white/5 p-5"
                      >
                        <div className="flex flex-wrap gap-2">
                          <Pill tone="red">{post.postType}</Pill>
                          {post.project ? (
                            <Pill tone="amber">{post.project.title}</Pill>
                          ) : (
                            <Pill tone="slate">General</Pill>
                          )}
                        </div>

                        <div className="mt-3 text-xl font-black">{post.title}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {post.body}
                        </p>

                        <div className="mt-3 text-xs text-slate-500">
                          {post.authorMembership?.user?.name ?? "Unknown"} ·{" "}
                          {new Date(post.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
                      No team posts yet.
                    </div>
                  )}
                </div>
              </Card>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}