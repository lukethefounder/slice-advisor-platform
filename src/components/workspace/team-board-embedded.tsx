"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlarmClock,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BellRing,
  BookOpenText,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FilePlus2,
  FileText,
  FolderKanban,
  LayoutList,
  Loader2,
  MailCheck,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
  Target,
  Trash2,
  UserRoundCheck,
  Users,
  WandSparkles,
  X,
} from "lucide-react";

type User = {
  id: string;
  name: string;
  email: string;
};

type Firm = {
  id: string;
  name: string;
  firmEmail: string | null;
};

type Membership = {
  id: string;
  firmId: string;
  userId: string;
  role: string;
  status: string;
  calendarColor: string;
  canManageProjects: boolean;
  canManageFirm: boolean;
  user?: User;
  firm?: Firm;
};

type Project = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
};

type TaskComment = {
  id: string;
  body: string;
  commentType: string;
  createdAt: string;
  user: User;
};

type Task = {
  id: string;
  projectId: string | null;
  title: string;
  detail: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt?: string | null;
  delayReason: string | null;
  inquiry: string | null;
  ownerName?: string;
  ownerColor?: string;
  ownerId?: string;
  ownerUserId?: string;
  project?: Project | null;
  comments?: TaskComment[];
};

type FirmWorkspacePayload = {
  firm: Firm | null;
  membership: Membership | null;
  members: Membership[];
  projects: Project[];
  operations?: {
    allTasks: Task[];
    sprintMetrics: {
      total: number;
      open: number;
      inProgress: number;
      review: number;
      blocked: number;
      complete: number;
      overdue: number;
    };
  };
};

type PersonalTodo = {
  id: string;
  ownerUserId: string;
  title: string;
  detail: string;
  category: string;
  priority: string;
  dueDate: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

type WorkPreference = {
  pinned?: boolean;
  manualRank?: number;
};

type WorkPreferenceMap = Record<string, WorkPreference>;

type LocalDoc = {
  id: string;
  ownerUserId: string;
  title: string;
  category: string;
  labels: string[];
  body: string;
  favorite: boolean;
  template: string;
  createdAt: string;
  updatedAt: string;
};

type DocTemplate = {
  name: string;
  category: string;
  labels: string[];
  description: string;
  body: string;
};

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
} | null;

type ActiveView = "delegate" | "my-work" | "docs";
type WorkSort = "smart" | "manual" | "due" | "priority";
type DocSort = "updated" | "title" | "category" | "favorite";

type RankedWorkItem = {
  key: string;
  source: "team" | "personal";
  title: string;
  detail: string;
  category: string;
  priority: string;
  dueDate: string | null;
  status: string;
  score: number;
  pinned: boolean;
  manualRank: number;
  task?: Task;
  todo?: PersonalTodo;
};

const EMPTY: FirmWorkspacePayload = {
  firm: null,
  membership: null,
  members: [],
  projects: [],
  operations: {
    allTasks: [],
    sprintMetrics: {
      total: 0,
      open: 0,
      inProgress: 0,
      review: 0,
      blocked: 0,
      complete: 0,
      overdue: 0,
    },
  },
};

const INPUT =
  "w-full min-w-0 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2 disabled:opacity-50";

const PRIMARY =
  "inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500 disabled:opacity-40";

const SOFT =
  "inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-black text-white transition hover:bg-white/10 disabled:opacity-40";

const TASK_STARTERS = [
  {
    label: "Client follow-up",
    title: "Complete client follow-up",
    detail:
      "Review the client request, document the recommended response, complete the follow-up, and confirm the outcome in SLICE.",
    priority: "High",
  },
  {
    label: "Portfolio review",
    title: "Prepare portfolio review",
    detail:
      "Review holdings, risk alignment, performance context, open planning items, and the decisions required for the next client meeting.",
    priority: "High",
  },
  {
    label: "Document request",
    title: "Collect and review requested documents",
    detail:
      "Contact the appropriate person, collect the required documents, verify completeness, and store the final status in the client workflow.",
    priority: "Medium",
  },
  {
    label: "Compliance check",
    title: "Complete communication compliance review",
    detail:
      "Review the communication for accuracy, suitability, required disclosures, and prohibited language before approval.",
    priority: "Critical",
  },
] as const;

const DOC_TEMPLATES: DocTemplate[] = [
  {
    name: "Daily Advisor Plan",
    category: "Planning",
    labels: ["daily", "priorities", "execution"],
    description:
      "Rank the day, protect focus time, and capture follow-ups.",
    body:
      "Daily Advisor Plan\n\nDate:\n\nTop Three Outcomes\n1. \n2. \n3. \n\nClient Commitments\n- \n\nTeam Follow-ups\n- \n\nDeep Work Block\n- Time:\n- Objective:\n\nDecisions Needed\n- \n\nEnd-of-Day Review\n- Completed:\n- Carry forward:\n- Delegate:\n",
  },
  {
    name: "Client Meeting Prep",
    category: "Client",
    labels: ["client", "meeting", "prep"],
    description:
      "Prepare goals, portfolio context, talking points, and next steps.",
    body:
      "Client Meeting Preparation\n\nClient / Household:\nMeeting Date:\nMeeting Objective:\n\nRelationship Context\n- Recent changes:\n- Current concerns:\n- Important preferences:\n\nFinancial Plan Review\n- Goals:\n- Cash flow / liquidity:\n- Tax considerations:\n- Estate considerations:\n- Insurance considerations:\n\nPortfolio Review\n- Allocation observations:\n- Risk alignment:\n- Concentrations:\n- Performance context:\n- Potential actions:\n\nQuestions to Ask\n1. \n2. \n3. \n\nRecommended Next Steps\n- \n\nFollow-up Owners and Dates\n- \n",
  },
  {
    name: "Client Call Notes",
    category: "Client",
    labels: ["client", "call", "notes"],
    description:
      "Capture a call, decisions, commitments, and delegated follow-ups.",
    body:
      "Client Call Notes\n\nClient:\nDate / Time:\nParticipants:\n\nReason for Call\n\nDiscussion Summary\n\nClient Questions or Concerns\n- \n\nAdvice / Information Provided\n- \n\nDecisions Made\n- \n\nTasks Created\n- Task:\n  Owner:\n  Due:\n\nCompliance / Documentation Notes\n\nNext Contact\n",
  },
  {
    name: "Portfolio Review Memo",
    category: "Investment",
    labels: ["portfolio", "review", "investment"],
    description:
      "Document allocation, risks, concentrations, and proposed actions.",
    body:
      "Portfolio Review Memo\n\nClient / Household:\nReview Date:\nTime Horizon:\nRisk Profile:\n\nCurrent Allocation\n\nConcentration Review\n- Security / sector concentrations:\n- Employer stock exposure:\n- Liquidity concentration:\n\nRisk Review\n- Volatility exposure:\n- Drawdown sensitivity:\n- Income needs:\n- Tax constraints:\n\nMarket and Economic Context\n\nRecommended Actions\n1. \n2. \n3. \n\nReasons to Maintain Current Positioning\n\nRisks and Tradeoffs\n\nClient Communication Plan\n",
  },
  {
    name: "Investment Research Memo",
    category: "Research",
    labels: ["research", "security", "memo"],
    description:
      "Record thesis, evidence, risks, valuation, and client relevance.",
    body:
      "Investment Research Memo\n\nSecurity / Topic:\nTicker:\nDate:\nAnalyst:\n\nExecutive Summary\n\nInvestment Thesis\n\nBusiness / Asset Overview\n\nKey Drivers\n1. \n2. \n3. \n\nFinancial and Valuation Evidence\n\nTechnical / Market Evidence\n\nBull Case\n\nBase Case\n\nBear Case\n\nPrimary Risks\n\nCatalysts\n\nClient Suitability and Relevance\n\nDecision / Watch Conditions\n",
  },
  {
    name: "Risk Review",
    category: "Risk",
    labels: ["risk", "portfolio", "review"],
    description:
      "Evaluate portfolio, planning, behavioral, and operational risk.",
    body:
      "Client Risk Review\n\nClient / Household:\nReview Date:\n\nRisk Capacity\n\nRisk Tolerance\n\nRisk Required to Meet Goals\n\nPortfolio Risk Observations\n- Concentration:\n- Volatility:\n- Liquidity:\n- Credit:\n- Duration:\n- Currency:\n\nPlanning Risks\n- Retirement:\n- Tax:\n- Estate:\n- Insurance:\n\nBehavioral Risks\n\nRecommended Mitigations\n1. \n2. \n3. \n\nMonitoring Triggers\n",
  },
  {
    name: "Compliance Review",
    category: "Compliance",
    labels: ["compliance", "review", "communication"],
    description:
      "Review communications or recommendations before approval.",
    body:
      "Compliance Review\n\nItem Reviewed:\nOwner:\nDate:\nAudience:\n\nPurpose of Communication\n\nFactual Claims Verified\n- \n\nPerformance Language Review\n- \n\nSuitability / Client Context\n- \n\nRequired Disclosures\n- \n\nPotentially Misleading Language\n- \n\nEdits Required\n1. \n2. \n\nFinal Decision\n- Approved / Revise / Escalate:\n- Reviewer:\n- Date:\n",
  },
  {
    name: "Tax Planning Review",
    category: "Planning",
    labels: ["tax", "planning", "client"],
    description:
      "Coordinate tax opportunities, constraints, and owners.",
    body:
      "Tax Planning Review\n\nClient / Household:\nTax Year:\nCPA / Tax Professional:\n\nIncome Changes\n\nCapital Gains and Losses\n\nTax-Loss Harvesting Opportunities\n\nCharitable Planning\n\nRetirement Contributions / Distributions\n\nRoth Conversion Analysis\n\nEstimated Tax / Withholding Review\n\nRequired Documents\n- \n\nQuestions for Tax Professional\n- \n\nAction Items, Owners, and Dates\n- \n",
  },
  {
    name: "Estate Planning Review",
    category: "Planning",
    labels: ["estate", "planning", "client"],
    description:
      "Review documents, beneficiaries, ownership, and coordination needs.",
    body:
      "Estate Planning Review\n\nClient / Household:\nAttorney:\nLast Document Review Date:\n\nDocuments on File\n- Will:\n- Trust:\n- Power of Attorney:\n- Healthcare Directive:\n\nBeneficiary Review\n\nAccount Ownership Review\n\nTrust Funding Review\n\nInsurance and Liquidity Needs\n\nFamily / Legacy Goals\n\nOpen Questions for Attorney\n- \n\nAction Items, Owners, and Dates\n- \n",
  },
  {
    name: "Decision Memo",
    category: "Operations",
    labels: ["decision", "operations", "leadership"],
    description:
      "Frame a decision, alternatives, tradeoffs, and accountability.",
    body:
      "Decision Memo\n\nDecision Required:\nDecision Owner:\nDecision Deadline:\n\nContext\n\nDesired Outcome\n\nOptions Considered\n1. \n2. \n3. \n\nEvaluation Criteria\n- \n\nTradeoffs and Risks\n\nRecommendation\n\nDecision\n\nImplementation Owner and Milestones\n- \n\nReview Date\n",
  },
  {
    name: "Standard Operating Procedure",
    category: "Operations",
    labels: ["sop", "process", "operations"],
    description:
      "Document a repeatable workflow with controls and ownership.",
    body:
      "Standard Operating Procedure\n\nProcess Name:\nOwner:\nVersion:\nEffective Date:\n\nPurpose\n\nScope\n\nRequired Inputs\n- \n\nProcedure\n1. \n2. \n3. \n\nQuality Checks\n- \n\nCompliance / Security Controls\n- \n\nExceptions and Escalation\n\nRecords Retained\n\nReview Frequency\n",
  },
  {
    name: "Quarterly Team Review",
    category: "Team",
    labels: ["team", "quarterly", "review"],
    description:
      "Review execution, client service, capacity, and next-quarter priorities.",
    body:
      "Quarterly Team Review\n\nQuarter:\nParticipants:\n\nWins\n- \n\nClient Service Metrics\n\nOperational Metrics\n\nTasks and Projects Completed\n\nBottlenecks\n\nCapacity and Workload\n\nProcess Improvements\n\nNext-Quarter Priorities\n1. \n2. \n3. \n\nOwners and Milestones\n- \n",
  },
];

