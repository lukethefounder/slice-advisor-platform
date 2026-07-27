"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent, ReactNode } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";
type View = "delegate" | "calendar" | "my-work" | "universal" | "brainstorm" | "docs" | "projects";

type User = { id?: string; name?: string | null; email?: string | null };
type Member = {
  id: string;
  userId?: string;
  role?: string;
  calendarColor?: string;
  canInviteMembers?: boolean;
  canManageFirm?: boolean;
  user?: User;
};
type Project = {
  id: string;
  title: string;
  description?: string | null;
  priority?: string | null;
  status?: string | null;
  dueDate?: string | null;
};
type Comment = {
  id: string;
  body: string;
  commentType: string;
  createdAt: string;
  user?: User;
};
type Task = {
  id: string;
  agendaId?: string;
  title: string;
  detail?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
  projectId?: string | null;
  ownerName?: string | null;
  ownerColor?: string | null;
  ownerId?: string | null;
  ownerUserId?: string | null;
  project?: Project | null;
  comments?: Comment[];
};
type Post = {
  id: string;
  title: string;
  body: string;
  postType: string;
  createdAt: string;
  projectId?: string | null;
  project?: Project | null;
  ideaStatus?: string | null;
  votes?: number | null;
};
type Workspace = {
  firm?: { id: string; name: string; firmCode?: string; firmEmail?: string | null } | null;
  membership?: Member | null;
  firms?: Array<{ id: string; name: string; membership?: Member }>;
  members?: Member[];
  projects?: Project[];
  posts?: Post[];
  createdInvite?: { inviteCode?: string } | null;
  inviteLink?: string | null;
  operations?: {
    allTasks?: Task[];
    calendarTasks?: Task[];
    ideaBoard?: Post[];
    sprintMetrics?: Record<string, number>;
  };
};

type LocalTodo = {
  id: string;
  title: string;
  date: string;
  done: boolean;
  rank: string;
  estimateMinutes: string;
  notes: string;
};
type TaskPref = {
  rank: string;
  estimateMinutes: string;
  reminderAt: string;
  personalNotes: string;
  progress: string;
  taskLinks: string;
};
type LocalDoc = {
  id: string;
  title: string;
  category: string;
  templateName: string;
  labels: string[];
  body: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};
type FileBlob = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  uploadedAt: string;
};
type PaperworkFile = FileBlob & {
  taskId: string;
  taskTitle: string;
  taskStatus: string;
};

const EMPTY_WORKSPACE: Workspace = {
  firm: null,
  membership: null,
  firms: [],
  members: [],
  projects: [],
  posts: [],
  operations: {
    allTasks: [],
    calendarTasks: [],
    ideaBoard: [],
    sprintMetrics: {},
  },
};

const tabs: Array<[View, string, string, Tone]> = [
  ["delegate", "Delegate", "Create tasks", "red"],
  ["calendar", "Calendar", "Due dates", "purple"],
  ["my-work", "My Work", "Tasks + paperwork", "green"],
  ["universal", "Universal", "Project room", "cyan"],
  ["brainstorm", "Brainstorm", "Idea studio", "amber"],
  ["docs", "Docs", "Template vault", "slate"],
  ["projects", "Projects", "Long-term", "blue"],
];

const toneClasses: Record<Tone, string> = {
  red: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-100",
  purple: "border-purple-500/25 bg-purple-500/10 text-purple-100",
  cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
  blue: "border-blue-500/25 bg-blue-500/10 text-blue-100",
  slate: "border-slate-500/25 bg-slate-500/10 text-slate-100",
};

const inputClass =
  "rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-500/20";

