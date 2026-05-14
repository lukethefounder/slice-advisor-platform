"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type User = { id: string; name: string; email: string };

type Tab =
  | "overview"
  | "command"
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
type CalendarMode = "week" | "month";

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

type CalendarTask = AgendaTask & {
  agendaTitle?: string;
  weekStart?: string;
  ownerName?: string;
  ownerColor?: string;
  ownerId?: string;
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

type BackendKernelSummary = {
  readinessScore: number;
  metrics: {
    vendors: number;
    configuredVendors: number;
    features: number;
    enabledFeatures: number;
    jobs: number;
    jobRuns: number;
    queuedDeliveries: number;
    deliveries: number;
    dataQuality: number;
    toolRuns: number;
    events: number;
    failedRuns: number;
  };
  message?: string;
};

const WORKSPACE_TAB_IDS: Tab[] = [
  "overview",
  "command",
  "watchlists",
  "firm-calendar",
  "team-board",
  "comparison",
  "alternatives",
  "clients",
  "portfolio",
  "intelligence",
  "notifications",
  "briefings",
  "security",
  "system",
];

const tabs: Array<{
  id: Tab;
  label: string;
  description: string;
  marker: string;
  tone: Tone;
}> = [
  { id: "overview", label: "Overview", description: "Main home", marker: "01", tone: "red" },
  { id: "command", label: "Command Layer", description: "AI + backend", marker: "02", tone: "cyan" },
  { id: "watchlists", label: "Watchlists", description: "Tracked assets", marker: "03", tone: "amber" },
  { id: "firm-calendar", label: "Calendar", description: "Execution", marker: "04", tone: "purple" },
  { id: "team-board", label: "Team Board", description: "Firm work", marker: "05", tone: "green" },
  { id: "comparison", label: "Compare", description: "Risk/reward", marker: "06", tone: "slate" },
  { id: "alternatives", label: "Alternatives", description: "Alts + venture", marker: "07", tone: "amber" },
  { id: "clients", label: "Clients", description: "Wealth brain", marker: "08", tone: "purple" },
  { id: "portfolio", label: "Portfolio Lab", description: "Holdings", marker: "09", tone: "green" },
  { id: "intelligence", label: "Intelligence", description: "Signals", marker: "10", tone: "red" },
  { id: "notifications", label: "Notifications", description: "Delivery", marker: "11", tone: "amber" },
  { id: "briefings", label: "Briefings", description: "Reports", marker: "12", tone: "cyan" },
  { id: "security", label: "Security", description: "Governance", marker: "13", tone: "red" },
  { id: "system", label: "System", description: "Readiness", marker: "14", tone: "cyan" },
];

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";

function parseWorkspaceTab(value: string | null): Tab | null {
  if (!value) return null;
  const normalized = value.trim();
  return WORKSPACE_TAB_IDS.includes(normalized as Tab) ? (normalized as Tab) : null;
}

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
  return `${Math.max(0, Math.min(100, Math.round(value || 0)))}%`;
}

function toDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`);
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = toDate(dateString);
  date.setDate(date.getDate() + days);
  return ymd(date);
}

function addMonths(dateString: string, months: number) {
  const date = toDate(dateString);
  date.setMonth(date.getMonth() + months);
  return ymd(date);
}

function startOfWeek(dateString: string) {
  const date = toDate(dateString);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return ymd(date);
}

function weekStartToday() {
  return startOfWeek(ymd(new Date()));
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

function shortDate(dateString: string | null) {
  if (!dateString) return "No date set";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayLabel(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
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

function monthDayLabel(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
  });
}

function toneFor(value: string): Tone {
  const lower = value.toLowerCase();

  if (
    lower.includes("complete") ||
    lower.includes("done") ||
    lower.includes("active") ||
    lower.includes("ready") ||
    lower.includes("configured") ||
    lower.includes("healthy") ||
    lower.includes("approved")
  ) {
    return "green";
  }

  if (
    lower.includes("missing") ||
    lower.includes("failed") ||
    lower.includes("critical") ||
    lower.includes("blocked") ||
    lower.includes("high")
  ) {
    return "red";
  }

  if (
    lower.includes("open") ||
    lower.includes("pending") ||
    lower.includes("queued") ||
    lower.includes("planned") ||
    lower.includes("watch")
  ) {
    return "amber";
  }

  if (lower.includes("ai") || lower.includes("portfolio") || lower.includes("alternative")) return "purple";
  if (lower.includes("backend") || lower.includes("system") || lower.includes("kernel")) return "cyan";

  return "slate";
}

function priorityTone(priority: string): Tone {
  if (priority === "High" || priority === "Critical" || priority === "Urgent") return "red";
  if (priority === "Medium") return "amber";
  if (priority === "Low") return "green";
  return "slate";
}

const toneClasses: Record<Tone, string> = {
  red: "border-red-500/25 bg-red-500/10 text-red-100 shadow-red-950/20",
  green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/20",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-100 shadow-amber-950/20",
  purple: "border-purple-500/25 bg-purple-500/10 text-purple-100 shadow-purple-950/20",
  cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100 shadow-cyan-950/20",
  slate: "border-slate-500/20 bg-slate-500/10 text-slate-100 shadow-slate-950/20",
};

const glowClasses: Record<Tone, string> = {
  red: "from-red-500/18",
  green: "from-emerald-500/18",
  amber: "from-amber-500/18",
  purple: "from-purple-500/18",
  cyan: "from-cyan-500/18",
  slate: "from-slate-400/10",
};

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2";

const selectClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition focus:ring-2";

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
        "inline-flex max-w-full items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] shadow-sm",
        toneClasses[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
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
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/72 shadow-2xl shadow-black/20 backdrop-blur-2xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Panel({
  children,
  className = "",
  tone = "slate",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.055] p-4 shadow-xl shadow-black/10",
        className
      )}
    >
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", glowClasses[tone])} />
      <div className="relative">{children}</div>
    </div>
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
    <Panel tone={tone} className="p-4">
      <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
      {helper ? <div className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</div> : null}
    </Panel>
  );
}

function ProgressBar({
  value,
  tone = "red",
}: {
  value: number;
  tone?: Exclude<Tone, "slate">;
}) {
  const fills: Record<Exclude<Tone, "slate">, string> = {
    red: "from-red-700 to-red-300",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    purple: "from-purple-700 to-purple-300",
    cyan: "from-cyan-700 to-cyan-300",
  };

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r", fills[tone])}
        style={{ width: percent(value) }}
      />
    </div>
  );
}

function LogoMark() {
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-xl shadow-red-950/50 ring-1 ring-red-500/40">
      <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
        S
      </div>
      <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
      <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
    </div>
  );
}

function OrbitGraphic() {
  return (
    <div className="pointer-events-none absolute right-[-80px] top-[-80px] hidden h-[360px] w-[360px] lg:block">
      <div className="absolute inset-0 rounded-full border border-red-500/20" />
      <div className="absolute inset-10 rounded-full border border-cyan-500/20" />
      <div className="absolute inset-20 rounded-full border border-purple-500/20" />
      <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-red-500 to-cyan-400 opacity-70 blur-xl" />
      <div className="absolute left-[66%] top-[17%] h-3 w-3 rounded-full bg-red-300 shadow-lg shadow-red-500/50" />
      <div className="absolute bottom-[25%] left-[12%] h-3 w-3 rounded-full bg-cyan-300 shadow-lg shadow-cyan-500/50" />
      <div className="absolute bottom-[10%] right-[28%] h-2.5 w-2.5 rounded-full bg-purple-300 shadow-lg shadow-purple-500/50" />
    </div>
  );
}

function MiniBars({ tone = "red" }: { tone?: Tone }) {
  const colors: Record<Tone, string> = {
    red: "bg-red-400",
    green: "bg-emerald-400",
    amber: "bg-amber-400",
    purple: "bg-purple-400",
    cyan: "bg-cyan-400",
    slate: "bg-slate-400",
  };

  return (
    <div className="flex h-10 items-end gap-1.5">
      {[34, 58, 42, 76, 52, 88, 64].map((height, index) => (
        <span
          key={`${tone}-${height}-${index}`}
          className={cx("w-2 rounded-full opacity-80", colors[tone])}
          style={{ height: `${height}%` }}
        />
      ))}
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
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function BeautifulButton({
  href,
  children,
  tone = "red",
}: {
  href: string;
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <a
      href={href}
      className={cx(
        "inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-black shadow-lg transition hover:-translate-y-0.5 hover:scale-[1.01]",
        tone === "slate" ? "border-white/10 bg-white text-slate-950" : toneClasses[tone]
      )}
    >
      {children}
    </a>
  );
}

function ModuleCard({
  title,
  description,
  stats,
  primaryHref,
  primaryLabel,
  tone = "red",
}: {
  title: string;
  description: string;
  stats?: Array<[string, string | number]>;
  primaryHref?: string;
  primaryLabel?: string;
  tone?: Tone;
}) {
  return (
    <Card className="group p-5 transition hover:-translate-y-1 hover:border-white/20 hover:bg-zinc-950/90">
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent", glowClasses[tone])} />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black text-white">{title}</h2>
            <p className="mt-2 line-clamp-3 min-h-[72px] text-sm leading-6 text-slate-400">{description}</p>
          </div>
          <MiniBars tone={tone} />
        </div>

        {stats?.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {stats.map(([label, value], index) => (
              <div key={`${title}-${label}-${index}`} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
                <div className="mt-1 truncate text-lg font-black text-white">{value}</div>
              </div>
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
      </div>
    </Card>
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
    tone?: Tone;
    stats?: Array<[string, string | number]>;
  }>;
}) {
  return (
    <section className="grid gap-5">
      <Card className="p-6">
        <SectionTitle eyebrow={eyebrow} title={title} description={description} />
      </Card>

      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {cards.map((card, index) => (
          <ModuleCard
            key={`${title}-${card.title}-${index}`}
            title={card.title}
            description={card.description}
            stats={card.stats}
            primaryHref={card.href}
            primaryLabel={card.button}
            tone={card.tone}
          />
        ))}
      </div>
    </section>
  );
}

function CalendarTaskPill({
  task,
  dense = false,
  onComplete,
  onSelect,
}: {
  task: CalendarTask;
  dense?: boolean;
  onComplete?: () => void;
  onSelect?: () => void;
}) {
  const complete = task.status === "Complete" || task.status === "Done";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && onSelect) onSelect();
      }}
      className={cx(
        "group cursor-pointer rounded-xl border bg-black/30 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/[0.08]",
        dense ? "px-2 py-1.5" : "px-2.5 py-2",
        complete ? "border-emerald-500/20 opacity-70" : "border-white/10 hover:border-red-400/30"
      )}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: task.ownerColor ?? "#ef4444",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className={cx(
              "truncate font-black",
              dense ? "text-[11px]" : "text-[12px]",
              complete ? "text-slate-500 line-through" : "text-white"
            )}
          >
            {task.title}
          </div>

          {!dense ? (
            <div className="mt-1 truncate text-[10px] font-semibold text-slate-500">
              {task.ownerName ?? "Team"} {task.project?.title ? `· ${task.project.title}` : ""}
            </div>
          ) : null}
        </div>

        {onComplete && !complete ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onComplete();
            }}
            className="hidden shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black text-white transition hover:bg-emerald-500/15 group-hover:inline-flex"
          >
            Done
          </button>
        ) : null}
      </div>

      {!dense ? (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
          <span className="truncate text-[10px] font-bold text-slate-600">{task.status}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function WorkspacePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [message, setMessage] = useState("");
  const [backendMessage, setBackendMessage] = useState("");
  const [backendWorking, setBackendWorking] = useState("");
  const [inviteOutput, setInviteOutput] = useState("");

  const [command, setCommand] = useState<CommandOverview | null>(null);
  const [firmWorkspace, setFirmWorkspace] = useState<FirmWorkspace | null>(null);
  const [kernel, setKernel] = useState<BackendKernelSummary | null>(null);

  const [calendarMode, setCalendarMode] = useState<CalendarMode>("week");
  const [calendarAnchor, setCalendarAnchor] = useState(ymd(new Date()));
  const [selectedDay, setSelectedDay] = useState(ymd(new Date()));
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
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
  const [newFirmForm, setNewFirmForm] = useState({ name: "", firmEmail: "" });
  const [inviteForm, setInviteForm] = useState({ email: "", role: "Member" });
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
  });
  const [taskForm, setTaskForm] = useState({
    agendaId: "",
    projectId: "",
    title: "",
    detail: "",
    priority: "Medium",
    dueDate: ymd(new Date()),
  });

  const firm = firmWorkspace?.firm ?? null;
  const membership = firmWorkspace?.membership ?? null;
  const members = firmWorkspace?.members ?? [];
  const invites = firmWorkspace?.invites ?? [];
  const projects = firmWorkspace?.projects ?? [];
  const agendas = firmWorkspace?.agendas ?? [];
  const posts = firmWorkspace?.posts ?? [];

  const canInvite =
    membership?.role === "Owner" ||
    Boolean(membership?.canInviteMembers) ||
    Boolean(membership?.canManageFirm);

  const canManageProjects =
    membership?.role === "Owner" ||
    Boolean(membership?.canManageProjects) ||
    Boolean(membership?.canManageFirm);

  const firmTasks = useMemo<CalendarTask[]>(() => {
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
    () => firmTasks.filter((task) => task.status !== "Complete" && task.status !== "Done"),
    [firmTasks]
  );

  const completedFirmTasks = useMemo(
    () => firmTasks.filter((task) => task.status === "Complete" || task.status === "Done"),
    [firmTasks]
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();

    for (const task of firmTasks) {
      if (!task.dueDate) continue;
      map.set(task.dueDate, [...(map.get(task.dueDate) ?? []), task]);
    }

    return map;
  }, [firmTasks]);

  const selectedDayTasks = useMemo(() => tasksByDay.get(selectedDay) ?? [], [selectedDay, tasksByDay]);

  const unscheduledTasks = useMemo(() => firmTasks.filter((task) => !task.dueDate), [firmTasks]);

  const calendarCompletionRate = firmTasks.length ? (completedFirmTasks.length / firmTasks.length) * 100 : 0;
  const readinessScore = command?.readinessScore ?? 0;
  const portfolioValue = command?.counts.portfolioTotalValue ?? 0;
  const portfolioHoldingCount = command?.counts.holdingCount ?? 0;
  const portfolioAccountCount = command?.counts.accountCount ?? 0;
  const portfolioModelCount = command?.counts.modelCount ?? 0;

  const visibleDays = useMemo(() => {
    if (calendarMode === "month") return calendarMonthDays(calendarAnchor);
    const start = agendaForm.weekStart || startOfWeek(calendarAnchor);
    return Array.from({ length: 7 }).map((_, index) => addDays(start, index));
  }, [agendaForm.weekStart, calendarAnchor, calendarMode]);

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  async function loadCommand() {
    const response = await fetch("/api/command/overview", { cache: "no-store" });
    if (response.ok) setCommand(await response.json());
  }

  async function loadBackendKernel() {
    const response = await fetch("/api/backend-kernel", { cache: "no-store" });
    if (response.ok) setKernel(await response.json());
  }

  async function loadFirmWorkspace(firmId?: string) {
    const query = firmId ? `?firmId=${firmId}` : "";
    const response = await fetch(`/api/firm-workspace${query}`, { cache: "no-store" });

    if (response.ok) {
      const data = await response.json();
      setFirmWorkspace(data);

      if (data.agendas?.length && !taskForm.agendaId) {
        setTaskForm((current) => ({ ...current, agendaId: data.agendas[0].id }));
      }
    }
  }

  async function loadMe() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await response.json();

      if (data.user) {
        setUser(data.user);
        await Promise.all([loadCommand(), loadFirmWorkspace(), loadBackendKernel()]);
      }
    } finally {
      setCheckingSession(false);
    }
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Login failed.");
      return;
    }

    setUser(data.user);
    setLoginForm({ email: "", password: "" });
    await Promise.all([loadCommand(), loadFirmWorkspace(), loadBackendKernel()]);
  }

  async function submitFirmSignup(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    await Promise.all([loadCommand(), loadFirmWorkspace(), loadBackendKernel()]);
  }

  async function submitInviteSignup(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/auth/invite-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteSignupForm),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Invite acceptance failed.");
      return;
    }

    setUser(data.user);
    setInviteSignupForm({ inviteCode: "", name: "", password: "" });
    await Promise.all([loadCommand(), loadFirmWorkspace(), loadBackendKernel()]);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setCommand(null);
    setFirmWorkspace(null);
    setKernel(null);
    setActiveTab("overview");
  }

  async function postFirmAction(body: Record<string, unknown>) {
    setMessage("");

    const response = await fetch("/api/firm-workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Firm workspace action failed.");
      return null;
    }

    setFirmWorkspace(data);

    if (data.inviteCode || data.inviteLink) {
      setInviteOutput(`Invite code: ${data.inviteCode}\nInvite link: ${data.inviteLink}`);
    }

    await loadCommand();
    return data;
  }

  async function postBackendAction(action: string, extra: Record<string, unknown> = {}) {
    setBackendWorking(action);
    setBackendMessage("");

    try {
      const response = await fetch("/api/backend-kernel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });

      const data = await response.json();

      if (!response.ok) {
        setBackendMessage(data.error ?? "Backend action failed.");
        return null;
      }

      setKernel(data);
      setBackendMessage(data.message ?? "Backend action completed.");
      await loadCommand();
      return data;
    } finally {
      setBackendWorking("");
    }
  }

  async function createFirm(event: FormEvent) {
    event.preventDefault();

    if (!newFirmForm.name.trim()) {
      setMessage("Firm name is required.");
      return;
    }

    const data = await postFirmAction({
      action: "createFirm",
      name: newFirmForm.name,
      firmEmail: newFirmForm.firmEmail,
    });

    if (data) {
      setNewFirmForm({ name: "", firmEmail: "" });
      setMessage("Firm workspace created.");
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
      setMessage("Invite created. The recipient must use this invite to create their login.");
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
      setProjectForm({ title: "", description: "", priority: "Medium", dueDate: "" });
      setMessage("Project created.");
    }
  }

  async function createAgenda(event: FormEvent) {
    event.preventDefault();
    if (!firm) return;

    const data = await postFirmAction({
      action: "createAgenda",
      firmId: firm.id,
      weekStart: agendaForm.weekStart,
      title: agendaForm.title,
      focus: agendaForm.focus,
      blockers: agendaForm.blockers,
      tasks: [],
    });

    if (data) {
      setAgendaForm((current) => ({
        ...current,
        title: "Weekly Agenda",
        focus: "",
        blockers: "",
      }));
      setMessage("Weekly agenda created.");
    }
  }

  async function createCalendarTask(event: FormEvent) {
    event.preventDefault();
    if (!firm) return;

    const agendaId = taskForm.agendaId || agendas[0]?.id;

    if (!agendaId || !taskForm.title.trim()) {
      setMessage("Choose an agenda and enter a task title.");
      return;
    }

    const data = await postFirmAction({
      action: "addAgendaTask",
      firmId: firm.id,
      agendaId,
      projectId: taskForm.projectId || null,
      title: taskForm.title,
      detail: taskForm.detail,
      priority: taskForm.priority,
      dueDate: taskForm.dueDate || selectedDay,
    });

    if (data) {
      setTaskForm((current) => ({
        ...current,
        title: "",
        detail: "",
        dueDate: selectedDay,
      }));
      setMessage(`Task added for ${shortDate(selectedDay)}.`);
    }
  }

  function selectCalendarDay(day: string) {
    setSelectedDay(day);
    setSelectedTask(null);
    setTaskForm((current) => ({
      ...current,
      dueDate: day,
      agendaId: current.agendaId || agendas[0]?.id || "",
    }));
  }

  function shiftCalendar(direction: -1 | 1) {
    if (calendarMode === "week") {
      const next = addDays(agendaForm.weekStart, direction * 7);
      setAgendaForm((current) => ({ ...current, weekStart: next }));
      setCalendarAnchor(next);
      selectCalendarDay(next);
      return;
    }

    const next = addMonths(calendarAnchor, direction);
    setCalendarAnchor(next);
    selectCalendarDay(monthStart(next));
  }

  function goToTab(tab: Tab) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }

  useEffect(() => {
    void loadMe();
  }, []);

  useEffect(() => {
    function applyRequestedTab() {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get("invite");
      const urlTab = parseWorkspaceTab(params.get("tab"));
      const savedTab = parseWorkspaceTab(window.localStorage.getItem("sliceWorkspaceTab"));

      if (invite) {
        setAuthMode("invite-signup");
        setInviteSignupForm((current) => ({ ...current, inviteCode: invite }));
      }

      const nextTab = urlTab ?? savedTab;

      if (nextTab) {
        setActiveTab(nextTab);
        window.localStorage.removeItem("sliceWorkspaceTab");
      }
    }

    applyRequestedTab();
    window.addEventListener("popstate", applyRequestedTab);

    return () => window.removeEventListener("popstate", applyRequestedTab);
  }, []);

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] p-6 text-white">
        <Card className="max-w-3xl p-8 text-center">
          <Pill tone="red">Slice</Pill>
          <h1 className="mt-4 text-3xl font-black">Loading the command center...</h1>
          <p className="mt-3 text-sm text-slate-400">
            Preparing the investment OS, AI layer, backend kernel, market visuals, and firm workspace.
          </p>
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_28%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <div className="mx-auto grid max-w-6xl gap-6">
          <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-2xl shadow-red-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <LogoMark />
              <div>
                <div className="text-2xl font-black tracking-tight">Slice</div>
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
                  Ultimate Investment Guidance Platform
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["login", "firm-signup", "invite-signup"] as AuthMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAuthMode(mode)}
                  className={cx(
                    "rounded-2xl px-4 py-3 text-sm font-black",
                    authMode === mode
                      ? "bg-white text-slate-950"
                      : "bg-white/10 text-white ring-1 ring-white/10"
                  )}
                >
                  {mode === "login" ? "Login" : mode === "firm-signup" ? "Create Firm" : "Accept Invite"}
                </button>
              ))}
            </div>
          </header>

          {message ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
              {message}
            </div>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
            <Card className="p-6">
              <OrbitGraphic />
              <div className="relative">
                <Pill tone="red">Advisor-grade AI operating system</Pill>
                <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                  The most beautiful home base for modern investment guidance.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
                  Slice combines AI command, market visuals, client intelligence, backend automations,
                  price alerts, research workflows, portfolio views, venture tracking, and approval-safe communication.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <MetricCard label="AI Command" value="Voice-ready" helper="OpenAI structured tools" tone="purple" />
                  <MetricCard label="Backend" value="Kernel" helper="Jobs + providers" tone="cyan" />
                  <MetricCard label="Markets" value="Visual" helper="Charts + forecasts" tone="green" />
                  <MetricCard label="Compliance" value="Gated" helper="Approvals + proof" tone="red" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              {authMode === "login" ? (
                <form onSubmit={submitLogin} className="grid gap-4">
                  <SectionTitle
                    eyebrow="Login"
                    title="Enter workspace"
                    description="Use your firm credentials or temporary demo access."
                  />

                  <input
                    value={loginForm.email}
                    onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                    className={inputClass}
                    placeholder="Email"
                  />

                  <input
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                    type="password"
                    className={inputClass}
                    placeholder="Password"
                  />

                  <button className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.01]">
                    Log In
                  </button>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        setLoginForm({
                          email: "founder@slice.local",
                          password: "SliceFounder!2026",
                        })
                      }
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white"
                    >
                      Use Founder Demo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setLoginForm({
                          email: "advisor@slice.local",
                          password: "SliceAdvisor!2026",
                        })
                      }
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white"
                    >
                      Use Advisor Demo
                    </button>
                  </div>
                </form>
              ) : null}

              {authMode === "firm-signup" ? (
                <form onSubmit={submitFirmSignup} className="grid gap-4">
                  <SectionTitle
                    eyebrow="Create firm"
                    title="Start a workspace"
                    description="Create the owner account and first firm workspace."
                  />

                  <input
                    value={firmSignupForm.firmName}
                    onChange={(event) => setFirmSignupForm((current) => ({ ...current, firmName: event.target.value }))}
                    className={inputClass}
                    placeholder="Firm name"
                  />
                  <input
                    value={firmSignupForm.firmEmail}
                    onChange={(event) => setFirmSignupForm((current) => ({ ...current, firmEmail: event.target.value }))}
                    className={inputClass}
                    placeholder="Firm email"
                  />
                  <input
                    value={firmSignupForm.name}
                    onChange={(event) => setFirmSignupForm((current) => ({ ...current, name: event.target.value }))}
                    className={inputClass}
                    placeholder="Your name"
                  />
                  <input
                    value={firmSignupForm.email}
                    onChange={(event) => setFirmSignupForm((current) => ({ ...current, email: event.target.value }))}
                    className={inputClass}
                    placeholder="Your email"
                  />
                  <input
                    value={firmSignupForm.password}
                    onChange={(event) => setFirmSignupForm((current) => ({ ...current, password: event.target.value }))}
                    type="password"
                    className={inputClass}
                    placeholder="Password"
                  />

                  <button className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.01]">
                    Create Firm Workspace
                  </button>
                </form>
              ) : null}

              {authMode === "invite-signup" ? (
                <form onSubmit={submitInviteSignup} className="grid gap-4">
                  <SectionTitle eyebrow="Accept invite" title="Join a firm" description="Use an invite code from a firm owner or admin." />
                  <input
                    value={inviteSignupForm.inviteCode}
                    onChange={(event) => setInviteSignupForm((current) => ({ ...current, inviteCode: event.target.value }))}
                    className={inputClass}
                    placeholder="Invite code"
                  />
                  <input
                    value={inviteSignupForm.name}
                    onChange={(event) => setInviteSignupForm((current) => ({ ...current, name: event.target.value }))}
                    className={inputClass}
                    placeholder="Your name"
                  />
                  <input
                    value={inviteSignupForm.password}
                    onChange={(event) => setInviteSignupForm((current) => ({ ...current, password: event.target.value }))}
                    type="password"
                    className={inputClass}
                    placeholder="Create password"
                  />
                  <button className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.01]">
                    Join Firm
                  </button>
                </form>
              ) : null}
            </Card>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.32),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(168,85,247,0.12),_transparent_28%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] text-white">
      <div className="grid min-h-screen lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-white/10 bg-black/76 p-4 backdrop-blur-2xl lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:overflow-y-auto">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-red-950/20">
            <div className="flex items-center gap-3">
              <LogoMark />
              <div className="min-w-0">
                <div className="truncate text-2xl font-black">Slice</div>
                <div className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-red-400">
                  Investment OS
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <div className="truncate text-sm font-black">{user.name}</div>
              <div className="truncate text-xs font-semibold text-slate-500">{user.email}</div>
              <div className="flex flex-wrap gap-2 pt-2">
                {firm ? <Pill tone="purple">{firm.name}</Pill> : <Pill tone="amber">No firm</Pill>}
                <Pill tone={activeTabMeta.tone}>{activeTabMeta.label}</Pill>
              </div>
            </div>
          </div>

          <nav className="mt-4 grid gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => goToTab(tab.id)}
                className={cx(
                  "group flex items-center gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition",
                  activeTab === tab.id
                    ? "border-white/20 bg-white text-slate-950 shadow-xl shadow-red-950/20"
                    : "border-white/10 bg-white/[0.04] text-white hover:-translate-y-0.5 hover:bg-white/[0.08]"
                )}
              >
                <span
                  className={cx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-black",
                    activeTab === tab.id
                      ? "bg-slate-950 text-white"
                      : toneClasses[tab.tone]
                  )}
                >
                  {tab.marker}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">{tab.label}</span>
                  <span className={cx("mt-0.5 block truncate text-[10px] font-semibold", activeTab === tab.id ? "text-slate-600" : "text-slate-500")}>
                    {tab.description}
                  </span>
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-4 grid gap-2">
            <BeautifulButton href="/workspace/personal-bot" tone="purple">Personal Bot</BeautifulButton>
            <BeautifulButton href="/market-visuals" tone="green">Market Visuals</BeautifulButton>
            <BeautifulButton href="/backend-kernel" tone="cyan">Backend Kernel</BeautifulButton>
            <button
              onClick={logout}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:bg-white/10"
            >
              Logout
            </button>
          </div>
        </aside>

        <section className="min-w-0 p-4 md:p-6">
          <div className="mx-auto grid max-w-[1540px] gap-5">
            <Card className="p-6">
              <OrbitGraphic />
              <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                    {activeTabMeta.marker} · {activeTabMeta.label}
                  </div>
                  <h1 className="mt-2 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">
                    The home screen for serious investment guidance.
                  </h1>
                  <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                    AI commands, source-backed research, market visuals, client intelligence, portfolio analysis,
                    calendar execution, alternatives, alerts, approvals, delivery, and backend operations — arranged
                    into one clean advisor-grade workspace.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[430px]">
                  <MetricCard label="Workspace" value={`${readinessScore}%`} helper="Platform readiness" tone={readinessScore > 80 ? "green" : "amber"} />
                  <MetricCard
                    label="Backend"
                    value={kernel ? `${kernel.readinessScore}%` : "—"}
                    helper={kernel ? `${kernel.metrics.configuredVendors}/${kernel.metrics.vendors} vendors` : "Not loaded"}
                    tone={kernel && kernel.readinessScore >= 80 ? "green" : "cyan"}
                  />
                </div>
              </div>

              <div className="relative mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <ProgressBar value={readinessScore} tone={readinessScore > 80 ? "green" : "red"} />
                <div className="flex flex-wrap gap-2">
                  <Pill tone="red">{command?.counts.unreadAlertCount ?? 0} unread alerts</Pill>
                  <Pill tone="purple">{openFirmTasks.length} open tasks</Pill>
                  <Pill tone="green">{portfolioHoldingCount} holdings</Pill>
                  <Pill tone="cyan">{kernel?.metrics.jobs ?? 0} jobs</Pill>
                </div>
              </div>
            </Card>

            {message ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
                {message}
              </div>
            ) : null}

            {backendMessage ? (
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">
                {backendMessage}
              </div>
            ) : null}

            {!firm ? (
              <Card className="p-6">
                <form onSubmit={createFirm} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <div className="md:col-span-3">
                    <SectionTitle
                      eyebrow="Firm setup"
                      title="Create your firm workspace"
                      description="You are logged in, but you are not connected to an active firm workspace yet."
                    />
                  </div>

                  <input
                    value={newFirmForm.name}
                    onChange={(event) => setNewFirmForm((current) => ({ ...current, name: event.target.value }))}
                    className={inputClass}
                    placeholder="Firm name"
                  />

                  <input
                    value={newFirmForm.firmEmail}
                    onChange={(event) => setNewFirmForm((current) => ({ ...current, firmEmail: event.target.value }))}
                    className={inputClass}
                    placeholder="Firm email"
                  />

                  <button className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
                    Create Firm
                  </button>
                </form>
              </Card>
            ) : null}

            {activeTab === "overview" ? (
              <section className="grid gap-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Firm Tasks" value={firmTasks.length} helper={`${openFirmTasks.length} open`} tone="purple" />
                  <MetricCard label="Client Alerts" value={command?.counts.unreadAlertCount ?? 0} helper="Unread intelligence" tone="red" />
                  <MetricCard label="Portfolio Value" value={money(portfolioValue)} helper={`${portfolioHoldingCount} holdings`} tone="green" />
                  <MetricCard label="Backend Jobs" value={kernel?.metrics.jobs ?? "—"} helper="Registered automations" tone="cyan" />
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                  <Card className="p-6">
                    <SectionTitle
                      eyebrow="Advisor Mission Control"
                      title="Everything important, one click away."
                      description="This homescreen is built to feel calm, powerful, visual, and operational — the place an advisor starts and ends the day."
                      action={<Pill tone="red">Premium OS</Pill>}
                    />

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <Panel tone="purple">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-xl font-black">Personal AI Bot</div>
                            <p className="mt-1 text-sm leading-6 text-slate-400">Voice commands, research, routing, reports, and actions.</p>
                          </div>
                          <MiniBars tone="purple" />
                        </div>
                        <BeautifulButton href="/workspace/personal-bot" tone="purple">Command Bot</BeautifulButton>
                      </Panel>

                      <Panel tone="green">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-xl font-black">Market Visuals</div>
                            <p className="mt-1 text-sm leading-6 text-slate-400">Charts, forecasts, signals, and all important market data.</p>
                          </div>
                          <MiniBars tone="green" />
                        </div>
                        <BeautifulButton href="/market-visuals" tone="green">Open Visuals</BeautifulButton>
                      </Panel>

                      <Panel tone="cyan">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-xl font-black">Backend Kernel</div>
                            <p className="mt-1 text-sm leading-6 text-slate-400">Providers, jobs, delivery, data quality, and live systems.</p>
                          </div>
                          <MiniBars tone="cyan" />
                        </div>
                        <BeautifulButton href="/backend-kernel" tone="cyan">Open Kernel</BeautifulButton>
                      </Panel>

                      <Panel tone="amber">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-xl font-black">Alternative Ventures</div>
                            <p className="mt-1 text-sm leading-6 text-slate-400">Startup tracking, venture diligence, and high-risk opportunity review.</p>
                          </div>
                          <MiniBars tone="amber" />
                        </div>
                        <BeautifulButton href="/alternative-investments?view=venture" tone="amber">Review Ventures</BeautifulButton>
                      </Panel>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <SectionTitle
                      eyebrow="System Pulse"
                      title="Today’s operating snapshot"
                      description="Beautiful, quick, and useful at a glance."
                    />

                    <div className="mt-5 grid gap-3">
                      <Panel tone="red">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Alert Flow</div>
                            <div className="mt-1 text-2xl font-black">{command?.counts.totalAlertCount ?? 0}</div>
                          </div>
                          <Pill tone="red">{command?.counts.unreadAlertCount ?? 0} unread</Pill>
                        </div>
                      </Panel>

                      <Panel tone="purple">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Advisor Work</div>
                            <div className="mt-1 text-2xl font-black">{firmTasks.length}</div>
                          </div>
                          <Pill tone="purple">{Math.round(calendarCompletionRate)}% complete</Pill>
                        </div>
                      </Panel>

                      <Panel tone="green">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Portfolio Lab</div>
                            <div className="mt-1 text-2xl font-black">{money(portfolioValue)}</div>
                          </div>
                          <Pill tone="green">{portfolioHoldingCount} holdings</Pill>
                        </div>
                      </Panel>

                      <Panel tone="cyan">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Backend</div>
                            <div className="mt-1 text-2xl font-black">{kernel ? `${kernel.readinessScore}%` : "—"}</div>
                          </div>
                          <Pill tone="cyan">{kernel?.metrics.queuedDeliveries ?? 0} queued</Pill>
                        </div>
                      </Panel>
                    </div>
                  </Card>
                </div>

                <GenericModule
                  eyebrow="Platform Launchpad"
                  title="Beautifully connected workflows"
                  description="Every important part of the platform is accessible from the homescreen without hunting."
                  cards={[
                    {
                      title: "Advisor Command Center",
                      description: "Client Brain, Next Best Action, firm search, proof trails, and Advisor Day.",
                      href: "/advisor-command-center",
                      button: "Open Command",
                      tone: "red",
                      stats: [
                        ["Clients", command?.counts.clientCount ?? 0],
                        ["Briefings", command?.counts.briefingCount ?? 0],
                      ],
                    },
                    {
                      title: "Execution Calendar",
                      description: "Weekly/monthly calendar with selected-day actions and clean task display.",
                      href: "/workspace?tab=firm-calendar",
                      button: "Open Calendar",
                      tone: "purple",
                      stats: [
                        ["Open", openFirmTasks.length],
                        ["Complete", completedFirmTasks.length],
                      ],
                    },
                    {
                      title: "Watchlist Price Alerts",
                      description: "High/low alerts tied to live provider quote checks and delivery queue.",
                      href: "/watchlist-alerts",
                      button: "Open Alerts",
                      tone: "amber",
                      stats: [
                        ["Trigger", "High / Low"],
                        ["Provider", "Live Quote"],
                      ],
                    },
                  ]}
                />
              </section>
            ) : null}

            {activeTab === "command" ? (
              <section className="grid gap-5">
                <Card className="p-6">
                  <SectionTitle
                    eyebrow="Command Layer"
                    title="Live backend + AI operations"
                    description="Run the backend kernel, validate providers, queue deliveries, process notifications, check watchlist prices, and control the platform."
                    action={<Pill tone="cyan">Integration-ready</Pill>}
                  />

                  <div className="mt-5 grid gap-3 md:grid-cols-5">
                    <MetricCard label="Kernel" value={kernel ? `${kernel.readinessScore}%` : "—"} helper="Backend score" tone="cyan" />
                    <MetricCard label="Vendors" value={kernel ? `${kernel.metrics.configuredVendors}/${kernel.metrics.vendors}` : "—"} helper="Configured" tone="purple" />
                    <MetricCard label="Features" value={kernel ? `${kernel.metrics.enabledFeatures}/${kernel.metrics.features}` : "—"} helper="Enabled" tone="green" />
                    <MetricCard label="Queued" value={kernel?.metrics.queuedDeliveries ?? "—"} helper="Deliveries" tone="amber" />
                    <MetricCard label="Failed" value={kernel?.metrics.failedRuns ?? "—"} helper="Job runs" tone={kernel?.metrics.failedRuns ? "red" : "green"} />
                  </div>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["bootstrap", "Foundation", "Bootstrap Kernel", "Refresh vendors, feature flags, jobs, and events.", "cyan"],
                    ["runCoreJobs", "Core", "Run Core Backend", "Run vendor health, price alerts, delivery, data quality, and Advisor Day.", "red"],
                    ["price", "Market", "Check Prices", "Run live high/low watchlist price checks.", "amber"],
                    ["queueTestDelivery", "Delivery", "Queue Test", "Queue a backend delivery and process it from the kernel.", "green"],
                  ].map(([action, eyebrow, title, description, tone]) => (
                    <button
                      key={String(action)}
                      onClick={() =>
                        action === "price"
                          ? postBackendAction("runJob", { jobKey: "watchlist_price_check" })
                          : postBackendAction(String(action))
                      }
                      disabled={backendWorking === action}
                      className={cx(
                        "rounded-[1.75rem] border p-5 text-left shadow-xl transition hover:-translate-y-1 disabled:opacity-50",
                        toneClasses[tone as Tone]
                      )}
                    >
                      <div className="text-xs font-black uppercase tracking-[0.16em] opacity-70">{eyebrow}</div>
                      <div className="mt-2 text-2xl font-black">{title}</div>
                      <div className="mt-2 text-sm font-semibold opacity-80">{description}</div>
                    </button>
                  ))}
                </div>

                <GenericModule
                  eyebrow="Backend Surfaces"
                  title="Control and verify every live dependency"
                  description="Presentation-ready backend management without exposing secrets."
                  cards={[
                    {
                      title: "Backend Kernel",
                      description: "Vendor status, feature flags, jobs, deliveries, event logs, and quality records.",
                      href: "/backend-kernel",
                      button: "Open Kernel",
                      tone: "cyan",
                      stats: [
                        ["Readiness", kernel ? `${kernel.readinessScore}%` : "—"],
                        ["Events", kernel?.metrics.events ?? "—"],
                      ],
                    },
                    {
                      title: "Integration Status",
                      description: "See OpenAI, market data, email, SMS, Blob, and live/simulated states.",
                      href: "/api/integrations/status",
                      button: "Open Status",
                      tone: "purple",
                      stats: [
                        ["OpenAI", "Checked"],
                        ["Providers", "Verified"],
                      ],
                    },
                    {
                      title: "Personal Bot",
                      description: "Voice command center for research, routing, reports, jobs, and firm actions.",
                      href: "/workspace/personal-bot",
                      button: "Command Bot",
                      tone: "red",
                      stats: [
                        ["Voice", "Ready"],
                        ["Tools", "Structured"],
                      ],
                    },
                  ]}
                />
              </section>
            ) : null}

            {activeTab === "firm-calendar" ? (
              <section className="grid gap-5">
                <Card className="p-6">
                  <SectionTitle
                    eyebrow="Firm Calendar"
                    title="Polished execution calendar"
                    description="Tap any day to add work, switch weekly/monthly, complete tasks, and keep firm work beautiful and readable."
                    action={
                      <div className="flex flex-wrap gap-2">
                        <Pill tone="green">{completedFirmTasks.length} complete</Pill>
                        <Pill tone="amber">{openFirmTasks.length} open</Pill>
                        <Pill tone="purple">{firmTasks.length} total</Pill>
                      </div>
                    }
                  />

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <MetricCard label="Completion" value={`${Math.round(calendarCompletionRate)}%`} helper="Calendar progress" tone={calendarCompletionRate > 70 ? "green" : "amber"} />
                    <MetricCard label="Open Tasks" value={openFirmTasks.length} helper="Still active" tone="amber" />
                    <MetricCard label="Unscheduled" value={unscheduledTasks.length} helper="Needs date" tone={unscheduledTasks.length ? "red" : "green"} />
                    <MetricCard label="Selected Day" value={shortDate(selectedDay)} helper={`${selectedDayTasks.length} tasks`} tone="purple" />
                  </div>
                </Card>

                <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
                  <Card className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                          {calendarMode === "week" ? "Weekly View" : "Monthly View"}
                        </div>
                        <h2 className="mt-1 text-2xl font-black text-white">
                          {calendarMode === "week" ? `Week of ${shortDate(agendaForm.weekStart)}` : monthTitle(calendarAnchor)}
                        </h2>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => shiftCalendar(-1)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:bg-white/10">
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const today = ymd(new Date());
                            setCalendarAnchor(today);
                            setAgendaForm((current) => ({ ...current, weekStart: startOfWeek(today) }));
                            selectCalendarDay(today);
                          }}
                          className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-950"
                        >
                          Today
                        </button>
                        <button type="button" onClick={() => shiftCalendar(1)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:bg-white/10">
                          Next
                        </button>

                        <div className="flex rounded-2xl border border-white/10 bg-black/40 p-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCalendarMode("week");
                              setAgendaForm((current) => ({ ...current, weekStart: startOfWeek(selectedDay) }));
                            }}
                            className={cx("rounded-xl px-3 py-1.5 text-xs font-black", calendarMode === "week" ? "bg-white text-slate-950" : "text-slate-400 hover:text-white")}
                          >
                            Week
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCalendarMode("month");
                              setCalendarAnchor(selectedDay);
                            }}
                            className={cx("rounded-xl px-3 py-1.5 text-xs font-black", calendarMode === "month" ? "bg-white text-slate-950" : "text-slate-400 hover:text-white")}
                          >
                            Month
                          </button>
                        </div>
                      </div>
                    </div>

                    {calendarMode === "month" ? (
                      <div className="mt-5 grid grid-cols-7 gap-2 px-1">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                          <div key={label} className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                            {label}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className={cx("mt-3 grid gap-3", calendarMode === "week" ? "grid-cols-1 md:grid-cols-7" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-7")}>
                      {visibleDays.map((day) => {
                        const rawDayTasks = tasksByDay.get(day) ?? [];
                        const isToday = day === ymd(new Date());
                        const isSelected = day === selectedDay;
                        const isCurrentMonth = toDate(day).getMonth() === toDate(calendarAnchor).getMonth();
                        const visibleTaskLimit = calendarMode === "week" ? 10 : 5;
                        const visibleTasks = rawDayTasks.slice(0, visibleTaskLimit);
                        const overflowCount = Math.max(0, rawDayTasks.length - visibleTasks.length);

                        return (
                          <div
                            key={day}
                            role="button"
                            tabIndex={0}
                            onClick={() => selectCalendarDay(day)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") selectCalendarDay(day);
                            }}
                            className={cx(
                              "group flex min-h-[184px] cursor-pointer flex-col rounded-[1.35rem] border p-2.5 text-left transition hover:-translate-y-0.5 hover:border-red-400/40 hover:bg-red-500/10 md:min-h-[220px]",
                              calendarMode === "week" && "md:min-h-[420px]",
                              isSelected
                                ? "border-red-400/60 bg-red-500/12 shadow-lg shadow-red-950/20"
                                : isToday
                                  ? "border-red-400/35 bg-red-500/8"
                                  : "border-white/10 bg-white/[0.045]",
                              calendarMode === "month" && !isCurrentMonth && "opacity-45"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className={cx("truncate font-black", calendarMode === "week" ? "text-sm" : "text-base", isToday || isSelected ? "text-red-100" : "text-white")}>
                                  {calendarMode === "week" ? dayLabel(day) : monthDayLabel(day)}
                                </div>
                                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                                  {rawDayTasks.length} task{rawDayTasks.length === 1 ? "" : "s"}
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-1">
                                {isToday ? <Pill tone="red">Today</Pill> : null}
                                {isSelected ? <Pill tone="purple">Selected</Pill> : null}
                              </div>
                            </div>

                            <div className={cx("mt-2 grid gap-1.5 overflow-y-auto pr-1", calendarMode === "week" ? "max-h-[322px]" : "max-h-[118px]")}>
                              {visibleTasks.length ? (
                                visibleTasks.map((task, index) => (
                                  <CalendarTaskPill
                                    key={`${day}-${task.id}-${index}`}
                                    task={task}
                                    dense={calendarMode === "month"}
                                    onSelect={() => {
                                      setSelectedTask(task);
                                      selectCalendarDay(day);
                                    }}
                                    onComplete={
                                      firm
                                        ? () =>
                                            postFirmAction({
                                              action: "updateTask",
                                              firmId: firm.id,
                                              taskId: task.id,
                                              status: "Complete",
                                            })
                                        : undefined
                                    }
                                  />
                                ))
                              ) : (
                                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.025] px-3 py-2 text-center text-[11px] font-bold text-slate-600">
                                  Tap to add
                                </div>
                              )}

                              {overflowCount > 0 ? (
                                <div className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-center text-[11px] font-black text-slate-400">
                                  +{overflowCount} more
                                </div>
                              ) : null}
                            </div>

                            <div className="mt-auto pt-2">
                              <div className="rounded-xl border border-white/10 bg-black/24 px-2 py-1.5 text-center text-[10px] font-black text-slate-500 transition group-hover:border-red-400/30 group-hover:text-red-200">
                                Add work
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  <aside className="grid gap-5">
                    <Card className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">Selected Day</div>
                          <h3 className="mt-2 text-xl font-black text-white">{shortDate(selectedDay)}</h3>
                        </div>
                        <Pill tone={selectedDayTasks.length ? "amber" : "green"}>{selectedDayTasks.length} tasks</Pill>
                      </div>

                      <div className="mt-4 grid max-h-[240px] gap-2 overflow-y-auto pr-1">
                        {selectedDayTasks.length ? (
                          selectedDayTasks.map((task, index) => (
                            <CalendarTaskPill
                              key={`selected-${task.id}-${index}`}
                              task={task}
                              onSelect={() => setSelectedTask(task)}
                              onComplete={
                                firm
                                  ? () =>
                                      postFirmAction({
                                        action: "updateTask",
                                        firmId: firm.id,
                                        taskId: task.id,
                                        status: "Complete",
                                      })
                                  : undefined
                              }
                            />
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.025] px-3 py-2 text-center text-[11px] font-bold text-slate-600">
                            No tasks yet
                          </div>
                        )}
                      </div>
                    </Card>

                    <Card className="p-5">
                      <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">Add Task</div>
                      <h3 className="mt-2 text-xl font-black text-white">Add to {shortDate(taskForm.dueDate || selectedDay)}</h3>

                      {agendas.length ? (
                        <form onSubmit={createCalendarTask} className="mt-4 grid gap-3">
                          <select value={taskForm.agendaId} onChange={(event) => setTaskForm((current) => ({ ...current, agendaId: event.target.value }))} className={selectClass}>
                            <option value="">Choose agenda</option>
                            {agendas.map((agenda) => (
                              <option key={agenda.id} value={agenda.id}>
                                {agenda.title} · {shortDate(agenda.weekStart)}
                              </option>
                            ))}
                          </select>

                          <select value={taskForm.projectId} onChange={(event) => setTaskForm((current) => ({ ...current, projectId: event.target.value }))} className={selectClass}>
                            <option value="">No project</option>
                            {projects.map((project) => (
                              <option key={project.id} value={project.id}>{project.title}</option>
                            ))}
                          </select>

                          <input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} className={inputClass} placeholder="Task title" />
                          <textarea value={taskForm.detail} onChange={(event) => setTaskForm((current) => ({ ...current, detail: event.target.value }))} className={inputClass} placeholder="Optional detail" rows={3} />

                          <div className="grid gap-3 sm:grid-cols-2">
                            <select value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))} className={selectClass}>
                              <option>Low</option>
                              <option>Medium</option>
                              <option>High</option>
                              <option>Critical</option>
                            </select>

                            <input type="date" value={taskForm.dueDate || selectedDay} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} className={inputClass} />
                          </div>

                          <button type="submit" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.01]">
                            Add to Calendar
                          </button>
                        </form>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                          Create an agenda first before adding tasks.
                        </div>
                      )}
                    </Card>

                    <Card className="p-5">
                      <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">Create Agenda</div>
                      <form onSubmit={createAgenda} className="mt-4 grid gap-3">
                        <input type="date" value={agendaForm.weekStart} onChange={(event) => setAgendaForm((current) => ({ ...current, weekStart: event.target.value }))} className={inputClass} />
                        <input value={agendaForm.title} onChange={(event) => setAgendaForm((current) => ({ ...current, title: event.target.value }))} className={inputClass} placeholder="Agenda title" />
                        <input value={agendaForm.focus} onChange={(event) => setAgendaForm((current) => ({ ...current, focus: event.target.value }))} className={inputClass} placeholder="Weekly focus" />
                        <textarea value={agendaForm.blockers} onChange={(event) => setAgendaForm((current) => ({ ...current, blockers: event.target.value }))} className={inputClass} rows={2} placeholder="Optional blockers" />
                        <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10">
                          Create Agenda
                        </button>
                      </form>
                    </Card>

                    {selectedTask ? (
                      <Card className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">Selected Task</div>
                            <h3 className="mt-2 text-lg font-black text-white">{selectedTask.title}</h3>
                          </div>
                          <button type="button" onClick={() => setSelectedTask(null)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white">
                            Clear
                          </button>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-400">{selectedTask.detail ?? "No detail added yet."}</p>
                        {firm ? (
                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() =>
                                postFirmAction({
                                  action: "updateTask",
                                  firmId: firm.id,
                                  taskId: selectedTask.id,
                                  status: "Complete",
                                })
                              }
                              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                            >
                              Mark Complete
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                postFirmAction({
                                  action: "updateTask",
                                  firmId: firm.id,
                                  taskId: selectedTask.id,
                                  status: "Open",
                                })
                              }
                              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white"
                            >
                              Reopen
                            </button>
                          </div>
                        ) : null}
                      </Card>
                    ) : null}
                  </aside>
                </div>
              </section>
            ) : null}

            {activeTab === "team-board" ? (
              <section className="grid gap-5">
                <Card className="p-6">
                  <SectionTitle
                    eyebrow="Team Board"
                    title="Members, invites, projects, and execution"
                    description="A cleaner operating layer for the firm’s people, permissions, initiatives, and project flow."
                  />
                </Card>

                <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                  <div className="grid gap-5">
                    <Card className="p-5">
                      <SectionTitle eyebrow="Members" title="Firm team" description="Active users and their permissions." />

                      <div className="mt-5 grid gap-3">
                        {members.map((member) => (
                          <Panel key={member.id} tone={toneFor(member.role)}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-lg font-black text-white">{member.user?.name ?? "Team member"}</div>
                                <div className="mt-1 truncate text-sm text-slate-500">{member.user?.email ?? "No email"}</div>
                              </div>
                              <Pill tone={toneFor(member.status)}>{member.role}</Pill>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <Pill tone={member.canAccessPortfolios ? "green" : "slate"}>Portfolios</Pill>
                              <Pill tone={member.canManageProjects ? "green" : "slate"}>Projects</Pill>
                              <Pill tone={member.canInviteMembers ? "green" : "slate"}>Invites</Pill>
                              <Pill tone={member.canManageFirm ? "green" : "slate"}>Firm Admin</Pill>
                            </div>
                          </Panel>
                        ))}
                      </div>
                    </Card>

                    <Card className="p-5">
                      <SectionTitle eyebrow="Invites" title="Invite a teammate" description="Generate an invite code for a new firm user." />

                      {canInvite ? (
                        <form onSubmit={createInvite} className="mt-5 grid gap-3">
                          <input value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} className={inputClass} placeholder="Teammate email" />
                          <select value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))} className={selectClass}>
                            <option>Member</option>
                            <option>Advisor</option>
                            <option>Admin</option>
                            <option>Viewer</option>
                          </select>
                          <button className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
                            Create Invite
                          </button>
                        </form>
                      ) : (
                        <p className="mt-4 text-sm text-slate-400">You do not have permission to invite members.</p>
                      )}

                      {inviteOutput ? (
                        <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-slate-300">{inviteOutput}</pre>
                      ) : null}

                      <div className="mt-5 grid gap-2">
                        {invites.slice(0, 8).map((invite) => (
                          <div key={invite.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                            <div className="truncate text-sm font-black text-white">{invite.email}</div>
                            <div className="mt-1 text-xs text-slate-500">{invite.role} · {invite.status}</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  <div className="grid gap-5">
                    <Card className="p-5">
                      <SectionTitle eyebrow="Projects" title="Create project" description="Track work across advisors, client initiatives, investment review, and operations." />

                      {canManageProjects ? (
                        <form onSubmit={createProject} className="mt-5 grid gap-3">
                          <input value={projectForm.title} onChange={(event) => setProjectForm((current) => ({ ...current, title: event.target.value }))} className={inputClass} placeholder="Project title" />
                          <textarea value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} className={inputClass} placeholder="Description" rows={3} />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <select value={projectForm.priority} onChange={(event) => setProjectForm((current) => ({ ...current, priority: event.target.value }))} className={selectClass}>
                              <option>Low</option>
                              <option>Medium</option>
                              <option>High</option>
                              <option>Critical</option>
                            </select>
                            <input type="date" value={projectForm.dueDate} onChange={(event) => setProjectForm((current) => ({ ...current, dueDate: event.target.value }))} className={inputClass} />
                          </div>
                          <button className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
                            Create Project
                          </button>
                        </form>
                      ) : (
                        <p className="mt-4 text-sm text-slate-400">You do not have project management permission.</p>
                      )}
                    </Card>

                    <div className="grid gap-3">
                      {projects.map((project) => (
                        <Card key={project.id} className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-lg font-black text-white">{project.title}</div>
                              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">{project.description ?? "No description yet."}</p>
                            </div>
                            <Pill tone={toneFor(project.priority)}>{project.priority}</Pill>
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-3">
                            <MetricCard label="Status" value={project.status} tone={toneFor(project.status)} />
                            <MetricCard label="Due" value={shortDate(project.dueDate)} tone="slate" />
                            <MetricCard label="Tasks" value={project.agendaTasks?.length ?? 0} tone="purple" />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === "watchlists" ? (
              <GenericModule
                eyebrow="Watchlists"
                title="Watchlists, price alerts, and tracked names"
                description="A clean space for stocks, opportunities, live quote triggers, and bot-driven monitoring."
                cards={[
                  {
                    title: "Watchlist Alerts",
                    description: "Create high/low price alerts for stocks in named watchlists.",
                    href: "/watchlist-alerts",
                    button: "Open Alerts",
                    tone: "amber",
                    stats: [
                      ["Trigger", "High / Low"],
                      ["Provider", "Live Quote"],
                    ],
                  },
                  {
                    title: "Market Visuals",
                    description: "Technical charts, predictive bands, data quality, and comparison tools.",
                    href: "/market-visuals",
                    button: "Open Visuals",
                    tone: "green",
                    stats: [
                      ["Charts", "Interactive"],
                      ["Freshness", "Tracked"],
                    ],
                  },
                  {
                    title: "Personal Bot",
                    description: "Ask your bot to add tickers, create alerts, or research names.",
                    href: "/workspace/personal-bot",
                    button: "Command Bot",
                    tone: "purple",
                    stats: [
                      ["Voice", "Ready"],
                      ["Research", "Enabled"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "comparison" ? (
              <GenericModule
                eyebrow="Compare"
                title="Compare investments visually and strategically"
                description="Bring together charts, portfolio exposures, alternatives, and advisor reasoning."
                cards={[
                  {
                    title: "Portfolio Lab",
                    description: "Compare holdings, allocation drift, and scenario outcomes.",
                    href: "/portfolio-lab",
                    button: "Open Lab",
                    tone: "green",
                    stats: [
                      ["Accounts", portfolioAccountCount],
                      ["Holdings", portfolioHoldingCount],
                    ],
                  },
                  {
                    title: "Market Visuals",
                    description: "Compare tickers, indicators, trend bands, and forecast visuals.",
                    href: "/market-visuals",
                    button: "Open Visuals",
                    tone: "cyan",
                    stats: [
                      ["Charts", "Comparison"],
                      ["Prediction", "Bands"],
                    ],
                  },
                  {
                    title: "Advisor OS",
                    description: "Turn investment events into advisor actions and talking points.",
                    href: "/advisor-os",
                    button: "Open Advisor OS",
                    tone: "red",
                    stats: [
                      ["Readiness", `${readinessScore}%`],
                      ["Briefings", command?.counts.briefingCount ?? 0],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "alternatives" ? (
              <GenericModule
                eyebrow="Alternatives"
                title="Alternative investment command center"
                description="Beautifully separate venture, penny stocks, crypto, and high-risk opportunity review from core portfolios."
                cards={[
                  {
                    title: "Alternative Ventures",
                    description: "Track startup opportunities, founders, valuations, equity offered, traction, thesis, and diligence status.",
                    href: "/alternative-investments?view=venture",
                    button: "Review Ventures",
                    tone: "purple",
                    stats: [
                      ["Ventures", command?.counts.ventureCount ?? 0],
                      ["Risk", "High"],
                    ],
                  },
                  {
                    title: "Penny Stocks",
                    description: "Track speculative tickers, catalysts, thesis, entry ideas, and risk caps.",
                    href: "/alternative-investments?view=penny-stocks",
                    button: "Review Penny Stocks",
                    tone: "red",
                    stats: [
                      ["Risk", "Extreme"],
                      ["Status", "Watchlist"],
                    ],
                  },
                  {
                    title: "Crypto Markets",
                    description: "Review crypto market data, sentiment, volatility, liquidity, and opportunity scoring.",
                    href: "/alternative-investments?view=crypto",
                    button: "Open Crypto",
                    tone: "amber",
                    stats: [
                      ["Source", "Live"],
                      ["Risk", "Very High"],
                    ],
                  },
                  {
                    title: "Alternative Risk Framework",
                    description: "Suitability guardrails for crypto, penny stocks, private deals, and venture opportunities.",
                    href: "/alternative-investments?view=risk",
                    button: "Review Risk",
                    tone: "red",
                    stats: [
                      ["Compliance", "Separated"],
                      ["Delivery", "Gated"],
                    ],
                  },
                  {
                    title: "Opportunity Radar",
                    description: "Review high-risk signals before advisor or client-facing action.",
                    href: "/opportunity-radar",
                    button: "Open Radar",
                    tone: "amber",
                    stats: [
                      ["Signals", command?.counts.retainedDecisionCount ?? 0],
                      ["Action", "Review"],
                    ],
                  },
                  {
                    title: "Briefings",
                    description: "Generate advisor-safe summaries before discussing alternatives with clients.",
                    href: "/briefings",
                    button: "Open Briefings",
                    tone: "cyan",
                    stats: [
                      ["Reports", command?.counts.briefingCount ?? 0],
                      ["Compliance", "Gated"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "clients" ? (
              <GenericModule
                eyebrow="Clients / Wealth"
                title="Client intelligence, communication, and wealth guidance"
                description="Client Brain, advisor tasks, briefings, notes, AI summaries, and client-safe communication workflows."
                cards={[
                  {
                    title: "AI Command Center",
                    description: "Use Client Brain and Next Best Action to prioritize advisor work.",
                    href: "/advisor-command-center",
                    button: "Open AI Command",
                    tone: "red",
                    stats: [
                      ["Clients", command?.counts.clientCount ?? 0],
                      ["Actions", "Ranked"],
                    ],
                  },
                  {
                    title: "Personal Bot",
                    description: "Create clients, tasks, notes, reports, and follow-ups by voice or text.",
                    href: "/workspace/personal-bot",
                    button: "Command Bot",
                    tone: "purple",
                    stats: [
                      ["Voice", "Enabled"],
                      ["Memory", "On"],
                    ],
                  },
                  {
                    title: "Briefings",
                    description: "Create client-facing and advisor-facing reports.",
                    href: "/briefings",
                    button: "Open Reports",
                    tone: "cyan",
                    stats: [
                      ["Reports", command?.counts.briefingCount ?? 0],
                      ["Delivery", "Gated"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "portfolio" ? (
              <GenericModule
                eyebrow="Portfolio Lab"
                title="Portfolio, allocation, and scenario analysis"
                description="The visual and analytical layer for holdings, drift, impact, models, and client exposure."
                cards={[
                  {
                    title: "Portfolio Lab",
                    description: "Open the full portfolio lab for analysis and scenario testing.",
                    href: "/portfolio-lab",
                    button: "Open Lab",
                    tone: "green",
                    stats: [
                      ["Value", money(portfolioValue)],
                      ["Holdings", portfolioHoldingCount],
                    ],
                  },
                  {
                    title: "Market Visuals",
                    description: "Connect market behavior, technical charts, and data-quality checks to portfolio questions.",
                    href: "/market-visuals",
                    button: "Open Visuals",
                    tone: "cyan",
                    stats: [
                      ["Charts", "Technical"],
                      ["Quality", "Freshness"],
                    ],
                  },
                  {
                    title: "Advisor OS",
                    description: "Run portfolio-aware event workflows and impact analysis.",
                    href: "/advisor-os",
                    button: "Open OS",
                    tone: "red",
                    stats: [
                      ["Models", portfolioModelCount],
                      ["AI", "Active"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "intelligence" ? (
              <GenericModule
                eyebrow="Intelligence"
                title="Continuous scanning and opportunity intelligence"
                description="Triage, retained headlines, source credibility, opportunity scoring, alerts, and AI research."
                cards={[
                  {
                    title: "Triage",
                    description: "Run and review retained news intelligence.",
                    href: "/triage",
                    button: "Open Triage",
                    tone: "red",
                    stats: [
                      ["Runs", command?.counts.triageRunCount ?? 0],
                      ["Retained", command?.counts.retainedDecisionCount ?? 0],
                    ],
                  },
                  {
                    title: "Opportunity Radar",
                    description: "Rank events by portfolio relevance and opportunity score.",
                    href: "/opportunity-radar",
                    button: "Open Radar",
                    tone: "amber",
                    stats: [
                      ["Alerts", command?.counts.totalAlertCount ?? 0],
                      ["Unread", command?.counts.unreadAlertCount ?? 0],
                    ],
                  },
                  {
                    title: "Research Bot",
                    description: "Use the personal AI bot to research tickers, sources, client exposure, and firm data.",
                    href: "/workspace/personal-bot",
                    button: "Ask Bot",
                    tone: "purple",
                    stats: [
                      ["Research", "Enabled"],
                      ["Sources", "Tracked"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "notifications" ? (
              <GenericModule
                eyebrow="Notifications"
                title="Alerts, delivery, and communication"
                description="Price triggers, queued delivery, email/SMS readiness, digest logic, and bot-generated approvals."
                cards={[
                  {
                    title: "Watchlist Price Alerts",
                    description: "Trigger notifications when watchlist stocks hit high or low prices.",
                    href: "/watchlist-alerts",
                    button: "Open Price Alerts",
                    tone: "amber",
                    stats: [
                      ["Trigger", "High / Low"],
                      ["Provider", "Live Quote"],
                    ],
                  },
                  {
                    title: "Backend Delivery Queue",
                    description: "Process queued dashboard, email, and SMS delivery records.",
                    href: "/backend-kernel",
                    button: "Open Delivery",
                    tone: "cyan",
                    stats: [
                      ["Queued", kernel?.metrics.queuedDeliveries ?? "—"],
                      ["Deliveries", kernel?.metrics.deliveries ?? "—"],
                    ],
                  },
                  {
                    title: "Bot Automation",
                    description: "Let the bot queue approval-gated investor email drafts.",
                    href: "/workspace/personal-bot",
                    button: "Command Bot",
                    tone: "purple",
                    stats: [
                      ["Mode", "Approval"],
                      ["Delivery", "Gated"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "briefings" ? (
              <GenericModule
                eyebrow="Briefings"
                title="Advisor and client reports"
                description="Beautiful daily, weekly, market, portfolio, and client-specific briefings."
                cards={[
                  {
                    title: "Briefing Reports",
                    description: "Open the dedicated briefing center.",
                    href: "/briefings",
                    button: "Open Reports",
                    tone: "cyan",
                    stats: [
                      ["Reports", command?.counts.briefingCount ?? 0],
                      ["Digest", command?.counts.digestCount ?? 0],
                    ],
                  },
                  {
                    title: "Personal Bot PDFs",
                    description: "Create premium PDF reports by command.",
                    href: "/workspace/personal-bot",
                    button: "Create PDF",
                    tone: "purple",
                    stats: [
                      ["Command", "pdf"],
                      ["Design", "Premium"],
                    ],
                  },
                  {
                    title: "Storage + Evidence",
                    description: "Store reports, evidence files, exports, and source snapshots when configured.",
                    href: "/backend-kernel",
                    button: "Open Backend",
                    tone: "cyan",
                    stats: [
                      ["Storage", "Provider-aware"],
                      ["Reports", "Export-ready"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "security" ? (
              <GenericModule
                eyebrow="Security"
                title="Governance, approvals, audit, and compliance"
                description="A beautiful but serious control layer for sensitive advisor workflows."
                cards={[
                  {
                    title: "Backend Readiness",
                    description: "Review tenant isolation, role policies, approval center, data quality, and health checks.",
                    href: "/backend-readiness",
                    button: "Open Readiness",
                    tone: "cyan",
                    stats: [
                      ["Tenant", "Scoped"],
                      ["Approvals", "Gated"],
                    ],
                  },
                  {
                    title: "Security Center",
                    description: "Open the security and compliance page.",
                    href: "/security",
                    button: "Open Security",
                    tone: "red",
                    stats: [
                      ["Audit Logs", command?.counts.auditLogCount ?? 0],
                      ["Status", "Active"],
                    ],
                  },
                  {
                    title: "Proof Trail",
                    description: "Advisor OS and bot workflows preserve evidence and rationale.",
                    href: "/advisor-os",
                    button: "Open OS",
                    tone: "purple",
                    stats: [
                      ["Delivery", "Gated"],
                      ["Evidence", "Stored"],
                    ],
                  },
                ]}
              />
            ) : null}

            {activeTab === "system" ? (
              <GenericModule
                eyebrow="System"
                title="System readiness and setup"
                description="A clean command layer for environment status, backend jobs, feature flags, providers, and launch readiness."
                cards={[
                  {
                    title: "Backend Kernel",
                    description: "Operational backend for vendor status, feature flags, jobs, delivery, and quality.",
                    href: "/backend-kernel",
                    button: "Open Kernel",
                    tone: "cyan",
                    stats: [
                      ["Readiness", kernel ? `${kernel.readinessScore}%` : "—"],
                      ["Jobs", kernel?.metrics.jobs ?? "—"],
                      ["Vendors", kernel ? `${kernel.metrics.configuredVendors}/${kernel.metrics.vendors}` : "—"],
                      ["Queued", kernel?.metrics.queuedDeliveries ?? "—"],
                    ],
                  },
                  {
                    title: "Backend Readiness",
                    description: "Policies, approvals, data quality, AI tools, jobs, tenant checks, and seed data.",
                    href: "/backend-readiness",
                    button: "Open Readiness",
                    tone: "cyan",
                    stats: [
                      ["Readiness", `${readinessScore}%`],
                      ["Firms", command?.counts.firmCount ?? 0],
                    ],
                  },
                  {
                    title: "Integration Status",
                    description: "Validate all configured provider variables and live/simulated status.",
                    href: "/api/integrations/status",
                    button: "Open Status",
                    tone: "purple",
                    stats: [
                      ["OpenAI", "Checked"],
                      ["Market", "Checked"],
                      ["Email/SMS", "Checked"],
                      ["Blob", "Checked"],
                    ],
                  },
                ]}
              />
            ) : null}

            <footer className="pb-8 text-center text-xs font-semibold text-slate-600">
              Slice · beautiful advisor-grade investment operating system · AI, visuals, backend, and guidance in one home
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}