const DOC_PROMPTS = [
  [
    "Executive summary",
    "\n\nExecutive Summary\n- Situation:\n- Key finding:\n- Recommendation:\n- Immediate next action:\n",
  ],
  [
    "Action register",
    "\n\nAction Register\n- Action:\n  Owner:\n  Due date:\n  Status:\n",
  ],
  [
    "Risk section",
    "\n\nRisks and Mitigations\n- Risk:\n  Likelihood:\n  Impact:\n  Mitigation:\n  Owner:\n",
  ],
  [
    "Client questions",
    "\n\nQuestions for the Client\n1. \n2. \n3. \n",
  ],
  [
    "Decision log",
    "\n\nDecision Log\n- Decision:\n  Rationale:\n  Decision maker:\n  Date:\n  Review trigger:\n",
  ],
  [
    "Meeting agenda",
    "\n\nMeeting Agenda\n1. Opening and objectives\n2. Updates\n3. Decisions required\n4. Action items\n5. Confirm next meeting\n",
  ],
  [
    "Follow-up email",
    "\n\nFollow-up Email Outline\n- Thank the client / team\n- Summarize decisions\n- Confirm responsibilities\n- Confirm deadlines\n- State next meeting or contact\n",
  ],
  [
    "Source register",
    "\n\nSources and Evidence\n- Source:\n  Date accessed:\n  Key evidence:\n  Reliability note:\n",
  ],
  [
    "Suitability notes",
    "\n\nSuitability Notes\n- Client objective:\n- Time horizon:\n- Liquidity need:\n- Risk tolerance:\n- Relevant constraints:\n",
  ],
  [
    "Compliance checklist",
    "\n\nCompliance Checklist\n- Facts verified:\n- Disclosures included:\n- Performance language reviewed:\n- Recommendation context documented:\n- Reviewer:\n",
  ],
  [
    "Delegation plan",
    "\n\nDelegation Plan\n- Task:\n  Owner:\n  Due date:\n  Reminder cadence:\n  Definition of done:\n",
  ],
  [
    "Next-meeting plan",
    "\n\nNext Meeting Plan\n- Proposed date:\n- Objective:\n- Required documents:\n- Decisions expected:\n- Preparation owners:\n",
  ],
] as const;

function cx(
  ...classes: Array<string | false | null | undefined>
) {
  return classes.filter(Boolean).join(" ");
}

function localYmd(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(days: number) {
  const date = new Date();

  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);

  return localYmd(date);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "No due date";
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function memberName(member?: Membership | null) {
  return member?.user?.name || member?.user?.email || "Team member";
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isComplete(status: string) {
  return status === "Complete" || status === "Done";
}

function priorityWeight(priority: string) {
  const value = priority.toLowerCase();

  if (value === "critical") {
    return 90;
  }

  if (value === "high") {
    return 65;
  }

  if (value === "medium") {
    return 40;
  }

  return 20;
}

function daysUntil(value?: string | null) {
  if (!value) {
    return 999;
  }

  const due = new Date(`${value}T12:00:00`).getTime();
  const today = new Date(`${localYmd()}T12:00:00`).getTime();

  return Math.round((due - today) / 86_400_000);
}

function smartScore(input: {
  priority: string;
  dueDate?: string | null;
  status: string;
  pinned: boolean;
  manualRank: number;
}) {
  let score = priorityWeight(input.priority);
  const remaining = daysUntil(input.dueDate);

  if (remaining < 0) {
    score += 70 + Math.min(30, Math.abs(remaining) * 3);
  } else if (remaining === 0) {
    score += 55;
  } else if (remaining === 1) {
    score += 38;
  } else if (remaining <= 3) {
    score += 22;
  } else if (remaining <= 7) {
    score += 10;
  }

  if (input.status === "In Progress") {
    score += 16;
  }

  if (input.status === "Blocked") {
    score += 24;
  }

  if (input.status === "Review") {
    score += 10;
  }

  if (input.pinned) {
    score += 1000;
  }

  score += Math.max(0, 6 - input.manualRank) * 5;

  return score;
}

function taskReminder(task: Task) {
  const comment = task.comments?.find((item) =>
    item.commentType.toLowerCase().includes("reminder")
  );

  if (!comment) {
    return null;
  }

  const at =
    comment.body
      .match(/firstReminderAt=(.+)/i)?.[1]
      ?.split("\n")[0]
      ?.trim() ||
    comment.body
      .match(/Reminder:\s*(.+)/i)?.[1]
      ?.split("\n")[0]
      ?.trim() ||
    "Reminder scheduled";

  const cadence =
    comment.body
      .match(/cadence=(.+)/i)?.[1]
      ?.split("\n")[0]
      ?.trim() ||
    comment.body
      .match(/Repeat interval:\s*(.+)/i)?.[1]
      ?.split("\n")[0]
      ?.trim() ||
    "Until complete";

  return {
    at,
    cadence,
  };
}

function statusStyle(status: string) {
  const lower = status.toLowerCase();

  if (
    lower.includes("complete") ||
    lower.includes("done")
  ) {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  }

  if (lower.includes("blocked")) {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  }

  if (
    lower.includes("progress") ||
    lower.includes("review")
  ) {
    return "border-amber-400/25 bg-amber-400/10 text-amber-200";
  }

  return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
}

function priorityStyle(priority: string) {
  const lower = priority.toLowerCase();

  if (lower === "critical") {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-100";
  }

  if (lower === "high") {
    return "border-orange-400/25 bg-orange-400/10 text-orange-100";
  }

  if (lower === "medium") {
    return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  }

  return "border-white/10 bg-white/[0.055] text-slate-300";
}

function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
        className
      )}
    >
      <span className="truncate">{children}</span>
    </span>
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
    <section
      className={cx(
        "min-w-0 overflow-hidden rounded-[1.8rem] border border-white/10 bg-zinc-950/82 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: number;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-4">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-600/10 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            {label}
          </div>

          <div className="mt-2 text-3xl font-black">
            {value}
          </div>

          <div className="mt-1 truncate text-xs font-semibold text-slate-500">
            {helper}
          </div>
        </div>

        <div className="shrink-0 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-300">
          {icon}
        </div>
      </div>
    </div>
  );
}