const docTemplates = [
  {
    name: "Daily Execution Plan",
    category: "Daily Planning",
    labels: ["daily", "execution"],
    body:
      "Daily Execution Plan\n\nDate:\nPrimary Objective:\n\nTop 3 Priorities:\n1. \n2. \n3. \n\nTime Blocks:\n- \n\nRisks / Blockers:\n- \n\nEnd-of-Day Review:\nCompleted:\nCarried Forward:\n",
  },
  {
    name: "Client Meeting Prep",
    category: "Client Prep",
    labels: ["client", "meeting"],
    body:
      "Client Meeting Prep\n\nClient:\nMeeting Date:\nMeeting Goal:\n\nClient Context:\n\nKey Talking Points:\n- \n\nQuestions to Ask:\n- \n\nFollow-Up Tasks:\n- \n\nCompliance / Disclosure Notes:\n",
  },
  {
    name: "Client Message Summary",
    category: "Client Communication",
    labels: ["client", "message"],
    body:
      "Client Message Summary\n\nClient:\nReceived Date:\nAssigned Task:\n\nClient Message:\n\nRequired Response:\n\nSupporting Paperwork:\n- \n\nFollow-Up Owner:\n",
  },
  {
    name: "Research Memo",
    category: "Research",
    labels: ["research", "memo"],
    body:
      "Research Memo\n\nTopic:\nPrepared By:\nDate:\n\nQuestion Being Answered:\n\nSummary:\n\nEvidence / Sources:\n- \n\nRisks:\n- \n\nRecommendation / Next Step:\n",
  },
  {
    name: "Investment Review Note",
    category: "Investment Review",
    labels: ["investment", "review"],
    body:
      "Investment Review Note\n\nSecurity / Topic:\nPrepared By:\nDate:\n\nReason for Review:\n\nBull Case:\n\nBear Case:\n\nClient Relevance:\n\nRisks:\n\nNext Action:\n",
  },
  {
    name: "Risk Review Worksheet",
    category: "Risk",
    labels: ["risk", "client"],
    body:
      "Risk Review Worksheet\n\nClient / Household:\nReview Date:\nReviewer:\n\nRisk Profile:\n\nKnown Constraints:\n\nPortfolio Concerns:\n\nRecommended Follow-Up:\n",
  },
  {
    name: "Project Brief",
    category: "Project",
    labels: ["project", "brief"],
    body:
      "Project Brief\n\nProject:\nOwner:\nDue Date:\n\nObjective:\n\nScope:\n\nMilestones:\n1. \n2. \n3. \n\nDependencies:\n\nRisks:\n\nDefinition of Done:\n",
  },
  {
    name: "Project Data Room Note",
    category: "Project Data",
    labels: ["project", "data"],
    body:
      "Project Data Room Note\n\nProject:\nData Added By:\nDate:\n\nData / Substance Added:\n\nFiles / Links:\n- \n\nWhy This Matters:\n\nDecision or Next Step:\n",
  },
  {
    name: "Compliance Review Note",
    category: "Compliance",
    labels: ["compliance", "review"],
    body:
      "Compliance Review Note\n\nItem Reviewed:\nReviewer:\nDate:\n\nPurpose:\n\nEvidence Reviewed:\n- \n\nIssues / Exceptions:\n- \n\nDecision:\n\nRequired Follow-Up:\n",
  },
  {
    name: "Marketing Review Checklist",
    category: "Compliance",
    labels: ["marketing", "approval"],
    body:
      "Marketing Review Checklist\n\nMaterial Name:\nPrepared By:\nReviewer:\nDate:\n\nAudience:\n\nClaims Reviewed:\n\nRequired Disclosures:\n\nApproval Decision:\n\nEvidence / Notes:\n",
  },
  {
    name: "Decision Record",
    category: "Decision",
    labels: ["decision", "strategy"],
    body:
      "Decision Record\n\nDecision:\nDate:\nOwner:\n\nContext:\n\nOptions Considered:\n1. \n2. \n3. \n\nChosen Path:\n\nWhy:\n\nRisks:\n\nNext Steps:\n",
  },
  {
    name: "Brainstorm Continuation",
    category: "Brainstorm",
    labels: ["idea", "continuation"],
    body:
      "Brainstorm Continuation\n\nOriginal Idea:\n\nNew Direction:\n\nWhy It Matters:\n\nPossible Owner:\n\nNext Action:\n",
  },
  {
    name: "Long-Term Project Roadmap",
    category: "Long-Term Planning",
    labels: ["roadmap", "project"],
    body:
      "Long-Term Project Roadmap\n\nProject:\nLong-Term Objective:\nOwner:\nTarget Completion:\n\nPhase 1:\n- \n\nPhase 2:\n- \n\nPhase 3:\n- \n\nDelegation Plan:\n\nRisks:\n\nSuccess Metrics:\n",
  },
  {
    name: "Completed Work Summary",
    category: "Deliverable",
    labels: ["completed", "handoff"],
    body:
      "Completed Work Summary\n\nTask:\nCompleted By:\nCompleted Date:\n\nWhat Was Completed:\n\nFiles / Links:\n- \n\nNotes for Reviewer:\n\nOpen Questions:\n\nRecommended Next Action:\n",
  },
  {
    name: "Weekly Firm Review",
    category: "Leadership",
    labels: ["weekly", "review"],
    body:
      "Weekly Firm Review\n\nWeek Of:\n\nWins:\n- \n\nRisks:\n- \n\nClient Service Notes:\n- \n\nOperations Notes:\n- \n\nCompliance Notes:\n- \n\nNext Week Priorities:\n1. \n2. \n3. \n",
  },
  {
    name: "Blank Note",
    category: "General",
    labels: ["note"],
    body: "",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthStart(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function addMonths(dateString: string, months: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().slice(0, 10);
}

function calendarMonthDays(anchorDate: string) {
  const firstGridDay = startOfWeek(monthStart(anchorDate));
  return Array.from({ length: 42 }).map((_, index) => addDays(firstGridDay, index));
}

function shortDate(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function longDate(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
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

function monthTitle(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function weekdayShort(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
  });
}

function dayNumber(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
  });
}

function defaultTaskPreference(): TaskPref {
  return {
    rank: "3",
    estimateMinutes: "30",
    reminderAt: "",
    personalNotes: "",
    progress: "0",
    taskLinks: "",
  };
}

function normalizeTaskPreference(value?: Partial<TaskPref>): TaskPref {
  return {
    ...defaultTaskPreference(),
    ...(value ?? {}),
  };
}

function normalizeTodo(value: Partial<LocalTodo>): LocalTodo {
  return {
    id: value.id ?? `todo-${Date.now()}`,
    title: value.title ?? "",
    date: value.date ?? todayString(),
    done: Boolean(value.done),
    rank: value.rank ?? "3",
    estimateMinutes: value.estimateMinutes ?? "15",
    notes: value.notes ?? "",
  };
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
  if (clean.includes("progress") || clean.includes("review") || clean.includes("pending") || clean.includes("to do")) return "amber";
  return "slate";
}

function progressTone(progress: string): Tone {
  const value = Number(progress || 0);
  if (value >= 100) return "green";
  if (value >= 70) return "cyan";
  if (value >= 35) return "amber";
  return "red";
}

function completeStatus(status?: string | null) {
  return status === "Complete" || status === "Done";
}

function isOverdue(dueDate?: string | null, status?: string | null) {
  return Boolean(dueDate && dueDate < todayString() && !completeStatus(status));
}

function memberName(member?: Member | null) {
  return member?.user?.name || member?.user?.email || "Team member";
}

function memberEmail(member?: Member | null) {
  return member?.user?.email || "";
}

function canInviteMembers(membership?: Member | null) {
  return Boolean(
    membership && (membership.role === "Owner" || membership.canInviteMembers || membership.canManageFirm),
  );
}

function completionPct(items: Array<{ done?: boolean; status?: string | null }>) {
  if (!items.length) return 0;
  return Math.round((items.filter((item) => item.done || completeStatus(item.status)).length / items.length) * 100);
}

function ideaCategory(idea: Post) {
  const match = idea.body.match(/Category:\s*(.+)/i);
  return match?.[1]?.split("\n")[0]?.trim() || "Uncategorized";
}

function ideaImpact(idea: Post) {
  const match = idea.body.match(/Expected impact:\s*(.+)/i);
  return match?.[1]?.split("\n")[0]?.trim() || "Medium";
}

function ideaEffort(idea: Post) {
  const match = idea.body.match(/Estimated effort:\s*(.+)/i);
  return match?.[1]?.split("\n")[0]?.trim() || "Medium";
}

function ideaVoteCount(idea: Post) {
  const privateVotes = (idea.body.match(/\[SLICE_PRIVATE_VOTE\]/g) ?? []).length;
  const legacyVotes = (idea.body.match(/#vote/g) ?? []).length;
  return Math.max(privateVotes, legacyVotes, idea.votes ?? 0);
}

function ideaIsRemoved(idea: Post) {
  const status = String(idea.ideaStatus ?? idea.postType ?? "").toLowerCase();
  return status.includes("removed") || status.includes("archived") || status.includes("deleted");
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

function fileSizeLabel(size: number) {
  if (size > 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size > 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function parseJsonFileMarker(body: string, marker: string) {
  const files: FileBlob[] = [];
  if (!body.includes(marker)) return files;

  const segments = body.split(marker).slice(1);

  for (const segment of segments) {
    const raw = segment.split("\n[/SLICE_FILES]")[0]?.trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as { files?: FileBlob[] };
      if (Array.isArray(parsed.files)) files.push(...parsed.files);
    } catch {
      // Ignore malformed file metadata.
    }
  }

  return files;
}

function parseDeliverableFiles(comments?: Comment[]) {
  return (comments ?? []).flatMap((comment) => parseJsonFileMarker(comment.body, "[SLICE_DELIVERABLE_JSON]"));
}

function parseProjectPostFiles(post: Post) {
  return parseJsonFileMarker(post.body, "[SLICE_PROJECT_FILES_JSON]");
}

function clientMessagesForTask(task: Task) {
  return (task.comments ?? []).filter((comment) => {
    const type = comment.commentType.toLowerCase();
    const body = comment.body.toLowerCase();

    return (
      type.includes("client") ||
      type.includes("message") ||
      body.includes("[client_message]") ||
      body.includes("client message:")
    );
  });
}

function inviteSuccessMessage(result: Workspace) {
  if (typeof result.inviteLink === "string" && result.inviteLink.trim()) return `Invite created: ${result.inviteLink.trim()}`;
  if (typeof result.createdInvite?.inviteCode === "string" && result.createdInvite.inviteCode.trim()) return `Invite created. Share invite code: ${result.createdInvite.inviteCode.trim()}`;
  return "Invite created.";
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl", className)}>
      {children}
    </div>
  );
}

function GlassPanel({
  children,
  className = "",
  tone = "slate",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  const glows: Record<Tone, string> = {
    red: "from-emerald-500/20",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
    blue: "from-blue-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <section className={cx("relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-5 shadow-xl shadow-black/10", className)}>
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">{children}</div>
    </section>
  );
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cx("inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]", toneClasses[tone])}>
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
    <GlassPanel tone={tone} className="p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 truncate text-3xl font-black text-white">{value}</div>
      {helper ? <div className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</div> : null}
    </GlassPanel>
  );
}

function ProgressBar({ value, tone = "green" }: { value: number; tone?: Tone }) {
  const colors: Record<Tone, string> = {
    red: "from-emerald-500 to-emerald-800",
    green: "from-emerald-400 to-emerald-700",
    amber: "from-amber-400 to-amber-700",
    purple: "from-purple-400 to-purple-800",
    cyan: "from-cyan-400 to-cyan-700",
    blue: "from-blue-400 to-blue-800",
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
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400">{eyebrow}</div>
        <h2 className="mt-1 text-2xl font-black text-white">{title}</h2>
        {description ? <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default function FirmCommandCenterPage() {
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY_WORKSPACE);
  const [activeFirmId, setActiveFirmId] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [activeView, setActiveView] = useState<View>("delegate");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(todayString());
  const [calendarAnchor, setCalendarAnchor] = useState(monthStart(todayString()));
  const [selectedIdeaId, setSelectedIdeaId] = useState("");
  const [ideaContinuation, setIdeaContinuation] = useState("");
  const [universalFilter, setUniversalFilter] = useState("All");
  const [universalProjectId, setUniversalProjectId] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [projectUploadFiles, setProjectUploadFiles] = useState<FileBlob[]>([]);

  const [firmForm, setFirmForm] = useState({ name: "", firmEmail: "" });
  const [inviteCodeForm, setInviteCodeForm] = useState({ inviteCode: "" });
  const [inviteForm, setInviteForm] = useState({ email: "", role: "Member" });

  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    priority: "Medium",
    dueDate: "",
    projectRole: "Contributor",
    assignedMembershipIds: [] as string[],
  });

  const [quickProjectForm, setQuickProjectForm] = useState({
    title: "",
    description: "",
    priority: "Medium",
    dueDate: "",
  });

  const [delegateForm, setDelegateForm] = useState({
    targetMembershipId: "",
    title: "",
    detail: "",
    priority: "Medium",
    status: "To Do",
    dueDate: todayString(),
    reminderAt: "",
    reminderNote: "",
    projectId: "",
    notifyEmail: true,
  });

  const [calendarTaskForm, setCalendarTaskForm] = useState({
    targetMembershipId: "",
    title: "",
    detail: "",
    priority: "Medium",
    projectId: "",
    reminderTime: "09:00",
    notifyEmail: true,
  });

  const [postForm, setPostForm] = useState({
    title: "",
    body: "",
    postType: "Project Update",
    projectId: "",
    dataAdded: "",
    decision: "",
    actionNeeded: "",
    ownerHint: "",
    links: "",
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

  const [docCreateForm, setDocCreateForm] = useState({
    title: "",
    templateName: docTemplates[0]?.name ?? "Blank Note",
  });

  const [ideaAssigneeId, setIdeaAssigneeId] = useState("");
  const [todoTitle, setTodoTitle] = useState("");
  const [todoRank, setTodoRank] = useState("3");
  const [todoEstimate, setTodoEstimate] = useState("15");
  const [todoNotes, setTodoNotes] = useState("");
  const [todoDate, setTodoDate] = useState(todayString());
  const [todos, setTodos] = useState<LocalTodo[]>([]);
  const [taskPrefs, setTaskPrefs] = useState<Record<string, TaskPref>>({});
  const [docs, setDocs] = useState<LocalDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState("");

  const members = workspace.members ?? [];
  const projects = workspace.projects ?? [];
  const posts = workspace.posts ?? [];
  const operations = workspace.operations ?? EMPTY_WORKSPACE.operations!;
  const allTasks = operations.allTasks ?? [];
  const calendarTasks = operations.calendarTasks ?? [];
  const ideas = operations.ideaBoard ?? [];
  const metrics = operations.sprintMetrics ?? {};
  const selectedTask = allTasks.find((task) => task.id === selectedTaskId) ?? allTasks[0] ?? null;
  const activeDoc = docs.find((doc) => doc.id === activeDocId) ?? docs[0] ?? null;

  const openTasks = allTasks.filter((task) => !completeStatus(task.status));
  const calendarDays = useMemo(() => calendarMonthDays(calendarAnchor), [calendarAnchor]);
  const selectedDateTasks = useMemo(() => calendarTasks.filter((task) => task.dueDate === selectedCalendarDate), [calendarTasks, selectedCalendarDate]);
  const visibleIdeaBoard = useMemo(() => ideas.filter((idea) => !ideaIsRemoved(idea)), [ideas]);
  const selectedIdea = visibleIdeaBoard.find((idea) => idea.id === selectedIdeaId) ?? visibleIdeaBoard[0] ?? null;
  const selectedUniversalProject = projects.find((project) => project.id === universalProjectId) ?? projects[0] ?? null;
  const membership = workspace.membership ?? null;

  const myTasks = useMemo(() => {
    if (!membership) return [];

    return allTasks
      .filter((task) => task.ownerUserId === membership.userId && !completeStatus(task.status))
      .sort((a, b) => {
        const aPref = normalizeTaskPreference(taskPrefs[a.id]);
        const bPref = normalizeTaskPreference(taskPrefs[b.id]);
        const rankDiff = Number(bPref.rank) - Number(aPref.rank);

        if (rankDiff !== 0) return rankDiff;

        return String(a.dueDate ?? "9999-12-31").localeCompare(String(b.dueDate ?? "9999-12-31"));
      });
  }, [allTasks, membership, taskPrefs]);

  const myCompletedTasks = useMemo(() => {
    if (!membership) return [];

    return allTasks
      .filter((task) => task.ownerUserId === membership.userId && completeStatus(task.status))
      .sort((a, b) => String(b.completedAt ?? b.updatedAt ?? "").localeCompare(String(a.completedAt ?? a.updatedAt ?? "")));
  }, [allTasks, membership]);

  const myTodos = useMemo(() => {
    return todos
      .filter((todo) => todo.date === todoDate)
      .sort((a, b) => {
        const rankDiff = Number(b.rank) - Number(a.rank);
        if (rankDiff !== 0) return rankDiff;
        return Number(a.done) - Number(b.done);
      });
  }, [todos, todoDate]);

  const paperworkFiles = useMemo<PaperworkFile[]>(() => {
    const sourceTasks = membership ? allTasks.filter((task) => task.ownerUserId === membership.userId) : allTasks;

    return sourceTasks.flatMap((task) =>
      parseDeliverableFiles(task.comments).map((file) => ({
        ...file,
        taskId: task.id,
        taskTitle: task.title,
        taskStatus: String(task.status ?? ""),
      })),
    );
  }, [allTasks, membership]);

  const universalPosts = useMemo(() => {
    return posts
      .filter((post) => {
        if (universalFilter !== "All" && post.postType !== universalFilter) return false;
        if (universalProjectId && post.projectId !== universalProjectId) return false;
        return true;
      })
      .slice(0, 120);
  }, [posts, universalFilter, universalProjectId]);

  const universalTypes = useMemo(() => ["All", ...Array.from(new Set(posts.map((post) => post.postType))).sort()], [posts]);

  const filteredSavedDocs = useMemo(() => {
    const query = docSearch.toLowerCase().trim();

    return docs
      .filter((doc) => {
        if (!query) return true;

        return (
          doc.title.toLowerCase().includes(query) ||
          doc.category.toLowerCase().includes(query) ||
          doc.templateName.toLowerCase().includes(query) ||
          doc.labels.join(" ").toLowerCase().includes(query) ||
          doc.body.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [docs, docSearch]);

  async function loadWorkspace(firmId?: string) {
    setLoading(true);
    setMessage("");

    try {
      const query = firmId ? `?firmId=${encodeURIComponent(firmId)}` : "";
      const response = await fetch(`/api/firm-workspace${query}`, { cache: "no-store" });
      const result = (await response.json()) as Workspace | { error?: string };

      if (!response.ok) {
        setMessage("error" in result && result.error ? result.error : "Unable to load firm workspace.");
        return;
      }

      const payload = result as Workspace;
      const normalized = {
        ...EMPTY_WORKSPACE,
        ...payload,
        operations: {
          ...EMPTY_WORKSPACE.operations,
          ...(payload.operations ?? {}),
        },
      } as Workspace;

      setWorkspace(normalized);

      const nextFirmId = normalized.firm?.id ?? normalized.firms?.[0]?.id ?? "";
      if (nextFirmId) setActiveFirmId(nextFirmId);

      if (!delegateForm.targetMembershipId && normalized.members?.[0]) {
        setDelegateForm((current) => ({ ...current, targetMembershipId: normalized.members![0].id }));
      }

      if (!calendarTaskForm.targetMembershipId && normalized.members?.[0]) {
        setCalendarTaskForm((current) => ({ ...current, targetMembershipId: normalized.members![0].id }));
      }

      if (!ideaAssigneeId && normalized.members?.[0]) {
        setIdeaAssigneeId(normalized.members[0].id);
      }

      if (!selectedTaskId && normalized.operations?.allTasks?.[0]) {
        setSelectedTaskId(normalized.operations.allTasks[0].id);
      }

      if (!universalProjectId && normalized.projects?.[0]) {
        setUniversalProjectId(normalized.projects[0].id);
        setPostForm((current) => ({ ...current, projectId: normalized.projects![0].id }));
      }

      const activeIdeas = normalized.operations?.ideaBoard?.filter((idea) => !ideaIsRemoved(idea)) ?? [];
      if (!selectedIdeaId && activeIdeas[0]) setSelectedIdeaId(activeIdeas[0].id);
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

      const result = (await response.json()) as Workspace | { error?: string };

      if (!response.ok) {
        setMessage("error" in result && result.error ? result.error : "Firm workspace action failed.");
        return null;
      }

      const payload = result as Workspace;
      await loadWorkspace(payload.firm?.id ?? activeFirmId);

      return payload;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Firm workspace action failed.");
      return null;
    } finally {
      setWorking("");
    }
  }

  async function postTeamAction(body: Record<string, unknown>) {
    if (!activeFirmId) {
      setMessage("Select or create a firm first.");
      return null;
    }

    setWorking(String(body.action ?? "team-board"));
    setMessage("");

    try {
      const response = await fetch("/api/firm-workspace/team-board", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": String(body.action ?? "team-board"),
        },
        body: JSON.stringify({
          firmId: activeFirmId,
          ...body,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Firm Command Center action failed.");
        return null;
      }

      await loadWorkspace(activeFirmId);

      return result as {
        ok?: boolean;
        taskId?: string;
        emailResult?: { status: string; reason: string; simulated: boolean };
        completionEmailResult?: { status: string; reason: string; simulated: boolean } | null;
      };
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Firm Command Center action failed.");
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

  async function createUniversalProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quickProjectForm.title.trim()) {
      setMessage("Project title is required.");
      return;
    }

    const result = await postFirmAction({
      action: "createProject",
      firmId: activeFirmId,
      title: quickProjectForm.title,
      description: quickProjectForm.description,
      priority: quickProjectForm.priority,
      dueDate: quickProjectForm.dueDate,
      assignedMembershipIds: [],
      projectRole: "Contributor",
    });

    if (result) {
      const created = result.projects?.find((project) => project.title === quickProjectForm.title) ?? result.projects?.[0] ?? null;

      setQuickProjectForm({
        title: "",
        description: "",
        priority: "Medium",
        dueDate: "",
      });

      if (created) {
        setUniversalProjectId(created.id);
        setPostForm((current) => ({ ...current, projectId: created.id }));
      }

      setMessage("Project room created.");
    }
  }

  async function createDelegatedTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!delegateForm.title.trim()) {
      setMessage("Task title is required.");
      return;
    }

    const result = await postTeamAction({
      action: "createDelegatedTask",
      targetMembershipId: delegateForm.targetMembershipId,
      title: delegateForm.title,
      detail: delegateForm.detail,
      priority: delegateForm.priority,
      status: delegateForm.status,
      dueDate: delegateForm.dueDate,
      reminderAt: delegateForm.reminderAt,
      reminderNote: delegateForm.reminderNote,
      projectId: delegateForm.projectId || null,
      notifyEmail: delegateForm.notifyEmail,
    });

    if (result) {
      const assignee = members.find((member) => member.id === delegateForm.targetMembershipId);

      setDelegateForm((current) => ({
        ...current,
        title: "",
        detail: "",
        reminderAt: "",
        reminderNote: "",
      }));

      setMessage(`Task delegated to ${memberName(assignee)}.${result.emailResult ? ` Email: ${result.emailResult.status}.` : ""}`);
    }
  }

  async function createCalendarTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!calendarTaskForm.title.trim()) {
      setMessage("Add a task title for the selected calendar date.");
      return;
    }

    const result = await postTeamAction({
      action: "createDelegatedTask",
      targetMembershipId: calendarTaskForm.targetMembershipId,
      title: calendarTaskForm.title,
      detail: calendarTaskForm.detail,
      priority: calendarTaskForm.priority,
      status: "To Do",
      dueDate: selectedCalendarDate,
      reminderAt: `${selectedCalendarDate} ${calendarTaskForm.reminderTime}`,
      reminderNote: calendarTaskForm.detail || calendarTaskForm.title,
      projectId: calendarTaskForm.projectId || null,
      notifyEmail: calendarTaskForm.notifyEmail,
    });

    if (result) {
      setCalendarTaskForm((current) => ({
        ...current,
        title: "",
        detail: "",
      }));

      setMessage(`Task added to ${shortDate(selectedCalendarDate)}.`);
    }
  }

  async function updateTaskStatus(taskId: string, status: string) {
    const result = await postTeamAction({
      action: "moveTask",
      taskId,
      status,
    });

    if (result) {
      setMessage(`Task marked ${status}.${result.completionEmailResult ? ` Completion email to assigner: ${result.completionEmailResult.status}.` : ""}`);
    }
  }

  async function addTaskReminder(task: Task, reminderAt: string, note: string) {
    if (!reminderAt.trim() && !note.trim()) {
      setMessage("Add a reminder time or note first.");
      return;
    }

    const result = await postFirmAction({
      action: "createTimedReminder",
      firmId: activeFirmId,
      taskId: task.id,
      targetMembershipId: task.ownerId,
      reminderAt,
      reminderNote: note || `Reminder for ${task.title}`,
    });

    if (result) setMessage("Reminder added to task.");
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const fileBlock = projectUploadFiles.length
      ? [
          "\nProject files attached:",
          projectUploadFiles.map((file) => `- ${file.name} (${fileSizeLabel(file.size)})`).join("\n"),
          "[SLICE_PROJECT_FILES_JSON]" + JSON.stringify({ files: projectUploadFiles }),
          "[/SLICE_FILES]",
        ].join("\n")
      : null;

    const enrichedBody = [
      postForm.body,
      postForm.dataAdded ? `\nData / Substance Added:\n${postForm.dataAdded}` : null,
      postForm.decision ? `\nDecision:\n${postForm.decision}` : null,
      postForm.actionNeeded ? `\nAction needed:\n${postForm.actionNeeded}` : null,
      postForm.ownerHint ? `\nOwner / follow-up:\n${postForm.ownerHint}` : null,
      postForm.links ? `\nLinks / files referenced:\n${postForm.links}` : null,
      fileBlock,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await postFirmAction({
      action: "createPost",
      firmId: activeFirmId,
      title: postForm.title,
      body: enrichedBody,
      postType: postForm.postType,
      projectId: postForm.projectId || universalProjectId || null,
    });

    if (result) {
      setPostForm({
        title: "",
        body: "",
        postType: "Project Update",
        projectId: universalProjectId,
        dataAdded: "",
        decision: "",
        actionNeeded: "",
        ownerHint: "",
        links: "",
      });
      setProjectUploadFiles([]);
      setMessage("Project contribution added.");
    }
  }

  async function createIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeFirmId) {
      setMessage("Create or select a firm first.");
      return;
    }

    if (!ideaForm.title.trim()) {
      setMessage("Idea title is required.");
      return;
    }

    setWorking("createIdea");
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
          firmId: activeFirmId,
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

      await loadWorkspace(activeFirmId);
      setSelectedIdeaId(payload.createdIdeaId || "");
      setMessage("Idea submitted to Brainstorm.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit idea.");
    } finally {
      setWorking("");
    }
  }

  async function continueIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedIdea || !ideaContinuation.trim()) {
      setMessage("Select an idea and add a continuation note first.");
      return;
    }

    setWorking("continueIdea");
    setMessage("");

    try {
      const response = await fetch("/api/firm-workspace/anonymous-ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "continue-firm-idea",
        },
        body: JSON.stringify({
          action: "createIdea",
          firmId: activeFirmId,
          title: `Continuation: ${selectedIdea.title}`,
          body: [
            `Original idea: ${selectedIdea.title}`,
            "",
            cleanIdeaBodyForDisplay(selectedIdea.body),
            "",
            "Continuation:",
            ideaContinuation.trim(),
          ].join("\n"),
          category: ideaCategory(selectedIdea),
          impact: ideaImpact(selectedIdea),
          effort: ideaEffort(selectedIdea),
          ownerHint: "",
          projectId: selectedIdea.projectId || "",
          fileLinks: [],
          anonymous: true,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to continue idea.");
        return;
      }

      setIdeaContinuation("");
      await loadWorkspace(activeFirmId);
      setSelectedIdeaId(payload.createdIdeaId || selectedIdea.id);
      setMessage("Idea continuation added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to continue idea.");
    } finally {
      setWorking("");
    }
  }

  async function createTaskFromIdea(idea: Post) {
    const result = await postTeamAction({
      action: "createDelegatedTask",
      targetMembershipId: ideaAssigneeId || delegateForm.targetMembershipId || members[0]?.id,
      title: `Explore idea: ${idea.title}`,
      detail: cleanIdeaBodyForDisplay(idea.body),
      priority: ideaImpact(idea) === "Critical" || ideaImpact(idea) === "High" ? "High" : "Medium",
      status: "To Do",
      dueDate: todayString(),
      reminderAt: "",
      reminderNote: "Follow up on this brainstorm idea.",
      projectId: idea.project?.id ?? null,
      notifyEmail: true,
    });

    if (result) {
      setMessage("Task created from brainstorm idea and assignee email notification was attempted.");
      setActiveView("delegate");
    }
  }

  async function addCommentToTask(task: Task, body: string, commentType = "Comment") {
    const result = await postFirmAction({
      action: "addComment",
      firmId: activeFirmId,
      taskId: task.id,
      agendaId: task.agendaId,
      body,
      commentType,
    });

    if (result) setMessage(`${commentType} added to ${task.title}.`);
  }

  function saveTodos(nextTodos: LocalTodo[]) {
    setTodos(nextTodos);

    try {
      localStorage.setItem("slice-firm-command-center-todos-v7", JSON.stringify(nextTodos));
    } catch {
      setMessage("Local todo save failed.");
    }
  }

  function addTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!todoTitle.trim()) return;

    const todo: LocalTodo = {
      id: `todo-${Date.now()}`,
      title: todoTitle.trim(),
      date: todoDate,
      done: false,
      rank: todoRank,
      estimateMinutes: todoEstimate,
      notes: todoNotes,
    };

    saveTodos([todo, ...todos]);
    setTodoTitle("");
    setTodoNotes("");
  }

  function updateTodo(todoId: string, patch: Partial<LocalTodo>) {
    saveTodos(todos.map((todo) => (todo.id === todoId ? { ...todo, ...patch } : todo)));
  }

  function toggleTodo(todoId: string) {
    saveTodos(todos.map((todo) => (todo.id === todoId ? { ...todo, done: !todo.done } : todo)));
  }

  function saveTaskPrefs(next: Record<string, TaskPref>) {
    setTaskPrefs(next);

    try {
      localStorage.setItem("slice-firm-command-center-task-prefs-v7", JSON.stringify(next));
    } catch {
      setMessage("Task preference save failed.");
    }
  }

  function updateTaskPref(taskId: string, patch: Partial<TaskPref>) {
    const current = normalizeTaskPreference(taskPrefs[taskId]);
    saveTaskPrefs({ ...taskPrefs, [taskId]: { ...current, ...patch } });
  }

  function saveDocs(nextDocs: LocalDoc[]) {
    setDocs(nextDocs);

    try {
      localStorage.setItem("slice-firm-command-center-docs-v7", JSON.stringify(nextDocs));
    } catch {
      setMessage("Doc save failed.");
    }
  }

  function createDoc(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const template = docTemplates.find((item) => item.name === docCreateForm.templateName) ?? docTemplates[0];
    const now = new Date().toISOString();
    const title =
      docCreateForm.title.trim() ||
      (template.name === "Blank Note" ? `Untitled Note - ${shortDate(todayString())}` : `${template.name} - ${shortDate(todayString())}`);

    const doc: LocalDoc = {
      id: `doc-${Date.now()}`,
      title,
      category: template.category,
      templateName: template.name,
      labels: template.labels,
      body: template.body,
      favorite: false,
      createdAt: now,
      updatedAt: now,
    };

    saveDocs([doc, ...docs]);
    setActiveDocId(doc.id);
    setDocCreateForm((current) => ({ ...current, title: "" }));
  }

  function createDocFromTemplate(templateName: string) {
    const template = docTemplates.find((item) => item.name === templateName) ?? docTemplates[0];
    const now = new Date().toISOString();

    const doc: LocalDoc = {
      id: `doc-${Date.now()}`,
      title: `${template.name} - ${shortDate(todayString())}`,
      category: template.category,
      templateName: template.name,
      labels: template.labels,
      body: template.body,
      favorite: false,
      createdAt: now,
      updatedAt: now,
    };

    saveDocs([doc, ...docs]);
    setActiveDocId(doc.id);
  }

  function updateActiveDoc(patch: Partial<LocalDoc>) {
    if (!activeDoc) return;

    saveDocs(docs.map((doc) => (doc.id === activeDoc.id ? { ...doc, ...patch, updatedAt: new Date().toISOString() } : doc)));
  }

  function deleteDoc(docId: string) {
    const nextDocs = docs.filter((doc) => doc.id !== docId);
    saveDocs(nextDocs);
    setActiveDocId(nextDocs[0]?.id ?? "");
  }

  function exportDoc(doc: LocalDoc) {
    const blob = new Blob([doc.body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${doc.title.replace(/[^a-z0-9]/gi, "-").toLowerCase() || "slice-doc"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function readFiles(files: FileList | File[], maxMb = 4) {
    const safeFiles = Array.from(files).slice(0, 8);
    const deliverables: FileBlob[] = [];

    for (const file of safeFiles) {
      if (file.size > maxMb * 1024 * 1024) {
        setMessage(`${file.name} is too large. Keep each upload under ${maxMb}MB for now.`);
        continue;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Unable to read file."));
        reader.readAsDataURL(file);
      });

      deliverables.push({
        id: `file-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      });
    }

    return deliverables;
  }

  async function uploadDeliverable(task: Task, files: FileList | File[]) {
    const deliverables = await readFiles(files, 4);

    if (!deliverables.length) return;

    await addCommentToTask(
      task,
      [
        "Deliverable uploaded for review.",
        `Uploaded by task owner at: ${new Date().toISOString()}`,
        "[SLICE_DELIVERABLE_JSON]" + JSON.stringify({ files: deliverables }),
        "[/SLICE_FILES]",
      ].join("\n"),
      "Deliverable Upload",
    );
  }

  async function handleDeliverableInput(task: Task, event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) return;

    await uploadDeliverable(task, files);
    event.target.value = "";
  }

  async function handleDeliverableDrop(task: Task, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const files = event.dataTransfer.files;
    if (!files?.length) return;

    await uploadDeliverable(task, files);
  }

  async function handleProjectFiles(files: FileList | File[]) {
    const uploads = await readFiles(files, 2);

    if (!uploads.length) return;

    setProjectUploadFiles((current) => [...current, ...uploads].slice(0, 8));
  }

  async function handleProjectFileInput(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) return;

    await handleProjectFiles(files);
    event.target.value = "";
  }

  async function handleProjectFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const files = event.dataTransfer.files;
    if (!files?.length) return;

    await handleProjectFiles(files);
  }

  async function submitTaskWork(task: Task) {
    const pref = normalizeTaskPreference(taskPrefs[task.id]);

    if (pref.taskLinks.trim() || pref.personalNotes.trim()) {
      await addCommentToTask(
        task,
        [
          "Task submitted for review.",
          pref.taskLinks.trim() ? `Links:\n${pref.taskLinks.trim()}` : null,
          pref.personalNotes.trim() ? `Notes:\n${pref.personalNotes.trim()}` : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
        "Task Submission",
      );
    }

    updateTaskPref(task.id, { progress: "100" });
    await updateTaskStatus(task.id, "Complete");
  }

  useEffect(() => {
    void loadWorkspace();

    try {
      const rawTodos = localStorage.getItem("slice-firm-command-center-todos-v7");
      const rawTaskPrefs = localStorage.getItem("slice-firm-command-center-task-prefs-v7");
      const rawDocs = localStorage.getItem("slice-firm-command-center-docs-v7");

      if (rawTodos) {
        const parsed = JSON.parse(rawTodos);
        if (Array.isArray(parsed)) setTodos(parsed.map((todo) => normalizeTodo(todo)));
      }

      if (rawTaskPrefs) {
        const parsed = JSON.parse(rawTaskPrefs);
        if (parsed && typeof parsed === "object") setTaskPrefs(parsed);
      }

      if (rawDocs) {
        const parsed = JSON.parse(rawDocs);

        if (Array.isArray(parsed)) {
          setDocs(parsed);
          setActiveDocId(parsed[0]?.id ?? "");
        }
      }
    } catch {
      setTodos([]);
      setTaskPrefs({});
      setDocs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.48),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(5,150,105,0.20),_transparent_28%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-16%] top-[-18%] h-[38rem] w-[38rem] rounded-full bg-emerald-700/24 blur-3xl" />
        <div className="absolute right-[-14%] top-[8%] h-[34rem] w-[34rem] rounded-full bg-emerald-500/12 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[28%] h-[30rem] w-[30rem] rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-black/65 p-6 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-60 bg-gradient-to-b from-emerald-600/24 via-emerald-500/10 to-transparent" />

          <div className="relative grid gap-5 xl:grid-cols-[1fr_auto] xl:items-start">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="red">Firm Command Center</Pill>
                {workspace.firm ? <Pill tone="green">{workspace.firm.name}</Pill> : <Pill tone="amber">No firm selected</Pill>}
                <Pill tone="amber">{metrics.open ?? 0} open</Pill>
                <Pill tone="green">{metrics.complete ?? 0} complete</Pill>
              </div>

              <h1 className="mt-4 max-w-6xl text-4xl font-black tracking-tight md:text-6xl">
                Firm operating center.
              </h1>

              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400">
                Delegate work, plan due dates, track ranked personal work, collect paperwork, add project files,
                capture client messages, build docs, and keep project ideas alive.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/workspace" prefetch={false} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20">
                ← Workspace
              </Link>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-8">
            <MetricCard label="Total Tasks" value={metrics.total ?? 0} tone="cyan" />
            <MetricCard label="Open" value={metrics.open ?? 0} tone="amber" />
            <MetricCard label="In Progress" value={metrics.inProgress ?? 0} tone="purple" />
            <MetricCard label="Review" value={metrics.review ?? 0} tone="amber" />
            <MetricCard label="Blocked" value={metrics.blocked ?? 0} tone={(metrics.blocked ?? 0) ? "red" : "green"} />
            <MetricCard label="Complete" value={metrics.complete ?? 0} tone="green" />
            <MetricCard label="Ideas" value={metrics.ideas ?? visibleIdeaBoard.length} tone="purple" />
            <MetricCard label="Overdue" value={metrics.overdue ?? 0} tone={(metrics.overdue ?? 0) ? "red" : "green"} />
          </div>

          {message ? (
            <div className="relative mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
              {message}
            </div>
          ) : null}
        </header>

        {loading ? (
          <Card>
            <div className="py-12 text-center text-sm font-bold text-slate-400">Loading firm command center...</div>
          </Card>
        ) : null}

        <div className="grid gap-2 rounded-[1.5rem] border border-white/10 bg-black/45 p-2 md:grid-cols-3 xl:grid-cols-7">
          {tabs.map(([key, label, helper, tone]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveView(key)}
              className={cx(
                "rounded-2xl px-4 py-3 text-left transition",
                activeView === key ? "bg-white text-slate-950 shadow-lg shadow-black/20" : "bg-white/5 text-white hover:bg-white/10",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-black">{label}</div>
                <span
                  className={cx(
                    "h-2 w-2 rounded-full",
                    tone === "red"
                      ? "bg-emerald-400"
                      : tone === "green"
                        ? "bg-emerald-400"
                        : tone === "amber"
                          ? "bg-amber-400"
                          : tone === "purple"
                            ? "bg-purple-400"
                            : tone === "cyan"
                              ? "bg-cyan-400"
                              : tone === "blue"
                                ? "bg-blue-400"
                                : "bg-slate-400",
                  )}
                />
              </div>
              <div className="mt-1 text-[10px] font-bold text-slate-500">{helper}</div>
            </button>
          ))}
        </div>

        {activeView === "delegate" ? (
          <section className="grid gap-5 xl:grid-cols-[460px_minmax(0,1fr)]">
            <GlassPanel tone="red">
              <SectionHeader eyebrow="Delegate" title="Create one clean task" description="Everything fits into a simple task creation flow." />

              <form onSubmit={createDelegatedTask} className="mt-5 grid gap-3">
                <select value={delegateForm.targetMembershipId} onChange={(event) => setDelegateForm((current) => ({ ...current, targetMembershipId: event.target.value }))} className={inputClass}>
                  <option value="">Select assignee</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{memberName(member)} · {member.role}</option>
                  ))}
                </select>

                <input value={delegateForm.title} onChange={(event) => setDelegateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Task title" className={inputClass} />

                <textarea value={delegateForm.detail} onChange={(event) => setDelegateForm((current) => ({ ...current, detail: event.target.value }))} placeholder="Expected output, context, links, client message, and definition of done." className={cx(inputClass, "min-h-[150px]")} />

                <div className="grid gap-3 md:grid-cols-2">
                  <select value={delegateForm.priority} onChange={(event) => setDelegateForm((current) => ({ ...current, priority: event.target.value }))} className={inputClass}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                  <input type="date" value={delegateForm.dueDate} onChange={(event) => setDelegateForm((current) => ({ ...current, dueDate: event.target.value }))} className={inputClass} />
                </div>

                <select value={delegateForm.projectId} onChange={(event) => setDelegateForm((current) => ({ ...current, projectId: event.target.value }))} className={inputClass}>
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.title}</option>
                  ))}
                </select>

                <details className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-300">Reminder and notification</summary>
                  <div className="mt-3 grid gap-3">
                    <input value={delegateForm.reminderAt} onChange={(event) => setDelegateForm((current) => ({ ...current, reminderAt: event.target.value }))} placeholder="Reminder, e.g. tomorrow 9am" className={inputClass} />
                    <textarea value={delegateForm.reminderNote} onChange={(event) => setDelegateForm((current) => ({ ...current, reminderNote: event.target.value }))} placeholder="Reminder note" className={cx(inputClass, "min-h-20")} />
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-slate-300">
                      Email assignee
                      <input type="checkbox" checked={delegateForm.notifyEmail} onChange={(event) => setDelegateForm((current) => ({ ...current, notifyEmail: event.target.checked }))} />
                    </label>
                  </div>
                </details>

                <button disabled={!activeFirmId || !delegateForm.targetMembershipId || working === "createDelegatedTask"} className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/30 disabled:opacity-50">
                  {working === "createDelegatedTask" ? "Creating..." : "Create Task"}
                </button>
              </form>
            </GlassPanel>

            <GlassPanel tone="cyan">
              <SectionHeader eyebrow="Task Intake" title="Active task queue" description="Open any task in My Work for progress, client messages, uploads, links, paperwork, and completion." />

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {openTasks.slice(0, 18).map((task) => (
                  <button key={task.id} type="button" onClick={() => { setSelectedTaskId(task.id); setActiveView("my-work"); }} className="rounded-2xl border border-white/10 bg-black/35 p-4 text-left hover:bg-white/[0.08]">
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={statusTone(task.status)}>{task.status}</Pill>
                      <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
                      {isOverdue(task.dueDate, task.status) ? <Pill tone="red">Overdue</Pill> : null}
                      {task.project ? <Pill tone="purple">{task.project.title}</Pill> : null}
                    </div>
                    <div className="mt-3 text-base font-black text-white">{task.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{task.ownerName || "Unassigned"} · Due {shortDate(task.dueDate)}</div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">{task.detail || "No details."}</p>
                  </button>
                ))}

                {!openTasks.length ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500 md:col-span-2">No open tasks yet. Create one on the left.</div>
                ) : null}
              </div>
            </GlassPanel>
          </section>
        ) : null}

        {activeView === "calendar" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <GlassPanel tone="purple">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">Monthly Calendar</div>
                  <h2 className="mt-2 text-3xl font-black text-white">Due dates by month</h2>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">Click any day, then create a due-date task from the right-side panel.</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCalendarAnchor(addMonths(calendarAnchor, -1))} className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-2 text-xs font-black text-white">Prev</button>
                  <button type="button" onClick={() => { setCalendarAnchor(monthStart(todayString())); setSelectedCalendarDate(todayString()); }} className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950">Today</button>
                  <button type="button" onClick={() => setCalendarAnchor(addMonths(calendarAnchor, 1))} className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-2 text-xs font-black text-white">Next</button>
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-2xl font-black text-white">{monthTitle(calendarAnchor)}</div>
                  <Pill tone="purple">{calendarTasks.length} scheduled tasks</Pill>
                </div>

                <div className="mt-4 grid grid-cols-7 gap-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div key={day} className="text-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{day}</div>
                  ))}

                  {calendarMonthDays(calendarAnchor).map((day) => {
                    const tasks = calendarTasks.filter((task) => task.dueDate === day);
                    const isSelected = day === selectedCalendarDate;
                    const isToday = day === todayString();
                    const isCurrentMonth = new Date(`${day}T00:00:00`).getMonth() === new Date(`${calendarAnchor}T00:00:00`).getMonth();

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setSelectedCalendarDate(day);
                          setDelegateForm((current) => ({ ...current, dueDate: day }));
                        }}
                        className={cx(
                          "min-h-[130px] rounded-[1.25rem] border p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08]",
                          isSelected ? "border-purple-300/70 bg-purple-500/20 shadow-lg shadow-purple-950/20" : "border-white/10 bg-white/[0.035]",
                          isToday && !isSelected ? "ring-1 ring-emerald-400/40" : "",
                          !isCurrentMonth ? "opacity-40" : "",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{weekdayShort(day)}</span>
                          <span className="text-lg font-black text-white">{dayNumber(day)}</span>
                        </div>

                        <div className="mt-3 grid gap-1">
                          {tasks.slice(0, 4).map((task) => (
                            <div key={task.id} className="truncate rounded-lg border border-white/10 bg-black/45 px-2 py-1 text-[10px] font-bold text-slate-300" style={{ borderLeftColor: task.ownerColor ?? "#64748b", borderLeftWidth: 4 }}>
                              {task.title}
                            </div>
                          ))}
                        </div>

                        {tasks.length > 4 ? <div className="mt-2 text-[10px] font-black text-purple-200">+{tasks.length - 4} more</div> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </GlassPanel>

            <GlassPanel tone="amber">
              <SectionHeader eyebrow="Selected Date" title={longDate(selectedCalendarDate)} description="Create a task with this exact due date." />

              <form onSubmit={createCalendarTask} className="mt-5 grid gap-3">
                <select value={calendarTaskForm.targetMembershipId} onChange={(event) => setCalendarTaskForm((current) => ({ ...current, targetMembershipId: event.target.value }))} className={inputClass}>
                  <option value="">Select assignee</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{memberName(member)} · {member.role}</option>
                  ))}
                </select>

                <input value={calendarTaskForm.title} onChange={(event) => setCalendarTaskForm((current) => ({ ...current, title: event.target.value }))} placeholder="Task title" className={inputClass} />

                <textarea value={calendarTaskForm.detail} onChange={(event) => setCalendarTaskForm((current) => ({ ...current, detail: event.target.value }))} placeholder="Task details" className={cx(inputClass, "min-h-[110px]")} />

                <div className="grid gap-3 md:grid-cols-2">
                  <select value={calendarTaskForm.priority} onChange={(event) => setCalendarTaskForm((current) => ({ ...current, priority: event.target.value }))} className={inputClass}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                  <input type="time" value={calendarTaskForm.reminderTime} onChange={(event) => setCalendarTaskForm((current) => ({ ...current, reminderTime: event.target.value }))} className={inputClass} />
                </div>

                <select value={calendarTaskForm.projectId} onChange={(event) => setCalendarTaskForm((current) => ({ ...current, projectId: event.target.value }))} className={inputClass}>
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.title}</option>
                  ))}
                </select>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-slate-300">
                  Email assignee
                  <input type="checkbox" checked={calendarTaskForm.notifyEmail} onChange={(event) => setCalendarTaskForm((current) => ({ ...current, notifyEmail: event.target.checked }))} />
                </label>

                <button disabled={!calendarTaskForm.targetMembershipId || working === "createDelegatedTask"} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">Add Due-Date Task</button>
              </form>

              <div className="mt-6 border-t border-white/10 pt-5">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Tasks on this date</div>
                <div className="mt-3 grid gap-3">
                  {selectedDateTasks.map((task) => (
                    <button key={task.id} type="button" onClick={() => { setSelectedTaskId(task.id); setActiveView("my-work"); }} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-left hover:bg-white/[0.08]">
                      <div className="flex flex-wrap gap-2">
                        <Pill tone={statusTone(task.status)}>{task.status}</Pill>
                        <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
                      </div>
                      <div className="mt-3 text-sm font-black text-white">{task.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{task.ownerName || "Unassigned"} · {task.project?.title || "No project"}</div>
                    </button>
                  ))}

                  {!selectedDateTasks.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">No tasks on this date yet.</div>
                  ) : null}
                </div>
              </div>
            </GlassPanel>
          </section>
        ) : null}

        {activeView === "my-work" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
            <GlassPanel tone="green">
              <SectionHeader eyebrow="My Work" title="Rank, track, message, and submit" description="Customize task rankings, progress, paperwork, client messages, links, notes, and completion." />

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <MetricCard label="Active Tasks" value={myTasks.length} tone="green" />
                <MetricCard label="Completed" value={myCompletedTasks.length} tone="green" />
                <MetricCard label="Paperwork" value={paperworkFiles.length} tone="blue" />
                <MetricCard label="Est. Time" value={`${myTasks.reduce((sum, task) => sum + Number(normalizeTaskPreference(taskPrefs[task.id]).estimateMinutes || 30), 0)}m`} tone="amber" />
              </div>

              <div className="mt-5">
                <ProgressBar value={completionPct([...myTasks, ...myCompletedTasks])} tone="green" />
              </div>

              <div className="mt-5 grid gap-3">
                {myTasks.map((task) => {
                  const pref = normalizeTaskPreference(taskPrefs[task.id]);
                  const deliverables = parseDeliverableFiles(task.comments);
                  const clientMessages = clientMessagesForTask(task);

                  return (
                    <details key={task.id} className="rounded-[1.5rem] border border-white/10 bg-black/35 p-4" open={task.id === selectedTaskId}>
                      <summary onClick={() => setSelectedTaskId(task.id)} className="cursor-pointer list-none">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Pill tone="amber">Rank {pref.rank}</Pill>
                              <Pill tone={statusTone(task.status)}>{task.status}</Pill>
                              <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
                              <Pill tone="blue">{pref.estimateMinutes}m</Pill>
                              <Pill tone={progressTone(pref.progress)}>{pref.progress}%</Pill>
                              {clientMessages.length ? <Pill tone="cyan">{clientMessages.length} client msg</Pill> : null}
                              {deliverables.length ? <Pill tone="blue">{deliverables.length} file(s)</Pill> : null}
                            </div>

                            <h3 className="mt-3 text-lg font-black text-white">{task.title}</h3>
                            <div className="mt-2 text-xs text-slate-500">Due {shortDate(task.dueDate)} · {task.project?.title || "No project"}</div>
                          </div>

                          <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Workpaper drawer</div>
                        </div>
                      </summary>

                      <div className="mt-4 grid gap-4 border-t border-white/10 pt-4">
                        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-400">{task.detail || "No task detail."}</p>

                        <div className="grid gap-3 lg:grid-cols-[150px_150px_150px_minmax(0,1fr)]">
                          <select value={pref.rank} onChange={(event) => updateTaskPref(task.id, { rank: event.target.value })} className={inputClass}>
                            <option value="5">Rank 5</option>
                            <option value="4">Rank 4</option>
                            <option value="3">Rank 3</option>
                            <option value="2">Rank 2</option>
                            <option value="1">Rank 1</option>
                          </select>

                          <input value={pref.estimateMinutes} onChange={(event) => updateTaskPref(task.id, { estimateMinutes: event.target.value })} placeholder="Minutes" className={inputClass} />

                          <select value={pref.progress} onChange={(event) => updateTaskPref(task.id, { progress: event.target.value })} className={inputClass}>
                            <option value="0">0%</option>
                            <option value="25">25%</option>
                            <option value="50">50%</option>
                            <option value="75">75%</option>
                            <option value="100">100%</option>
                          </select>

                          <input value={pref.reminderAt} onChange={(event) => updateTaskPref(task.id, { reminderAt: event.target.value })} placeholder="Reminder, e.g. 2pm" className={inputClass} />
                        </div>

                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                          <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Client messages attached to this task</div>
                          <div className="mt-3 grid gap-2">
                            {clientMessages.map((comment) => (
                              <div key={comment.id} className="rounded-2xl border border-cyan-500/20 bg-black/30 p-3">
                                <div className="text-xs font-bold text-cyan-100">{comment.user?.name || comment.user?.email || "Client / User"} · {formatDateTime(comment.createdAt)}</div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{comment.body.replace("[CLIENT_MESSAGE]", "").trim()}</p>
                              </div>
                            ))}

                            {!clientMessages.length ? (
                              <div className="rounded-2xl border border-dashed border-cyan-500/20 p-4 text-sm text-cyan-100/70">No client messages are attached to this task yet.</div>
                            ) : null}
                          </div>
                        </div>

                        <textarea value={pref.personalNotes} onChange={(event) => updateTaskPref(task.id, { personalNotes: event.target.value })} placeholder="Task substance, notes, status, or submission explanation." className={cx(inputClass, "min-h-20")} />

                        <textarea value={pref.taskLinks} onChange={(event) => updateTaskPref(task.id, { taskLinks: event.target.value })} placeholder="Paste links to Excel sheets, PDFs, Word docs, folders, research, or files." className={cx(inputClass, "min-h-20")} />

                        <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleDeliverableDrop(task, event)} className="rounded-2xl border border-dashed border-blue-500/35 bg-blue-500/10 p-5 text-center text-sm font-bold text-blue-100">
                          Drop Excel, PDF, Word, image, or other task files here.
                          <label className="mt-3 block cursor-pointer rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
                            Or choose files
                            <input type="file" multiple className="hidden" onChange={(event) => void handleDeliverableInput(task, event)} />
                          </label>
                        </div>

                        {deliverables.length ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            {deliverables.map((file) => (
                              <a key={file.id} href={file.dataUrl} download={file.name} className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs font-bold text-blue-100">
                                {file.name}
                                <span className="mt-1 block text-[10px] text-blue-200/70">{fileSizeLabel(file.size)} · {formatDateTime(file.uploadedAt)}</span>
                              </a>
                            ))}
                          </div>
                        ) : null}

                        <div className="grid gap-2 md:grid-cols-5">
                          <button type="button" onClick={() => void updateTaskStatus(task.id, "In Progress")} className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-3 py-3 text-xs font-black text-purple-100">Progress</button>
                          <button type="button" onClick={() => void updateTaskStatus(task.id, "Review")} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs font-black text-amber-100">Review</button>
                          <button type="button" onClick={() => void addTaskReminder(task, pref.reminderAt, pref.personalNotes)} className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-3 py-3 text-xs font-black text-blue-100">Reminder</button>
                          <button type="button" onClick={() => updateTaskPref(task.id, { progress: "100" })} className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-xs font-black text-cyan-100">100%</button>
                          <button type="button" onClick={() => void submitTaskWork(task)} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-xs font-black text-emerald-100">Submit</button>
                        </div>
                      </div>
                    </details>
                  );
                })}

                {!myTasks.length ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No active assigned work. Completed work appears in the completed tracker.</div>
                ) : null}
              </div>
            </GlassPanel>

            <div className="grid gap-5">
              <GlassPanel tone="amber">
                <SectionHeader eyebrow="Ranked To-Do List" title="Personal priority queue" description="Rank each to-do item and estimate time commitment." />

                <form onSubmit={addTodo} className="mt-5 grid gap-3">
                  <input type="date" value={todoDate} onChange={(event) => setTodoDate(event.target.value)} className={inputClass} />
                  <input value={todoTitle} onChange={(event) => setTodoTitle(event.target.value)} placeholder="Add personal to-do" className={inputClass} />

                  <div className="grid gap-3 md:grid-cols-2">
                    <select value={todoRank} onChange={(event) => setTodoRank(event.target.value)} className={inputClass}>
                      <option value="5">Rank 5</option>
                      <option value="4">Rank 4</option>
                      <option value="3">Rank 3</option>
                      <option value="2">Rank 2</option>
                      <option value="1">Rank 1</option>
                    </select>
                    <input value={todoEstimate} onChange={(event) => setTodoEstimate(event.target.value)} placeholder="Minutes" className={inputClass} />
                  </div>

                  <textarea value={todoNotes} onChange={(event) => setTodoNotes(event.target.value)} placeholder="Notes" className={cx(inputClass, "min-h-20")} />

                  <button className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">Add Ranked To-Do</button>
                </form>

                <div className="mt-5">
                  <ProgressBar value={completionPct(myTodos)} tone="amber" />
                </div>

                <div className="mt-5 grid gap-2">
                  {myTodos.map((todo) => (
                    <div key={todo.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" onClick={() => toggleTodo(todo.id)} className="text-left">
                          <div className={cx("text-sm font-black", todo.done ? "text-emerald-300 line-through" : "text-white")}>{todo.title}</div>
                          <div className="mt-1 text-xs text-slate-500">Rank {todo.rank} · {todo.estimateMinutes}m</div>
                          {todo.notes ? <p className="mt-2 text-xs leading-5 text-slate-400">{todo.notes}</p> : null}
                        </button>

                        <select value={todo.rank} onChange={(event) => updateTodo(todo.id, { rank: event.target.value })} className="rounded-xl border border-white/10 bg-black/30 px-2 py-1 text-xs font-black text-white">
                          <option value="5">5</option>
                          <option value="4">4</option>
                          <option value="3">3</option>
                          <option value="2">2</option>
                          <option value="1">1</option>
                        </select>
                      </div>
                    </div>
                  ))}

                  {!myTodos.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">No private to-dos for this date.</div>
                  ) : null}
                </div>
              </GlassPanel>

              <GlassPanel tone="blue">
                <SectionHeader eyebrow="Paperwork Vault" title="All task files" description="Uploaded task documents, spreadsheets, PDFs, Word docs, images, and finished work appear here." />

                <div className="mt-5 grid max-h-[430px] gap-2 overflow-y-auto pr-1">
                  {paperworkFiles.map((file) => (
                    <a key={file.id} href={file.dataUrl} download={file.name} className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs font-bold text-blue-100">
                      {file.name}
                      <span className="mt-1 block text-[10px] text-blue-200/70">{file.taskTitle} · {fileSizeLabel(file.size)} · {formatDateTime(file.uploadedAt)}</span>
                    </a>
                  ))}

                  {!paperworkFiles.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">No uploaded paperwork yet.</div>
                  ) : null}
                </div>
              </GlassPanel>

              <GlassPanel tone="green">
                <SectionHeader eyebrow="Completed Work" title="Completed task tracker" description="Completed tasks move away from active work and stay here." />

                <div className="mt-3 grid max-h-[420px] gap-2 overflow-y-auto pr-1">
                  {myCompletedTasks.map((task) => (
                    <button key={task.id} type="button" onClick={() => setSelectedTaskId(task.id)} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-left hover:bg-emerald-500/15">
                      <div className="text-sm font-black text-white">{task.title}</div>
                      <div className="mt-1 text-xs text-emerald-200/70">{formatDateTime(task.completedAt || task.updatedAt)} · {parseDeliverableFiles(task.comments).length} upload(s)</div>
                    </button>
                  ))}

                  {!myCompletedTasks.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">No completed assigned tasks yet.</div>
                  ) : null}
                </div>
              </GlassPanel>
            </div>
          </section>
        ) : null}

        {activeView === "universal" ? (
          <section className="grid gap-5 xl:grid-cols-[460px_minmax(0,1fr)]">
            <div className="grid gap-5">
              <GlassPanel tone="cyan">
                <SectionHeader eyebrow="Project Room" title="Create or select project" description="Universal is a shared project room. Add comments, images, documents, spreadsheets, links, decisions, and follow-ups." />

                <form onSubmit={createUniversalProject} className="mt-5 grid gap-3">
                  <input value={quickProjectForm.title} onChange={(event) => setQuickProjectForm((current) => ({ ...current, title: event.target.value }))} placeholder="New project name" className={inputClass} />
                  <textarea value={quickProjectForm.description} onChange={(event) => setQuickProjectForm((current) => ({ ...current, description: event.target.value }))} placeholder="What is this project for?" className={cx(inputClass, "min-h-20")} />

                  <div className="grid gap-3 md:grid-cols-2">
                    <select value={quickProjectForm.priority} onChange={(event) => setQuickProjectForm((current) => ({ ...current, priority: event.target.value }))} className={inputClass}>
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>Critical</option>
                    </select>
                    <input type="date" value={quickProjectForm.dueDate} onChange={(event) => setQuickProjectForm((current) => ({ ...current, dueDate: event.target.value }))} className={inputClass} />
                  </div>

                  <button disabled={!activeFirmId || working === "createProject"} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">Create Project Room</button>
                </form>

                <div className="mt-5 grid gap-2 border-t border-white/10 pt-5">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => {
                        setUniversalProjectId(project.id);
                        setPostForm((current) => ({ ...current, projectId: project.id }));
                      }}
                      className={cx(
                        "rounded-2xl border p-3 text-left transition hover:bg-white/[0.08]",
                        universalProjectId === project.id ? "border-cyan-400/50 bg-cyan-500/10" : "border-white/10 bg-white/[0.045]",
                      )}
                    >
                      <div className="text-sm font-black text-white">{project.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{project.priority} · {shortDate(project.dueDate)}</div>
                    </button>
                  ))}

                  {!projects.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">No projects yet. Create one above.</div>
                  ) : null}
                </div>
              </GlassPanel>

              <GlassPanel tone="blue">
                <SectionHeader eyebrow="Selected Room" title={selectedUniversalProject?.title || "No project selected"} description={selectedUniversalProject?.description || "Choose a project to build its shared knowledge base."} />

                {selectedUniversalProject ? (
                  <div className="mt-5 grid gap-3">
                    <MetricCard label="Priority" value={selectedUniversalProject.priority ?? "Medium"} tone={priorityTone(selectedUniversalProject.priority)} />
                    <MetricCard label="Due" value={shortDate(selectedUniversalProject.dueDate)} tone="amber" />
                    <MetricCard label="Updates" value={posts.filter((post) => post.projectId === selectedUniversalProject.id).length} tone="cyan" />
                  </div>
                ) : null}
              </GlassPanel>
            </div>

            <div className="grid gap-5">
              <GlassPanel tone="cyan">
                <SectionHeader eyebrow="Add Substance" title="Comment, attach, or capture a decision" description="Add images, pictures, Excel sheets, PDFs, Word docs, links, or written project updates." />

                <form onSubmit={createPost} className="mt-5 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <input value={postForm.title} onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))} placeholder="Update or comment title" className={inputClass} />
                    <select value={postForm.postType} onChange={(event) => setPostForm((current) => ({ ...current, postType: event.target.value }))} className={inputClass}>
                      <option>Project Update</option>
                      <option>Project Comment</option>
                      <option>Project Data</option>
                      <option>Decision</option>
                      <option>Action Item</option>
                      <option>Client Service</option>
                      <option>Research</option>
                      <option>Compliance</option>
                      <option>Operations</option>
                      <option>Blocker</option>
                      <option>Win</option>
                    </select>
                  </div>

                  <select value={postForm.projectId || universalProjectId} onChange={(event) => {
                    setPostForm((current) => ({ ...current, projectId: event.target.value }));
                    setUniversalProjectId(event.target.value);
                  }} className={inputClass}>
                    <option value="">Select project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.title}</option>
                    ))}
                  </select>

                  <textarea value={postForm.body} onChange={(event) => setPostForm((current) => ({ ...current, body: event.target.value }))} placeholder="Comment, core update, project context, or client/project note." className={cx(inputClass, "min-h-24")} />

                  <details className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-300">Optional substance fields</summary>
                    <div className="mt-3 grid gap-3">
                      <textarea value={postForm.dataAdded} onChange={(event) => setPostForm((current) => ({ ...current, dataAdded: event.target.value }))} placeholder="Data or substance added to the project." className={cx(inputClass, "min-h-24")} />
                      <textarea value={postForm.decision} onChange={(event) => setPostForm((current) => ({ ...current, decision: event.target.value }))} placeholder="Decision made, if any." className={cx(inputClass, "min-h-20")} />
                      <textarea value={postForm.actionNeeded} onChange={(event) => setPostForm((current) => ({ ...current, actionNeeded: event.target.value }))} placeholder="Action needed / next step." className={cx(inputClass, "min-h-20")} />
                      <input value={postForm.ownerHint} onChange={(event) => setPostForm((current) => ({ ...current, ownerHint: event.target.value }))} placeholder="Owner or follow-up person" className={inputClass} />
                      <textarea value={postForm.links} onChange={(event) => setPostForm((current) => ({ ...current, links: event.target.value }))} placeholder="Links to Excel sheets, PDFs, Word docs, folders, research, or files." className={cx(inputClass, "min-h-20")} />
                    </div>
                  </details>

                  <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleProjectFileDrop(event)} className="rounded-2xl border border-dashed border-cyan-500/35 bg-cyan-500/10 p-5 text-center text-sm font-bold text-cyan-100">
                    Drop project images, pictures, Excel sheets, PDFs, Word docs, or other files here.
                    <label className="mt-3 block cursor-pointer rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
                      Or choose project files
                      <input type="file" multiple className="hidden" onChange={(event) => void handleProjectFileInput(event)} />
                    </label>
                  </div>

                  {projectUploadFiles.length ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {projectUploadFiles.map((file) => (
                        <div key={file.id} className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs font-bold text-cyan-100">
                          {file.name}
                          <span className="mt-1 block text-[10px] text-cyan-200/70">{fileSizeLabel(file.size)} · ready to post</span>
                          <button type="button" onClick={() => setProjectUploadFiles((current) => current.filter((item) => item.id !== file.id))} className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black text-emerald-100">
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <button disabled={!activeFirmId || working === "createPost"} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
                    {working === "createPost" ? "Posting..." : "Add to Project"}
                  </button>
                </form>
              </GlassPanel>

              <GlassPanel tone="cyan">
                <SectionHeader
                  eyebrow="Room Feed"
                  title="Comments, files, data, decisions, and updates"
                  description="This is the running project record."
                  action={
                    <select value={universalFilter} onChange={(event) => setUniversalFilter(event.target.value)} className={inputClass}>
                      {universalTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  }
                />

                <div className="mt-5 grid max-h-[900px] gap-3 overflow-y-auto pr-1">
                  {universalPosts.map((post) => {
                    const postFiles = parseProjectPostFiles(post);

                    return (
                      <article key={post.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-black text-white">{post.title}</h3>
                            <div className="mt-1 text-xs font-semibold text-slate-500">
                              {post.postType} · {post.project?.title || "No project"} · {formatDateTime(post.createdAt)}
                            </div>
                          </div>
                          <Pill tone={post.postType.toLowerCase().includes("decision") ? "green" : post.postType.toLowerCase().includes("blocker") ? "red" : post.postType.toLowerCase().includes("data") ? "blue" : "slate"}>
                            {post.postType}
                          </Pill>
                        </div>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{post.body.split("[SLICE_PROJECT_FILES_JSON]")[0]}</p>

                        {postFiles.length ? (
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {postFiles.map((file) => (
                              <a key={file.id} href={file.dataUrl} download={file.name} className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs font-bold text-cyan-100">
                                {file.name}
                                <span className="mt-1 block text-[10px] text-cyan-200/70">{fileSizeLabel(file.size)} · {formatDateTime(file.uploadedAt)}</span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}

                  {!universalPosts.length ? (
                    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">No project substance matches this filter.</div>
                  ) : null}
                </div>
              </GlassPanel>
            </div>
          </section>
        ) : null}

        {activeView === "brainstorm" ? (
          <section className="grid gap-5">
            <GlassPanel tone="amber">
              <SectionHeader eyebrow="Brainstorm Studio" title="Beautiful idea map" description="Add ideas, see them as high-impact nodes, continue the best ones, and convert them into delegated work." />

              <div className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
                <form onSubmit={createIdea} className="grid gap-3 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-4">
                  <input value={ideaForm.title} onChange={(event) => setIdeaForm((current) => ({ ...current, title: event.target.value }))} placeholder="Idea title" className={inputClass} />
                  <textarea value={ideaForm.body} onChange={(event) => setIdeaForm((current) => ({ ...current, body: event.target.value }))} placeholder="Describe the idea, expected outcome, customer impact, risks, and why it matters." className={cx(inputClass, "min-h-[150px]")} />

                  <div className="grid gap-2 md:grid-cols-3">
                    <select value={ideaForm.category} onChange={(event) => setIdeaForm((current) => ({ ...current, category: event.target.value }))} className={inputClass}>
                      <option>Growth</option>
                      <option>Client Experience</option>
                      <option>Operations</option>
                      <option>Compliance</option>
                      <option>Revenue</option>
                      <option>Product</option>
                    </select>

                    <select value={ideaForm.impact} onChange={(event) => setIdeaForm((current) => ({ ...current, impact: event.target.value }))} className={inputClass}>
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>Critical</option>
                    </select>

                    <select value={ideaForm.effort} onChange={(event) => setIdeaForm((current) => ({ ...current, effort: event.target.value }))} className={inputClass}>
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  </div>

                  <button disabled={working === "createIdea"} className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/30 disabled:opacity-50">
                    {working === "createIdea" ? "Submitting..." : "Add Idea"}
                  </button>
                </form>

                <div className="relative min-h-[650px] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.24),_rgba(0,0,0,0.35)_42%,_rgba(0,0,0,0.15))] p-6">
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-500/10" />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-500/15" />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-[15rem] w-[15rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-500/20" />

                  <div className="absolute left-1/2 top-1/2 z-10 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/40 bg-black/70 text-center shadow-2xl shadow-amber-950/30 backdrop-blur-xl">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">Ideas</div>
                      <div className="mt-2 text-4xl font-black text-white">{visibleIdeaBoard.length}</div>
                      <div className="mt-1 text-xs font-bold text-amber-100/70">active nodes</div>
                    </div>
                  </div>

                  <div className="relative z-20 grid min-h-[590px] grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {visibleIdeaBoard.map((idea, index) => {
                      const isFeatured = index % 5 === 0;

                      return (
                        <button
                          key={idea.id}
                          type="button"
                          onClick={() => setSelectedIdeaId(idea.id)}
                          className={cx(
                            "rounded-full border p-4 text-center transition hover:-translate-y-1 hover:bg-white/[0.08]",
                            isFeatured ? "aspect-square scale-105" : "aspect-square",
                            selectedIdea?.id === idea.id ? "border-amber-300/70 bg-amber-500/20" : "border-white/10 bg-black/45",
                          )}
                        >
                          <div className="mx-auto flex h-full max-w-[13rem] flex-col items-center justify-center">
                            <Pill tone={priorityTone(ideaImpact(idea))}>{ideaImpact(idea)}</Pill>
                            <div className="mt-3 line-clamp-3 text-sm font-black text-white">{idea.title}</div>
                            <div className="mt-2 text-[10px] font-bold text-slate-500">{ideaCategory(idea)} · {ideaVoteCount(idea)} votes</div>
                          </div>
                        </button>
                      );
                    })}

                    {!visibleIdeaBoard.length ? (
                      <div className="col-span-full flex min-h-[420px] items-center justify-center rounded-[2rem] border border-dashed border-white/10 text-center text-sm text-slate-500">Add the first idea node.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </GlassPanel>

            {selectedIdea ? (
              <GlassPanel tone="purple">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Pill tone="amber">{ideaCategory(selectedIdea)}</Pill>
                      <Pill tone={priorityTone(ideaImpact(selectedIdea))}>{ideaImpact(selectedIdea)} impact</Pill>
                      <Pill tone="purple">{ideaVoteCount(selectedIdea)} votes</Pill>
                    </div>
                    <h2 className="mt-3 text-3xl font-black text-white">{selectedIdea.title}</h2>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-400">{cleanIdeaBodyForDisplay(selectedIdea.body)}</p>
                  </div>

                  <form onSubmit={continueIdea} className="grid gap-3">
                    <select value={ideaAssigneeId} onChange={(event) => setIdeaAssigneeId(event.target.value)} className={inputClass}>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>{memberName(member)} · {member.role}</option>
                      ))}
                    </select>

                    <textarea value={ideaContinuation} onChange={(event) => setIdeaContinuation(event.target.value)} placeholder="Continue this idea with a new angle, next step, or refined version." className={cx(inputClass, "min-h-28")} />

                    <button className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-black text-purple-100">Continue Idea</button>

                    <button type="button" onClick={() => void createTaskFromIdea(selectedIdea)} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">Create Task from Idea</button>
                  </form>
                </div>
              </GlassPanel>
            ) : null}
          </section>
        ) : null}

        {activeView === "docs" ? (
          <section className="grid gap-5 xl:grid-cols-[460px_minmax(0,1fr)]">
            <GlassPanel tone="slate">
              <SectionHeader eyebrow="Docs" title="Template vault" description="Choose a template from the pulldown, name the doc before creation, then edit it without any mirrored preview." />

              <form onSubmit={createDoc} className="mt-5 grid gap-3">
                <input value={docCreateForm.title} onChange={(event) => setDocCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Name this document before creating it" className={inputClass} />

                <select value={docCreateForm.templateName} onChange={(event) => setDocCreateForm((current) => ({ ...current, templateName: event.target.value }))} className={inputClass}>
                  {docTemplates.map((template) => (
                    <option key={template.name}>{template.name}</option>
                  ))}
                </select>

                <button className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">Create Named Doc</button>
              </form>

              <details className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-slate-300">Template portfolio</summary>

                <div className="mt-4 grid gap-2">
                  {docTemplates.map((template) => (
                    <button key={template.name} type="button" onClick={() => createDocFromTemplate(template.name)} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-left hover:bg-white/[0.08]">
                      <div className="text-sm font-black text-white">{template.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{template.category} · {template.labels.join(", ")}</div>
                    </button>
                  ))}
                </div>
              </details>

              <details open className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-slate-300">Saved docs only</summary>

                <input value={docSearch} onChange={(event) => setDocSearch(event.target.value)} placeholder="Search saved docs only" className={cx(inputClass, "mt-4 w-full")} />

                <div className="mt-3 grid max-h-[520px] gap-2 overflow-y-auto pr-1">
                  {filteredSavedDocs.map((doc) => (
                    <button key={doc.id} type="button" onClick={() => setActiveDocId(doc.id)} className={cx("rounded-2xl border p-3 text-left hover:bg-white/[0.08]", activeDoc?.id === doc.id ? "border-slate-300/40 bg-white/10" : "border-white/10 bg-white/[0.045]")}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-black text-white">{doc.title}</div>
                          <div className="mt-1 text-xs text-slate-500">{doc.category} · {formatDateTime(doc.updatedAt)}</div>
                        </div>
                        {doc.favorite ? <Pill tone="amber">★</Pill> : null}
                      </div>
                    </button>
                  ))}

                  {!filteredSavedDocs.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">No saved docs match this search.</div>
                  ) : null}
                </div>
              </details>
            </GlassPanel>

            <GlassPanel tone="slate">
              {activeDoc ? (
                <>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Doc Editor</div>
                      <h2 className="mt-2 text-3xl font-black text-white">{activeDoc.title}</h2>
                      <p className="mt-2 text-sm text-slate-500">{activeDoc.templateName} · {activeDoc.category}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => updateActiveDoc({ favorite: !activeDoc.favorite })} className={cx("rounded-2xl px-4 py-2 text-xs font-black", activeDoc.favorite ? "bg-amber-400 text-slate-950" : "border border-amber-500/30 bg-amber-500/10 text-amber-100")}>
                        {activeDoc.favorite ? "★ Favorite" : "☆ Favorite"}
                      </button>
                      <button type="button" onClick={() => exportDoc(activeDoc)} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100">Export</button>
                      <button type="button" onClick={() => deleteDoc(activeDoc.id)} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100">Delete</button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <input value={activeDoc.title} onChange={(event) => updateActiveDoc({ title: event.target.value })} placeholder="Document name" className={inputClass} />
                    <input value={activeDoc.category} onChange={(event) => updateActiveDoc({ category: event.target.value })} placeholder="Category" className={inputClass} />
                  </div>

                  <input value={activeDoc.labels.join(", ")} onChange={(event) => updateActiveDoc({ labels: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Labels separated by commas" className={cx(inputClass, "mt-3 w-full")} />

                  <textarea value={activeDoc.body} onChange={(event) => updateActiveDoc({ body: event.target.value })} className="mt-4 min-h-[680px] w-full rounded-[1.5rem] border border-white/10 bg-black/45 px-5 py-5 leading-8 text-white outline-none placeholder:text-slate-600" placeholder="Start writing..." />

                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeDoc.labels.map((label) => (
                      <Pill key={label} tone="slate">{label}</Pill>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex min-h-[560px] items-center justify-center text-center">
                  <div>
                    <h3 className="text-2xl font-black text-white">Choose or create a named doc</h3>
                    <p className="mt-2 text-sm text-slate-500">Docs use one clean editor only. No mirrored preview screen.</p>
                  </div>
                </div>
              )}
            </GlassPanel>
          </section>
        ) : null}

        {activeView === "projects" ? (
          <section className="grid gap-5 xl:grid-cols-[460px_minmax(0,1fr)]">
            <div className="grid gap-5">
              <GlassPanel tone="blue">
                <SectionHeader eyebrow="Long-Term Project Creator" title="Create and delegate larger work" description="Use this for larger projects that need long-term tracking, project substance, and delegated execution." />

                <form onSubmit={createProject} className="mt-5 grid gap-3">
                  <input value={projectForm.title} onChange={(event) => setProjectForm((current) => ({ ...current, title: event.target.value }))} placeholder="Long-term project title" className={inputClass} />
                  <textarea value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} placeholder="Long-term objective, major phases, and intended result." className={cx(inputClass, "min-h-28")} />

                  <div className="grid gap-3 md:grid-cols-2">
                    <select value={projectForm.priority} onChange={(event) => setProjectForm((current) => ({ ...current, priority: event.target.value }))} className={inputClass}>
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>Critical</option>
                    </select>
                    <input type="date" value={projectForm.dueDate} onChange={(event) => setProjectForm((current) => ({ ...current, dueDate: event.target.value }))} className={inputClass} />
                  </div>

                  <details className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-300">Delegate project access</summary>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {members.map((member) => {
                        const checked = projectForm.assignedMembershipIds.includes(member.id);

                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() =>
                              setProjectForm((current) => ({
                                ...current,
                                assignedMembershipIds: checked
                                  ? current.assignedMembershipIds.filter((id) => id !== member.id)
                                  : [...current.assignedMembershipIds, member.id],
                              }))
                            }
                            className={cx(
                              "rounded-2xl border p-3 text-left text-sm font-bold",
                              checked
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                                : "border-white/10 bg-white/[0.04] text-slate-300",
                            )}
                          >
                            {memberName(member)}
                          </button>
                        );
                      })}
                    </div>
                  </details>

                  <button disabled={!activeFirmId || working === "createProject"} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
                    {working === "createProject" ? "Creating..." : "Create Long-Term Project"}
                  </button>
                </form>
              </GlassPanel>

              <Card>
                <SectionHeader eyebrow="Firm Access" title="Create or join firm" description="Create the shared firm workspace or accept an invite code." />

                <form onSubmit={createFirm} className="mt-5 grid gap-3">
                  <input value={firmForm.name} onChange={(event) => setFirmForm((current) => ({ ...current, name: event.target.value }))} placeholder="Firm name" className={inputClass} />
                  <input value={firmForm.firmEmail} onChange={(event) => setFirmForm((current) => ({ ...current, firmEmail: event.target.value }))} placeholder="Firm email" className={inputClass} />
                  <button disabled={working === "createFirm"} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
                    {working === "createFirm" ? "Creating..." : "Create Firm"}
                  </button>
                </form>

                <form onSubmit={acceptInvite} className="mt-5 grid gap-3 border-t border-white/10 pt-5">
                  <input value={inviteCodeForm.inviteCode} onChange={(event) => setInviteCodeForm({ inviteCode: event.target.value })} placeholder="Invite code" className={cx(inputClass, "uppercase")} />
                  <button disabled={working === "acceptInvite"} className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 disabled:opacity-50">
                    {working === "acceptInvite" ? "Joining..." : "Accept Invite"}
                  </button>
                </form>
              </Card>
            </div>

            <div className="grid gap-5">
              <Card>
                <SectionHeader eyebrow="Long-Term Portfolio" title="Simplified project board" description="Open a project room or preselect it for delegation." />

                <div className="mt-5 grid gap-3">
                  {[...projects].sort((a, b) => String(a.dueDate ?? "9999").localeCompare(String(b.dueDate ?? "9999"))).map((project) => {
                    const projectTasks = allTasks.filter((task) => task.projectId === project.id);
                    const projectPosts = posts.filter((post) => post.projectId === project.id);

                    return (
                      <article key={project.id} className="rounded-3xl border border-white/10 bg-black/30 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={priorityTone(project.priority)}>{project.priority}</Pill>
                              <Pill tone={statusTone(project.status)}>{project.status}</Pill>
                              <Pill tone="cyan">{shortDate(project.dueDate)}</Pill>
                              <Pill tone="blue">{projectTasks.length} tasks</Pill>
                              <Pill tone="slate">{projectPosts.length} updates</Pill>
                            </div>
                            <h3 className="mt-3 text-lg font-black text-white">{project.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-400">{project.description || "No description."}</p>
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setUniversalProjectId(project.id);
                                setPostForm((current) => ({ ...current, projectId: project.id }));
                                setActiveView("universal");
                              }}
                              className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-100"
                            >
                              Open Room
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDelegateForm((current) => ({ ...current, projectId: project.id }));
                                setCalendarTaskForm((current) => ({ ...current, projectId: project.id }));
                                setActiveView("delegate");
                              }}
                              className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100"
                            >
                              Delegate
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {!projects.length ? (
                    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">No projects yet.</div>
                  ) : null}
                </div>
              </Card>

              <Card>
                <SectionHeader eyebrow="Team" title="Members and invites" description="Invite members and review active firm access." />

                {canInviteMembers(membership) ? (
                  <form onSubmit={inviteMember} className="mt-5 grid gap-3">
                    <input value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} placeholder="Member email" className={inputClass} />
                    <select value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))} className={inputClass}>
                      <option>Member</option>
                      <option>Advisor</option>
                      <option>Analyst</option>
                      <option>Operations</option>
                      <option>Manager</option>
                      <option>Admin</option>
                    </select>
                    <button disabled={!activeFirmId || working === "inviteMember"} className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100 disabled:opacity-50">
                      {working === "inviteMember" ? "Creating invite..." : "Create Invite"}
                    </button>
                  </form>
                ) : (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">You do not currently have invite permissions.</div>
                )}

                <div className="mt-5 grid gap-2">
                  {members.map((member) => (
                    <div key={member.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="font-black text-white">{memberName(member)}</div>
                      <div className="mt-1 text-xs text-slate-500">{memberEmail(member)} · {member.role}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}