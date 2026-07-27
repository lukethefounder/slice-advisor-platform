"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";

type TaskKind = "Objective" | "Goal" | "Task";
type PlanningView = "calendar" | "firm-goals";

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
  agendaTasks?: Array<{
    id: string;
    status: string;
  }>;
};

type PlanningTask = {
  id: string;
  agendaId: string;
  weekStart: string;
  title: string;
  detail: string;
  kind: TaskKind;
  status: string;
  priority: string;
  dueDate: string | null;
  delayReason: string | null;
  inquiry: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: Project | null;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerColor: string;
};

type FirmPlanningData = {
  user: User;
  firms: Array<Firm & { membership: Membership }>;
  firm: Firm | null;
  membership: Membership | null;
  members: Membership[];
  projects: Project[];
  tasks: PlanningTask[];
};

type CalendarDay = {
  date: Date;
  dateString: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function dateToString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
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

function getMonthDays(currentMonth: Date): CalendarDay[] {
  const first = startOfMonth(currentMonth);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const firstDayOfWeek = first.getDay();
  const totalDays = last.getDate();

  const days: CalendarDay[] = [];
  const todayString = dateToString(new Date());

  for (let index = firstDayOfWeek; index > 0; index -= 1) {
    const date = new Date(first);
    date.setDate(first.getDate() - index);

    days.push({
      date,
      dateString: dateToString(date),
      dayNumber: date.getDate(),
      isCurrentMonth: false,
      isToday: dateToString(date) === todayString,
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(first.getFullYear(), first.getMonth(), day);

    days.push({
      date,
      dateString: dateToString(date),
      dayNumber: day,
      isCurrentMonth: true,
      isToday: dateToString(date) === todayString,
    });
  }

  while (days.length % 7 !== 0) {
    const previous = days[days.length - 1].date;
    const date = new Date(previous);
    date.setDate(previous.getDate() + 1);

    days.push({
      date,
      dateString: dateToString(date),
      dayNumber: date.getDate(),
      isCurrentMonth: false,
      isToday: dateToString(date) === todayString,
    });
  }

  return days;
}

function statusTone(status: string) {
  if (["Complete", "Done", "Delivered", "Accepted", "Ready"].includes(status)) {
    return "green";
  }

  if (["Delayed", "Blocked", "Critical", "At Risk"].includes(status)) {
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
        "rounded-[2rem] border border-white/10 bg-zinc-950/70 shadow-xl shadow-emerald-950/20 backdrop-blur-xl",
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
    red: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
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
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-950 via-zinc-950 to-emerald-700 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-emerald-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-emerald-700" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">
          Firm Planning
        </div>
      </div>
    </div>
  );
}

function taskKindTone(kind: TaskKind) {
  if (kind === "Objective") return "purple";
  if (kind === "Goal") return "red";
  return "slate";
}

export default function FirmPlanningPage() {
  const [data, setData] = useState<FirmPlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeView, setActiveView] = useState<PlanningView>("calendar");
  const [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(new Date())
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [celebratingTaskId, setCelebratingTaskId] = useState<string | null>(
    null
  );

  const [taskForm, setTaskForm] = useState({
    title: "",
    detail: "",
    kind: "Task" as TaskKind,
    priority: "Medium",
    dueDate: dateToString(new Date()),
    targetMembershipId: "",
    projectId: "",
  });

  const [goalForm, setGoalForm] = useState({
    title: "",
    description: "",
    priority: "High",
    startDate: dateToString(new Date()),
    targetDate: "",
  });

  const firm = data?.firm ?? null;
  const membership = data?.membership ?? null;

  const canManageProjects =
    membership?.role === "Owner" ||
    membership?.canManageProjects ||
    membership?.canManageFirm;

  const calendarDays = useMemo(() => getMonthDays(currentMonth), [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, PlanningTask[]>();

    for (const task of data?.tasks ?? []) {
      if (!task.dueDate) continue;

      const existing = map.get(task.dueDate) ?? [];
      existing.push(task);
      map.set(task.dueDate, existing);
    }

    for (const [date, tasks] of map.entries()) {
      map.set(
        date,
        tasks.sort((a, b) => {
          const aComplete = a.status === "Complete" || a.status === "Done";
          const bComplete = b.status === "Complete" || b.status === "Done";

          if (aComplete !== bComplete) return aComplete ? 1 : -1;

          const priorityOrder: Record<string, number> = {
            Critical: 0,
            High: 1,
            Medium: 2,
            Low: 3,
          };

          return (
            (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
          );
        })
      );
    }

    return map;
  }, [data?.tasks]);

  const monthTasks = useMemo(() => {
    const monthPrefix = `${currentMonth.getFullYear()}-${`${currentMonth.getMonth() + 1}`.padStart(2, "0")}`;

    return (data?.tasks ?? []).filter((task) =>
      task.dueDate?.startsWith(monthPrefix)
    );
  }, [currentMonth, data?.tasks]);

  const completedMonthTasks = monthTasks.filter(
    (task) => task.status === "Complete" || task.status === "Done"
  );

  const openMonthTasks = monthTasks.filter(
    (task) => task.status !== "Complete" && task.status !== "Done"
  );

  const firmGoals = useMemo(() => {
    return (data?.projects ?? []).filter((project) => {
      const description = project.description ?? "";

      return (
        project.status !== "Active" ||
        description.includes("Timeframe:") ||
        ["On Track", "At Risk", "Paused", "Complete"].includes(project.status)
      );
    });
  }, [data?.projects]);

  const currentMonthStart = startOfMonth(currentMonth);
  const earliestAllowedMonth = addMonths(startOfMonth(new Date()), -2);
  const canGoBack = currentMonthStart > earliestAllowedMonth;

  async function loadPlanning(firmId?: string) {
    const query = firmId ? `?firmId=${firmId}` : "";
    const response = await fetch(`/api/firm-planning${query}`, {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to load firm planning.");
      return;
    }

    setData(payload);
    setTaskForm((current) => ({
      ...current,
      targetMembershipId:
        current.targetMembershipId || payload.membership?.id || "",
    }));
  }

  async function postPlanningAction(body: Record<string, unknown>) {
    if (!firm) return null;

    setMessage("");

    const response = await fetch("/api/firm-planning", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firmId: firm.id,
        ...body,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Planning action failed.");
      return null;
    }

    setData(payload);
    return payload;
  }

  function openTaskCreator(dateString: string) {
    setSelectedDay(dateString);
    setTaskForm((current) => ({
      ...current,
      dueDate: dateString,
      title: "",
      detail: "",
      kind: "Task",
      priority: "Medium",
      targetMembershipId: current.targetMembershipId || membership?.id || "",
      projectId: "",
    }));
    setShowTaskModal(true);
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();

    const payload = await postPlanningAction({
      action: "createCalendarTask",
      ...taskForm,
      targetMembershipId: taskForm.targetMembershipId || membership?.id,
      projectId: taskForm.projectId || null,
    });

    if (payload) {
      setShowTaskModal(false);
      setSelectedDay(null);
      setTaskForm({
        title: "",
        detail: "",
        kind: "Task",
        priority: "Medium",
        dueDate: dateToString(new Date()),
        targetMembershipId: membership?.id ?? "",
        projectId: "",
      });
      setMessage("Calendar item added.");
    }
  }

  async function toggleTask(task: PlanningTask) {
    const nextStatus =
      task.status === "Complete" || task.status === "Done" ? "Open" : "Complete";

    const payload = await postPlanningAction({
      action: "updateCalendarTask",
      taskId: task.id,
      status: nextStatus,
    });

    if (payload && nextStatus === "Complete") {
      setCelebratingTaskId(task.id);
      setTimeout(() => setCelebratingTaskId(null), 1800);
    }
  }

  async function createFirmGoal(event: FormEvent) {
    event.preventDefault();

    const payload = await postPlanningAction({
      action: "createFirmGoal",
      ...goalForm,
    });

    if (payload) {
      setGoalForm({
        title: "",
        description: "",
        priority: "High",
        startDate: dateToString(new Date()),
        targetDate: "",
      });
      setMessage("Firm goal created.");
    }
  }

  async function updateFirmGoalStatus(goal: Project, status: string) {
    await postPlanningAction({
      action: "updateFirmGoal",
      goalId: goal.id,
      status,
    });
  }

  useEffect(() => {
    async function run() {
      try {
        await loadPlanning();
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(4,120,87,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <Logo />
          <div className="mt-8 text-sm font-semibold text-slate-400">
            Loading firm planning calendar...
          </div>
        </div>
      </main>
    );
  }

  if (!data?.user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(4,120,87,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <div className="mx-auto max-w-3xl">
          <Logo />

          <Card className="mt-8 p-8">
            <h1 className="text-3xl font-black">Login required</h1>
            <p className="mt-3 text-slate-400">
              Please log in through the Slice workspace before using firm
              planning.
            </p>
            <a
              href="/workspace"
              className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-black text-slate-950"
            >
              Go to Workspace
            </a>
          </Card>
        </div>
      </main>
    );
  }

  if (!firm || !membership) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(4,120,87,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <div className="mx-auto max-w-4xl">
          <Logo />

          <Card className="mt-8 p-8">
            <Pill tone="amber">Firm setup needed</Pill>
            <h1 className="mt-4 text-4xl font-black">
              Create or join a firm first.
            </h1>
            <p className="mt-3 text-slate-400">
              This calendar is built for firm members. Create a firm workspace or
              accept an invite from the main Slice workspace.
            </p>

            <a
              href="/workspace"
              className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-black text-slate-950"
            >
              Open Workspace
            </a>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(4,120,87,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <style>{`
        @keyframes celebrate-pop {
          0% { transform: scale(0.6) translateY(10px); opacity: 0; }
          20% { transform: scale(1.05) translateY(0); opacity: 1; }
          80% { transform: scale(1) translateY(-6px); opacity: 1; }
          100% { transform: scale(0.9) translateY(-16px); opacity: 0; }
        }

        @keyframes confetti-float {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-28px) rotate(24deg); opacity: 0; }
        }

        .celebrate-pop {
          animation: celebrate-pop 1.8s ease-out forwards;
        }

        .confetti-piece {
          animation: confetti-float 1.2s ease-out forwards;
        }
      `}</style>

      <div className="mx-auto max-w-7xl">
        <header className="sticky top-4 z-40 rounded-[2rem] border border-white/10 bg-black/70 p-4 shadow-xl shadow-emerald-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <Logo />

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <div className="text-xs font-black uppercase text-slate-500">
                  Firm
                </div>
                <div className="font-black">{firm.name}</div>
              </div>

              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <div className="text-xs font-black uppercase text-slate-500">
                  Member
                </div>
                <div className="font-black">{data.user.name}</div>
              </div>

              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
              >
                Workspace
              </a>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveView("calendar")}
              className={cx(
                "rounded-full px-4 py-2 text-sm font-black transition",
                activeView === "calendar"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-950 text-white shadow-lg shadow-emerald-950/40"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              )}
            >
              Monthly Calendar
            </button>

            <button
              onClick={() => setActiveView("firm-goals")}
              className={cx(
                "rounded-full px-4 py-2 text-sm font-black transition",
                activeView === "firm-goals"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-950 text-white shadow-lg shadow-emerald-950/40"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              )}
            >
              Firm Goals
            </button>
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">
            {message}
          </div>
        ) : null}

        {activeView === "calendar" ? (
          <section className="mt-6 grid gap-6">
            <section className="grid gap-4 md:grid-cols-4">
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Month
                </div>
                <div className="mt-2 text-2xl font-black">
                  {monthLabel(currentMonth)}
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Open
                </div>
                <div className="mt-2 text-3xl font-black">
                  {openMonthTasks.length}
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Completed
                </div>
                <div className="mt-2 text-3xl font-black text-emerald-300">
                  {completedMonthTasks.length}
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Completion
                </div>
                <div className="mt-2 text-3xl font-black">
                  {monthTasks.length
                    ? Math.round(
                        (completedMonthTasks.length / monthTasks.length) * 100
                      )
                    : 0}
                  %
                </div>
              </Card>
            </section>

            <Card className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <Pill tone="purple">Daily execution calendar</Pill>
                  <h1 className="mt-3 text-4xl font-black">
                    Objectives, goals, and tasks by day.
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                    Team members can hit the plus button on any day, assign a
                    goal or task, complete it with a checkbox, and review the
                    previous two months while scheduling as far into the future
                    as needed.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={!canGoBack}
                    onClick={() => setCurrentMonth((current) => addMonths(current, -1))}
                    className={cx(
                      "rounded-2xl px-4 py-3 font-black",
                      canGoBack
                        ? "bg-white/10 text-white hover:bg-white/20"
                        : "cursor-not-allowed bg-white/5 text-slate-600"
                    )}
                  >
                    ← Previous
                  </button>

                  <button
                    onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                    className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white hover:bg-white/20"
                  >
                    Today
                  </button>

                  <button
                    onClick={() => setCurrentMonth((current) => addMonths(current, 1))}
                    className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
                  >
                    Next →
                  </button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-7">
                {calendarDays.map((day) => {
                  const dayTasks = tasksByDate.get(day.dateString) ?? [];

                  return (
                    <div
                      key={day.dateString}
                      className={cx(
                        "min-h-[190px] rounded-3xl border p-3 transition",
                        day.isCurrentMonth
                          ? "border-white/10 bg-black/30"
                          : "border-white/5 bg-white/[0.02] opacity-50",
                        day.isToday && "ring-2 ring-emerald-500/60"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div
                            className={cx(
                              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-black",
                              day.isToday
                                ? "bg-emerald-600 text-white"
                                : "bg-white/10 text-slate-200"
                            )}
                          >
                            {day.dayNumber}
                          </div>
                        </div>

                        <button
                          onClick={() => openTaskCreator(day.dateString)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-slate-950 transition hover:scale-105"
                          title={`Add task for ${day.dateString}`}
                        >
                          +
                        </button>
                      </div>

                      <div className="mt-3 space-y-2">
                        {dayTasks.slice(0, 4).map((task) => {
                          const isComplete =
                            task.status === "Complete" || task.status === "Done";

                          return (
                            <div
                              key={task.id}
                              className={cx(
                                "relative rounded-2xl border p-2 text-left",
                                isComplete
                                  ? "border-emerald-500/30 bg-emerald-500/10"
                                  : "border-white/10 bg-white/5"
                              )}
                            >
                              {celebratingTaskId === task.id ? (
                                <div className="celebrate-pop pointer-events-none absolute inset-x-0 -top-8 z-20 mx-auto w-max rounded-full bg-white px-3 py-2 text-xs font-black text-slate-950 shadow-xl">
                                  Nice work 🎉
                                  <span className="confetti-piece absolute -left-3 top-1 text-emerald-500">
                                    ◆
                                  </span>
                                  <span className="confetti-piece absolute -right-3 top-1 text-emerald-400">
                                    ◆
                                  </span>
                                  <span className="confetti-piece absolute left-1/2 -top-2 text-amber-300">
                                    ◆
                                  </span>
                                </div>
                              ) : null}

                              <div className="flex items-start gap-2">
                                <button
                                  onClick={() => toggleTask(task)}
                                  className={cx(
                                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-black",
                                    isComplete
                                      ? "border-emerald-400 bg-emerald-400 text-slate-950"
                                      : "border-white/20 bg-black/40 text-transparent"
                                  )}
                                  title={
                                    isComplete
                                      ? "Mark incomplete"
                                      : "Mark complete"
                                  }
                                >
                                  ✓
                                </button>

                                <div className="min-w-0 flex-1">
                                  <div
                                    className={cx(
                                      "truncate text-xs font-black",
                                      isComplete &&
                                        "text-emerald-200 line-through"
                                    )}
                                  >
                                    {task.title}
                                  </div>

                                  <div className="mt-1 flex flex-wrap gap-1">
                                    <Pill tone={taskKindTone(task.kind)}>
                                      {task.kind}
                                    </Pill>
                                    <Pill tone={statusTone(task.priority) as "red" | "green" | "amber" | "slate"}>
                                      {task.priority}
                                    </Pill>
                                  </div>

                                  <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">
                                    {task.ownerName}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {dayTasks.length > 4 ? (
                          <div className="rounded-2xl bg-white/5 px-3 py-2 text-xs font-black text-slate-400">
                            +{dayTasks.length - 4} more
                          </div>
                        ) : null}

                        {!dayTasks.length ? (
                          <div className="rounded-2xl border border-dashed border-white/10 p-3 text-xs font-bold text-slate-600">
                            No items yet.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <Card className="p-5">
                <h2 className="text-2xl font-black">Team legend</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Each member keeps their own calendar color.
                </p>

                <div className="mt-4 space-y-3">
                  {data.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: member.calendarColor }}
                        />
                        <div>
                          <div className="font-black">
                            {member.user?.name ?? "Team member"}
                          </div>
                          <div className="text-xs font-semibold text-slate-500">
                            {member.role}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="text-2xl font-black">
                  Month task detail
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  A detailed view of all tasks, goals, and objectives for the
                  selected month.
                </p>

                <div className="mt-4 space-y-3">
                  {monthTasks.length ? (
                    monthTasks.map((task) => {
                      const isComplete =
                        task.status === "Complete" || task.status === "Done";

                      return (
                        <div
                          key={task.id}
                          className="rounded-3xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap gap-2">
                                <Pill tone={taskKindTone(task.kind)}>
                                  {task.kind}
                                </Pill>
                                <Pill tone={statusTone(task.status) as "red" | "green" | "amber" | "slate"}>
                                  {task.status}
                                </Pill>
                                <Pill tone="slate">{shortDate(task.dueDate)}</Pill>
                              </div>

                              <h3
                                className={cx(
                                  "mt-3 text-xl font-black",
                                  isComplete && "text-emerald-200 line-through"
                                )}
                              >
                                {task.title}
                              </h3>

                              {task.detail ? (
                                <p className="mt-2 text-sm leading-6 text-slate-400">
                                  {task.detail}
                                </p>
                              ) : null}

                              <div className="mt-3 text-xs font-bold text-slate-500">
                                Assigned to {task.ownerName}
                                {task.project ? ` · Linked to ${task.project.title}` : ""}
                              </div>
                            </div>

                            <button
                              onClick={() => toggleTask(task)}
                              className={cx(
                                "rounded-2xl px-4 py-3 text-sm font-black",
                                isComplete
                                  ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/30"
                                  : "bg-white text-slate-950"
                              )}
                            >
                              {isComplete ? "Completed ✓" : "Complete"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-500">
                      No tasks in this month yet. Use the plus button on a day
                      to add one.
                    </div>
                  )}
                </div>
              </Card>
            </section>
          </section>
        ) : null}

        {activeView === "firm-goals" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <Card className="p-6">
              <Pill tone="red">Firm goals</Pill>
              <h1 className="mt-4 text-4xl font-black">
                Big-picture goals with clear timeframes.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Use this tab for larger firm-wide priorities: revenue targets,
                client acquisition, operational upgrades, research initiatives,
                portfolio review cycles, or platform development milestones.
              </p>

              {canManageProjects ? (
                <form onSubmit={createFirmGoal} className="mt-6 space-y-4">
                  <input
                    value={goalForm.title}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Firm goal title"
                  />

                  <textarea
                    value={goalForm.description}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Why this matters, what success looks like, and who owns it."
                  />

                  <div className="grid gap-3 md:grid-cols-3">
                    <select
                      value={goalForm.priority}
                      onChange={(event) =>
                        setGoalForm((current) => ({
                          ...current,
                          priority: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                    >
                      <option>Critical</option>
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>

                    <input
                      type="date"
                      value={goalForm.startDate}
                      onChange={(event) =>
                        setGoalForm((current) => ({
                          ...current,
                          startDate: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                    />

                    <input
                      type="date"
                      value={goalForm.targetDate}
                      onChange={(event) =>
                        setGoalForm((current) => ({
                          ...current,
                          targetDate: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                    />
                  </div>

                  <button className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-5 py-4 font-black text-white shadow-lg shadow-emerald-950/40">
                    Create Firm Goal
                  </button>
                </form>
              ) : (
                <div className="mt-6 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm font-bold text-amber-200">
                  You can view firm goals, but only owners/admins/project
                  managers can create or update them.
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-3xl font-black">Goal board</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Track major firm initiatives and their target dates.
                  </p>
                </div>

                <Pill tone="purple">{firmGoals.length} goal(s)</Pill>
              </div>

              <div className="mt-6 space-y-4">
                {firmGoals.length ? (
                  firmGoals.map((goal) => {
                    const totalTasks = goal.agendaTasks?.length ?? 0;
                    const completedTasks =
                      goal.agendaTasks?.filter(
                        (task) =>
                          task.status === "Complete" || task.status === "Done"
                      ).length ?? 0;

                    const completion = totalTasks
                      ? Math.round((completedTasks / totalTasks) * 100)
                      : 0;

                    return (
                      <div
                        key={goal.id}
                        className="rounded-[2rem] border border-white/10 bg-white/5 p-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={statusTone(goal.status) as "red" | "green" | "amber" | "slate"}>
                                {goal.status}
                              </Pill>
                              <Pill tone={statusTone(goal.priority) as "red" | "green" | "amber" | "slate"}>
                                {goal.priority}
                              </Pill>
                              <Pill tone="slate">
                                Target: {shortDate(goal.dueDate)}
                              </Pill>
                            </div>

                            <h3 className="mt-4 text-2xl font-black">
                              {goal.title}
                            </h3>

                            {goal.description ? (
                              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-400">
                                {goal.description}
                              </p>
                            ) : null}

                            <div className="mt-4">
                              <div className="flex items-center justify-between text-xs font-black uppercase text-slate-500">
                                <span>Linked task progress</span>
                                <span>{completion}%</span>
                              </div>

                              <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/40">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                                  style={{ width: `${completion}%` }}
                                />
                              </div>

                              <div className="mt-2 text-xs font-semibold text-slate-500">
                                {completedTasks}/{totalTasks} linked tasks
                                completed
                              </div>
                            </div>
                          </div>

                          {canManageProjects ? (
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <button
                                onClick={() =>
                                  updateFirmGoalStatus(goal, "On Track")
                                }
                                className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200 ring-1 ring-emerald-500/30"
                              >
                                On Track
                              </button>

                              <button
                                onClick={() =>
                                  updateFirmGoalStatus(goal, "At Risk")
                                }
                                className="rounded-2xl bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-200 ring-1 ring-amber-500/30"
                              >
                                At Risk
                              </button>

                              <button
                                onClick={() =>
                                  updateFirmGoalStatus(goal, "Paused")
                                }
                                className="rounded-2xl bg-slate-500/10 px-3 py-2 text-xs font-black text-slate-200 ring-1 ring-slate-500/30"
                              >
                                Pause
                              </button>

                              <button
                                onClick={() =>
                                  updateFirmGoalStatus(goal, "Complete")
                                }
                                className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-950"
                              >
                                Complete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
                    <h3 className="text-2xl font-black">
                      No firm goals created yet.
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Add a big-picture goal with a specific timeframe to start
                      building the firm’s strategic roadmap.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </section>
        ) : null}
      </div>

      {showTaskModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur">
          <Card className="w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Pill tone="purple">Add calendar item</Pill>
                <h2 className="mt-3 text-3xl font-black">
                  {selectedDay ? shortDate(selectedDay) : "New item"}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Create an objective, goal, or simple task for this day.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowTaskModal(false);
                  setSelectedDay(null);
                }}
                className="rounded-full bg-white/10 px-4 py-2 font-black text-slate-300 hover:bg-white/20"
              >
                ×
              </button>
            </div>

            <form onSubmit={createTask} className="mt-6 space-y-4">
              <input
                value={taskForm.title}
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="What needs to get done?"
              />

              <textarea
                value={taskForm.detail}
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    detail: event.target.value,
                  }))
                }
                className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Optional details, context, or success criteria"
              />

              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={taskForm.kind}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      kind: event.target.value as TaskKind,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                >
                  <option>Task</option>
                  <option>Objective</option>
                  <option>Goal</option>
                </select>

                <select
                  value={taskForm.priority}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
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
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                />

                <select
                  value={taskForm.targetMembershipId}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      targetMembershipId: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
                >
                  {data.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.user?.name ?? "Team member"} — {member.role}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={taskForm.projectId}
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    projectId: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2"
              >
                <option value="">No linked firm goal/project</option>
                {data.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>

              <button className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-5 py-4 font-black text-white shadow-lg shadow-emerald-950/40">
                Add to Calendar
              </button>
            </form>
          </Card>
        </div>
      ) : null}
    </main>
  );
}