function NoticeBar({
  notice,
  close,
}: {
  notice: Notice;
  close: () => void;
}) {
  if (!notice) {
    return null;
  }

  const styles =
    notice.tone === "success"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
      : notice.tone === "error"
        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
        : "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";

  return (
    <div
      className={cx(
        "flex min-w-0 items-start justify-between gap-3 rounded-2xl border p-4",
        styles
      )}
    >
      <div className="flex min-w-0 items-start gap-3 text-sm font-bold leading-6">
        {notice.tone === "success" ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
        )}

        <span className="min-w-0 break-words">
          {notice.text}
        </span>
      </div>

      <button
        type="button"
        onClick={close}
        className="shrink-0 rounded-lg p-1 hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function TeamBoardEmbedded() {
  const [workspace, setWorkspace] =
    useState<FirmWorkspacePayload>(EMPTY);

  const [activeView, setActiveView] =
    useState<ActiveView>("delegate");

  const [loading, setLoading] = useState(true);

  const [notice, setNotice] =
    useState<Notice>(null);

  const [
    selectedMemberId,
    setSelectedMemberId,
  ] = useState("");

  const [taskForm, setTaskForm] = useState({
    title: "",
    detail: "",
    priority: "High",
    dueDate: addDays(1),
    projectId: "",
    reminderDate: addDays(1),
    reminderTime: "09:00",
    reminderCadence: "Daily",
    reminderNote:
      "Please review this task and update its status in SLICE.",
  });

  const [
    personalTodos,
    setPersonalTodos,
  ] = useState<PersonalTodo[]>([]);

  const [
    workPreferences,
    setWorkPreferences,
  ] = useState<WorkPreferenceMap>({});

  const [workSort, setWorkSort] =
    useState<WorkSort>("smart");

  const [workSearch, setWorkSearch] =
    useState("");

  const [
    workStatusFilter,
    setWorkStatusFilter,
  ] = useState("Open work");

  const [
    workCategoryFilter,
    setWorkCategoryFilter,
  ] = useState("All categories");

  const [
    selectedWorkKey,
    setSelectedWorkKey,
  ] = useState("");

  const [personalForm, setPersonalForm] =
    useState({
      title: "",
      detail: "",
      category: "Advisor follow-up",
      priority: "Medium",
      dueDate: localYmd(),
    });

  const [docs, setDocs] =
    useState<LocalDoc[]>([]);

  const [activeDocId, setActiveDocId] =
    useState("");

  const [docSearch, setDocSearch] =
    useState("");

  const [docSort, setDocSort] =
    useState<DocSort>("updated");

  const [
    docCategoryFilter,
    setDocCategoryFilter,
  ] = useState("All categories");

  const [
    docLabelFilter,
    setDocLabelFilter,
  ] = useState("All labels");

  const [
    templateSearch,
    setTemplateSearch,
  ] = useState("");

  const docEditorRef =
    useRef<HTMLTextAreaElement | null>(null);

  const firm = workspace.firm;
  const membership = workspace.membership;
  const members = workspace.members;
  const projects = workspace.projects;

  const allTasks = (
    workspace.operations ??
    EMPTY.operations!
  ).allTasks;

  const selectedMember =
    members.find(
      (member) =>
        member.id === selectedMemberId
    ) ??
    members[0] ??
    null;

  const myTasks = useMemo(
    () =>
      membership
        ? allTasks.filter(
            (task) =>
              task.ownerUserId ===
              membership.userId
          )
        : [],
    [allTasks, membership]
  );

  const activeDocs = useMemo(
    () =>
      membership
        ? docs.filter(
            (doc) =>
              doc.ownerUserId ===
              membership.userId
          )
        : [],
    [docs, membership]
  );

  const activeDoc =
    activeDocs.find(
      (doc) => doc.id === activeDocId
    ) ??
    activeDocs[0] ??
    null;

  const memberWorkload = useMemo(
    () =>
      members.map((member) => {
        const tasks = allTasks.filter(
          (task) =>
            task.ownerId === member.id &&
            !isComplete(task.status)
        );

        const urgent = tasks.filter(
          (task) =>
            task.priority === "Critical" ||
            task.priority === "High"
        ).length;

        return {
          member,
          open: tasks.length,
          urgent,
          capacity: Math.max(
            0,
            100 -
              tasks.length * 10 -
              urgent * 8
          ),
        };
      }),
    [allTasks, members]
  );

  const selectedMemberTasks = useMemo(
    () =>
      allTasks
        .filter(
          (task) =>
            task.ownerId ===
              selectedMember?.id &&
            !isComplete(task.status)
        )
        .sort((a, b) => {
          const priority =
            priorityWeight(b.priority) -
            priorityWeight(a.priority);

          return (
            priority ||
            String(
              a.dueDate ?? "9999"
            ).localeCompare(
              String(
                b.dueDate ?? "9999"
              )
            )
          );
        }),
    [allTasks, selectedMember]
  );

  const rankedWork =
    useMemo<RankedWorkItem[]>(() => {
      if (!membership) {
        return [];
      }

      const teamItems: RankedWorkItem[] =
        myTasks.map((task) => {
          const preference =
            workPreferences[
              `task:${task.id}`
            ] ?? {};

          const pinned =
            preference.pinned === true;

          const manualRank =
            preference.manualRank ?? 3;

          return {
            key: `task:${task.id}`,
            source: "team",
            title: task.title,
            detail:
              task.detail ??
              "No task detail supplied.",
            category:
              task.project?.title ||
              "Team assignment",
            priority: task.priority,
            dueDate: task.dueDate,
            status: task.status,
            score: smartScore({
              priority: task.priority,
              dueDate: task.dueDate,
              status: task.status,
              pinned,
              manualRank,
            }),
            pinned,
            manualRank,
            task,
          };
        });

      const personalItems: RankedWorkItem[] =
        personalTodos
          .filter(
            (todo) =>
              todo.ownerUserId ===
              membership.userId
          )
          .map((todo) => {
            const preference =
              workPreferences[
                `todo:${todo.id}`
              ] ?? {};

            const pinned =
              preference.pinned === true;

            const manualRank =
              preference.manualRank ?? 3;

            const status = todo.done
              ? "Complete"
              : "To Do";

            return {
              key: `todo:${todo.id}`,
              source: "personal",
              title: todo.title,
              detail:
                todo.detail ||
                "Personal advisor work item.",
              category: todo.category,
              priority: todo.priority,
              dueDate: todo.dueDate,
              status,
              score: smartScore({
                priority: todo.priority,
                dueDate: todo.dueDate,
                status,
                pinned,
                manualRank,
              }),
              pinned,
              manualRank,
              todo,
            };
          });

      const query = workSearch
        .trim()
        .toLowerCase();

      return [
        ...teamItems,
        ...personalItems,
      ]
        .filter((item) => {
          if (
            workStatusFilter ===
              "Open work" &&
            isComplete(item.status)
          ) {
            return false;
          }

          if (
            workStatusFilter ===
              "Completed" &&
            !isComplete(item.status)
          ) {
            return false;
          }

          if (
            workCategoryFilter !==
              "All categories" &&
            item.category !==
              workCategoryFilter
          ) {
            return false;
          }

          return (
            !query ||
            [
              item.title,
              item.detail,
              item.category,
              item.priority,
              item.status,
            ]
              .join(" ")
              .toLowerCase()
              .includes(query)
          );
        })
        .sort((a, b) => {
          if (a.pinned !== b.pinned) {
            return (
              Number(b.pinned) -
              Number(a.pinned)
            );
          }

          if (
            workSort === "manual" &&
            a.manualRank !== b.manualRank
          ) {
            return (
              a.manualRank -
              b.manualRank
            );
          }

          if (workSort === "due") {
            const due = String(
              a.dueDate ?? "9999"
            ).localeCompare(
              String(
                b.dueDate ?? "9999"
              )
            );

            if (due) {
              return due;
            }
          }

          if (workSort === "priority") {
            const priority =
              priorityWeight(b.priority) -
              priorityWeight(a.priority);

            if (priority) {
              return priority;
            }
          }

          return b.score - a.score;
        });
    }, [
      membership,
      myTasks,
      personalTodos,
      workPreferences,
      workSearch,
      workSort,
      workStatusFilter,
      workCategoryFilter,
    ]);

  const selectedWork =
    rankedWork.find(
      (item) =>
        item.key === selectedWorkKey
    ) ??
    rankedWork[0] ??
    null;

  const workCategories = useMemo(
    () => [
      "All categories",
      ...Array.from(
        new Set([
          ...myTasks.map(
            (task) =>
              task.project?.title ||
              "Team assignment"
          ),
          ...personalTodos
            .filter(
              (todo) =>
                todo.ownerUserId ===
                membership?.userId
            )
            .map(
              (todo) => todo.category
            ),
        ])
      ).sort(),
    ],
    [membership, myTasks, personalTodos]
  );

  const docCategories = useMemo(
    () => [
      "All categories",
      ...Array.from(
        new Set(
          activeDocs.map(
            (doc) => doc.category
          )
        )
      ).sort(),
    ],
    [activeDocs]
  );

  const docLabels = useMemo(
    () => [
      "All labels",
      ...Array.from(
        new Set(
          activeDocs.flatMap(
            (doc) => doc.labels
          )
        )
      ).sort(),
    ],
    [activeDocs]
  );

  const filteredDocs = useMemo(() => {
    const query = docSearch
      .trim()
      .toLowerCase();

    return activeDocs
      .filter((doc) => {
        if (
          docCategoryFilter !==
            "All categories" &&
          doc.category !==
            docCategoryFilter
        ) {
          return false;
        }

        if (
          docLabelFilter !==
            "All labels" &&
          !doc.labels.includes(
            docLabelFilter
          )
        ) {
          return false;
        }

        return (
          !query ||
          [
            doc.title,
            doc.category,
            doc.labels.join(" "),
            doc.body,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        );
      })
      .sort((a, b) => {
        if (
          docSort === "favorite" &&
          a.favorite !== b.favorite
        ) {
          return (
            Number(b.favorite) -
            Number(a.favorite)
          );
        }

        if (docSort === "title") {
          return a.title.localeCompare(
            b.title
          );
        }

        if (docSort === "category") {
          return (
            a.category.localeCompare(
              b.category
            ) ||
            a.title.localeCompare(
              b.title
            )
          );
        }

        return b.updatedAt.localeCompare(
          a.updatedAt
        );
      });
  }, [
    activeDocs,
    docCategoryFilter,
    docLabelFilter,
    docSearch,
    docSort,
  ]);

  const filteredTemplates = useMemo(() => {
    const query = templateSearch
      .trim()
      .toLowerCase();

    return DOC_TEMPLATES.filter(
      (template) =>
        !query ||
        [
          template.name,
          template.category,
          template.labels.join(" "),
          template.description,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)
    );
  }, [templateSearch]);

  async function loadWorkspace() {
    setLoading(true);

    try {
      const response = await fetch(
        "/api/firm-workspace",
        {
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as
          FirmWorkspacePayload & {
            error?: string;
          };

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to load Team Board."
        );
      }

      setWorkspace(data);

      if (
        !selectedMemberId &&
        data.members?.[0]
      ) {
        setSelectedMemberId(
          data.members[0].id
        );
      }
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to load Team Board.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function postTaskAction(
    body: Record<string, unknown>
  ) {
    if (!firm?.id) {
      setNotice({
        tone: "error",
        text:
          "Connect this account to a firm first.",
      });

      return null;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/firm-workspace/team-board",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            "x-slice-sensitive-action":
              String(
                body.action ??
                  "team-board"
              ),
          },
          body: JSON.stringify({
            firmId: firm.id,
            ...body,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ??
            data.detail ??
            "Team Board action failed."
        );
      }

      await loadWorkspace();

      return data;
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Team Board action failed.",
      });

      return null;
    } finally {
      setLoading(false);
    }
  }

  function localKeys(
    userId = membership?.userId
  ) {
    return {
      todos: userId
        ? `slice-team-board-personal-work-v3:${userId}`
        : "",
      preferences: userId
        ? `slice-team-board-rank-preferences-v3:${userId}`
        : "",
      docs: userId
        ? `slice-team-board-docs-v3:${userId}`
        : "",
    };
  }

  function loadLocalData(userId: string) {
    const keys = localKeys(userId);

    try {
      const todos = JSON.parse(
        localStorage.getItem(
          keys.todos
        ) || "[]"
      ) as PersonalTodo[];

      const preferences = JSON.parse(
        localStorage.getItem(
          keys.preferences
        ) || "{}"
      ) as WorkPreferenceMap;

      const loadedDocs = JSON.parse(
        localStorage.getItem(
          keys.docs
        ) || "[]"
      ) as LocalDoc[];

      setPersonalTodos(
        Array.isArray(todos)
          ? todos
          : []
      );

      setWorkPreferences(
        preferences &&
          typeof preferences ===
            "object"
          ? preferences
          : {}
      );

      setDocs(
        Array.isArray(loadedDocs)
          ? loadedDocs
          : []
      );

      setActiveDocId(
        Array.isArray(loadedDocs)
          ? loadedDocs[0]?.id ?? ""
          : ""
      );
    } catch {
      setPersonalTodos([]);
      setWorkPreferences({});
      setDocs([]);
      setActiveDocId("");
    }
  }

  function saveTodos(
    next: PersonalTodo[]
  ) {
    setPersonalTodos(next);

    const key = localKeys().todos;

    if (key) {
      localStorage.setItem(
        key,
        JSON.stringify(next)
      );
    }
  }

  function savePreferences(
    next: WorkPreferenceMap
  ) {
    setWorkPreferences(next);

    const key =
      localKeys().preferences;

    if (key) {
      localStorage.setItem(
        key,
        JSON.stringify(next)
      );
    }
  }

  function saveDocs(next: LocalDoc[]) {
    setDocs(next);

    const key = localKeys().docs;

    if (key) {
      localStorage.setItem(
        key,
        JSON.stringify(next)
      );
    }
  }

  async function createDelegatedTask(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!selectedMember) {
      setNotice({
        tone: "error",
        text: "Choose an assignee first.",
      });

      return;
    }

    if (!taskForm.title.trim()) {
      setNotice({
        tone: "error",
        text: "Task title is required.",
      });

      return;
    }

    const firstReminderAt = new Date(
      `${taskForm.reminderDate}T${taskForm.reminderTime}:00`
    ).toISOString();

    const result =
      await postTaskAction({
        action:
          "createDelegatedTask",
        targetMembershipId:
          selectedMember.id,
        title: taskForm.title,
        detail: taskForm.detail,
        priority: taskForm.priority,
        status: "To Do",
        dueDate: taskForm.dueDate,
        projectId:
          taskForm.projectId ||
          null,
        reminderAt:
          firstReminderAt,
        reminderCadence:
          taskForm.reminderCadence,
        reminderNote:
          taskForm.reminderNote,
        notifyEmail: true,
        notifyOnCompletion: true,
        notifyAtReminders: true,
      });

    if (result) {
      setTaskForm((current) => ({
        ...current,
        title: "",
        detail: "",
        reminderNote:
          "Please review this task and update its status in SLICE.",
      }));

      setNotice({
        tone: "success",
        text: `Task delegated to ${memberName(
          selectedMember
        )}. Creation email sent or safely simulated; reminders continue until completion.`,
      });
    }
  }

  async function updateTask(
    task: Task,
    status: string
  ) {
    const result =
      await postTaskAction({
        action: "updateTask",
        taskId: task.id,
        status,
      });

    if (result) {
      setNotice({
        tone: "success",
        text:
          status === "Complete"
            ? "Task completed. The assigner and assignee were notified."
            : `Task moved to ${status}.`,
      });
    }
  }

  function addPersonalTodo(
    event: FormEvent
  ) {
    event.preventDefault();

    if (
      !membership ||
      !personalForm.title.trim()
    ) {
      return;
    }

    const now =
      new Date().toISOString();

    const todo: PersonalTodo = {
      id: `personal-${Date.now()}`,
      ownerUserId:
        membership.userId,
      title:
        personalForm.title.trim(),
      detail:
        personalForm.detail.trim(),
      category:
        personalForm.category.trim() ||
        "General",
      priority:
        personalForm.priority,
      dueDate:
        personalForm.dueDate,
      done: false,
      createdAt: now,
      updatedAt: now,
    };

    saveTodos([
      todo,
      ...personalTodos,
    ]);

    setPersonalForm((current) => ({
      ...current,
      title: "",
      detail: "",
    }));

    setSelectedWorkKey(
      `todo:${todo.id}`
    );
  }

  function togglePersonalTodo(
    todo: PersonalTodo
  ) {
    saveTodos(
      personalTodos.map((item) =>
        item.id === todo.id
          ? {
              ...item,
              done: !item.done,
              updatedAt:
                new Date().toISOString(),
            }
          : item
      )
    );
  }

  function deletePersonalTodo(
    todoId: string
  ) {
    saveTodos(
      personalTodos.filter(
        (todo) =>
          todo.id !== todoId
      )
    );
  }

  function updatePreference(
    key: string,
    patch: WorkPreference
  ) {
    savePreferences({
      ...workPreferences,
      [key]: {
        ...(workPreferences[key] ??
          {}),
        ...patch,
      },
    });
  }

  function adjustManualRank(
    item: RankedWorkItem,
    direction: -1 | 1
  ) {
    updatePreference(item.key, {
      manualRank: Math.min(
        5,
        Math.max(
          1,
          item.manualRank +
            direction
        )
      ),
    });
  }

  function createDoc(
    template?: DocTemplate
  ) {
    if (!membership) {
      return;
    }

    const now =
      new Date().toISOString();

    const doc: LocalDoc = {
      id: `doc-${Date.now()}`,
      ownerUserId:
        membership.userId,
      title: template
        ? `${template.name} — ${formatDate(
            localYmd()
          )}`
        : "Untitled Advisor Doc",
      category:
        template?.category ??
        "General",
      labels:
        template?.labels ?? [
          "advisor",
        ],
      body: template?.body ?? "",
      favorite: false,
      template:
        template?.name ?? "Blank",
      createdAt: now,
      updatedAt: now,
    };

    saveDocs([doc, ...docs]);
    setActiveDocId(doc.id);
  }

  function updateActiveDoc(
    patch: Partial<LocalDoc>
  ) {
    if (!activeDoc) {
      return;
    }

    saveDocs(
      docs.map((doc) =>
        doc.id === activeDoc.id
          ? {
              ...doc,
              ...patch,
              updatedAt:
                new Date().toISOString(),
            }
          : doc
      )
    );
  }

  function deleteActiveDoc() {
    if (!activeDoc) {
      return;
    }

    const next = docs.filter(
      (doc) =>
        doc.id !== activeDoc.id
    );

    saveDocs(next);

    setActiveDocId(
      next.find(
        (doc) =>
          doc.ownerUserId ===
          membership?.userId
      )?.id ?? ""
    );
  }

  function appendDocPrompt(
    text: string
  ) {
    if (!activeDoc) {
      return;
    }

    const textarea =
      docEditorRef.current;

    const start =
      textarea?.selectionStart ??
      activeDoc.body.length;

    const end =
      textarea?.selectionEnd ??
      activeDoc.body.length;

    const nextBody = `${activeDoc.body.slice(
      0,
      start
    )}${text}${activeDoc.body.slice(
      end
    )}`;

    updateActiveDoc({
      body: nextBody,
    });

    requestAnimationFrame(() => {
      textarea?.focus();

      const position =
        start + text.length;

      textarea?.setSelectionRange(
        position,
        position
      );
    });
  }

  useEffect(() => {
    void loadWorkspace();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (membership?.userId) {
      loadLocalData(
        membership.userId
      );
    }
  }, [membership?.userId]);

  useEffect(() => {
    if (
      rankedWork.length &&
      !rankedWork.some(
        (item) =>
          item.key ===
          selectedWorkKey
      )
    ) {
      setSelectedWorkKey(
        rankedWork[0].key
      );
    }
  }, [rankedWork, selectedWorkKey]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] px-4 py-5 text-white md:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_9%_0%,rgba(6,95,70,0.46),transparent_30%),radial-gradient(circle_at_84%_8%,rgba(16,185,129,0.13),transparent_25%),radial-gradient(circle_at_60%_100%,rgba(6,182,212,0.07),transparent_28%),linear-gradient(145deg,#030303,#09090b_48%,#111827)]" />

      <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:46px_46px]" />

      <div className="relative mx-auto grid max-w-[1900px] gap-5">
        <header className="min-w-0 rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-2xl shadow-emerald-950/25 backdrop-blur-xl md:p-7">
          <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-400">
                <FolderKanban className="h-4 w-4" />
                Slice Team Board OS
              </div>

              <h1 className="mt-3 break-words text-4xl font-black tracking-tight md:text-6xl">
                Delegate clearly. Rank intelligently. Document everything.
              </h1>

              <p className="mt-3 max-w-4xl text-sm font-medium leading-7 text-slate-400 md:text-base">
                A focused advisor execution system for assignment, recurring
                accountability, personal priorities, and organized working
                documents.
              </p>
            </div>

            <a
              href="/workspace"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 hover:bg-emerald-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to workspace
            </a>
          </div>
        </header>

        <NoticeBar
          notice={notice}
          close={() =>
            setNotice(null)
          }
        />

        {loading && !firm ? (
          <Panel className="grid min-h-[520px] place-items-center p-8 text-center">
            <div>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-300" />

              <h2 className="mt-4 text-2xl font-black">
                Loading firm workspace
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Retrieving team assignments and permissions.
              </p>
            </div>
          </Panel>
        ) : !firm || !membership ? (
          <Panel className="p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-amber-300" />

            <h2 className="mt-4 text-3xl font-black">
              Connect this user to a firm workspace.
            </h2>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Create or join a firm from the main workspace, then return here
              to delegate work, rank priorities, and manage advisor documents.
            </p>
          </Panel>
        ) : (
          <>
            <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="My open work"
                value={
                  myTasks.filter(
                    (task) =>
                      !isComplete(
                        task.status
                      )
                  ).length +
                  personalTodos.filter(
                    (todo) =>
                      todo.ownerUserId ===
                        membership.userId &&
                      !todo.done
                  ).length
                }
                helper="Ranked advisor priorities"
                icon={
                  <LayoutList className="h-5 w-5" />
                }
              />

              <Metric
                label="Team open tasks"
                value={
                  allTasks.filter(
                    (task) =>
                      !isComplete(
                        task.status
                      )
                  ).length
                }
                helper="Across active assignees"
                icon={
                  <Users className="h-5 w-5" />
                }
              />

              <Metric
                label="Overdue"
                value={
                  allTasks.filter(
                    (task) =>
                      !isComplete(
                        task.status
                      ) &&
                      daysUntil(
                        task.dueDate
                      ) < 0
                  ).length
                }
                helper="Needs immediate attention"
                icon={
                  <CircleAlert className="h-5 w-5" />
                }
              />

              <Metric
                label="My docs"
                value={activeDocs.length}
                helper="Labeled working library"
                icon={
                  <BookOpenText className="h-5 w-5" />
                }
              />
            </section>

            <nav className="grid min-w-0 gap-2 rounded-[1.6rem] border border-white/10 bg-black/55 p-2 md:grid-cols-3">
              {(
                [
                  [
                    "delegate",
                    "Delegate",
                    "Assign, remind, and track",
                    Send,
                  ],
                  [
                    "my-work",
                    "My Work",
                    "Custom ranked to-do list",
                    Target,
                  ],
                  [
                    "docs",
                    "Docs",
                    "Prompted, labeled, and sorted",
                    FileText,
                  ],
                ] as const
              ).map(
                ([
                  key,
                  label,
                  helper,
                  Icon,
                ]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setActiveView(
                        key
                      )
                    }
                    className={cx(
                      "min-w-0 rounded-2xl px-4 py-3 text-left transition",
                      activeView === key
                        ? "bg-white text-zinc-950"
                        : "text-slate-300 hover:bg-white/[0.06]"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2 text-sm font-black">
                      <Icon className="h-4 w-4 shrink-0" />

                      <span className="truncate">
                        {label}
                      </span>
                    </div>

                    <div
                      className={cx(
                        "mt-1 truncate text-xs",
                        activeView ===
                          key
                          ? "text-slate-600"
                          : "text-slate-500"
                      )}
                    >
                      {helper}
                    </div>
                  </button>
                )
              )}
            </nav>

            {activeView ===
            "delegate" ? (
              <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_430px]">
                <div className="grid min-w-0 gap-5">
                  <Panel>
                    <div className="border-b border-white/10 bg-gradient-to-r from-emerald-950/50 via-zinc-950 to-zinc-950 p-5 md:p-6">
                      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                            Assignee intelligence
                          </div>

                          <h2 className="mt-2 break-words text-3xl font-black">
                            Choose the right person before assigning the work
                          </h2>

                          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                            Compare active workload, urgent assignments, and
                            capacity before delegating.
                          </p>
                        </div>

                        <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-100">
                          Creation, reminder, and completion email enabled
                        </Badge>
                      </div>
                    </div>

                    <div className="grid min-w-0 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
                      {memberWorkload.map(
                        ({
                          member,
                          open,
                          urgent,
                          capacity,
                        }) => {
                          const selected =
                            selectedMember?.id ===
                            member.id;

                          return (
                            <button
                              key={
                                member.id
                              }
                              type="button"
                              onClick={() =>
                                setSelectedMemberId(
                                  member.id
                                )
                              }
                              className={cx(
                                "min-w-0 overflow-hidden rounded-2xl border p-4 text-left transition",
                                selected
                                  ? "border-emerald-400/45 bg-emerald-500/10"
                                  : "border-white/10 bg-white/[0.035] hover:bg-white/[0.065]"
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div
                                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xs font-black text-white"
                                  style={{
                                    backgroundColor:
                                      member.calendarColor ||
                                      "#64748b",
                                  }}
                                >
                                  {initials(
                                    memberName(
                                      member
                                    )
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-black">
                                    {memberName(
                                      member
                                    )}
                                  </div>

                                  <div className="mt-1 truncate text-xs text-slate-500">
                                    {
                                      member.role
                                    }{" "}
                                    · {open} open
                                  </div>
                                </div>

                                <div
                                  className={cx(
                                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                                    selected
                                      ? "border-emerald-300 bg-emerald-500 text-white"
                                      : "border-white/15 text-transparent"
                                  )}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-2">
                                <div className="rounded-xl bg-black/30 p-2.5">
                                  <div className="text-[9px] font-black uppercase text-slate-600">
                                    Urgent
                                  </div>

                                  <div className="mt-1 text-lg font-black">
                                    {urgent}
                                  </div>
                                </div>

                                <div className="rounded-xl bg-black/30 p-2.5">
                                  <div className="text-[9px] font-black uppercase text-slate-600">
                                    Capacity
                                  </div>

                                  <div className="mt-1 text-lg font-black">
                                    {
                                      capacity
                                    }
                                    %
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </Panel>

                  <Panel>
                    <div className="border-b border-white/10 p-5">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">
                            Active assignments
                          </div>

                          <h3 className="mt-2 truncate text-2xl font-black">
                            {memberName(
                              selectedMember
                            )}
                          </h3>
                        </div>

                        <Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
                          {
                            selectedMemberTasks.length
                          }{" "}
                          open
                        </Badge>
                      </div>
                    </div>

                    <div className="grid min-w-0 gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                      {selectedMemberTasks.map(
                        (task) => {
                          const reminder =
                            taskReminder(
                              task
                            );

                          return (
                            <article
                              key={
                                task.id
                              }
                              className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                            >
                              <div className="flex min-w-0 items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="break-words text-sm font-black">
                                    {
                                      task.title
                                    }
                                  </h4>

                                  <div className="mt-1 text-xs text-slate-500">
                                    Due{" "}
                                    {formatDate(
                                      task.dueDate
                                    )}
                                  </div>
                                </div>

                                <Badge
                                  className={priorityStyle(
                                    task.priority
                                  )}
                                >
                                  {
                                    task.priority
                                  }
                                </Badge>
                              </div>

                              <p className="mt-3 line-clamp-3 break-words text-xs leading-5 text-slate-400">
                                {task.detail ||
                                  "No details supplied."}
                              </p>

                              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                                <Badge
                                  className={statusStyle(
                                    task.status
                                  )}
                                >
                                  {
                                    task.status
                                  }
                                </Badge>

                                {reminder ? (
                                  <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">
                                    {
                                      reminder.cadence
                                    }
                                  </Badge>
                                ) : null}
                              </div>
                            </article>
                          );
                        }
                      )}

                      {!selectedMemberTasks.length ? (
                        <div className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm font-bold text-slate-500 md:col-span-2 xl:col-span-3">
                          This team member has no open assignments.
                        </div>
                      ) : null}
                    </div>
                  </Panel>
                </div>

                <Panel className="h-fit 2xl:sticky 2xl:top-5">
                  <div className="border-b border-white/10 p-5">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                      <Send className="h-3.5 w-3.5" />
                      Fast delegation
                    </div>

                    <h2 className="mt-2 break-words text-2xl font-black">
                      Assign with automatic accountability
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      The assignee receives an email now, at every reminder
                      interval, and when the task is completed. The assigner is
                      also notified on completion.
                    </p>
                  </div>

                  <form
                    onSubmit={
                      createDelegatedTask
                    }
                    className="grid min-w-0 gap-4 p-5"
                  >
                    <div>
                      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Quick task starter
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {TASK_STARTERS.map(
                          (starter) => (
                            <button
                              key={
                                starter.label
                              }
                              type="button"
                              onClick={() =>
                                setTaskForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,
                                    title:
                                      starter.title,
                                    detail:
                                      starter.detail,
                                    priority:
                                      starter.priority,
                                  })
                                )
                              }
                              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-left text-[11px] font-black transition hover:border-emerald-400/30 hover:bg-emerald-500/10"
                            >
                              <span className="block truncate">
                                {
                                  starter.label
                                }
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {selectedMember ? (
                      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                        <div
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xs font-black"
                          style={{
                            backgroundColor:
                              selectedMember.calendarColor ||
                              "#64748b",
                          }}
                        >
                          {initials(
                            memberName(
                              selectedMember
                            )
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-black">
                            {memberName(
                              selectedMember
                            )}
                          </div>

                          <div className="mt-1 truncate text-xs text-emerald-100/60">
                            {
                              selectedMember
                                .user?.email
                            }
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <input
                      value={taskForm.title}
                      onChange={(event) =>
                        setTaskForm(
                          (current) => ({
                            ...current,
                            title:
                              event.target
                                .value,
                          })
                        )
                      }
                      placeholder="Task title"
                      className={INPUT}
                    />

                    <textarea
                      value={taskForm.detail}
                      onChange={(event) =>
                        setTaskForm(
                          (current) => ({
                            ...current,
                            detail:
                              event.target
                                .value,
                          })
                        )
                      }
                      placeholder="Expected outcome, success criteria, context, and source links"
                      className={cx(
                        INPUT,
                        "min-h-[115px] resize-y leading-6"
                      )}
                    />

                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <select
                        value={
                          taskForm.priority
                        }
                        onChange={(event) =>
                          setTaskForm(
                            (current) => ({
                              ...current,
                              priority:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className={INPUT}
                      >
                        <option>Low</option>
                        <option>
                          Medium
                        </option>
                        <option>High</option>
                        <option>
                          Critical
                        </option>
                      </select>

                      <input
                        type="date"
                        value={
                          taskForm.dueDate
                        }
                        onChange={(event) =>
                          setTaskForm(
                            (current) => ({
                              ...current,
                              dueDate:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className={INPUT}
                      />
                    </div>

                    <select
                      value={
                        taskForm.projectId
                      }
                      onChange={(event) =>
                        setTaskForm(
                          (current) => ({
                            ...current,
                            projectId:
                              event.target
                                .value,
                          })
                        )
                      }
                      className={INPUT}
                    >
                      <option value="">
                        No project
                      </option>

                      {projects.map(
                        (project) => (
                          <option
                            key={
                              project.id
                            }
                            value={
                              project.id
                            }
                          >
                            {
                              project.title
                            }
                          </option>
                        )
                      )}
                    </select>

                    <div className="min-w-0 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-amber-200">
                        <BellRing className="h-4 w-4" />
                        Reminder until complete
                      </div>

                      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                        <input
                          type="date"
                          value={
                            taskForm.reminderDate
                          }
                          onChange={(
                            event
                          ) =>
                            setTaskForm(
                              (
                                current
                              ) => ({
                                ...current,
                                reminderDate:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                          className={INPUT}
                        />

                        <input
                          type="time"
                          value={
                            taskForm.reminderTime
                          }
                          onChange={(
                            event
                          ) =>
                            setTaskForm(
                              (
                                current
                              ) => ({
                                ...current,
                                reminderTime:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                          className={INPUT}
                        />
                      </div>

                      <select
                        value={
                          taskForm.reminderCadence
                        }
                        onChange={(event) =>
                          setTaskForm(
                            (current) => ({
                              ...current,
                              reminderCadence:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className={cx(
                          INPUT,
                          "mt-3"
                        )}
                      >
                        <option>Daily</option>
                        <option>
                          Every 2 Days
                        </option>
                        <option>
                          Weekly
                        </option>
                        <option>
                          Biweekly
                        </option>
                        <option>
                          Monthly
                        </option>
                      </select>

                      <textarea
                        value={
                          taskForm.reminderNote
                        }
                        onChange={(event) =>
                          setTaskForm(
                            (current) => ({
                              ...current,
                              reminderNote:
                                event.target
                                  .value,
                            })
                          )
                        }
                        placeholder="Reminder message"
                        className={cx(
                          INPUT,
                          "mt-3 min-h-[78px]"
                        )}
                      />
                    </div>

                    <div className="grid gap-2">
                      {[
                        "Email assignee when task is created",
                        "Email assignee at every reminder interval",
                        "Email assigner and assignee when completed",
                      ].map((label) => (
                        <div
                          key={label}
                          className="flex min-w-0 items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-2.5 text-xs font-bold text-emerald-100"
                        >
                          <MailCheck className="h-4 w-4 shrink-0" />

                          <span className="min-w-0 break-words">
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      disabled={loading}
                      className={cx(
                        PRIMARY,
                        "py-4 text-sm"
                      )}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserRoundCheck className="h-4 w-4" />
                      )}

                      Delegate and activate reminders
                    </button>
                  </form>
                </Panel>
              </div>
            ) : null}

            {activeView ===
            "my-work" ? (
              <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
                <Panel>
                  <div className="border-b border-white/10 bg-gradient-to-r from-emerald-950/35 via-zinc-950 to-zinc-950 p-5 md:p-6">
                    <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                          Personal priority engine
                        </div>

                        <h2 className="mt-2 break-words text-3xl font-black">
                          A ranked to-do list that adapts to the advisor
                        </h2>

                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                          Team assignments and private work are combined,
                          ranked, pinnable, and individually adjustable.
                        </p>
                      </div>

                      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-100">
                        {
                          rankedWork.filter(
                            (item) =>
                              !isComplete(
                                item.status
                              )
                          ).length
                        }{" "}
                        active priorities
                      </Badge>
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-3 border-b border-white/10 p-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="relative min-w-0">
                      <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-600" />

                      <input
                        value={workSearch}
                        onChange={(event) =>
                          setWorkSearch(
                            event.target
                              .value
                          )
                        }
                        placeholder="Search my work"
                        className={cx(
                          INPUT,
                          "pl-10"
                        )}
                      />
                    </div>

                    <select
                      value={workSort}
                      onChange={(event) =>
                        setWorkSort(
                          event.target
                            .value as WorkSort
                        )
                      }
                      className={INPUT}
                    >
                      <option value="smart">
                        Smart rank
                      </option>
                      <option value="manual">
                        My manual rank
                      </option>
                      <option value="due">
                        Due date
                      </option>
                      <option value="priority">
                        Priority
                      </option>
                    </select>

                    <select
                      value={
                        workStatusFilter
                      }
                      onChange={(event) =>
                        setWorkStatusFilter(
                          event.target
                            .value
                        )
                      }
                      className={INPUT}
                    >
                      <option>
                        Open work
                      </option>
                      <option>
                        Completed
                      </option>
                      <option>
                        All work
                      </option>
                    </select>

                    <select
                      value={
                        workCategoryFilter
                      }
                      onChange={(event) =>
                        setWorkCategoryFilter(
                          event.target
                            .value
                        )
                      }
                      className={INPUT}
                    >
                      {workCategories.map(
                        (category) => (
                          <option
                            key={
                              category
                            }
                          >
                            {category}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="grid min-w-0 gap-3 p-4">
                    {rankedWork.map(
                      (item, index) => {
                        const selected =
                          selectedWork?.key ===
                          item.key;

                        const overdue =
                          !isComplete(
                            item.status
                          ) &&
                          daysUntil(
                            item.dueDate
                          ) < 0;

                        return (
                          <article
                            key={
                              item.key
                            }
                            className={cx(
                              "grid min-w-0 gap-3 rounded-2xl border p-4 transition lg:grid-cols-[46px_minmax(0,1fr)_auto] lg:items-center",
                              selected
                                ? "border-emerald-400/35 bg-emerald-400/[0.08]"
                                : "border-white/10 bg-white/[0.03] hover:bg-white/[0.055]"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedWorkKey(
                                  item.key
                                )
                              }
                              className={cx(
                                "grid h-11 w-11 place-items-center rounded-2xl border text-sm font-black",
                                item.pinned
                                  ? "border-amber-300/30 bg-amber-300/15 text-amber-100"
                                  : "border-white/10 bg-black/30 text-slate-300"
                              )}
                            >
                              {item.pinned ? (
                                <Pin className="h-4 w-4" />
                              ) : (
                                index + 1
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setSelectedWorkKey(
                                  item.key
                                )
                              }
                              className="min-w-0 text-left"
                            >
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <h3 className="min-w-0 break-words text-sm font-black">
                                  {
                                    item.title
                                  }
                                </h3>

                                <Badge
                                  className={
                                    item.source ===
                                    "team"
                                      ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                                      : "border-violet-400/20 bg-violet-400/10 text-violet-100"
                                  }
                                >
                                  {item.source ===
                                  "team"
                                    ? "Team"
                                    : "Personal"}
                                </Badge>
                              </div>

                              <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-500">
                                {
                                  item.detail
                                }
                              </p>

                              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                                <Badge
                                  className={priorityStyle(
                                    item.priority
                                  )}
                                >
                                  {
                                    item.priority
                                  }
                                </Badge>

                                <Badge
                                  className={statusStyle(
                                    item.status
                                  )}
                                >
                                  {
                                    item.status
                                  }
                                </Badge>

                                <Badge
                                  className={
                                    overdue
                                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                                      : "border-white/10 bg-white/[0.04] text-slate-400"
                                  }
                                >
                                  {overdue
                                    ? "Overdue"
                                    : formatDate(
                                        item.dueDate
                                      )}
                                </Badge>

                                <Badge className="border-white/10 bg-white/[0.04] text-slate-400">
                                  {
                                    item.category
                                  }
                                </Badge>
                              </div>
                            </button>

                            <div className="flex min-w-0 flex-wrap gap-2 lg:justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  updatePreference(
                                    item.key,
                                    {
                                      pinned:
                                        !item.pinned,
                                    }
                                  )
                                }
                                className={cx(
                                  "grid h-9 w-9 place-items-center rounded-xl border",
                                  item.pinned
                                    ? "border-amber-300/30 bg-amber-300/15 text-amber-100"
                                    : "border-white/10 bg-black/30 text-slate-400"
                                )}
                                title="Pin priority"
                              >
                                <Pin className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  adjustManualRank(
                                    item,
                                    -1
                                  )
                                }
                                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/30 text-slate-400"
                                title="Move up in my rank"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  adjustManualRank(
                                    item,
                                    1
                                  )
                                }
                                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/30 text-slate-400"
                                title="Move down in my rank"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>

                              {item.task ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void updateTask(
                                      item.task!,
                                      "Complete"
                                    )
                                  }
                                  disabled={
                                    isComplete(
                                      item.status
                                    ) ||
                                    loading
                                  }
                                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 text-[10px] font-black text-emerald-100 disabled:opacity-40"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Complete
                                </button>
                              ) : item.todo ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    togglePersonalTodo(
                                      item.todo!
                                    )
                                  }
                                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 text-[10px] font-black text-emerald-100"
                                >
                                  <Check className="h-3.5 w-3.5" />

                                  {item.todo.done
                                    ? "Reopen"
                                    : "Complete"}
                                </button>
                              ) : null}
                            </div>
                          </article>
                        );
                      }
                    )}

                    {!rankedWork.length ? (
                      <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm font-bold text-slate-500">
                        No work matches these filters.
                      </div>
                    ) : null}
                  </div>
                </Panel>

                <div className="grid min-w-0 content-start gap-5 2xl:sticky 2xl:top-5">
                  <Panel>
                    <div className="border-b border-white/10 p-5">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">
                        <Plus className="h-3.5 w-3.5" />
                        Personal work item
                      </div>

                      <h2 className="mt-2 text-2xl font-black">
                        Add to my private list
                      </h2>
                    </div>

                    <form
                      onSubmit={
                        addPersonalTodo
                      }
                      className="grid min-w-0 gap-3 p-5"
                    >
                      <input
                        value={
                          personalForm.title
                        }
                        onChange={(event) =>
                          setPersonalForm(
                            (current) => ({
                              ...current,
                              title:
                                event.target
                                  .value,
                            })
                          )
                        }
                        placeholder="Personal task"
                        className={INPUT}
                      />

                      <textarea
                        value={
                          personalForm.detail
                        }
                        onChange={(event) =>
                          setPersonalForm(
                            (current) => ({
                              ...current,
                              detail:
                                event.target
                                  .value,
                            })
                          )
                        }
                        placeholder="Notes or desired outcome"
                        className={cx(
                          INPUT,
                          "min-h-[82px]"
                        )}
                      />

                      <input
                        value={
                          personalForm.category
                        }
                        onChange={(event) =>
                          setPersonalForm(
                            (current) => ({
                              ...current,
                              category:
                                event.target
                                  .value,
                            })
                          )
                        }
                        placeholder="Category"
                        className={INPUT}
                      />

                      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                        <select
                          value={
                            personalForm.priority
                          }
                          onChange={(
                            event
                          ) =>
                            setPersonalForm(
                              (
                                current
                              ) => ({
                                ...current,
                                priority:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                          className={INPUT}
                        >
                          <option>
                            Low
                          </option>
                          <option>
                            Medium
                          </option>
                          <option>
                            High
                          </option>
                          <option>
                            Critical
                          </option>
                        </select>

                        <input
                          type="date"
                          value={
                            personalForm.dueDate
                          }
                          onChange={(
                            event
                          ) =>
                            setPersonalForm(
                              (
                                current
                              ) => ({
                                ...current,
                                dueDate:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                          className={INPUT}
                        />
                      </div>

                      <button
                        className={PRIMARY}
                      >
                        <Plus className="h-4 w-4" />
                        Add and rank
                      </button>
                    </form>
                  </Panel>

                  <Panel>
                    <div className="border-b border-white/10 p-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                        Selected priority
                      </div>

                      <h2 className="mt-2 break-words text-2xl font-black">
                        {selectedWork?.title ||
                          "Choose an item"}
                      </h2>
                    </div>

                    {selectedWork ? (
                      <div className="grid min-w-0 gap-4 p-5">
                        <p className="break-words text-sm leading-7 text-slate-400">
                          {
                            selectedWork.detail
                          }
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                            <div className="text-[9px] font-black uppercase text-slate-600">
                              Smart score
                            </div>

                            <div className="mt-1 text-2xl font-black">
                              {
                                selectedWork.score
                              }
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                            <div className="text-[9px] font-black uppercase text-slate-600">
                              My rank
                            </div>

                            <div className="mt-1 text-2xl font-black">
                              {
                                selectedWork.manualRank
                              }
                            </div>
                          </div>
                        </div>

                        {selectedWork.task ? (
                          <>
                            {taskReminder(
                              selectedWork.task
                            ) ? (
                              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                                <div className="flex items-center gap-2 text-xs font-black text-amber-100">
                                  <AlarmClock className="h-4 w-4" />

                                  {
                                    taskReminder(
                                      selectedWork.task
                                    )?.cadence
                                  }
                                </div>

                                <div className="mt-2 break-words text-xs leading-5 text-amber-50/70">
                                  First
                                  reminder:{" "}
                                  {
                                    taskReminder(
                                      selectedWork.task
                                    )?.at
                                  }
                                </div>
                              </div>
                            ) : null}

                            <div className="grid gap-2 sm:grid-cols-3 2xl:grid-cols-1">
                              <button
                                type="button"
                                onClick={() =>
                                  void updateTask(
                                    selectedWork.task!,
                                    "In Progress"
                                  )
                                }
                                className={SOFT}
                              >
                                <Clock3 className="h-4 w-4" />
                                Start
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void updateTask(
                                    selectedWork.task!,
                                    "Blocked"
                                  )
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-100"
                              >
                                <CircleAlert className="h-4 w-4" />
                                Blocked
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void updateTask(
                                    selectedWork.task!,
                                    "Complete"
                                  )
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-100"
                              >
                                <Check className="h-4 w-4" />
                                Complete
                              </button>
                            </div>
                          </>
                        ) : selectedWork.todo ? (
                          <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                            <button
                              type="button"
                              onClick={() =>
                                togglePersonalTodo(
                                  selectedWork.todo!
                                )
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-100"
                            >
                              <Check className="h-4 w-4" />

                              {selectedWork.todo
                                .done
                                ? "Reopen"
                                : "Complete"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deletePersonalTodo(
                                  selectedWork.todo!
                                    .id
                                )
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-100"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-sm font-bold text-slate-500">
                        Select a work item to review it.
                      </div>
                    )}
                  </Panel>
                </div>
              </div>
            ) : null}

            {activeView ===
            "docs" ? (
              <div className="grid min-w-0 gap-5 2xl:grid-cols-[320px_minmax(0,1fr)_390px]">
                <Panel className="h-fit 2xl:sticky 2xl:top-5">
                  <div className="border-b border-white/10 p-4">
                    <button
                      type="button"
                      onClick={() =>
                        createDoc()
                      }
                      className={cx(
                        PRIMARY,
                        "w-full py-3.5 text-sm"
                      )}
                    >
                      <FilePlus2 className="h-4 w-4" />
                      New blank doc
                    </button>

                    <div className="relative mt-3">
                      <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-600" />

                      <input
                        value={docSearch}
                        onChange={(event) =>
                          setDocSearch(
                            event.target
                              .value
                          )
                        }
                        placeholder="Search documents"
                        className={cx(
                          INPUT,
                          "pl-10"
                        )}
                      />
                    </div>

                    <div className="mt-3 grid min-w-0 gap-2">
                      <select
                        value={docSort}
                        onChange={(event) =>
                          setDocSort(
                            event.target
                              .value as DocSort
                          )
                        }
                        className={INPUT}
                      >
                        <option value="updated">
                          Recently updated
                        </option>
                        <option value="favorite">
                          Favorites first
                        </option>
                        <option value="title">
                          Title A–Z
                        </option>
                        <option value="category">
                          Category A–Z
                        </option>
                      </select>

                      <select
                        value={
                          docCategoryFilter
                        }
                        onChange={(event) =>
                          setDocCategoryFilter(
                            event.target
                              .value
                          )
                        }
                        className={INPUT}
                      >
                        {docCategories.map(
                          (category) => (
                            <option
                              key={
                                category
                              }
                            >
                              {category}
                            </option>
                          )
                        )}
                      </select>

                      <select
                        value={
                          docLabelFilter
                        }
                        onChange={(event) =>
                          setDocLabelFilter(
                            event.target
                              .value
                          )
                        }
                        className={INPUT}
                      >
                        {docLabels.map(
                          (label) => (
                            <option
                              key={label}
                            >
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="max-h-[650px] space-y-2 overflow-y-auto p-3">
                    {filteredDocs.map(
                      (doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() =>
                            setActiveDocId(
                              doc.id
                            )
                          }
                          className={cx(
                            "w-full min-w-0 overflow-hidden rounded-2xl border p-4 text-left",
                            activeDoc?.id ===
                              doc.id
                              ? "border-amber-400/35 bg-amber-400/10"
                              : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                          )}
                        >
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-black">
                                {
                                  doc.title
                                }
                              </div>

                              <div className="mt-1 truncate text-xs text-slate-500">
                                {
                                  doc.category
                                }{" "}
                                ·{" "}
                                {formatDateTime(
                                  doc.updatedAt
                                )}
                              </div>
                            </div>

                            {doc.favorite ? (
                              <Star className="h-4 w-4 shrink-0 fill-amber-300 text-amber-300" />
                            ) : null}
                          </div>

                          <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
                            {doc.labels
                              .slice(
                                0,
                                4
                              )
                              .map(
                                (
                                  label
                                ) => (
                                  <span
                                    key={
                                      label
                                    }
                                    className="max-w-full truncate rounded-md bg-white/[0.055] px-1.5 py-0.5 text-[9px] font-black text-slate-400"
                                  >
                                    {
                                      label
                                    }
                                  </span>
                                )
                              )}
                          </div>
                        </button>
                      )
                    )}

                    {!filteredDocs.length ? (
                      <div className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm font-bold text-slate-500">
                        No documents match these specifications.
                      </div>
                    ) : null}
                  </div>
                </Panel>

                <Panel>
                  {activeDoc ? (
                    <>
                      <div className="flex min-w-0 flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                            Focus document editor
                          </div>

                          <h2 className="mt-2 truncate text-2xl font-black">
                            {
                              activeDoc.title
                            }
                          </h2>
                        </div>

                        <div className="flex min-w-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveDoc(
                                {
                                  favorite:
                                    !activeDoc.favorite,
                                }
                              )
                            }
                            className={cx(
                              SOFT,
                              activeDoc.favorite &&
                                "border-amber-300/30 bg-amber-300/15 text-amber-100"
                            )}
                          >
                            <Star
                              className={cx(
                                "h-4 w-4",
                                activeDoc.favorite &&
                                  "fill-current"
                              )}
                            />
                            Favorite
                          </button>

                          <button
                            type="button"
                            onClick={
                              deleteActiveDoc
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-100"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="grid min-w-0 gap-4 p-5">
                        <input
                          value={
                            activeDoc.title
                          }
                          onChange={(
                            event
                          ) =>
                            updateActiveDoc(
                              {
                                title:
                                  event
                                    .target
                                    .value,
                              }
                            )
                          }
                          placeholder="Document title"
                          className={INPUT}
                        />

                        <div className="grid min-w-0 gap-3 md:grid-cols-2">
                          <input
                            value={
                              activeDoc.category
                            }
                            onChange={(
                              event
                            ) =>
                              updateActiveDoc(
                                {
                                  category:
                                    event
                                      .target
                                      .value,
                                }
                              )
                            }
                            placeholder="Category"
                            className={INPUT}
                          />

                          <input
                            value={activeDoc.labels.join(
                              ", "
                            )}
                            onChange={(
                              event
                            ) =>
                              updateActiveDoc(
                                {
                                  labels:
                                    Array.from(
                                      new Set(
                                        event.target.value
                                          .split(
                                            ","
                                          )
                                          .map(
                                            (
                                              label
                                            ) =>
                                              label
                                                .trim()
                                                .toLowerCase()
                                          )
                                          .filter(
                                            Boolean
                                          )
                                      )
                                    ),
                                }
                              )
                            }
                            placeholder="Labels separated by commas"
                            className={INPUT}
                          />
                        </div>

                        <textarea
                          ref={
                            docEditorRef
                          }
                          value={
                            activeDoc.body
                          }
                          onChange={(
                            event
                          ) =>
                            updateActiveDoc(
                              {
                                body:
                                  event
                                    .target
                                    .value,
                              }
                            )
                          }
                          placeholder="Write the document..."
                          className={cx(
                            INPUT,
                            "min-h-[650px] resize-y whitespace-pre-wrap font-[Inter] leading-7"
                          )}
                        />

                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                          <span className="min-w-0 truncate">
                            Template:{" "}
                            {
                              activeDoc.template
                            }{" "}
                            · Updated{" "}
                            {formatDateTime(
                              activeDoc.updatedAt
                            )}
                          </span>

                          <span>
                            {activeDoc.body.trim()
                              ? activeDoc.body
                                  .trim()
                                  .split(
                                    /\s+/
                                  ).length
                              : 0}{" "}
                            words
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="grid min-h-[760px] place-items-center p-8 text-center">
                      <div>
                        <BookOpenText className="mx-auto h-10 w-10 text-amber-300" />

                        <h2 className="mt-4 text-3xl font-black">
                          Create a document from a prompt
                        </h2>

                        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-500">
                          Select a template or create a blank document. The
                          editor stays focused; there is no mirrored notes panel
                          beside it.
                        </p>
                      </div>
                    </div>
                  )}
                </Panel>

                <div className="grid min-w-0 content-start gap-5 2xl:sticky 2xl:top-5">
                  <Panel>
                    <div className="border-b border-white/10 p-5">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                        <WandSparkles className="h-3.5 w-3.5" />
                        Prompt library
                      </div>

                      <h2 className="mt-2 text-2xl font-black">
                        Start with more structure
                      </h2>

                      <div className="relative mt-4">
                        <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-600" />

                        <input
                          value={
                            templateSearch
                          }
                          onChange={(
                            event
                          ) =>
                            setTemplateSearch(
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="Find a template"
                          className={cx(
                            INPUT,
                            "pl-10"
                          )}
                        />
                      </div>
                    </div>

                    <div className="max-h-[460px] space-y-2 overflow-y-auto p-3">
                      {filteredTemplates.map(
                        (template) => (
                          <button
                            key={
                              template.name
                            }
                            type="button"
                            onClick={() =>
                              createDoc(
                                template
                              )
                            }
                            className="w-full min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.07]"
                          >
                            <div className="truncate text-sm font-black">
                              {
                                template.name
                              }
                            </div>

                            <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-500">
                              {
                                template.description
                              }
                            </p>

                            <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
                              <Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
                                {
                                  template.category
                                }
                              </Badge>

                              {template.labels
                                .slice(
                                  0,
                                  2
                                )
                                .map(
                                  (
                                    label
                                  ) => (
                                    <Badge
                                      key={
                                        label
                                      }
                                      className="border-white/10 bg-white/[0.04] text-slate-400"
                                    >
                                      {
                                        label
                                      }
                                    </Badge>
                                  )
                                )}
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  </Panel>

                  <Panel>
                    <div className="border-b border-white/10 p-5">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">
                        <Sparkles className="h-3.5 w-3.5" />
                        Insert sections
                      </div>

                      <h2 className="mt-2 text-xl font-black">
                        Expand the active doc
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-4">
                      {DOC_PROMPTS.map(
                        ([
                          label,
                          text,
                        ]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() =>
                              appendDocPrompt(
                                text
                              )
                            }
                            disabled={
                              !activeDoc
                            }
                            className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-left text-[11px] font-black text-slate-300 transition hover:bg-violet-400/10 disabled:opacity-35"
                          >
                            <span className="block break-words">
                              {label}
                            </span>
                          </button>
                        )
                      )}
                    </div>
                  </Panel>
                </div>
              </div>
            ) : null}
          </>
        )}

        <footer className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-semibold text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 break-words">
            Team tasks and notifications are firm-backed. Personal rankings,
            private work, and personal docs are saved per user in this browser.
          </span>

          <button
            type="button"
            onClick={() =>
              void loadWorkspace()
            }
            className="inline-flex shrink-0 items-center gap-2 font-black text-slate-400 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Team Board
          </button>
        </footer>
      </div>
    </main>
  );
}