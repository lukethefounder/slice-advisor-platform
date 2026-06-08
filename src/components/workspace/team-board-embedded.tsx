"use client";

import {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
      channel?: string;
      destination?: string | null;
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
  emailResult?: {
    status: string;
    reason: string;
    simulated: boolean;
  };
};

type InternalView =
  | "delegate"
  | "calendar"
  | "ideas"
  | "workspace"
  | "my-work"
  | "docs";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";

type LocalAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  createdAt: string;
};

type LocalDoc = {
  id: string;
  ownerUserId: string;
  title: string;
  category: string;
  labels: string[];
  body: string;
  fontSize: string;
  fontFamily: string;
  favorite?: boolean;
  template?: string;
  attachments: LocalAttachment[];
  updatedAt: string;
  createdAt: string;
};

type LocalTodo = {
  id: string;
  ownerUserId: string;
  title: string;
  date: string;
  category: string;
  done: boolean;
  createdAt: string;
};

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

const inputClass =
  "rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-red-400/40 focus:ring-2 focus:ring-red-500/20";

const viewTabs: Array<[InternalView, string, string, Tone]> = [
  ["delegate", "Delegate", "Assign work", "red"],
  ["calendar", "Calendar", "Click reminders", "purple"],
  ["ideas", "Brainstorm", "Bubble chart", "purple"],
  ["workspace", "Universal", "Shared room", "cyan"],
  ["my-work", "My Work", "Personal day", "green"],
  ["docs", "Docs", "Individual notes", "amber"],
];

const docTemplates = [
  {
    name: "Daily Notes",
    category: "Daily Notes",
    labels: ["daily", "execution"],
    body:
      "Daily Focus\n\nTop Objectives:\n1. \n2. \n3. \n\nNotes:\n\nFollow-ups:\n",
  },
  {
    name: "Client Prep",
    category: "Client Prep",
    labels: ["client", "meeting"],
    body:
      "Client Meeting Prep\n\nClient:\nDate:\nObjective:\n\nKey Talking Points:\n- \n- \n\nQuestions to Ask:\n- \n\nFollow-up Items:\n- ",
  },
  {
    name: "Research Memo",
    category: "Research",
    labels: ["research", "memo"],
    body:
      "Research Memo\n\nTopic:\nSource Links:\n\nThesis:\n\nEvidence:\n\nRisks:\n\nAdvisor Notes:\n\nAction Items:\n",
  },
  {
    name: "Investment Note",
    category: "Investment Notes",
    labels: ["investment", "analysis"],
    body:
      "Investment Note\n\nSecurity / Topic:\nReason for Review:\n\nBull Case:\n\nBear Case:\n\nKey Data:\n\nClient Relevance:\n\nNext Action:\n",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`);
}

function addDays(dateString: string, days: number) {
  const date = toDate(dateString);
  date.setDate(date.getDate() + days);
  return ymd(date);
}

function startOfWeek(dateString: string) {
  const date = toDate(dateString);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return ymd(date);
}

function monthStart(dateString: string) {
  const date = toDate(dateString);
  date.setDate(1);
  return ymd(date);
}

function calendarMonthDays(anchorDate: string) {
  const start = toDate(monthStart(anchorDate));
  const firstGridDay = startOfWeek(ymd(start));
  return Array.from({ length: 42 }).map((_, index) => addDays(firstGridDay, index));
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

function monthTitle(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function dayNumber(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
  });
}

function weekdayShort(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
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

function toneFor(value: string | number | null | undefined): Tone {
  const lower = String(value ?? "").toLowerCase();
  const numeric = typeof value === "number" ? value : Number.NaN;

  if (
    lower.includes("blocked") ||
    lower.includes("failed") ||
    lower.includes("overdue") ||
    lower.includes("critical") ||
    lower.includes("high") ||
    (!Number.isNaN(numeric) && numeric < 35)
  ) {
    return "red";
  }

  if (
    lower.includes("complete") ||
    lower.includes("done") ||
    lower.includes("active") ||
    lower.includes("approved") ||
    lower.includes("delivered") ||
    (!Number.isNaN(numeric) && numeric >= 75)
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
    lower.includes("to do") ||
    lower.includes("skipped") ||
    (!Number.isNaN(numeric) && numeric >= 35 && numeric < 75)
  ) {
    return "amber";
  }

  if (lower.includes("idea") || lower.includes("project") || lower.includes("sprint")) {
    return "purple";
  }

  if (lower.includes("chat") || lower.includes("file") || lower.includes("message") || lower.includes("email")) {
    return "cyan";
  }

  return "slate";
}

function memberName(member: Membership | null | undefined) {
  if (!member) return "Anonymous Contributor";
  return member.user?.name || member.user?.email || "Team member";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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

function isOwner(member: Membership | null | undefined) {
  return Boolean(member?.role === "Owner" || member?.canManageFirm);
}

function ideaAuthor(post: FirmPost) {
  if (!post.authorMembership) return "Anonymous Contributor";
  return memberName(post.authorMembership);
}

function fileSizeLabel(size: number) {
  if (size > 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size > 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function ideaCategory(idea: FirmPost) {
  const match = idea.body.match(/Category:\s*(.+)/i);
  return match?.[1]?.split("\n")[0]?.trim() || "Uncategorized";
}

function ideaImpact(idea: FirmPost) {
  const match = idea.body.match(/Expected impact:\s*(.+)/i);
  return match?.[1]?.split("\n")[0]?.trim() || "Medium";
}

function ideaEffort(idea: FirmPost) {
  const match = idea.body.match(/Estimated effort:\s*(.+)/i);
  return match?.[1]?.split("\n")[0]?.trim() || "Medium";
}

function ideaVoteCount(idea: FirmPost) {
  const privateVotes = (idea.body.match(/\[SLICE_PRIVATE_VOTE\]/g) ?? []).length;
  const legacyVotes = (idea.body.match(/#vote/g) ?? []).length;
  return Math.max(privateVotes, legacyVotes);
}

function ideaNotes(idea: FirmPost) {
  const chunks = idea.body.split("[SLICE_IDEA_NOTE]").slice(1);

  return chunks
    .map((chunk) => {
      const author = chunk.match(/Author:\s*(.+)/)?.[1]?.split("\n")[0]?.trim() || "Contributor";
      const timestamp = chunk.match(/Timestamp:\s*(.+)/)?.[1]?.split("\n")[0]?.trim() || "";
      const note = chunk.match(/Note:\s*([\s\S]+)/)?.[1]?.trim() || "";
      return { author, timestamp, note };
    })
    .filter((item) => item.note);
}

function ideaIsRemoved(idea: FirmPost) {
  const status = String(idea.ideaStatus ?? idea.postType ?? "").toLowerCase();
  return (
    status.includes("removed") ||
    status.includes("archived") ||
    status.includes("deleted")
  );
}

function cleanIdeaBodyForDisplay(body: string) {
  return body
    .split("\n")
    .filter((line) => {
      const lower = line.toLowerCase();
      return (
        !line.includes("[SLICE_PRIVATE_VOTE]") &&
        !line.includes("[SLICE_IDEA_NOTE]") &&
        !line.includes("[SLICE_STATUS_UPDATE]") &&
        !lower.includes("#vote") &&
        !lower.startsWith("timestamp:") &&
        !lower.startsWith("anonymous:") &&
        !lower.startsWith("visibleto:") &&
        !lower.startsWith("voting is anonymous") &&
        !lower.startsWith("voting:")
      );
    })
    .join("\n")
    .replace(/\n{4,}/g, "\n\n")
    .trim();
}

function taskReminderSummary(task: Task | null | undefined) {
  const reminder = task?.comments?.find((comment) =>
    comment.commentType.toLowerCase().includes("reminder")
  );

  if (!reminder) return null;

  const repeat = reminder.body.match(/Repeat interval:\s*(.+)/i)?.[1]?.split("\n")[0]?.trim();
  const when = reminder.body.match(/Reminder:\s*(.+)/i)?.[1]?.split("\n")[0]?.trim();

  return {
    when: when || "Reminder set",
    repeat: repeat || "Once",
    body: reminder.body,
  };
}

function priorityScore(priority: string) {
  const lower = priority.toLowerCase();
  if (lower === "critical") return 100;
  if (lower === "high") return 78;
  if (lower === "medium") return 52;
  return 28;
}

function completionPct(items: Array<{ done?: boolean; status?: string }>) {
  if (!items.length) return 0;

  const complete = items.filter((item) => item.done || item.status === "Complete" || item.status === "Done").length;
  return Math.round((complete / items.length) * 100);
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
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

function Metric({
  label,
  value,
  tone = "slate",
  helper,
}: {
  label: string;
  value: string | number;
  tone?: Tone;
  helper?: string;
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
      <div className={cx("absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4 shadow-xl shadow-black/10", className)}>
      {children}
    </div>
  );
}

function ProgressBar({
  value,
  tone = "green",
}: {
  value: number;
  tone?: Tone;
}) {
  const colors: Record<Tone, string> = {
    red: "from-red-500 to-red-800",
    green: "from-emerald-400 to-emerald-700",
    amber: "from-amber-400 to-amber-700",
    purple: "from-purple-400 to-purple-800",
    cyan: "from-cyan-400 to-cyan-700",
    slate: "from-slate-400 to-slate-700",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r transition-all", colors[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function AttachmentCard({
  attachment,
  onRemove,
}: {
  attachment: LocalAttachment;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
      {attachment.type.startsWith("image/") ? (
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          className="h-36 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-xs font-black text-slate-500">
          {attachment.type || "File"}
        </div>
      )}

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-white">{attachment.name}</div>
          <div className="mt-1 text-[10px] font-bold text-slate-500">
            {fileSizeLabel(attachment.size)}
          </div>
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-black text-red-100"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function TeamBoardEmbedded() {
  const [workspace, setWorkspace] = useState<FirmWorkspacePayload>(EMPTY);
  const [activeView, setActiveView] = useState<InternalView>("delegate");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(ymd(new Date()));
  const [calendarAnchor, setCalendarAnchor] = useState(ymd(new Date()));
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [taskForm, setTaskForm] = useState({
    title: "",
    detail: "",
    priority: "Medium",
    status: "To Do",
    dueDate: ymd(new Date()),
    reminderAt: "",
    reminderInterval: "Once",
    reminderNote: "",
    projectId: "",
    notifyEmail: true,
  });

  const [calendarQuickForm, setCalendarQuickForm] = useState({
    title: "",
    note: "",
    time: "09:00",
    interval: "Once",
  });

  const [workspaceMessage, setWorkspaceMessage] = useState({
    title: "",
    body: "",
    postType: "Chat",
    fileLinks: "",
    projectId: "",
  });
  const [workspaceFilter, setWorkspaceFilter] = useState("All");

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

  const [selectedIdeaCategory, setSelectedIdeaCategory] = useState("All");
  const [selectedIdeaId, setSelectedIdeaId] = useState("");
  const [ideaNote, setIdeaNote] = useState("");
  const [ideaNoteAnonymous, setIdeaNoteAnonymous] = useState(true);
  const [ideaAssigneeId, setIdeaAssigneeId] = useState("");

  const [todoTitle, setTodoTitle] = useState("");
  const [todoCategory, setTodoCategory] = useState("Execution");
  const [todoDate, setTodoDate] = useState(ymd(new Date()));
  const [todos, setTodos] = useState<LocalTodo[]>([]);

  const [docs, setDocs] = useState<LocalDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [docFullScreen, setDocFullScreen] = useState(false);
  const [docPreview, setDocPreview] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const firm = workspace.firm;
  const membership = workspace.membership;
  const members = workspace.members;
  const projects = workspace.projects;
  const operations = workspace.operations ?? EMPTY.operations!;
  const allTasks = operations.allTasks;
  const selectedTask = allTasks.find((item) => item.id === selectedTaskId) ?? allTasks[0] ?? null;
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? members[0] ?? null;
  const activeDoc = docs.find((doc) => doc.id === activeDocId) ?? docs[0] ?? null;
  const ownerMode = isOwner(membership);

  const visibleIdeaBoard = useMemo(() => {
    return operations.ideaBoard.filter((idea) => !ideaIsRemoved(idea));
  }, [operations.ideaBoard]);

  const myTasks = useMemo(() => {
    if (!membership) return [];
    return allTasks.filter((task) => task.ownerUserId === membership.userId);
  }, [allTasks, membership]);

  const completedFirmTasks = useMemo(() => {
    return allTasks
      .filter((task) => task.status === "Complete" || task.status === "Done")
      .sort((a, b) => String(b.dueDate ?? "").localeCompare(String(a.dueDate ?? "")));
  }, [allTasks]);

  const myTodos = useMemo(() => {
    if (!membership) return [];
    return todos
      .filter((todo) => todo.ownerUserId === membership.userId && todo.date === todoDate)
      .sort((a, b) => Number(a.done) - Number(b.done));
  }, [todos, membership, todoDate]);

  const myTodoCompletion = completionPct(myTodos);
  const myFirmTaskCompletion = completionPct(myTasks);

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

  const calendarDays = useMemo(() => calendarMonthDays(calendarAnchor), [calendarAnchor]);

  const tasksByCalendarDate = useMemo(() => {
    return operations.calendarTasks.reduce<Record<string, Task[]>>((map, task) => {
      if (!task.dueDate) return map;
      map[task.dueDate] = [...(map[task.dueDate] ?? []), task];
      return map;
    }, {});
  }, [operations.calendarTasks]);

  const selectedDateTasks = tasksByCalendarDate[selectedCalendarDate] ?? [];

  const filteredIdeas = useMemo(() => {
    return visibleIdeaBoard.filter((idea) => {
      if (selectedIdeaCategory === "All") return true;
      return ideaCategory(idea) === selectedIdeaCategory;
    });
  }, [visibleIdeaBoard, selectedIdeaCategory]);

  const selectedIdea = visibleIdeaBoard.find((idea) => idea.id === selectedIdeaId) ?? visibleIdeaBoard[0] ?? null;

  const ideaCategories = useMemo(() => {
    return ["All", ...Array.from(new Set(visibleIdeaBoard.map(ideaCategory))).sort()];
  }, [visibleIdeaBoard]);

  const ideaCategoryGroups = useMemo(() => {
    return Array.from(
      visibleIdeaBoard.reduce<Map<string, FirmPost[]>>((map, idea) => {
        const category = ideaCategory(idea);
        map.set(category, [...(map.get(category) ?? []), idea]);
        return map;
      }, new Map())
    );
  }, [visibleIdeaBoard]);

  const workspaceMessages = useMemo(() => {
    if (workspaceFilter === "All") return operations.unifiedMessages;
    return operations.unifiedMessages.filter((post) => post.postType === workspaceFilter);
  }, [operations.unifiedMessages, workspaceFilter]);

  const workspaceTypes = useMemo(() => {
    return ["All", ...Array.from(new Set(operations.unifiedMessages.map((post) => post.postType))).sort()];
  }, [operations.unifiedMessages]);

  const filteredDocs = useMemo(() => {
    if (!membership) return [];

    const query = docSearch.toLowerCase().trim();

    return docs
      .filter((doc) => doc.ownerUserId === membership.userId)
      .filter((doc) => {
        if (!query) return true;

        return (
          doc.title.toLowerCase().includes(query) ||
          doc.category.toLowerCase().includes(query) ||
          doc.labels.join(" ").toLowerCase().includes(query) ||
          doc.body.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [docs, membership, docSearch]);

  const docCategories = useMemo(() => {
    return Array.from(new Set(filteredDocs.map((doc) => doc.category))).sort();
  }, [filteredDocs]);

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

      const activeIdeas = (payload.operations?.ideaBoard ?? []).filter(
        (idea: FirmPost) => !ideaIsRemoved(idea)
      );

      setWorkspace(payload);

      if (!selectedMemberId && payload.members?.[0]) {
        setSelectedMemberId(payload.members[0].id);
      }

      if (!ideaAssigneeId && payload.members?.[0]) {
        setIdeaAssigneeId(payload.members[0].id);
      }

      if (!selectedTaskId && payload.operations?.allTasks?.[0]) {
        setSelectedTaskId(payload.operations.allTasks[0].id);
      }

      if (!selectedIdeaId && activeIdeas[0]) {
        setSelectedIdeaId(activeIdeas[0].id);
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

    const intervalLine =
      taskForm.reminderInterval && taskForm.reminderInterval !== "Once"
        ? `Repeat interval: ${taskForm.reminderInterval}`
        : "Repeat interval: Once";

    const reminderNote = [intervalLine, taskForm.reminderNote]
      .filter(Boolean)
      .join("\n");

    const result = await postFirmAction({
      action: "createDelegatedTask",
      targetMembershipId: selectedMemberId || members[0]?.id,
      title: taskForm.title,
      detail: taskForm.detail,
      priority: taskForm.priority,
      status: taskForm.status,
      dueDate: taskForm.dueDate,
      reminderAt: taskForm.reminderAt,
      reminderNote,
      projectId: taskForm.projectId || null,
      notifyEmail: taskForm.notifyEmail,
    });

    if (result) {
      const emailStatus = result.emailResult
        ? ` Email: ${result.emailResult.status}.`
        : "";

      setTaskForm((current) => ({
        ...current,
        title: "",
        detail: "",
        reminderAt: "",
        reminderNote: "",
      }));

      setMessage(`Task delegated. The assigned person was notified in Slice.${emailStatus}`);
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

  async function createTimedReminder(event?: FormEvent) {
    event?.preventDefault();

    if (!selectedTask) {
      setMessage("Select a task first.");
      return;
    }

    const intervalLine =
      taskForm.reminderInterval && taskForm.reminderInterval !== "Once"
        ? `Repeat interval: ${taskForm.reminderInterval}`
        : "Repeat interval: Once";

    const result = await postFirmAction({
      action: "createTimedReminder",
      taskId: selectedTask.id,
      targetMembershipId: selectedTask.ownerId || selectedMemberId,
      reminderAt:
        taskForm.reminderAt ||
        `${selectedCalendarDate}${calendarQuickForm.time ? ` ${calendarQuickForm.time}` : ""}`,
      reminderNote:
        [intervalLine, taskForm.reminderNote || calendarQuickForm.note || "Please review this task and update the project workspace."]
          .filter(Boolean)
          .join("\n"),
    });

    if (result) {
      setTaskForm((current) => ({
        ...current,
        reminderAt: "",
        reminderNote: "",
      }));
      setCalendarQuickForm((current) => ({ ...current, note: "" }));
      setMessage("Reminder created and interval saved to the task.");
    }
  }

  async function createCalendarQuickTask(event: FormEvent) {
    event.preventDefault();

    const title = calendarQuickForm.title.trim();

    if (!title) {
      setMessage("Add a quick reminder title first.");
      return;
    }

    const result = await postFirmAction({
      action: "createDelegatedTask",
      targetMembershipId: selectedMemberId || membership?.id,
      title,
      detail: calendarQuickForm.note,
      priority: "Medium",
      status: "To Do",
      dueDate: selectedCalendarDate,
      reminderAt: `${selectedCalendarDate}${calendarQuickForm.time ? ` ${calendarQuickForm.time}` : ""}`,
      reminderNote: [
        `Repeat interval: ${calendarQuickForm.interval}`,
        calendarQuickForm.note || title,
      ].join("\n"),
      projectId: null,
      notifyEmail: true,
    });

    if (result) {
      setCalendarQuickForm({
        title: "",
        note: "",
        time: "09:00",
        interval: "Once",
      });
      setMessage("Calendar reminder added and notification sent.");
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
      setSelectedIdeaId(payload.createdIdeaId || "");
      setMessage("Idea submitted to the brainstorm board.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit idea.");
    } finally {
      setLoading(false);
    }
  }

  async function voteIdea(ideaId: string) {
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
          anonymous: true,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to vote.");
        return;
      }

      await loadWorkspace();
      setMessage(ownerMode ? "Anonymous vote recorded." : "Anonymous vote recorded. Vote totals are visible to the firm owner.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to vote.");
    } finally {
      setLoading(false);
    }
  }

  async function addIdeaNote(event: FormEvent) {
    event.preventDefault();

    if (!firm?.id || !selectedIdea || !ideaNote.trim()) {
      setMessage("Select an idea and add a note first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/firm-workspace/anonymous-ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "note-firm-idea",
        },
        body: JSON.stringify({
          action: "addIdeaNote",
          firmId: firm.id,
          ideaId: selectedIdea.id,
          note: ideaNote,
          anonymous: ideaNoteAnonymous,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to add note.");
        return;
      }

      setIdeaNote("");
      await loadWorkspace();
      setMessage("Note added to brainstorm bubble.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add note.");
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

  async function removeIdeaBubble(ideaId: string) {
    if (!isLeader(membership)) {
      setMessage("Only firm leaders can remove brainstorm bubbles.");
      return;
    }

    const result = await postFirmAction({
      action: "updateIdeaStatus",
      ideaId,
      status: "Removed",
      note: "Removed from active brainstorm chart.",
    });

    if (result) {
      const remainingIdeas = (result.operations?.ideaBoard ?? []).filter(
        (idea) => !ideaIsRemoved(idea)
      );
      setSelectedIdeaId(remainingIdeas[0]?.id ?? "");
      setMessage("Bubble removed from the active brainstorm chart.");
    }
  }

  async function createTaskFromIdea(idea: FirmPost) {
    const result = await postFirmAction({
      action: "createDelegatedTask",
      targetMembershipId: ideaAssigneeId || selectedMemberId || members[0]?.id,
      title: `Explore idea: ${idea.title}`,
      detail: cleanIdeaBodyForDisplay(idea.body),
      priority: ideaImpact(idea) === "Critical" || ideaImpact(idea) === "High" ? "High" : "Medium",
      status: "To Do",
      dueDate: ymd(new Date()),
      reminderAt: "",
      reminderNote: `Repeat interval: Weekly\nFollow up on brainstorm idea.`,
      projectId: idea.project?.id ?? null,
      notifyEmail: true,
    });

    if (result) {
      setMessage("Task created from brainstorm bubble and assignee was notified.");
    }
  }

  function loadLocalWork() {
    if (!membership) return;

    try {
      const docRaw = localStorage.getItem(`slice-team-docs:${membership.userId}`);
      const todoRaw = localStorage.getItem(`slice-team-todos:${membership.userId}`);

      const loadedDocs = docRaw ? (JSON.parse(docRaw) as LocalDoc[]) : [];
      const loadedTodos = todoRaw ? (JSON.parse(todoRaw) as LocalTodo[]) : [];

      setDocs(loadedDocs);
      setTodos(loadedTodos);

      if (!activeDocId && loadedDocs[0]) setActiveDocId(loadedDocs[0].id);
    } catch {
      setDocs([]);
      setTodos([]);
    }
  }

  function saveLocalWork(nextDocs = docs, nextTodos = todos) {
    if (!membership) return;

    try {
      localStorage.setItem(`slice-team-docs:${membership.userId}`, JSON.stringify(nextDocs));
      localStorage.setItem(`slice-team-todos:${membership.userId}`, JSON.stringify(nextTodos));
    } catch {
      setMessage("Local save failed. Try removing very large pasted files.");
    }
  }

  function createDoc(templateName?: string) {
    if (!membership) return;

    const template =
      docTemplates.find((item) => item.name === templateName) ?? docTemplates[0];

    const now = new Date().toISOString();

    const doc: LocalDoc = {
      id: `doc-${Date.now()}`,
      ownerUserId: membership.userId,
      title: templateName ? `${template.name} - ${shortDate(ymd(new Date()))}` : "Untitled Work Doc",
      category: template.category,
      labels: template.labels,
      body: templateName ? template.body : "",
      fontSize: "16px",
      fontFamily: "Inter",
      favorite: false,
      template: template.name,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };

    const nextDocs = [doc, ...docs];
    setDocs(nextDocs);
    setActiveDocId(doc.id);
    saveLocalWork(nextDocs, todos);
  }

  function updateActiveDoc(patch: Partial<LocalDoc>) {
    if (!activeDoc) return;

    const nextDocs = docs.map((doc) =>
      doc.id === activeDoc.id
        ? {
            ...doc,
            ...patch,
            updatedAt: new Date().toISOString(),
          }
        : doc
    );

    setDocs(nextDocs);
    saveLocalWork(nextDocs, todos);
  }

  function deleteDoc(docId: string) {
    const nextDocs = docs.filter((doc) => doc.id !== docId);
    setDocs(nextDocs);
    setActiveDocId(nextDocs[0]?.id ?? "");
    saveLocalWork(nextDocs, todos);
  }

  function exportDoc() {
    if (!activeDoc) return;

    const blob = new Blob([activeDoc.body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeDoc.title.replace(/[^a-z0-9]/gi, "-").toLowerCase() || "slice-doc"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function addTodo(event: FormEvent) {
    event.preventDefault();

    if (!membership || !todoTitle.trim()) return;

    const todo: LocalTodo = {
      id: `todo-${Date.now()}`,
      ownerUserId: membership.userId,
      title: todoTitle.trim(),
      category: todoCategory,
      date: todoDate,
      done: false,
      createdAt: new Date().toISOString(),
    };

    const nextTodos = [todo, ...todos];
    setTodos(nextTodos);
    setTodoTitle("");
    saveLocalWork(docs, nextTodos);
  }

  function toggleTodo(todoId: string) {
    const nextTodos = todos.map((todo) =>
      todo.id === todoId ? { ...todo, done: !todo.done } : todo
    );

    setTodos(nextTodos);
    saveLocalWork(docs, nextTodos);
  }

  function deleteTodo(todoId: string) {
    const nextTodos = todos.filter((todo) => todo.id !== todoId);
    setTodos(nextTodos);
    saveLocalWork(docs, nextTodos);
  }

  function readFileAsAttachment(file: File) {
    return new Promise<LocalAttachment>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve({
          id: `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: String(reader.result ?? ""),
          createdAt: new Date().toISOString(),
        });
      };

      reader.onerror = () => reject(new Error("Unable to read file."));
      reader.readAsDataURL(file);
    });
  }

  async function addFilesToDoc(files: FileList | File[]) {
    if (!activeDoc) return;

    const safeFiles = Array.from(files).slice(0, 8);
    const attachments: LocalAttachment[] = [];

    for (const file of safeFiles) {
      if (file.size > 3 * 1024 * 1024) {
        setMessage(`${file.name} is too large for local doc storage. Use a link instead.`);
        continue;
      }

      attachments.push(await readFileAsAttachment(file));
    }

    if (!attachments.length) return;

    updateActiveDoc({
      attachments: [...attachments, ...activeDoc.attachments],
    });

    setMessage(`${attachments.length} file(s) added to the doc.`);
  }

  async function handleDocFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files) return;
    await addFilesToDoc(event.target.files);
    event.target.value = "";
  }

  async function handleDocPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files ?? []);

    if (files.length) {
      await addFilesToDoc(files);
    }
  }

  function removeDocAttachment(attachmentId: string) {
    if (!activeDoc) return;

    updateActiveDoc({
      attachments: activeDoc.attachments.filter((item) => item.id !== attachmentId),
    });
  }

  useEffect(() => {
    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLocalWork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membership?.userId]);

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
            Once a firm is created or the user accepts an invite, this tab becomes the shared operating workspace for delegation, brainstorm charts, reminders, docs, personal work, and team collaboration.
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

  const renderDocsEditor = () => {
    if (!activeDoc) {
      return (
        <Panel className="flex min-h-[560px] items-center justify-center text-center">
          <div>
            <h3 className="text-2xl font-black text-white">Create your first doc</h3>
            <p className="mt-2 text-sm text-slate-500">
              Docs are personal to each user and support templates, categories, labels, fullscreen mode, pasted images, and file attachments.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {docTemplates.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  onClick={() => createDoc(template.name)}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        </Panel>
      );
    }

    return (
      <Panel className={docFullScreen ? "fixed inset-4 z-[100] overflow-y-auto bg-zinc-950 p-5 shadow-2xl" : ""}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
              Personal Doc Editor
            </div>
            <h3 className="mt-1 text-2xl font-black text-white">{activeDoc.title}</h3>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => updateActiveDoc({ favorite: !activeDoc.favorite })}
              className={cx(
                "rounded-2xl px-4 py-2 text-xs font-black",
                activeDoc.favorite
                  ? "bg-amber-500 text-slate-950"
                  : "border border-amber-500/30 bg-amber-500/10 text-amber-100"
              )}
            >
              {activeDoc.favorite ? "★ Favorite" : "☆ Favorite"}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-100"
            >
              Add Image/File
            </button>
            <button
              type="button"
              onClick={() => setDocPreview((current) => !current)}
              className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-white"
            >
              {docPreview ? "Hide Preview" : "Preview"}
            </button>
            <button
              type="button"
              onClick={exportDoc}
              className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => setDocFullScreen((current) => !current)}
              className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
            >
              {docFullScreen ? "Exit Full Screen" : "Full Screen"}
            </button>
            <button
              type="button"
              onClick={() => deleteDoc(activeDoc.id)}
              className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100"
            >
              Delete
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleDocFileInput}
          className="hidden"
        />

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <input
            value={activeDoc.title}
            onChange={(event) => updateActiveDoc({ title: event.target.value })}
            className={inputClass}
            placeholder="Document title"
          />
          <input
            value={activeDoc.category}
            onChange={(event) => updateActiveDoc({ category: event.target.value })}
            className={inputClass}
            placeholder="Category"
          />
          <input
            value={activeDoc.labels.join(", ")}
            onChange={(event) =>
              updateActiveDoc({
                labels: event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            className={inputClass}
            placeholder="Labels"
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[180px_180px_1fr]">
          <select
            value={activeDoc.fontSize}
            onChange={(event) => updateActiveDoc({ fontSize: event.target.value })}
            className={inputClass}
          >
            <option value="14px">Small</option>
            <option value="16px">Normal</option>
            <option value="18px">Large</option>
            <option value="22px">Presentation</option>
          </select>

          <select
            value={activeDoc.fontFamily}
            onChange={(event) => updateActiveDoc({ fontFamily: event.target.value })}
            className={inputClass}
          >
            <option value="Inter">Inter</option>
            <option value="Georgia">Georgia</option>
            <option value="Arial">Arial</option>
            <option value="ui-monospace">Monospace</option>
          </select>

          <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-xs font-bold text-slate-500">
            Paste images directly into the editor or use Add Image/File. Files are stored locally in this browser.
          </div>
        </div>

        <div className={cx("mt-4 grid gap-4", docPreview ? "xl:grid-cols-2" : "")}>
          <textarea
            value={activeDoc.body}
            onPaste={handleDocPaste}
            onChange={(event) => updateActiveDoc({ body: event.target.value })}
            placeholder="Start typing. This can be a personal note, client prep document, report outline, research memo, or daily work doc."
            className="min-h-[620px] w-full rounded-[1.5rem] border border-white/10 bg-black/45 px-5 py-5 leading-8 text-white outline-none placeholder:text-slate-600"
            style={{
              fontSize: activeDoc.fontSize,
              fontFamily: activeDoc.fontFamily,
            }}
          />

          {docPreview ? (
            <div className="min-h-[620px] rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5">
              <div className="mb-4 flex flex-wrap gap-2">
                <Pill tone="cyan">{activeDoc.category}</Pill>
                {activeDoc.labels.map((label) => (
                  <Pill key={label} tone="slate">{label}</Pill>
                ))}
              </div>
              <div
                className="whitespace-pre-wrap leading-8 text-slate-200"
                style={{
                  fontSize: activeDoc.fontSize,
                  fontFamily: activeDoc.fontFamily,
                }}
              >
                {activeDoc.body || "Preview will appear here as you type."}
              </div>
            </div>
          ) : null}
        </div>

        {activeDoc.attachments.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {activeDoc.attachments.map((attachment) => (
              <AttachmentCard
                key={attachment.id}
                attachment={attachment}
                onRemove={() => removeDocAttachment(attachment.id)}
              />
            ))}
          </div>
        ) : null}
      </Panel>
    );
  };

  return (
    <section className="grid gap-5">
      <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-zinc-950/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-red-600/18 via-purple-500/8 to-transparent" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
              Team Board · Firm Operating Workspace
            </div>
            <h2 className="mt-2 text-4xl font-black tracking-tight text-white md:text-5xl">
              A cleaner operating room for delegation, ideas, docs, and execution.
            </h2>
            <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400">
              Assign work with reminders and email alerts, click calendar days to schedule follow-ups, open brainstorm bubbles, vote anonymously, remove bubbles when needed, assign ideas as tasks, monitor completed work, and keep richer personal docs.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/workspace/firm-command-center"
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
            >
              Full Command Center
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

        <div className="relative mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-8">
          <Metric label="Total Tasks" value={operations.sprintMetrics.total} tone="cyan" />
          <Metric label="Open" value={operations.sprintMetrics.open} tone="amber" />
          <Metric label="Progress" value={operations.sprintMetrics.inProgress} tone="purple" />
          <Metric label="Blocked" value={operations.sprintMetrics.blocked} tone={operations.sprintMetrics.blocked ? "red" : "green"} />
          <Metric label="Complete" value={operations.sprintMetrics.complete} tone="green" />
          <Metric label="Ideas" value={visibleIdeaBoard.length} tone="purple" />
          <Metric label="My To-Dos" value={`${myTodoCompletion}%`} tone="green" helper="Daily done" />
          <Metric label="Docs" value={filteredDocs.length} tone="amber" />
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
          {message}
        </div>
      ) : null}

      <div className="grid gap-2 rounded-[1.5rem] border border-white/10 bg-black/45 p-2 md:grid-cols-3 xl:grid-cols-6">
        {viewTabs.map(([key, label, helper, tone]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveView(key)}
            className={cx(
              "rounded-2xl px-4 py-3 text-left transition",
              activeView === key
                ? "bg-white text-slate-950 shadow-lg shadow-black/20"
                : "bg-white/5 text-white hover:bg-white/10"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-black">{label}</div>
              <span
                className={cx(
                  "h-2 w-2 rounded-full",
                  tone === "red"
                    ? "bg-red-400"
                    : tone === "green"
                      ? "bg-emerald-400"
                      : tone === "amber"
                        ? "bg-amber-400"
                        : tone === "purple"
                          ? "bg-purple-400"
                          : tone === "cyan"
                            ? "bg-cyan-400"
                            : "bg-slate-400"
                )}
              />
            </div>
            <div className={cx("mt-1 text-[10px] font-bold", activeView === key ? "text-slate-500" : "text-slate-500")}>
              {helper}
            </div>
          </button>
        ))}
      </div>

      {activeView === "delegate" ? (
        <div className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
          <Panel className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-red-500/12 to-transparent" />

            <div className="relative">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                Delegation Cockpit
              </div>
              <h3 className="mt-2 text-2xl font-black text-white">
                Assign fast with priority and reminder intervals
              </h3>

              <form onSubmit={createDelegatedTask} className="mt-5 grid gap-3">
                <select
                  value={selectedMemberId}
                  onChange={(event) => setSelectedMemberId(event.target.value)}
                  className={inputClass}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {memberName(member)} · {member.role}
                    </option>
                  ))}
                </select>

                {selectedMember ? (
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black text-white shadow-lg"
                        style={{ backgroundColor: selectedMember.calendarColor }}
                      >
                        {initials(memberName(selectedMember))}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-lg font-black text-white">
                          {memberName(selectedMember)}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {selectedMember.user?.email} · {selectedMember.role}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                        <span>Current workload</span>
                        <span>{allTasks.filter((task) => task.ownerId === selectedMember.id && task.status !== "Complete" && task.status !== "Done").length} open tasks</span>
                      </div>
                      <ProgressBar
                        value={100 - Math.min(100, allTasks.filter((task) => task.ownerId === selectedMember.id && task.status !== "Complete" && task.status !== "Done").length * 12)}
                        tone="cyan"
                      />
                    </div>
                  </div>
                ) : null}

                <input
                  value={taskForm.title}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Task title"
                  className={inputClass}
                />

                <textarea
                  value={taskForm.detail}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, detail: event.target.value }))
                  }
                  placeholder="Task detail. Add expected outcome, source links, and success criteria."
                  className={cx(inputClass, "min-h-28")}
                />

                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={taskForm.priority}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, priority: event.target.value }))
                    }
                    className={inputClass}
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
                    className={inputClass}
                  >
                    {operations.scrumStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Priority weight
                    </div>
                    <Pill tone={toneFor(taskForm.priority)}>{taskForm.priority}</Pill>
                  </div>
                  <ProgressBar value={priorityScore(taskForm.priority)} tone={toneFor(taskForm.priority)} />
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                    }
                    className={inputClass}
                  />

                  <select
                    value={taskForm.projectId}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, projectId: event.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                    Reminder cadence
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      value={taskForm.reminderAt}
                      onChange={(event) =>
                        setTaskForm((current) => ({ ...current, reminderAt: event.target.value }))
                      }
                      placeholder="tomorrow 9am"
                      className={inputClass}
                    />

                    <select
                      value={taskForm.reminderInterval}
                      onChange={(event) =>
                        setTaskForm((current) => ({ ...current, reminderInterval: event.target.value }))
                      }
                      className={inputClass}
                    >
                      <option>Once</option>
                      <option>Daily</option>
                      <option>Every 2 Days</option>
                      <option>Weekly</option>
                      <option>Biweekly</option>
                      <option>Monthly</option>
                      <option>Until Complete</option>
                    </select>
                  </div>

                  <textarea
                    value={taskForm.reminderNote}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, reminderNote: event.target.value }))
                    }
                    placeholder="Reminder note"
                    className={cx(inputClass, "mt-2 min-h-20 w-full")}
                  />

                  <label className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-slate-300">
                    Send Resend email notification
                    <input
                      type="checkbox"
                      checked={taskForm.notifyEmail}
                      onChange={(event) =>
                        setTaskForm((current) => ({
                          ...current,
                          notifyEmail: event.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>

                <button
                  disabled={loading}
                  className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30 disabled:opacity-50"
                >
                  Delegate + Notify
                </button>
              </form>
            </div>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
            {taskColumns.map((column) => (
              <Panel key={column.status} className="p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-sm font-black text-white">{column.status}</div>
                  <Pill tone={toneFor(column.status)}>{column.tasks.length}</Pill>
                </div>

                <div className="grid max-h-[780px] gap-3 overflow-y-auto pr-1">
                  {column.tasks.map((task) => {
                    const reminder = taskReminderSummary(task);

                    return (
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
                          {reminder ? <Pill tone="amber">{reminder.repeat}</Pill> : null}
                        </div>
                      </button>
                    );
                  })}

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

      {activeView === "calendar" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <Panel className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-purple-500/16 via-cyan-500/8 to-transparent" />

            <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                  Calendar Reminder Board
                </div>
                <h3 className="mt-2 text-3xl font-black text-white">
                  Click a day. Add a reminder. Keep the firm moving.
                </h3>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarAnchor(addDays(calendarAnchor, -30))}
                  className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-2 text-xs font-black text-white"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarAnchor(ymd(new Date()))}
                  className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarAnchor(addDays(calendarAnchor, 30))}
                  className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-2 text-xs font-black text-white"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="relative mt-6 rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-black text-white">{monthTitle(calendarAnchor)}</div>
                <Pill tone="purple">{operations.calendarTasks.length} scheduled</Pill>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div key={day} className="text-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {day}
                  </div>
                ))}

                {calendarDays.map((day) => {
                  const tasks = tasksByCalendarDate[day] ?? [];
                  const isSelected = day === selectedCalendarDate;
                  const isToday = day === ymd(new Date());
                  const isCurrentMonth =
                    new Date(`${day}T00:00:00`).getMonth() ===
                    new Date(`${calendarAnchor}T00:00:00`).getMonth();

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setSelectedCalendarDate(day);
                        setTaskForm((current) => ({ ...current, dueDate: day }));
                      }}
                      className={cx(
                        "min-h-[122px] rounded-[1.25rem] border p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08]",
                        isSelected
                          ? "border-cyan-400/50 bg-cyan-500/15 shadow-lg shadow-cyan-950/20"
                          : "border-white/10 bg-white/[0.035]",
                        isToday && !isSelected ? "ring-1 ring-red-400/40" : "",
                        !isCurrentMonth ? "opacity-45" : ""
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          {weekdayShort(day)}
                        </span>
                        <span className="text-lg font-black text-white">{dayNumber(day)}</span>
                      </div>

                      <div className="mt-3 grid gap-1">
                        {tasks.slice(0, 3).map((task) => (
                          <div
                            key={task.id}
                            className="truncate rounded-lg border border-white/10 bg-black/35 px-2 py-1 text-[10px] font-bold text-slate-300"
                            style={{ borderLeftColor: task.ownerColor ?? "#64748b", borderLeftWidth: 4 }}
                          >
                            {task.title}
                          </div>
                        ))}
                      </div>

                      {tasks.length > 3 ? (
                        <div className="mt-2 text-[10px] font-black text-cyan-300">
                          +{tasks.length - 3} more
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>

          <Panel className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-amber-500/12 to-transparent" />

            <div className="relative">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                Selected Day
              </div>
              <h3 className="mt-2 text-3xl font-black text-white">{shortDate(selectedCalendarDate)}</h3>

              <form onSubmit={createCalendarQuickTask} className="mt-5 grid gap-3">
                <select
                  value={selectedMemberId}
                  onChange={(event) => setSelectedMemberId(event.target.value)}
                  className={inputClass}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {memberName(member)} · {member.role}
                    </option>
                  ))}
                </select>

                <input
                  value={calendarQuickForm.title}
                  onChange={(event) =>
                    setCalendarQuickForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Quick reminder or task"
                  className={inputClass}
                />

                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    type="time"
                    value={calendarQuickForm.time}
                    onChange={(event) =>
                      setCalendarQuickForm((current) => ({ ...current, time: event.target.value }))
                    }
                    className={inputClass}
                  />

                  <select
                    value={calendarQuickForm.interval}
                    onChange={(event) =>
                      setCalendarQuickForm((current) => ({ ...current, interval: event.target.value }))
                    }
                    className={inputClass}
                  >
                    <option>Once</option>
                    <option>Daily</option>
                    <option>Every 2 Days</option>
                    <option>Weekly</option>
                    <option>Biweekly</option>
                    <option>Monthly</option>
                    <option>Until Complete</option>
                  </select>
                </div>

                <textarea
                  value={calendarQuickForm.note}
                  onChange={(event) =>
                    setCalendarQuickForm((current) => ({ ...current, note: event.target.value }))
                  }
                  placeholder="Reminder note"
                  className={cx(inputClass, "min-h-24")}
                />

                <button
                  disabled={loading}
                  className="rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-purple-950/30 disabled:opacity-50"
                >
                  Add Calendar Reminder
                </button>
              </form>

              <div className="mt-6 grid gap-3">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Tasks on this day
                </div>
                {selectedDateTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setActiveView("my-work");
                    }}
                    className="rounded-2xl border border-white/10 bg-black/35 p-3 text-left hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-black text-white">{task.title}</div>
                      <Pill tone={toneFor(task.priority)}>{task.priority}</Pill>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{task.ownerName}</div>
                  </button>
                ))}

                {!selectedDateTasks.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm font-bold text-slate-500">
                    No tasks yet. Add one above.
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>
        </div>
      ) : null}

      {activeView === "ideas" ? (
        <div className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)_390px]">
            <Panel>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                Brainstorm Input
              </div>
              <h3 className="mt-2 text-2xl font-black text-white">
                Add a new bubble
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Submit ideas as bubbles. Click a bubble to add notes, vote anonymously, assign it as a task, or remove it from the active chart.
              </p>

              <form onSubmit={createIdea} className="mt-5 grid gap-3">
                <input
                  value={ideaForm.title}
                  onChange={(event) =>
                    setIdeaForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Idea title"
                  className={inputClass}
                />

                <textarea
                  value={ideaForm.body}
                  onChange={(event) =>
                    setIdeaForm((current) => ({ ...current, body: event.target.value }))
                  }
                  placeholder="Describe the idea. Use @Name if you want to tag a reviewer."
                  className={cx(inputClass, "min-h-28")}
                />

                <div className="grid gap-2 md:grid-cols-3">
                  <input
                    value={ideaForm.category}
                    onChange={(event) =>
                      setIdeaForm((current) => ({ ...current, category: event.target.value }))
                    }
                    placeholder="Category"
                    className={inputClass}
                  />

                  <select
                    value={ideaForm.impact}
                    onChange={(event) =>
                      setIdeaForm((current) => ({ ...current, impact: event.target.value }))
                    }
                    className={inputClass}
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
                    className={inputClass}
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
                  placeholder="Suggested owner/reviewer"
                  className={inputClass}
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
                  Add Bubble
                </button>
              </form>
            </Panel>

            <Panel className="relative min-h-[700px] overflow-hidden">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(168,85,247,0.18),_transparent_32%),radial-gradient(circle_at_20%_20%,_rgba(239,68,68,0.14),_transparent_24%),radial-gradient(circle_at_80%_80%,_rgba(6,182,212,0.14),_transparent_24%)]" />

              <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                    Live Brainstorm Chart
                  </div>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    Click bubbles to open details
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ideaCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedIdeaCategory(category)}
                      className={cx(
                        "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                        selectedIdeaCategory === category
                          ? "bg-white text-slate-950"
                          : "border border-white/10 bg-white/[0.045] text-white"
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative mt-8 min-h-[560px]">
                <svg className="absolute inset-0 h-full w-full opacity-70">
                  {ideaCategoryGroups.map(([category], categoryIndex) => {
                    const angle = (categoryIndex / Math.max(ideaCategoryGroups.length, 1)) * Math.PI * 2 - Math.PI / 2;
                    const x = 50 + Math.cos(angle) * 31;
                    const y = 50 + Math.sin(angle) * 29;

                    return (
                      <line
                        key={category}
                        x1="50%"
                        y1="50%"
                        x2={`${x}%`}
                        y2={`${y}%`}
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth="2"
                      />
                    );
                  })}

                  {ideaCategoryGroups.flatMap(([category, ideas], categoryIndex) => {
                    const categoryAngle = (categoryIndex / Math.max(ideaCategoryGroups.length, 1)) * Math.PI * 2 - Math.PI / 2;
                    const categoryX = 50 + Math.cos(categoryAngle) * 31;
                    const categoryY = 50 + Math.sin(categoryAngle) * 29;

                    return ideas.slice(0, 10).map((idea, ideaIndex) => {
                      const childAngle =
                        categoryAngle +
                        ((ideaIndex - (ideas.length - 1) / 2) * Math.PI) / 13;
                      const childX = categoryX + Math.cos(childAngle) * 13;
                      const childY = categoryY + Math.sin(childAngle) * 10;

                      return (
                        <line
                          key={`${category}-${idea.id}`}
                          x1={`${categoryX}%`}
                          y1={`${categoryY}%`}
                          x2={`${childX}%`}
                          y2={`${childY}%`}
                          stroke="rgba(255,255,255,0.12)"
                          strokeWidth="1.5"
                        />
                      );
                    });
                  })}
                </svg>

                <div className="absolute left-1/2 top-1/2 z-10 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-red-500/30 bg-gradient-to-br from-red-600 via-red-800 to-zinc-950 p-4 text-center shadow-2xl shadow-red-950/40">
                  <div>
                    <div className="text-2xl font-black text-white">Slice</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-red-100/80">
                      Brainstorm
                    </div>
                  </div>
                </div>

                {ideaCategoryGroups.map(([category, ideas], categoryIndex) => {
                  const angle = (categoryIndex / Math.max(ideaCategoryGroups.length, 1)) * Math.PI * 2 - Math.PI / 2;
                  const x = 50 + Math.cos(angle) * 31;
                  const y = 50 + Math.sin(angle) * 29;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedIdeaCategory(category)}
                      className="absolute z-20 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/15 p-3 text-center shadow-xl shadow-purple-950/25 backdrop-blur transition hover:scale-105"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      <div>
                        <div className="line-clamp-2 text-xs font-black text-white">{category}</div>
                        <div className="mt-1 text-[10px] font-bold text-purple-200">
                          {ideas.length} ideas
                        </div>
                      </div>
                    </button>
                  );
                })}

                {ideaCategoryGroups.flatMap(([category, ideas], categoryIndex) => {
                  const categoryAngle = (categoryIndex / Math.max(ideaCategoryGroups.length, 1)) * Math.PI * 2 - Math.PI / 2;
                  const categoryX = 50 + Math.cos(categoryAngle) * 31;
                  const categoryY = 50 + Math.sin(categoryAngle) * 29;

                  return ideas.slice(0, 10).map((idea, ideaIndex) => {
                    if (selectedIdeaCategory !== "All" && ideaCategory(idea) !== selectedIdeaCategory) return null;

                    const childAngle =
                      categoryAngle +
                      ((ideaIndex - (ideas.length - 1) / 2) * Math.PI) / 13;
                    const childX = categoryX + Math.cos(childAngle) * 13;
                    const childY = categoryY + Math.sin(childAngle) * 10;
                    const impact = ideaImpact(idea);
                    const size = impact === "Critical" ? 94 : impact === "High" ? 84 : 72;
                    const selected = selectedIdea?.id === idea.id;

                    return (
                      <button
                        key={idea.id}
                        type="button"
                        onClick={() => setSelectedIdeaId(idea.id)}
                        className={cx(
                          "absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full border p-3 text-center shadow-xl backdrop-blur transition hover:scale-105",
                          selected
                            ? "border-white bg-white text-slate-950 shadow-white/20"
                            : impact === "Critical" || impact === "High"
                              ? "border-red-500/40 bg-red-500/20 text-white shadow-red-950/30"
                              : "border-cyan-500/30 bg-cyan-500/15 text-white shadow-cyan-950/20"
                        )}
                        style={{
                          left: `${childX}%`,
                          top: `${childY}%`,
                          width: size,
                          height: size,
                        }}
                        title="Click to open bubble details"
                      >
                        <div className="line-clamp-3 text-[10px] font-black leading-4">
                          {idea.title}
                        </div>
                      </button>
                    );
                  });
                })}
              </div>
            </Panel>

            <Panel className="relative overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-cyan-500/12 to-transparent" />
              <div className="relative">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                  Bubble Detail
                </div>

                {selectedIdea ? (
                  <div className="mt-4 grid gap-4">
                    <div>
                      <h3 className="text-2xl font-black text-white">{selectedIdea.title}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Pill tone="purple">{ideaCategory(selectedIdea)}</Pill>
                        <Pill tone={toneFor(ideaImpact(selectedIdea))}>{ideaImpact(selectedIdea)} impact</Pill>
                        <Pill tone="amber">{ideaEffort(selectedIdea)} effort</Pill>
                        {ownerMode ? <Pill tone="green">{ideaVoteCount(selectedIdea)} votes</Pill> : <Pill tone="slate">Votes private</Pill>}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {cleanIdeaBodyForDisplay(selectedIdea.body)}
                      </p>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => voteIdea(selectedIdea.id)}
                        className="rounded-2xl bg-white px-4 py-3 text-xs font-black text-slate-950"
                      >
                        Anonymous Vote
                      </button>

                      {isLeader(membership) ? (
                        <button
                          type="button"
                          onClick={() => removeIdeaBubble(selectedIdea.id)}
                          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-black text-red-100"
                        >
                          Remove Bubble
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setMessage("Only firm leaders can remove brainstorm bubbles.")}
                          className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-xs font-black text-white"
                        >
                          Remove Locked
                        </button>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
                        Assign Bubble As Task
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Choose who should own this idea, then create a delegated follow-up task with email notification.
                      </p>

                      <select
                        value={ideaAssigneeId}
                        onChange={(event) => setIdeaAssigneeId(event.target.value)}
                        className={cx(inputClass, "mt-3 w-full")}
                      >
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            Assign task to {memberName(member)}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => createTaskFromIdea(selectedIdea)}
                        className="mt-3 w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-black text-red-100"
                      >
                        Create Assigned Task
                      </button>
                    </div>

                    <form onSubmit={addIdeaNote} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        Add bubble note
                      </div>
                      <textarea
                        value={ideaNote}
                        onChange={(event) => setIdeaNote(event.target.value)}
                        placeholder="Add context, refinement, objection, or next step..."
                        className={cx(inputClass, "min-h-24")}
                      />
                      <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-slate-300">
                        Add note anonymously
                        <input
                          type="checkbox"
                          checked={ideaNoteAnonymous}
                          onChange={(event) => setIdeaNoteAnonymous(event.target.checked)}
                        />
                      </label>
                      <button
                        disabled={loading}
                        className="rounded-2xl bg-cyan-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
                      >
                        Add Note
                      </button>
                    </form>

                    <div className="grid gap-2">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        Notes
                      </div>
                      {ideaNotes(selectedIdea).map((note, index) => (
                        <div key={`${note.timestamp}-${index}`} className="rounded-2xl border border-white/10 bg-black/35 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-black text-white">{note.author}</div>
                            <div className="text-[10px] text-slate-500">{formatDateTime(note.timestamp)}</div>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{note.note}</p>
                        </div>
                      ))}
                      {!ideaNotes(selectedIdea).length ? (
                        <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs font-bold text-slate-500">
                          No notes yet.
                        </div>
                      ) : null}
                    </div>

                    {isLeader(membership) ? (
                      <div className="flex flex-wrap gap-2">
                        {["Review", "Approved", "Backlog", "Rejected"].map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => updateIdeaStatus(selectedIdea.id, status)}
                            className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white hover:bg-white/10"
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                    Select a bubble to open notes and actions.
                  </div>
                )}
              </div>
            </Panel>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredIdeas.map((idea) => (
              <Panel key={idea.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => setSelectedIdeaId(idea.id)}
                      className="text-left font-black text-white hover:text-cyan-200"
                    >
                      {idea.title}
                    </button>
                    <div className="mt-1 text-xs text-slate-500">
                      {ideaAuthor(idea)} · {formatDateTime(idea.createdAt)}
                    </div>
                  </div>
                  <Pill tone={toneFor(idea.ideaStatus)}>{idea.ideaStatus ?? "Proposed"}</Pill>
                </div>

                <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                  {cleanIdeaBodyForDisplay(idea.body)}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="purple">{ideaCategory(idea)}</Pill>
                  <Pill tone={toneFor(ideaImpact(idea))}>{ideaImpact(idea)} impact</Pill>
                  {ownerMode ? <Pill tone="green">{ideaVoteCount(idea)} votes</Pill> : <Pill tone="slate">Votes private</Pill>}
                  <Pill tone="cyan">{ideaNotes(idea).length} notes</Pill>
                  <button
                    type="button"
                    onClick={() => voteIdea(idea.id)}
                    className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white hover:bg-white/10"
                  >
                    Vote
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIdeaId(idea.id);
                      setIdeaAssigneeId(ideaAssigneeId || selectedMemberId || members[0]?.id || "");
                    }}
                    className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100 hover:bg-cyan-500/20"
                  >
                    Assign
                  </button>
                  {isLeader(membership) ? (
                    <button
                      type="button"
                      onClick={() => removeIdeaBubble(idea.id)}
                      className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-100 hover:bg-red-500/20"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </Panel>
            ))}

            {!filteredIdeas.length ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                No ideas in this category yet.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeView === "workspace" ? (
        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Panel className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-cyan-500/12 to-transparent" />
            <div className="relative">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                Universal Workspace
              </div>
              <h3 className="mt-2 text-2xl font-black text-white">
                Shared firm operating room
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Post decisions, updates, file links, requests, and team notes. Use @Name to notify specific people.
              </p>

              <form onSubmit={createUniversalMessage} className="mt-5 grid gap-3">
                <input
                  value={workspaceMessage.title}
                  onChange={(event) =>
                    setWorkspaceMessage((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Optional title"
                  className={inputClass}
                />

                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={workspaceMessage.postType}
                    onChange={(event) =>
                      setWorkspaceMessage((current) => ({ ...current, postType: event.target.value }))
                    }
                    className={inputClass}
                  >
                    <option>Chat</option>
                    <option>Announcement</option>
                    <option>File</option>
                    <option>Decision</option>
                    <option>Update</option>
                    <option>Client Work</option>
                    <option>Research</option>
                  </select>

                  <select
                    value={workspaceMessage.projectId}
                    onChange={(event) =>
                      setWorkspaceMessage((current) => ({ ...current, projectId: event.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  {["Decision", "Client Work", "Research", "Update"].map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() =>
                        setWorkspaceMessage((current) => ({
                          ...current,
                          postType: template,
                          title: current.title || `${template}: `,
                          body:
                            current.body ||
                            `${template}\n\nContext:\n\nDecision / Update:\n\nOwner:\n\nNext Step:\n`,
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-black text-white hover:bg-white/10"
                    >
                      {template} Template
                    </button>
                  ))}
                </div>

                <textarea
                  value={workspaceMessage.body}
                  onChange={(event) =>
                    setWorkspaceMessage((current) => ({ ...current, body: event.target.value }))
                  }
                  placeholder="Message body. Tag people with @Name."
                  className={cx(inputClass, "min-h-32")}
                />

                <textarea
                  value={workspaceMessage.fileLinks}
                  onChange={(event) =>
                    setWorkspaceMessage((current) => ({ ...current, fileLinks: event.target.value }))
                  }
                  placeholder="File links, one per line"
                  className={cx(inputClass, "min-h-20")}
                />

                <button
                  disabled={loading}
                  className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  Post + Notify Mentions
                </button>
              </form>
            </div>
          </Panel>

          <Panel className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-cyan-500/12 to-transparent" />
            <div className="relative">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                    Shared Feed
                  </div>
                  <h3 className="mt-2 text-2xl font-black text-white">Firm activity stream</h3>
                </div>

                <div className="flex flex-wrap gap-2">
                  {workspaceTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setWorkspaceFilter(type)}
                      className={cx(
                        "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                        workspaceFilter === type
                          ? "bg-white text-slate-950"
                          : "border border-white/10 bg-white/[0.045] text-white"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid max-h-[900px] gap-3 overflow-y-auto pr-2">
                {workspaceMessages.map((post) => (
                  <Panel key={post.id} className="bg-black/35">
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

                {!workspaceMessages.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                    No workspace posts in this filter.
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>
        </div>
      ) : null}

      {activeView === "my-work" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <Panel className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-emerald-500/12 to-transparent" />

            <div className="relative">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-green-400">
                My Work
              </div>
              <h3 className="mt-2 text-3xl font-black text-white">
                Personal objectives and assigned work
              </h3>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Metric label="Daily Objectives" value={`${myTodoCompletion}%`} tone="green" helper={`${myTodos.filter((todo) => todo.done).length}/${myTodos.length} complete`} />
                <Metric label="Firm Work" value={`${myFirmTaskCompletion}%`} tone="cyan" helper={`${myTasks.filter((task) => task.status === "Complete" || task.status === "Done").length}/${myTasks.length} complete`} />
              </div>

              <form onSubmit={addTodo} className="mt-5 grid gap-3 md:grid-cols-[1fr_150px_150px_auto]">
                <input
                  value={todoTitle}
                  onChange={(event) => setTodoTitle(event.target.value)}
                  placeholder="Add personal objective"
                  className={inputClass}
                />
                <input
                  type="date"
                  value={todoDate}
                  onChange={(event) => setTodoDate(event.target.value)}
                  className={inputClass}
                />
                <input
                  value={todoCategory}
                  onChange={(event) => setTodoCategory(event.target.value)}
                  placeholder="Category"
                  className={inputClass}
                />
                <button className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950">
                  Add
                </button>
              </form>

              <div className="mt-5 grid gap-3">
                {myTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className={cx(
                      "group flex items-center justify-between gap-3 rounded-2xl border p-4 transition",
                      todo.done ? "border-emerald-500/20 bg-emerald-500/10" : "border-white/10 bg-black/35 hover:bg-white/[0.06]"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleTodo(todo.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className={cx(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-2xl border text-sm font-black transition group-hover:scale-105",
                          todo.done
                            ? "border-emerald-400 bg-emerald-500 text-white shadow-lg shadow-emerald-950/30"
                            : "border-white/20 bg-white/[0.045] text-slate-500"
                        )}
                      >
                        {todo.done ? "✓" : ""}
                      </span>
                      <span className="min-w-0">
                        <span className={cx("block truncate text-sm font-black", todo.done ? "text-emerald-100 line-through" : "text-white")}>
                          {todo.title}
                        </span>
                        <span className="text-xs text-slate-500">{todo.category}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTodo(todo.id)}
                      className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[10px] font-black text-red-100"
                    >
                      Delete
                    </button>
                  </div>
                ))}

                {!myTodos.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                    No personal objectives for this day.
                  </div>
                ) : null}
              </div>

              <div className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Firm-assigned work
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {myTasks.map((task) => (
                  <Panel key={task.id} className={task.status === "Complete" || task.status === "Done" ? "border-emerald-500/25 bg-emerald-500/10" : "bg-black/35"}>
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
                    No assigned firm work yet.
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          <div className="grid gap-5">
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
                      className={inputClass}
                    />
                    <select
                      value={taskForm.reminderInterval}
                      onChange={(event) =>
                        setTaskForm((current) => ({ ...current, reminderInterval: event.target.value }))
                      }
                      className={inputClass}
                    >
                      <option>Once</option>
                      <option>Daily</option>
                      <option>Every 2 Days</option>
                      <option>Weekly</option>
                      <option>Biweekly</option>
                      <option>Monthly</option>
                      <option>Until Complete</option>
                    </select>
                    <textarea
                      value={taskForm.reminderNote}
                      onChange={(event) =>
                        setTaskForm((current) => ({ ...current, reminderNote: event.target.value }))
                      }
                      placeholder="Reminder note"
                      className={cx(inputClass, "min-h-20")}
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

            {ownerMode ? (
              <Panel>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-400">
                  Owner Completion Feed
                </div>
                <h3 className="mt-2 text-xl font-black text-white">
                  Completed firm-assigned work
                </h3>

                <div className="mt-4 grid max-h-[360px] gap-3 overflow-y-auto pr-2">
                  {completedFirmTasks.slice(0, 20).map((task) => (
                    <div key={task.id} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-black text-white">{task.title}</div>
                        <Pill tone="green">Done</Pill>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Completed by {task.ownerName} · Due {shortDate(task.dueDate)}
                      </div>
                    </div>
                  ))}

                  {!completedFirmTasks.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm font-bold text-slate-500">
                      No completed firm tasks yet.
                    </div>
                  ) : null}
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeView === "docs" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Panel className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-amber-500/12 to-transparent" />

            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                    My Docs
                  </div>
                  <h3 className="mt-2 text-2xl font-black text-white">Personal knowledge vault</h3>
                </div>
                <button
                  type="button"
                  onClick={() => createDoc()}
                  className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                >
                  New
                </button>
              </div>

              <div className="mt-4 grid gap-2">
                {docTemplates.map((template) => (
                  <button
                    key={template.name}
                    type="button"
                    onClick={() => createDoc(template.name)}
                    className="rounded-2xl border border-white/10 bg-black/35 p-3 text-left text-xs font-black text-white hover:bg-white/[0.06]"
                  >
                    <div>{template.name}</div>
                    <div className="mt-1 text-[10px] font-bold text-slate-500">{template.category}</div>
                  </button>
                ))}
              </div>

              <input
                value={docSearch}
                onChange={(event) => setDocSearch(event.target.value)}
                placeholder="Search docs, category, labels..."
                className={cx(inputClass, "mt-4 w-full")}
              />

              {docCategories.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {docCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setDocSearch(category)}
                      className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white hover:bg-white/10"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 grid max-h-[720px] gap-3 overflow-y-auto pr-2">
                {filteredDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setActiveDocId(doc.id)}
                    className={cx(
                      "rounded-2xl border p-4 text-left transition hover:bg-white/[0.06]",
                      activeDoc?.id === doc.id
                        ? "border-cyan-400/50 bg-cyan-500/10"
                        : "border-white/10 bg-black/35"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-black text-white">
                          {doc.favorite ? "★ " : ""}
                          {doc.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {doc.category} · {formatDateTime(doc.updatedAt)}
                        </div>
                      </div>
                      {doc.attachments.length ? <Pill tone="amber">{doc.attachments.length}</Pill> : null}
                    </div>
                    <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400">
                      {doc.body || "Blank document."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {doc.labels.slice(0, 3).map((label) => (
                        <Pill key={label} tone="cyan">{label}</Pill>
                      ))}
                    </div>
                  </button>
                ))}

                {!filteredDocs.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                    No docs yet.
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          {renderDocsEditor()}
        </div>
      ) : null}
    </section>
  );
}