"use client";

import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  CalendarCheck2,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  FilePenLine,
  FileText,
  History,
  ImageIcon,
  Inbox,
  Loader2,
  Mail,
  Palette,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  UserCheck,
  UsersRound,
  WandSparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  BrandMark,
  Card,
  Pill,
  SliceBackground,
  SoftCard,
  cx,
  type SliceTone,
} from "@/components/slice-ui";
import {
  EMAIL_PORTFOLIO_BANDS,
  type EmailArchivePayload,
  type EmailBrandingPreference,
  type EmailCenterPayload,
  type EmailDraftDetail,
  type EmailDraftProgressPayload,
  type EmailDraftSummary,
  type EmailGenerationSpeed,
  type EmailPortfolioBand,
} from "@/lib/email-center/contracts";

type Stage = "prompt" | "drafts" | "approval" | "archive";
type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";
type Notice = { tone: "success" | "error" | "info"; text: string } | null;

type Payload = EmailCenterPayload & {
  aiRuntime?: {
    configured?: boolean;
    model?: string;
    fastModel?: string;
    qualityModel?: string;
  };
};

const COMPLETE_PROMPT_EXAMPLES = [
  {
    title: "Market update",
    text:
      "Write a calm, concise client email about current market volatility. Explain what we are monitoring, connect the update to the client’s long-term plan, avoid unsupported predictions, and end with an invitation to schedule a review.",
  },
  {
    title: "Portfolio review",
    text:
      "Invite the selected client to a portfolio and planning review. Explain why the meeting is useful, mention that we will review goals, risk, liquidity, and holdings, and make the next step obvious without sounding promotional.",
  },
  {
    title: "Holding development",
    text:
      "Draft an advisor-reviewed update about a material development affecting one or more client holdings. Use measured language, explain what is known and unknown, place it in portfolio context, and avoid guarantees or automatic recommendations.",
  },
  {
    title: "Planning reminder",
    text:
      "Create a polished planning reminder covering upcoming deadlines, documents the client should prepare, and the exact next action. Keep it warm, professional, and easy to scan.",
  },
] as const;

const DRAFT_FILTERS = [
  "All",
  "Generating",
  "Draft",
  "Edited",
  "Needs Advisor Approval",
  "Approved",
  "Archived",
] as const;

function dateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function initials(value: string | null | undefined) {
  return String(value ?? "Client")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join("");
}

function statusTone(value: string | null | undefined): SliceTone {
  const normalized = String(value ?? "").toLowerCase();

  if (
    normalized.includes("sent") ||
    normalized.includes("approved") ||
    normalized.includes("complete") ||
    normalized.includes("saved")
  ) {
    return "green";
  }

  if (
    normalized.includes("processing") ||
    normalized.includes("generating") ||
    normalized.includes("queued") ||
    normalized.includes("sending")
  ) {
    return "cyan";
  }

  if (
    normalized.includes("failed") ||
    normalized.includes("rejected") ||
    normalized.includes("cancelled") ||
    normalized.includes("superseded")
  ) {
    return "amber";
  }

  return "slate";
}

function safeHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#059669";
}

async function emailAction(
  body: Record<string, unknown>,
  sensitiveAction?: string,
) {
  const response = await fetch("/api/client-emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sensitiveAction
        ? { "x-slice-sensitive-action": sensitiveAction }
        : {}),
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "The email action could not be completed.",
    );
  }

  return result;
}

function immediateDraftFrom(value: unknown): EmailDraftDetail | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<EmailDraftDetail>;

  return typeof draft.id === "string" &&
    typeof draft.subject === "string" &&
    typeof draft.body === "string" &&
    Array.isArray(draft.versions)
    ? (draft as EmailDraftDetail)
    : null;
}

function immediateDraftSummaries(value: unknown): EmailDraftSummary[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is EmailDraftSummary => {
    if (!item || typeof item !== "object") return false;
    const draft = item as Partial<EmailDraftSummary>;
    return typeof draft.id === "string" && typeof draft.subject === "string";
  });
}

function mergeDraftSummaries(
  current: EmailDraftSummary[],
  incoming: EmailDraftSummary[],
) {
  const byId = new Map(current.map((draft) => [draft.id, draft]));
  for (const draft of incoming) byId.set(draft.id, draft);

  return Array.from(byId.values()).sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function generationIsActive(
  draft: Pick<EmailDraftSummary, "generation" | "status"> | null,
) {
  return Boolean(
    draft &&
      (["Queued", "Processing"].includes(draft.generation.status) ||
        draft.status === "Generating"),
  );
}

function draftEditable(draft: EmailDraftDetail | null) {
  return Boolean(draft?.editable && !generationIsActive(draft));
}

function generationNeedsRetry(
  draft: Pick<EmailDraftSummary, "generation" | "status" | "origin"> | null,
) {
  return Boolean(
    draft &&
      draft.origin === "AI" &&
      draft.generation.mode === "Generate" &&
      draft.generation.status !== "Completed" &&
      !generationIsActive(draft),
  );
}

function portfolioMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Value unavailable";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function promptSymbols(prompt: string, available: string[]) {
  const known = new Set(available.map((value) => value.toUpperCase()));
  const matches = prompt
    .toUpperCase()
    .match(/\b[A-Z][A-Z0-9.:-]{0,9}\b/g) ?? [];

  return Array.from(new Set(matches.filter((value) => known.has(value)))).slice(0, 12);
}

function jobProgressForDraft(
  draft: EmailDraftSummary | EmailDraftDetail | null,
  jobs: EmailCenterPayload["jobs"],
) {
  const job = draft?.generation.jobId
    ? jobs.find((candidate) => candidate.id === draft.generation.jobId) ?? null
    : null;
  const terminal = Boolean(
    draft && ["Completed", "Completed With Fallback", "Failed"].includes(draft.generation.status),
  );

  return {
    job,
    value: terminal
      ? 100
      : Math.max(
          3,
          Math.min(99, Number(job?.progress.value ?? (draft?.generation.status === "Processing" ? 12 : 4))),
        ),
    message:
      job?.progress.message ||
      (draft?.generation.status === "Queued"
        ? "Queued for custom AI"
        : draft?.generation.status === "Processing"
          ? "Building the final subject and message"
          : draft?.generation.status === "Completed"
            ? "Custom AI email complete"
            : draft?.generation.status === "Completed With Fallback"
              ? "Legacy fallback detected — retry Custom AI"
              : draft?.generation.status === "Failed"
                ? "Custom AI failed — retry required"
                : "Ready"),
  };
}

function Surface({
  children,
  className,
  accent = "green",
}: {
  children: ReactNode;
  className?: string;
  accent?: "green" | "cyan" | "purple" | "amber" | "red";
}) {
  const wash: Record<typeof accent, string> = {
    green: "from-emerald-400/[0.13]",
    cyan: "from-cyan-400/[0.10]",
    purple: "from-violet-400/[0.09]",
    amber: "from-amber-400/[0.09]",
    red: "from-rose-400/[0.08]",
  };

  return (
    <Card
      className={cx(
        "relative overflow-hidden !border-[var(--slice-border)] !bg-[var(--slice-surface)] text-[var(--slice-text)] shadow-[0_24px_78px_var(--slice-shadow)]",
        className,
      )}
    >
      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b to-transparent",
          wash[accent],
        )}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(color-mix(in_srgb,var(--slice-accent)_3%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--slice-accent)_3%,transparent)_1px,transparent_1px)] bg-[size:34px_34px] opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
      <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-[var(--slice-accent-soft)] blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/45 to-transparent" />
      <div className="relative h-full min-h-0">{children}</div>
    </Card>
  );
}

function Button({
  children,
  onClick,
  disabled,
  loading,
  variant = "primary",
  className,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  type?: "button" | "submit";
}) {
  const styles = {
    primary:
      "border-[var(--slice-accent-border)] bg-[linear-gradient(110deg,var(--slice-accent),var(--slice-accent-strong))] text-white shadow-[0_12px_30px_var(--slice-accent-glow)] hover:brightness-105",
    secondary:
      "border-[var(--slice-green-border)] bg-[var(--slice-green-bg)] text-[var(--slice-green-text)] hover:brightness-98",
    ghost:
      "border-[var(--slice-border)] bg-[var(--slice-surface-strong)] text-[var(--slice-text)] shadow-sm hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)]",
    danger:
      "border-[var(--slice-rose-border)] bg-[var(--slice-rose-bg)] text-[var(--slice-rose-text)] hover:brightness-98",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black transition focus:outline-none focus:ring-2 focus:ring-[var(--slice-accent-border)] disabled:cursor-not-allowed disabled:opacity-45",
        styles[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--slice-muted)]">
        {label}
      </span>
      <div className="mt-2">{children}</div>
      {helper ? (
        <span className="mt-2 block text-[10px] font-semibold leading-4 text-[var(--slice-subtle)]">
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  helper,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  helper?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cx(
        "flex w-full items-center justify-between gap-4 rounded-xl border p-3 text-left transition",
        checked
          ? "border-[var(--slice-green-border)] bg-[var(--slice-green-bg)]"
          : "border-[var(--slice-border)] bg-[var(--slice-surface-muted)] hover:border-[var(--slice-accent-border)] hover:bg-white",
      )}
    >
      <span>
        <span className="block text-xs font-black text-[var(--slice-heading)]">{label}</span>
        {helper ? (
          <span className="mt-1 block text-[10px] font-semibold leading-4 text-[var(--slice-muted)]">
            {helper}
          </span>
        ) : null}
      </span>
      <span
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-full border transition",
          checked
            ? "border-emerald-500/30 bg-emerald-500/25"
            : "border-[var(--slice-border)] bg-white",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md ring-1 ring-emerald-950/10 transition",
            checked ? "left-5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function StageButton({
  number,
  label,
  helper,
  active,
  complete,
  onClick,
}: {
  number: number;
  label: string;
  helper: string;
  active: boolean;
  complete: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition",
        active
          ? "border-[var(--slice-accent-border)] bg-[linear-gradient(135deg,var(--slice-accent-soft),rgba(255,255,255,.92))] shadow-[0_10px_28px_var(--slice-shadow)]"
          : "border-[var(--slice-border)] bg-[var(--slice-surface)] hover:border-[var(--slice-accent-border)] hover:bg-white",
      )}
    >
      <span
        className={cx(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-[11px] font-black",
          complete
            ? "border-[var(--slice-green-border)] bg-[var(--slice-green-bg)] text-[var(--slice-green-text)]"
            : active
              ? "border-[var(--slice-accent-border)] bg-[linear-gradient(145deg,var(--slice-accent),var(--slice-accent-strong))] text-white"
              : "border-[var(--slice-border)] bg-[var(--slice-surface-muted)] text-[var(--slice-muted)]",
        )}
      >
        {complete ? <Check className="h-4 w-4" /> : number}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-black text-[var(--slice-heading)]">{label}</span>
        <span className="mt-0.5 hidden truncate text-[9px] font-semibold text-[var(--slice-muted)] xl:block">
          {helper}
        </span>
      </span>
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[var(--slice-subtle)] transition group-hover:text-[var(--slice-accent)]" />
    </button>
  );
}

function DraftGenerationProgress({
  draft,
  jobs,
  compact = false,
}: {
  draft: EmailDraftSummary | EmailDraftDetail;
  jobs: EmailCenterPayload["jobs"];
  compact?: boolean;
}) {
  const progress = jobProgressForDraft(draft, jobs);
  const active = generationIsActive(draft);

  if (!active && !["Failed", "Completed With Fallback"].includes(draft.generation.status)) {
    return null;
  }

  return (
    <div
      className={cx(
        "overflow-hidden rounded-xl border",
        active
          ? "border-emerald-300/18 bg-[linear-gradient(135deg,rgba(16,185,129,.12),rgba(255,255,255,.82))]"
          : draft.generation.status === "Failed"
            ? "border-amber-300/18 bg-[var(--slice-amber-bg)]"
            : "border-cyan-300/16 bg-[var(--slice-cyan-bg)]",
        compact ? "mt-2 p-2" : "p-3",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          {active ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--slice-accent)]" />
          ) : draft.generation.status === "Failed" ? (
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          ) : (
            <Check className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
          )}
          <span
            className={cx(
              "truncate font-black",
              compact ? "text-[9px]" : "text-xs",
              active ? "text-[var(--slice-green-text)]" : "text-[var(--slice-heading)]",
            )}
          >
            {progress.message}
          </span>
        </span>
        <span
          className={cx(
            "shrink-0 font-black tabular-nums",
            compact ? "text-[9px]" : "text-xs",
            active ? "text-[var(--slice-green-text)]" : "text-[var(--slice-muted)]",
          )}
        >
          {Math.round(progress.value)}%
        </span>
      </div>
      <div
        className={cx(
          "overflow-hidden rounded-full bg-[var(--slice-slate-bg)]",
          compact ? "mt-1.5 h-1.5" : "mt-2 h-2",
        )}
      >
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#064e3b,#10b981,#67e8f9)] shadow-[0_0_18px_rgba(16,185,129,.32)] transition-[width] duration-500 ease-out"
          style={{ width: `${progress.value}%` }}
        />
      </div>
      {!compact && active ? (
        <div className="mt-2 flex items-center justify-between text-[9px] font-bold text-[var(--slice-subtle)]">
          <span>Interpret</span>
          <span>Compose</span>
          <span>Verify</span>
          <span>Ready</span>
        </div>
      ) : null}
    </div>
  );
}

function EmailPreview({
  draft,
  branding,
}: {
  draft: EmailDraftDetail | null;
  branding: EmailBrandingPreference;
}) {
  const activeBranding = draft?.branding ?? branding;
  const accent = safeHex(activeBranding.accentColor);
  const paragraphs = String(draft?.body ?? "")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div data-slice-color-lock="true" className="overflow-hidden rounded-[1.75rem] border border-emerald-900/10 bg-[#edf7f1] p-3 shadow-[0_24px_70px_rgba(12,74,50,.16)] sm:p-5">
      <article className="mx-auto max-w-[760px] overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
        <header className="bg-[#042f2b]">
          <div className="flex min-h-[88px] items-center justify-between gap-4 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              {activeBranding.showSliceBrand ? (
                <>
                  <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white">
                    <div
                      className="absolute -left-2 top-[17px] h-2 w-14 -rotate-[28deg]"
                      style={{ backgroundColor: accent }}
                    />
                    <div
                      className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                  </div>
                  <div>
                    <div className="text-lg font-black tracking-wide text-white">SLICE</div>
                    <div className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-200">
                      Advisor communication
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm font-black text-white">{activeBranding.firmName}</div>
              )}
            </div>

            {activeBranding.firmLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeBranding.firmLogoUrl}
                alt={`${activeBranding.firmName} logo`}
                className="max-h-12 max-w-[170px] object-contain"
              />
            ) : (
              <div className="max-w-[180px] text-right text-xs font-black leading-5 text-white">
                {activeBranding.firmName}
              </div>
            )}
          </div>
          <div className="h-1" style={{ backgroundColor: accent }} />
        </header>

        <div className="px-5 pb-3 pt-7 sm:px-8">
          <p
            className="text-[9px] font-black uppercase tracking-[0.18em]"
            style={{ color: accent }}
          >
            Prepared for {draft?.clientName || "Selected client"}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {draft?.subject || "Your advisor email subject appears here"}
          </h2>
        </div>

        <div className="px-5 py-5 sm:px-8">
          {paragraphs.length ? (
            <div className="space-y-4 text-[15px] font-medium leading-7 text-slate-700">
              {paragraphs.map((paragraph, index) => (
                <p key={`${paragraph.slice(0, 20)}-${index}`} className="whitespace-pre-wrap">
                  {paragraph}
                </p>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center text-sm font-semibold text-slate-400">
              The client-facing draft appears here as soon as it is created.
            </div>
          )}

          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-sm font-medium text-slate-600">
              {activeBranding.signature.signOff}
            </p>
            <p className="mt-1 text-lg font-black text-slate-950">
              {activeBranding.signature.name}
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
              {[
                activeBranding.signature.title,
                activeBranding.signature.company,
                activeBranding.signature.phone,
                activeBranding.signature.email,
                activeBranding.signature.website.replace(/^https:\/\//i, "").replace(/\/$/, ""),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        <footer className="border-t border-slate-200 bg-[#f7faf8] px-5 py-5 sm:px-8">
          <p className="text-[10px] font-medium leading-5 text-slate-500">
            {activeBranding.disclosure}
          </p>
          <p className="mt-2 text-[9px] font-semibold text-slate-400">
            Prepared and reviewed through Slice.
          </p>
        </footer>
      </article>
    </div>
  );
}

function Modal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", keydown);
    window.setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keydown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2147483640] grid place-items-center overflow-y-auto bg-[var(--slice-overlay)] p-4 backdrop-blur-md">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close dialog" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-3xl rounded-[1.8rem] border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-5 shadow-[0_40px_120px_var(--slice-shadow)] outline-none sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-[var(--slice-heading)]">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--slice-muted)]">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:text-[var(--slice-heading)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export default function ClientEmailCenterPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [stage, setStage] = useState<Stage>("prompt");
  const [activeDraftId, setActiveDraftId] = useState("");
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [holdingFilter, setHoldingFilter] = useState("All");
  const [portfolioBandFilter, setPortfolioBandFilter] = useState<
    EmailPortfolioBand | "All"
  >("All");
  const [recipientSort, setRecipientSort] = useState<
    "relevance" | "portfolio" | "name"
  >("relevance");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [completePrompt, setCompletePrompt] = useState<string>(COMPLETE_PROMPT_EXAMPLES[0].text);
  const [speedMode, setSpeedMode] = useState<EmailGenerationSpeed>("Quick");
  const [tone, setTone] = useState("Professional, calm, concise, and reassuring");
  const [useResearch, setUseResearch] = useState(false);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftFilter, setDraftFilter] = useState<(typeof DRAFT_FILTERS)[number]>("All");
  const [editor, setEditor] = useState({ subject: "", body: "", tone: "Professional" });
  const [branding, setBranding] = useState<EmailBrandingPreference | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [approvalNote, setApprovalNote] = useState(
    "Reviewed and approved by the advisor for the confirmed recipient and current draft revision.",
  );
  const [recipientConfirmed, setRecipientConfirmed] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [selectedApprovalId, setSelectedApprovalId] = useState("");
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [archive, setArchive] = useState<EmailArchivePayload | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [selectedArchiveId, setSelectedArchiveId] = useState("");

  const savedRef = useRef({
    id: "",
    revision: 0,
    subject: "",
    body: "",
    tone: "",
    branding: "",
  });
  const saveTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(
    async (draftId?: string, silent = false) => {
      if (!silent) setLoading(true);

      try {
        const requested = draftId || activeDraftId;
        const response = await fetch(
          `/api/client-emails${requested ? `?draftId=${encodeURIComponent(requested)}` : ""}`,
          { cache: "no-store" },
        );
        const data = (await response.json().catch(() => ({}))) as Payload & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Unable to load the Email Center.");
        }

        if (!mountedRef.current) return;

        setPayload(data);
        setBranding((current) => current ?? data.activeDraft?.branding ?? data.branding);
        const nextId = data.activeDraft?.id || requested || data.drafts[0]?.id || "";
        setActiveDraftId(nextId);

        if (data.activeDraft) {
          const nextEditor = {
            subject: data.activeDraft.subject,
            body: data.activeDraft.body,
            tone: data.activeDraft.tone,
          };
          setEditor(nextEditor);
          setBranding(data.activeDraft.branding);
          savedRef.current = {
            id: data.activeDraft.id,
            revision: data.activeDraft.revision,
            ...nextEditor,
            branding: JSON.stringify(data.activeDraft.branding),
          };
          setSaveState("idle");
        }

        setSelectedApprovalId((current) =>
          current && data.approvals.some((approval) => approval.id === current)
            ? current
            : data.approvals.find((approval) => approval.status === "Pending")?.id ||
              data.approvals[0]?.id ||
              "",
        );

        setSelectedDraftIds((current) =>
          current.filter((id) => data.drafts.some((draft) => draft.id === id && draft.deletable)),
        );
      } catch (error) {
        if (!silent) {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Unable to load the Email Center.",
          });
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activeDraftId],
  );


  const loadArchive = useCallback(
    async (options: {
      deliveryId?: string;
      silent?: boolean;
      append?: boolean;
      preserveItems?: boolean;
      cursor?: string | null;
    } = {}) => {
      const {
        deliveryId,
        silent = false,
        append = false,
        preserveItems = false,
        cursor = null,
      } = options;

      if (!silent) setArchiveLoading(true);

      try {
        const requested = deliveryId || (!append ? selectedArchiveId : "");
        const params = new URLSearchParams({
          view: "archive",
          limit: "40",
        });
        if (requested) params.set("deliveryId", requested);
        if (cursor) params.set("cursor", cursor);

        const response = await fetch(
          `/api/client-emails?${params.toString()}`,
          { cache: "no-store" },
        );
        const data = (await response.json().catch(() => ({}))) as EmailArchivePayload & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Unable to load sent-email history.");
        }

        if (!mountedRef.current) return;

        setArchive((current) => {
          if (!current || (!append && !preserveItems)) return data;

          if (append) {
            const items = Array.from(
              new Map(
                [...current.items, ...data.items].map((item) => [item.deliveryId, item]),
              ).values(),
            );

            return {
              ...data,
              items,
              activeItem: current.activeItem ?? data.activeItem,
            };
          }

          return {
            ...data,
            items: current.items,
            pagination: current.pagination,
          };
        });

        if (!append) {
          setSelectedArchiveId(
            data.activeItem?.deliveryId || requested || data.items[0]?.deliveryId || "",
          );
        }
      } catch (error) {
        if (!silent) {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Unable to load sent-email history.",
          });
        }
      } finally {
        if (!silent) setArchiveLoading(false);
      }
    },
    [selectedArchiveId],
  );


  const pollDraftProgress = useCallback(
    async (draftId: string) => {
      if (!draftId) return null;

      const response = await fetch(
        `/api/client-emails?view=progress&draftId=${encodeURIComponent(draftId)}`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => ({}))) as
        | EmailDraftProgressPayload
        | { error?: string };

      if (!response.ok || !("draft" in data)) {
        throw new Error(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Unable to read custom AI drafting progress.",
        );
      }

      if (!mountedRef.current) return data;

      setPayload((current) => {
        if (!current) return current;

        const summary: EmailDraftSummary = data.draft;
        const drafts = current.drafts.map((draft) =>
          draft.id === summary.id ? summary : draft,
        );
        const jobs = data.job
          ? [
              data.job,
              ...current.jobs.filter((job) => job.id !== data.job?.id),
            ]
          : current.jobs;

        return {
          ...current,
          drafts,
          activeDraft:
            current.activeDraft?.id === data.draft.id
              ? data.draft
              : current.activeDraft,
          jobs,
          metrics: {
            ...current.metrics,
            generatingCount: drafts.filter((draft) => generationIsActive(draft)).length,
          },
        };
      });

      if (savedRef.current.id === data.draft.id && !data.locked) {
        setEditor({
          subject: data.draft.subject,
          body: data.draft.body,
          tone: data.draft.tone,
        });
        setBranding(data.draft.branding);
        savedRef.current = {
          id: data.draft.id,
          revision: data.draft.revision,
          subject: data.draft.subject,
          body: data.draft.body,
          tone: data.draft.tone,
          branding: JSON.stringify(data.draft.branding),
        };
        setSaveState("idle");
        setNotice({
          tone: data.progress.status === "Failed" ? "info" : "success",
          text:
            data.progress.status === "Failed"
              ? `${data.draft.clientName || "The client"} email was not completed by Custom AI. Retry generation before editing or approval.`
              : `${data.draft.clientName || "The client"} email is complete and ready for advisor editing.`,
        });
      }

      return data;
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    void load();

    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    if (stage === "archive" && !archive && !archiveLoading) {
      void loadArchive({});
    }
  }, [archive, archiveLoading, loadArchive, stage]);

  const activeJobs = payload?.jobs.filter((job) =>
    ["Queued", "Retrying", "Processing"].includes(job.status),
  );
  const generatingDraftCount =
    payload?.drafts.filter((draft) => generationIsActive(draft)).length ?? 0;

  const activeDraft = payload?.activeDraft ?? null;
  const activeGenerationDraftId =
    activeDraft && generationIsActive(activeDraft) ? activeDraft.id : "";

  useEffect(() => {
    if (!activeGenerationDraftId) return;

    let stopped = false;
    const tick = async () => {
      try {
        const result = await pollDraftProgress(activeGenerationDraftId);
        if (
          !stopped &&
          result &&
          !["Completed", "Completed With Fallback", "Failed"].includes(
            result.progress.status,
          )
        ) {
          window.setTimeout(() => void tick(), 1_250);
        }
      } catch {
        if (!stopped) window.setTimeout(() => void tick(), 2_500);
      }
    };

    void tick();
    return () => {
      stopped = true;
    };
  }, [activeGenerationDraftId, pollDraftProgress]);

  useEffect(() => {
    if (!activeJobs?.length && generatingDraftCount === 0) return;

    /*
     * Keep the entire draft rail synchronized while independent recipient
     * jobs complete. The selected draft still uses the lightweight 1.25 s
     * progress endpoint; this slower refresh updates every other recipient.
     */
    const timer = window.setInterval(
      () => void load(activeDraftId, true),
      4_000,
    );

    return () => window.clearInterval(timer);
  }, [activeDraftId, activeJobs?.length, generatingDraftCount, load]);
  const activeBranding = branding ?? activeDraft?.branding ?? payload?.branding ?? null;
  const clients = payload?.clients ?? [];
  const drafts = payload?.drafts ?? [];
  const approvals = payload?.approvals ?? [];
  const deliveries = payload?.deliveries ?? [];
  const archiveItems = archive?.items ?? [];
  const activeArchiveItem = archive?.activeItem ?? null;

  const allHoldingSymbols = useMemo(
    () =>
      Array.from(
        new Set(clients.flatMap((client) => client.holdingSymbols)),
      ).sort((left, right) => left.localeCompare(right)),
    [clients],
  );

  const matchedPromptSymbols = useMemo(
    () => promptSymbols(completePrompt, allHoldingSymbols),
    [allHoldingSymbols, completePrompt],
  );

  const visibleClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    const filtered = clients.filter((client) => {
      const queryMatch =
        !query ||
        [
          client.fullName,
          client.householdName,
          client.email,
          client.portfolioValueLabel,
          client.portfolioBand,
          ...client.holdingSymbols,
          ...client.holdings.flatMap((holding) => [holding.symbol, holding.assetName]),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const holdingMatch =
        holdingFilter === "All" || client.holdingSymbols.includes(holdingFilter);
      const portfolioMatch =
        portfolioBandFilter === "All" || client.portfolioBand === portfolioBandFilter;

      return queryMatch && holdingMatch && portfolioMatch;
    });

    return [...filtered].sort((left, right) => {
      if (recipientSort === "name") {
        return left.fullName.localeCompare(right.fullName);
      }

      if (recipientSort === "portfolio") {
        return (right.portfolioValueNumber ?? -1) - (left.portfolioValueNumber ?? -1) ||
          left.fullName.localeCompare(right.fullName);
      }

      const leftMatches = matchedPromptSymbols.filter((symbol) =>
        left.holdingSymbols.includes(symbol),
      ).length;
      const rightMatches = matchedPromptSymbols.filter((symbol) =>
        right.holdingSymbols.includes(symbol),
      ).length;

      return (
        rightMatches - leftMatches ||
        (right.portfolioValueNumber ?? -1) - (left.portfolioValueNumber ?? -1) ||
        left.fullName.localeCompare(right.fullName)
      );
    });
  }, [
    clientSearch,
    clients,
    holdingFilter,
    matchedPromptSymbols,
    portfolioBandFilter,
    recipientSort,
  ]);

  const visibleDrafts = useMemo(() => {
    const query = draftSearch.trim().toLowerCase();
    return drafts.filter((draft) => {
      const statusMatch = draftFilter === "All" || draft.status === draftFilter;
      const queryMatch =
        !query ||
        [draft.clientName, draft.recipientEmail, draft.subject, draft.bodyPreview]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return statusMatch && queryMatch;
    });
  }, [draftFilter, draftSearch, drafts]);


  const visibleArchiveItems = useMemo(() => {
    const query = archiveSearch.trim().toLowerCase();
    if (!query) return archiveItems;

    return archiveItems.filter((item) =>
      [
        item.subject,
        item.ownerName,
        item.provider,
        item.status,
        item.bodyPreview,
        ...item.recipients.flatMap((recipient) => [
          recipient.clientName,
          recipient.email,
        ]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [archiveItems, archiveSearch]);

  const deletableVisibleIds = visibleDrafts.filter((draft) => draft.deletable).map((draft) => draft.id);
  const selectedApproval = approvals.find((approval) => approval.id === selectedApprovalId) ?? null;
  const approvalDrafts = selectedApproval
    ? drafts.filter((draft) => selectedApproval.draftIds.includes(draft.id))
    : [];

  const promptComplete = Boolean(selectedClientIds.length && completePrompt.trim());
  const draftComplete = Boolean(
    activeDraft &&
      !generationIsActive(activeDraft) &&
      activeDraft.subject.trim() &&
      activeDraft.body.trim(),
  );
  const approvalComplete = Boolean(activeDraft?.approval.status === "Approved");
  const archiveComplete = Boolean(payload?.metrics.archiveCount || archive?.metrics.totalSent);

  useEffect(() => {
    if (!activeDraft || !activeBranding || !draftEditable(activeDraft)) return;

    const nextBranding = JSON.stringify(activeBranding);
    const saved = savedRef.current;
    const changed =
      saved.id === activeDraft.id &&
      (saved.subject !== editor.subject ||
        saved.body !== editor.body ||
        saved.tone !== editor.tone ||
        saved.branding !== nextBranding);

    if (!changed) return;

    setSaveState("unsaved");
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void saveDraft();
    }, 900);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [activeBranding, activeDraft, editor.body, editor.subject, editor.tone]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveDraft(brandingOverride?: EmailBrandingPreference) {
    const brandingToSave = brandingOverride ?? activeBranding;
    if (!activeDraft || !brandingToSave || !draftEditable(activeDraft)) return;

    setSaveState("saving");
    try {
      await emailAction({
        action: "updateDraft",
        draftId: activeDraft.id,
        subject: editor.subject,
        body: editor.body,
        tone: editor.tone,
        branding: brandingToSave,
        expectedRevision: savedRef.current.revision,
      });
      await load(activeDraft.id, true);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1_500);
    } catch (error) {
      setSaveState("error");
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "The draft could not be saved.",
      });
    }
  }

  async function createAiDrafts() {
    if (!promptComplete) return;
    setBusy("generate");
    setNotice(null);

    try {
      const result = await emailAction({
        action: "createAiDrafts",
        clientIds: selectedClientIds,
        prompt: completePrompt,
        tone,
        useResearch: speedMode === "Researched" && useResearch,
        speedMode,
        optionCount: speedMode === "Quick" ? 1 : 2,
      });
      const immediate = immediateDraftFrom(result.activeDraft);
      const createdDrafts = immediateDraftSummaries(result.createdDrafts);
      const nextId =
        immediate?.id ||
        (typeof result.activeDraftId === "string" ? result.activeDraftId : "");

      if (immediate) {
        setPayload((current) =>
          current
            ? {
                ...current,
                drafts: mergeDraftSummaries(current.drafts, createdDrafts),
                activeDraft: immediate,
                metrics: {
                  ...current.metrics,
                  draftCount: Math.max(
                    current.metrics.draftCount,
                    mergeDraftSummaries(current.drafts, createdDrafts).filter(
                      (draft) => draft.status !== "Archived",
                    ).length,
                  ),
                },
              }
            : current,
        );
        setActiveDraftId(immediate.id);
        setEditor({
          subject: immediate.subject,
          body: immediate.body,
          tone: immediate.tone,
        });
        setBranding(immediate.branding);
        savedRef.current = {
          id: immediate.id,
          revision: immediate.revision,
          subject: immediate.subject,
          body: immediate.body,
          tone: immediate.tone,
          branding: JSON.stringify(immediate.branding),
        };
        setSaveState("idle");
        setStage("drafts");
        void pollDraftProgress(immediate.id);
      } else {
        await load(nextId, false);
        setStage("drafts");
      }

      setNotice({
        tone: "success",
        text:
          typeof result.message === "string"
            ? result.message
            : "Custom AI is completing the selected email. The editor will unlock automatically when it is ready.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "AI drafting failed.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function createBlankDraft() {
    setBusy("manual");
    try {
      const result = await emailAction({
        action: "createManualDrafts",
        clientIds: selectedClientIds.slice(0, 1),
        subject: "A message from your advisory team",
        body: "Hello,\n\nWrite your advisor-reviewed message here.\n\nWarm regards,",
        tone,
        allowScratch: selectedClientIds.length === 0,
      });
      const nextId =
        typeof result.activeDraftId === "string"
          ? result.activeDraftId
          : "";
      await load(nextId, false);
      setStage("drafts");
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Blank draft creation failed.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function chooseDraft(draftId: string) {
    if (saveState === "unsaved" || saveState === "saving") await saveDraft();
    setActiveDraftId(draftId);
    setRecipientConfirmed(false);
    await load(draftId, false);
  }

  async function polishDraft() {
    if (!activeDraft) return;
    setBusy("polish");
    try {
      await emailAction({
        action: "polishDraft",
        draftId: activeDraft.id,
        polishMode: "Improve clarity, warmth, structure, and client readability while preserving the advisor's facts and intent.",
        advisorInstructions: "Do not add unsupported financial claims, predictions, or recommendations.",
        optionCount: 1,
        speedMode: "Quick",
      });
      await load(activeDraft.id, false);
      setNotice({ tone: "success", text: "Quick polish queued. The editor is temporarily locked and will reopen when the polished version is ready." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Polish failed." });
    } finally {
      setBusy(null);
    }
  }

  async function selectVersion(versionId: string) {
    if (!activeDraft) return;
    setBusy(`version:${versionId}`);
    try {
      await emailAction({
        action: "selectVersion",
        draftId: activeDraft.id,
        versionId,
        expectedRevision: activeDraft.revision,
      });
      await load(activeDraft.id, false);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Version selection failed." });
    } finally {
      setBusy(null);
    }
  }

  async function requestApproval() {
    if (!activeDraft) return;
    if (saveState === "unsaved" || saveState === "saving") await saveDraft();
    setBusy("approval-request");

    try {
      const result = await emailAction({
        action: "requestApproval",
        draftIds: [activeDraft.id],
        approvalTitle: `Approve email to ${activeDraft.clientName || "client"}`,
      });
      const approvalId = typeof result.approvalId === "string" ? result.approvalId : "";
      await load(activeDraft.id, false);
      setSelectedApprovalId(approvalId);
      setStage("approval");
      setNotice({ tone: "success", text: "The exact current draft and recipient are ready for advisor approval." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Approval request failed." });
    } finally {
      setBusy(null);
    }
  }

  async function approveOnly() {
    if (!selectedApproval) return;
    setBusy("approve");
    try {
      await emailAction(
        {
          action: "decideApproval",
          approvalId: selectedApproval.id,
          decision: "approve",
          notes: approvalNote,
        },
        "email-approval",
      );
      await load(activeDraftId, false);
      setNotice({ tone: "success", text: "Advisor approval recorded for the current revision and recipient." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Approval failed." });
    } finally {
      setBusy(null);
    }
  }

  async function approveAndSend() {
    if (!selectedApproval || !recipientConfirmed) return;
    setBusy("approve-send");
    try {
      await emailAction(
        {
          action: "approveAndSend",
          approvalId: selectedApproval.id,
          approvalNotes: approvalNote,
        },
        "email-send",
      );
      await load(activeDraftId, false);
      setNotice({ tone: "success", text: "The approved email has entered the durable delivery queue." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Approve and send failed." });
    } finally {
      setBusy(null);
    }
  }

  async function scheduleApprovedDrafts() {
    if (!selectedApproval || !scheduleAt || !recipientConfirmed) return;
    setBusy("schedule");
    try {
      await emailAction(
        {
          action: "scheduleDrafts",
          draftIds: selectedApproval.draftIds,
          scheduledAt: new Date(scheduleAt).toISOString(),
          confirmRecipients: true,
        },
        "email-schedule",
      );
      await load(activeDraftId, false);
      setNotice({ tone: "success", text: "The approved email has been scheduled." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Scheduling failed." });
    } finally {
      setBusy(null);
    }
  }

  async function saveBranding() {
    if (!activeBranding) return;
    setBusy("branding");
    try {
      const result = await emailAction({
        action: "saveBranding",
        branding: activeBranding,
      });
      const stored = result.branding as EmailBrandingPreference | undefined;
      if (stored) setBranding(stored);
      if (activeDraft && draftEditable(activeDraft)) {
        await saveDraft(stored ?? activeBranding);
      }
      setBrandingOpen(false);
      setNotice({ tone: "success", text: "Email branding and signature saved as the advisor default." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Branding could not be saved." });
    } finally {
      setBusy(null);
    }
  }

  async function deleteDrafts() {
    const ids = selectedDraftIds.length
      ? selectedDraftIds
      : activeDraft?.deletable
        ? [activeDraft.id]
        : [];
    if (!ids.length) return;
    setBusy("delete");

    try {
      await emailAction(
        { action: "deleteDrafts", draftIds: ids },
        "email-delete-draft",
      );
      setSelectedDraftIds([]);
      setDeleteOpen(false);
      const remaining = drafts.filter((draft) => !ids.includes(draft.id));
      const nextId = remaining[0]?.id || "";
      await load(nextId, false);
      setNotice({ tone: "success", text: `${ids.length} draft${ids.length === 1 ? "" : "s"} permanently deleted.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Draft deletion failed." });
    } finally {
      setBusy(null);
    }
  }

  async function archiveActive() {
    if (!activeDraft) return;
    setBusy("archive");
    try {
      await emailAction({ action: "archiveDrafts", draftIds: [activeDraft.id] });
      await load("", false);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Archive failed." });
    } finally {
      setBusy(null);
    }
  }

  async function cancelDelivery(deliveryId: string) {
    setBusy(`cancel:${deliveryId}`);
    try {
      await emailAction({ action: "cancelDelivery", deliveryId }, "email-cancel");
      await load(activeDraftId, false);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Cancellation failed." });
    } finally {
      setBusy(null);
    }
  }

  async function retryCustomAi() {
    if (!activeDraft) return;

    setBusy("retry-ai");
    setNotice(null);

    try {
      await emailAction({
        action: "retryAiGeneration",
        draftId: activeDraft.id,
      });
      await load(activeDraft.id, false);
      setNotice({
        tone: "info",
        text: "The original prompt was requeued for a real custom AI subject and email body.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Custom AI generation could not be retried.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function retryDelivery(deliveryId: string) {
    setBusy(`retry:${deliveryId}`);
    try {
      await emailAction({ action: "retryDelivery", deliveryId }, "email-retry");
      await load(activeDraftId, false);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Retry failed." });
    } finally {
      setBusy(null);
    }
  }

  function toggleSelectedDraft(id: string) {
    setSelectedDraftIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }


  async function chooseArchiveItem(deliveryId: string) {
    setSelectedArchiveId(deliveryId);
    await loadArchive({ deliveryId, preserveItems: true });
  }

  function openArchivePrintView() {
    if (!activeArchiveItem?.html) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(activeArchiveItem.html);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  function copyPreview() {
    if (!activeDraft) return;
    void navigator.clipboard.writeText(`${activeDraft.subject}\n\n${activeDraft.body}`);
    setNotice({ tone: "success", text: "Draft copied to the clipboard." });
  }

  if (loading || !payload || !activeBranding) {
    return (
      <SliceBackground>
        <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl place-items-center p-5">
          <Surface className="w-full p-8">
            <div className="flex flex-col items-center text-center">
              <BrandMark label="Slice" subtitle="AI Email Center" />
              <Loader2 className="mt-8 h-7 w-7 animate-spin text-emerald-300" />
              <h1 className="mt-5 text-2xl font-black text-[var(--slice-heading)]">Loading the communication workspace</h1>
              <p className="mt-2 text-sm font-semibold text-[var(--slice-muted)]">
                Restoring recipients, drafts, approval state, branding, and delivery history.
              </p>
            </div>
          </Surface>
        </div>
      </SliceBackground>
    );
  }

  return (
    <SliceBackground>
      <main className="slice-email-center-light min-h-0 px-2.5 py-2.5 text-[var(--slice-text)] sm:px-4 sm:py-3 lg:h-[calc(100dvh-6.25rem)] lg:overflow-hidden">
        <style jsx global>{`
          .slice-email-center-light {
            --email-rail: clamp(270px, 18vw, 310px);
            --email-preview: clamp(320px, 24vw, 430px);
          }

          .slice-email-center-light :where(input, textarea, select) {
            border-color: var(--slice-border) !important;
            background: var(--slice-input) !important;
            color: var(--slice-heading) !important;
            box-shadow: 0 1px 0 rgba(255,255,255,.75) inset;
          }

          .slice-email-center-light :where(input, textarea)::placeholder {
            color: var(--slice-subtle) !important;
          }

          .slice-email-center-light :where([class*="border-white/"]):not([data-slice-color-lock], [data-slice-color-lock] *) {
            border-color: var(--slice-border) !important;
          }

          .slice-email-center-light :where([class*="bg-black"], [class*="bg-[#02"], [class*="bg-[#03"], [class*="bg-[#04"], [class*="bg-[#05"], [class*="bg-[#08"]):not([data-slice-color-lock], [data-slice-color-lock] *) {
            background-color: var(--slice-surface-muted) !important;
          }

          .slice-email-center-light :where([class*="text-white"]):not([data-slice-color-lock], [data-slice-color-lock] *, button[class*="from-emerald"], button[class*="bg-emerald"]) {
            color: var(--slice-heading) !important;
          }

          .slice-email-center-light :where([class*="text-slate-400"], [class*="text-slate-500"], [class*="text-slate-600"], [class*="text-slate-700"]):not([data-slice-color-lock], [data-slice-color-lock] *) {
            color: var(--slice-muted) !important;
          }

          .slice-email-center-light .email-scroll-region {
            min-height: 0;
            overflow: auto;
            overscroll-behavior: contain;
            scrollbar-gutter: stable;
          }

          .slice-email-center-light button[class*="from-emerald"],
          .slice-email-center-light button[class*="bg-emerald-6"],
          .slice-email-center-light button[class*="bg-emerald-7"] {
            color: white !important;
          }

          .slice-email-center-light [data-slice-color-lock],
          .slice-email-center-light [data-slice-color-lock] * {
            color-scheme: light;
          }

          @media (max-width: 1279px) {
            .slice-email-center-light {
              overflow: visible;
            }
          }
        `}</style>
        <div className="mx-auto flex min-h-0 max-w-[1920px] flex-col gap-2 lg:h-full">
          <header className="flex shrink-0 items-center justify-between gap-3 rounded-[1.35rem] border border-[var(--slice-border)] bg-[var(--slice-surface)] px-3 py-2.5 shadow-[0_14px_40px_var(--slice-shadow)] backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark label="Slice" subtitle="Advisor Email Center" />
              <div className="hidden h-8 w-px bg-[var(--slice-border)] xl:block" />
              <div className="hidden min-w-0 xl:block">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">
                  AI-assisted · advisor controlled
                </p>
                <p className="mt-1 truncate text-xs font-semibold text-[var(--slice-muted)]">
                  Prompt once, edit freely, approve the exact recipient and content.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <span className="hidden lg:inline-flex"><Pill tone={payload.aiRuntime?.configured ? "green" : "amber"}>
                <Bot className="h-3.5 w-3.5" />
                {payload.aiRuntime?.configured ? payload.aiRuntime.fastModel || "AI ready" : "AI setup required"}
              </Pill></span>
              <span className="hidden xl:inline-flex"><Pill tone="cyan">
                <ShieldCheck className="h-3.5 w-3.5" />
                Approval required
              </Pill></span>
              <Link
                href="/workspace"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 text-xs font-black text-[var(--slice-text)] shadow-sm hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Workspace</span>
              </Link>
            </div>
          </header>

          <nav className="grid shrink-0 grid-cols-2 gap-1.5 lg:grid-cols-4" aria-label="Email Center workflow">
            <StageButton number={1} label="AI Prompt" helper="Interpret the brief and assign clients" active={stage === "prompt"} complete={promptComplete} onClick={() => setStage("prompt")} />
            <StageButton number={2} label="Draft Studio" helper="Edit, compare, brand, and refine" active={stage === "drafts"} complete={draftComplete} onClick={() => setStage("drafts")} />
            <StageButton number={3} label="Approval & Send" helper="Verify recipients and delivery" active={stage === "approval"} complete={approvalComplete} onClick={() => setStage("approval")} />
            <StageButton number={4} label="Sent Archive" helper="Exact history, timing, and recipients" active={stage === "archive"} complete={archiveComplete} onClick={() => setStage("archive")} />
          </nav>

          {notice ? (
            <div
              role="status"
              className={cx(
                "fixed bottom-4 right-4 z-[100] flex max-w-[min(92vw,460px)] items-start justify-between gap-4 rounded-xl border px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur-xl",
                notice.tone === "success"
                  ? "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-100"
                  : notice.tone === "error"
                    ? "border-rose-400/20 bg-rose-500/[0.08] text-rose-100"
                    : "border-cyan-400/20 bg-cyan-500/[0.08] text-cyan-100",
              )}
            >
              <span>{notice.text}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 email-scroll-region overflow-y-auto overscroll-contain [scrollbar-gutter:stable] xl:overflow-hidden">
            {stage === "prompt" ? (
              <section className="grid min-h-full min-w-0 gap-2 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Surface className="min-h-0 email-scroll-region overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable] sm:p-4" accent="green">
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="flex shrink-0 items-start justify-between gap-3">
                      <div>
                        <Pill tone="green">
                          <Sparkles className="h-3.5 w-3.5" />
                          Complete Email Center prompt
                        </Pill>
                        <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                          One brief. A complete client-ready email.
                        </h1>
                        <p className="mt-1.5 max-w-3xl text-xs font-semibold leading-5 text-slate-500">
                          Choose recipients and describe the communication once. Slice builds each custom subject and complete email independently, shows live progress, and unlocks the editor only when that recipient’s draft is finished.
                        </p>
                      </div>
                      <div className="hidden shrink-0 grid-cols-2 gap-2 md:grid">
                        <SoftCard className="!p-3 text-center">
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-600">Recipients</p>
                          <p className="mt-1 text-2xl font-black text-white">{selectedClientIds.length}</p>
                        </SoftCard>
                        <SoftCard className="!p-3 text-center">
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-600">Draft mode</p>
                          <p className="mt-1 text-sm font-black text-emerald-200">{speedMode}</p>
                        </SoftCard>
                      </div>
                    </div>

                    <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-[1.45rem] border border-emerald-300/18 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.11),transparent_34%),rgba(0,0,0,.38)] p-3 sm:p-4">
                      <Field label="Complete communication brief" helper="Describe what the client should understand, why it matters, facts to include or avoid, and the desired next action. Slice creates a tailored subject and complete email—not a restatement of these instructions.">
                        <textarea
                          autoFocus
                          value={completePrompt}
                          onChange={(event) => setCompletePrompt(event.target.value)}
                          placeholder="Example: Prepare a calm, concise email explaining recent market volatility, reassure the client that we are monitoring their plan rather than reacting to headlines, avoid predictions, and invite them to schedule a review if they have questions."
                          className="h-[clamp(132px,25vh,210px)] w-full resize-none rounded-[1.2rem] border border-white/10 bg-black/48 p-4 text-sm font-semibold leading-6 text-white outline-none ring-emerald-400 placeholder:text-slate-700 focus:ring-2"
                        />
                      </Field>

                      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                        {COMPLETE_PROMPT_EXAMPLES.map((example) => (
                          <button
                            key={example.title}
                            type="button"
                            onClick={() => setCompletePrompt(example.text)}
                            className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black text-slate-300 transition hover:border-emerald-300/24 hover:text-white"
                          >
                            {example.title}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 grid gap-2 md:grid-cols-[220px_minmax(220px,1fr)_auto]">
                        <Field label="Generation speed">
                          <div className="grid grid-cols-2 gap-2">
                            {(["Quick", "Researched"] as EmailGenerationSpeed[]).map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setSpeedMode(value)}
                                className={cx(
                                  "rounded-xl border px-3 py-3 text-xs font-black transition",
                                  speedMode === value
                                    ? "border-emerald-300/28 bg-emerald-500/12 text-emerald-100"
                                    : "border-white/8 bg-white/[0.025] text-slate-500",
                                )}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        </Field>
                        <Field label="Advisor tone">
                          <select
                            value={tone}
                            onChange={(event) => setTone(event.target.value)}
                            className="h-11 w-full rounded-xl border border-white/10 bg-[#030605] px-3 text-xs font-black text-white outline-none ring-emerald-400 focus:ring-2"
                          >
                            <option>Professional, calm, concise, and reassuring</option>
                            <option>Warm, personal, and conversational</option>
                            <option>Executive, direct, and concise</option>
                            <option>Educational, clear, and detailed</option>
                          </select>
                        </Field>
                        <div className="flex items-end">
                          <Button
                            className="w-full min-w-[210px]"
                            onClick={() => void createAiDrafts()}
                            disabled={!promptComplete}
                            loading={busy === "generate"}
                          >
                            <Sparkles className="h-4 w-4" />
                            Create custom {selectedClientIds.length || ""} email{selectedClientIds.length === 1 ? "" : "s"}
                          </Button>
                        </div>
                      </div>

                      {speedMode === "Researched" ? (
                        <div className="mt-2">
                          <Toggle
                            checked={useResearch}
                            onChange={setUseResearch}
                            label="Use current public research"
                            helper="Public market or regulatory context is researched separately from private client information."
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-2 flex shrink-0 items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-600">
                        Prefer to write from scratch? Start a blank editable draft without AI.
                      </p>
                      <Button variant="ghost" onClick={() => void createBlankDraft()} loading={busy === "manual"}>
                        <FilePenLine className="h-4 w-4" />
                        Start blank draft
                      </Button>
                    </div>
                  </div>
                </Surface>

                <Surface className="min-h-[420px] overflow-hidden xl:min-h-0" accent="green">
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="shrink-0 border-b border-emerald-100/10 bg-[linear-gradient(135deg,rgba(16,185,129,.10),rgba(6,78,59,.04),transparent)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">Intelligent recipient targeting</p>
                          <h2 className="mt-1 text-xl font-black text-white">Choose by client, holding, or portfolio size</h2>
                        </div>
                        <Pill tone="green">{selectedClientIds.length} selected</Pill>
                      </div>

                      <div className="relative mt-2.5">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                        <input
                          value={clientSearch}
                          onChange={(event) => setClientSearch(event.target.value)}
                          placeholder="Search name, household, email, ticker, or company"
                          className="h-10 w-full rounded-xl border border-emerald-100/10 bg-black/42 pl-10 pr-3 text-xs font-bold text-white outline-none ring-emerald-400 placeholder:text-slate-700 focus:ring-2"
                        />
                      </div>

                      {matchedPromptSymbols.length ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">Prompt holdings</span>
                          {matchedPromptSymbols.map((symbol) => (
                            <button
                              key={symbol}
                              type="button"
                              onClick={() => setHoldingFilter(symbol)}
                              className={cx(
                                "rounded-full border px-2.5 py-1 text-[9px] font-black transition",
                                holdingFilter === symbol
                                  ? "border-emerald-300/35 bg-emerald-500/18 text-emerald-100"
                                  : "border-white/8 bg-white/[0.03] text-slate-500 hover:border-emerald-300/20 hover:text-white",
                              )}
                            >
                              {symbol}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <label className="block">
                          <span className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-600">Holding</span>
                          <select
                            value={holdingFilter}
                            onChange={(event) => setHoldingFilter(event.target.value)}
                            className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-[#020705] px-2.5 text-[10px] font-black text-white outline-none ring-emerald-400 focus:ring-2"
                          >
                            <option value="All">All holdings</option>
                            {allHoldingSymbols.map((symbol) => (
                              <option key={symbol} value={symbol}>{symbol}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-600">Portfolio size</span>
                          <select
                            value={portfolioBandFilter}
                            onChange={(event) => setPortfolioBandFilter(event.target.value as EmailPortfolioBand | "All")}
                            className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-[#020705] px-2.5 text-[10px] font-black text-white outline-none ring-emerald-400 focus:ring-2"
                          >
                            <option value="All">All sizes</option>
                            {EMAIL_PORTFOLIO_BANDS.map((band) => (
                              <option key={band} value={band}>{band}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-600">Order</span>
                          <select
                            value={recipientSort}
                            onChange={(event) => setRecipientSort(event.target.value as "relevance" | "portfolio" | "name")}
                            className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-[#020705] px-2.5 text-[10px] font-black text-white outline-none ring-emerald-400 focus:ring-2"
                          >
                            <option value="relevance">Prompt relevance</option>
                            <option value="portfolio">Largest portfolio</option>
                            <option value="name">Client name</option>
                          </select>
                        </label>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          className="min-h-9 px-2"
                          onClick={() =>
                            setSelectedClientIds(
                              visibleClients.filter((client) => !client.emailMissing).map((client) => client.id),
                            )
                          }
                        >
                          <Target className="h-3.5 w-3.5" />
                          Select filtered
                        </Button>
                        <Button
                          variant="ghost"
                          className="min-h-9 px-2"
                          onClick={() => {
                            if (matchedPromptSymbols.length) {
                              setSelectedClientIds(
                                clients
                                  .filter(
                                    (client) =>
                                      !client.emailMissing &&
                                      matchedPromptSymbols.some((symbol) => client.holdingSymbols.includes(symbol)),
                                  )
                                  .map((client) => client.id),
                              );
                            } else {
                              setSelectedClientIds([]);
                            }
                          }}
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          {matchedPromptSymbols.length ? "Select prompt matches" : "Clear selection"}
                        </Button>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between border-b border-white/7 px-3 py-2 text-[9px] font-bold text-slate-600">
                      <span>{visibleClients.length} matching clients</span>
                      <button
                        type="button"
                        onClick={() => {
                          setClientSearch("");
                          setHoldingFilter("All");
                          setPortfolioBandFilter("All");
                          setRecipientSort("relevance");
                        }}
                        className="font-black text-emerald-300 hover:text-emerald-200"
                      >
                        Reset filters
                      </button>
                    </div>

                    <div className="min-h-0 flex-1 email-scroll-region overflow-y-auto overscroll-contain p-2.5 [scrollbar-gutter:stable]">
                      {visibleClients.length ? (
                        <div className="grid gap-2">
                          {visibleClients.map((client) => {
                            const selected = selectedClientIds.includes(client.id);
                            const promptMatchCount = matchedPromptSymbols.filter((symbol) =>
                              client.holdingSymbols.includes(symbol),
                            ).length;

                            return (
                              <button
                                key={client.id}
                                type="button"
                                disabled={client.emailMissing}
                                onClick={() =>
                                  setSelectedClientIds((current) =>
                                    selected
                                      ? current.filter((id) => id !== client.id)
                                      : [...current, client.id],
                                  )
                                }
                                className={cx(
                                  "group rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45",
                                  selected
                                    ? "border-emerald-300/35 bg-[linear-gradient(135deg,rgba(16,185,129,.17),rgba(6,78,59,.06))] shadow-lg shadow-emerald-950/20"
                                    : "border-white/8 bg-white/[0.025] hover:border-emerald-200/18 hover:bg-emerald-500/[0.045]",
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-200/12 bg-[radial-gradient(circle_at_top,rgba(52,211,153,.18),rgba(0,0,0,.28))] text-xs font-black text-white">
                                    {initials(client.fullName)}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-start justify-between gap-2">
                                      <span className="min-w-0">
                                        <span className="block truncate text-xs font-black text-white">{client.fullName}</span>
                                        <span className="mt-1 block truncate text-[10px] font-semibold text-slate-500">
                                          {client.email || "Email address required"}
                                        </span>
                                      </span>
                                      <span
                                        className={cx(
                                          "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                                          selected
                                            ? "border-emerald-300/40 bg-emerald-500/25 text-emerald-100"
                                            : "border-white/10 text-transparent",
                                        )}
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </span>
                                    </span>

                                    <span className="mt-2 flex flex-wrap items-center gap-1.5">
                                      <span className="rounded-full border border-emerald-300/12 bg-emerald-500/[0.06] px-2 py-1 text-[8px] font-black text-emerald-200">
                                        {client.portfolioValueLabel || portfolioMoney(client.portfolioValueNumber)}
                                      </span>
                                      <span className="rounded-full border border-white/8 bg-black/25 px-2 py-1 text-[8px] font-black text-slate-500">
                                        {client.portfolioBand}
                                      </span>
                                      {promptMatchCount ? (
                                        <span className="rounded-full border border-cyan-300/16 bg-cyan-500/[0.07] px-2 py-1 text-[8px] font-black text-cyan-200">
                                          {promptMatchCount} prompt match{promptMatchCount === 1 ? "" : "es"}
                                        </span>
                                      ) : null}
                                    </span>

                                    {client.holdings.length ? (
                                      <span className="mt-2 flex max-h-14 flex-wrap gap-1 overflow-hidden">
                                        {client.holdings.slice(0, 7).map((holding) => (
                                          <span
                                            key={`${client.id}-${holding.symbol}`}
                                            className={cx(
                                              "rounded-md border px-1.5 py-0.5 text-[8px] font-black",
                                              matchedPromptSymbols.includes(holding.symbol)
                                                ? "border-cyan-300/25 bg-cyan-500/10 text-cyan-100"
                                                : "border-white/7 bg-black/22 text-slate-600",
                                            )}
                                            title={`${holding.assetName} · ${holding.allocationPctNumber ?? "?"}% · ${portfolioMoney(holding.valueNumber)}`}
                                          >
                                            {holding.symbol}
                                            {holding.allocationPctNumber !== null ? ` ${Math.round(holding.allocationPctNumber)}%` : ""}
                                          </span>
                                        ))}
                                      </span>
                                    ) : (
                                      <span className="mt-2 block text-[9px] font-semibold text-slate-700">No holdings recorded</span>
                                    )}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid h-full min-h-48 place-items-center rounded-2xl border border-dashed border-emerald-200/10 p-5 text-center">
                          <div>
                            <UsersRound className="mx-auto h-7 w-7 text-emerald-700" />
                            <p className="mt-3 text-sm font-black text-white">No recipients match these filters</p>
                            <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">Reset the holding or portfolio-size filter, or add a valid client email.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Surface>
              </section>
            ) : null}

            {stage === "drafts" ? (
              <section className="grid min-h-full min-w-0 gap-2 xl:h-full xl:min-h-0 xl:grid-cols-[300px_minmax(0,1fr)_minmax(350px,.78fr)]">
                <Surface className="min-h-0 overflow-hidden xl:min-h-0" accent="green">
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="border-b border-white/8 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">Draft library</p>
                          <h2 className="mt-1 text-xl font-black text-white">Select and edit</h2>
                        </div>
                        <Pill tone="green">{visibleDrafts.length}</Pill>
                      </div>
                      <div className="relative mt-4">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                        <input
                          value={draftSearch}
                          onChange={(event) => setDraftSearch(event.target.value)}
                          placeholder="Search drafts"
                          className="h-10 w-full rounded-xl border border-white/10 bg-black/38 pl-10 pr-3 text-xs font-bold text-white outline-none ring-emerald-400 placeholder:text-slate-700 focus:ring-2"
                        />
                      </div>
                      <select
                        value={draftFilter}
                        onChange={(event) => setDraftFilter(event.target.value as (typeof DRAFT_FILTERS)[number])}
                        className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-[#030605] px-3 text-xs font-black text-white outline-none"
                      >
                        {DRAFT_FILTERS.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDraftIds((current) =>
                              current.length === deletableVisibleIds.length ? [] : deletableVisibleIds,
                            )
                          }
                          className="text-[10px] font-black text-emerald-300 hover:text-emerald-200"
                        >
                          {selectedDraftIds.length === deletableVisibleIds.length && deletableVisibleIds.length
                            ? "Clear selection"
                            : "Select deletable"}
                        </button>
                        <Button
                          variant="danger"
                          className="min-h-9 px-3"
                          disabled={!selectedDraftIds.length}
                          onClick={() => setDeleteOpen(true)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete {selectedDraftIds.length || ""}
                        </Button>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 email-scroll-region overflow-y-auto overscroll-contain p-2.5 [scrollbar-gutter:stable]">
                      {visibleDrafts.length ? (
                        <div className="grid gap-2">
                          {visibleDrafts.map((draft) => {
                            const active = activeDraftId === draft.id;
                            const selected = selectedDraftIds.includes(draft.id);
                            return (
                              <article
                                key={draft.id}
                                className={cx(
                                  "group relative rounded-2xl border p-3 transition",
                                  active
                                    ? "border-emerald-300/30 bg-emerald-500/[0.10] shadow-lg shadow-emerald-950/20"
                                    : "border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.045]",
                                )}
                              >
                                <div className="flex items-start gap-2.5">
                                  <button
                                    type="button"
                                    disabled={!draft.deletable}
                                    onClick={() => toggleSelectedDraft(draft.id)}
                                    className={cx(
                                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border",
                                      selected
                                        ? "border-emerald-300/35 bg-emerald-500/20 text-emerald-100"
                                        : "border-white/10 text-transparent",
                                      !draft.deletable && "cursor-not-allowed opacity-30",
                                    )}
                                    aria-label={selected ? "Deselect draft" : "Select draft for deletion"}
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                  <button type="button" onClick={() => void chooseDraft(draft.id)} className="min-w-0 flex-1 text-left">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-black text-white">{draft.clientName || "Scratch draft"}</p>
                                        <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">{draft.recipientEmail || "Recipient not assigned"}</p>
                                      </div>
                                      <Pill tone={statusTone(draft.status)}>{draft.status}</Pill>
                                    </div>
                                    <p className="mt-3 line-clamp-2 text-sm font-black leading-5 text-slate-100">{draft.subject || "Untitled draft"}</p>
                                    <p className="mt-2 line-clamp-2 text-[10px] font-semibold leading-4 text-slate-600">{draft.bodyPreview}</p>
                                    <DraftGenerationProgress
                                      draft={draft}
                                      jobs={payload?.jobs ?? []}
                                      compact
                                    />
                                    <div className="mt-3 flex items-center justify-between text-[9px] font-bold text-slate-700">
                                      <span>v{draft.revision} · {draft.versionCount} saved</span>
                                      <span>{dateTime(draft.updatedAt)}</span>
                                    </div>
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-white/10 p-5 text-center">
                          <div>
                            <Inbox className="mx-auto h-7 w-7 text-slate-600" />
                            <p className="mt-3 text-sm font-black text-white">No matching drafts</p>
                            <p className="mt-1 text-[10px] font-semibold text-slate-600">Change the filter or create a new communication.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Surface>

                <Surface className="min-h-0 overflow-hidden p-0" accent="purple">
                  {activeDraft ? (
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-white/8 p-3.5">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Pill tone={statusTone(activeDraft.status)}>{activeDraft.status}</Pill>
                            <Pill tone="purple">{activeDraft.origin}</Pill>
                            <Pill tone={saveState === "error" ? "amber" : saveState === "saving" ? "cyan" : "green"}>
                              {saveState === "unsaved" ? "Unsaved" : saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : `Revision ${activeDraft.revision}`}
                            </Pill>
                            {generationIsActive(activeDraft) ? (
                              <Pill tone="green">Custom AI building</Pill>
                            ) : null}
                          </div>
                          <h2 className="mt-2 text-xl font-black text-white">Draft workspace</h2>
                          <p className="mt-2 text-xs font-semibold text-slate-500">
                            {activeDraft.clientName || "Scratch draft"} · {activeDraft.recipientEmail || "Recipient missing"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => setBrandingOpen(true)}
                            disabled={!draftEditable(activeDraft)}
                          >
                            <Palette className="h-4 w-4" />
                            Branding
                          </Button>
                          <Button variant="ghost" onClick={copyPreview}>
                            <Copy className="h-4 w-4" />
                            Copy
                          </Button>
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 email-scroll-region overflow-y-auto overscroll-contain p-3.5 [scrollbar-gutter:stable]">
                        {generationIsActive(activeDraft) ? (
                          <div className="grid h-full min-h-[320px] place-items-center">
                            <div className="w-full max-w-xl rounded-[1.6rem] border border-emerald-300/18 bg-[radial-gradient(circle_at_top,rgba(16,185,129,.15),transparent_48%),rgba(0,0,0,.36)] p-5 shadow-2xl shadow-emerald-950/25">
                              <div className="flex items-start gap-3">
                                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-300/22 bg-emerald-500/12">
                                  <Bot className="h-6 w-6 animate-pulse text-emerald-200" />
                                </div>
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">Custom AI drafting</p>
                                  <h3 className="mt-1 text-xl font-black text-white">Finishing this recipient’s email</h3>
                                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                                    Editing is temporarily locked so the final AI subject and message cannot overwrite advisor changes. This editor unlocks automatically when the quality and safety checks complete.
                                  </p>
                                </div>
                              </div>
                              <div className="mt-5">
                                <DraftGenerationProgress
                                  draft={activeDraft}
                                  jobs={payload?.jobs ?? []}
                                />
                              </div>
                              <div className="mt-4 grid grid-cols-3 gap-2">
                                {[
                                  ["Recipient", activeDraft.clientName || "Client"],
                                  ["Mode", activeDraft.generation.speedMode],
                                  ["Intent", activeDraft.generation.promptIntent || "Custom email"],
                                ].map(([label, value]) => (
                                  <div key={label} className="rounded-xl border border-white/8 bg-black/28 p-3">
                                    <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-700">{label}</p>
                                    <p className="mt-1 truncate text-[10px] font-black text-slate-200">{value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : generationNeedsRetry(activeDraft) ? (
                          <div className="grid h-full min-h-[320px] place-items-center">
                            <div className="w-full max-w-xl rounded-[1.6rem] border border-amber-300/20 bg-[radial-gradient(circle_at_top,rgba(245,158,11,.11),transparent_48%),rgba(0,0,0,.38)] p-6 text-center shadow-2xl shadow-black/25">
                              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/24 bg-amber-500/10">
                                <RotateCcw className="h-6 w-6 text-amber-200" />
                              </div>
                              <p className="mt-4 text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">
                                Verified AI output required
                              </p>
                              <h3 className="mt-2 text-2xl font-black text-white">
                                This email was not completed by Custom AI
                              </h3>
                              <p className="mx-auto mt-3 max-w-md text-xs font-semibold leading-6 text-slate-400">
                                Slice will not present the private preflight template as an AI-generated email. Retry the original prompt to create a new, prompt-specific subject and complete message through OpenAI.
                              </p>
                              {activeDraft.generation.error ? (
                                <p className="mx-auto mt-3 max-w-md rounded-xl border border-amber-300/15 bg-amber-500/[0.05] p-3 text-[10px] font-semibold leading-5 text-amber-100/80">
                                  {activeDraft.generation.error}
                                </p>
                              ) : null}
                              <Button
                                className="mt-5"
                                onClick={() => void retryCustomAi()}
                                loading={busy === "retry-ai"}
                              >
                                <RotateCcw className="h-4 w-4" />
                                Retry Custom AI
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            <Field label="Subject">
                              <input
                                value={editor.subject}
                                onChange={(event) => setEditor((current) => ({ ...current, subject: event.target.value }))}
                                disabled={!draftEditable(activeDraft)}
                                className="h-12 w-full rounded-xl border border-white/10 bg-black/42 px-4 text-sm font-black text-white outline-none ring-emerald-400 placeholder:text-slate-700 focus:ring-2 disabled:opacity-55"
                              />
                            </Field>
                            <Field label="Message" helper="The completed AI email is fully editable. Every meaningful change supersedes prior approval.">
                              <textarea
                                value={editor.body}
                                onChange={(event) => setEditor((current) => ({ ...current, body: event.target.value }))}
                                disabled={!draftEditable(activeDraft)}
                                className="h-[clamp(260px,43vh,520px)] w-full resize-none rounded-[1.2rem] border border-white/10 bg-black/42 p-4 text-sm font-semibold leading-6 text-white outline-none ring-emerald-400 placeholder:text-slate-700 focus:ring-2 disabled:opacity-55"
                              />
                            </Field>
                            <Field label="Tone">
                              <input
                                value={editor.tone}
                                onChange={(event) => setEditor((current) => ({ ...current, tone: event.target.value }))}
                                disabled={!draftEditable(activeDraft)}
                                className="h-11 w-full rounded-xl border border-white/10 bg-black/42 px-4 text-xs font-bold text-white outline-none ring-emerald-400 focus:ring-2 disabled:opacity-55"
                              />
                            </Field>
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 border-t border-white/8 p-3.5">
                        {generationNeedsRetry(activeDraft) ? (
                          <Button
                            onClick={() => void retryCustomAi()}
                            loading={busy === "retry-ai"}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Retry Custom AI
                          </Button>
                        ) : null}
                        <Button
                          variant="secondary"
                          onClick={() => void saveDraft()}
                          loading={saveState === "saving"}
                          disabled={!draftEditable(activeDraft)}
                        >
                          <Save className="h-4 w-4" />
                          Save now
                        </Button>
                        <Button variant="secondary" onClick={() => void polishDraft()} loading={busy === "polish"} disabled={!draftEditable(activeDraft)}>
                          <WandSparkles className="h-4 w-4" />
                          Quick polish
                        </Button>
                        <Button onClick={() => void requestApproval()} loading={busy === "approval-request"} disabled={!activeDraft.recipientEmail || !draftEditable(activeDraft)}>
                          <UserCheck className="h-4 w-4" />
                          Request approval
                        </Button>
                        {activeDraft.deletable ? (
                          <Button variant="danger" onClick={() => { setSelectedDraftIds([activeDraft.id]); setDeleteOpen(true); }}>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        ) : (
                          <Button variant="ghost" onClick={() => void archiveActive()} loading={busy === "archive"}>
                            <Archive className="h-4 w-4" />
                            Archive
                          </Button>
                        )}
                      </div>

                      <div className="max-h-[190px] shrink-0 overflow-y-auto overscroll-contain border-t border-white/8 p-3.5 [scrollbar-gutter:stable]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-300">Version history</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">Choose any AI, manual, polished, or checkpoint version.</p>
                          </div>
                          <Pill tone="purple">{activeDraft.versions.length}</Pill>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {activeDraft.versions.slice(0, 8).map((version) => (
                            <button
                              key={version.id}
                              type="button"
                              onClick={() => void selectVersion(version.id)}
                              disabled={busy === `version:${version.id}` || generationIsActive(activeDraft)}
                              className={cx(
                                "rounded-xl border p-3 text-left transition",
                                activeDraft.selectedVersionId === version.id
                                  ? "border-violet-300/28 bg-violet-500/10"
                                  : "border-white/8 bg-white/[0.025] hover:border-white/15",
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black text-white">v{version.version} · {version.label}</span>
                                <Pill tone="purple">{version.origin}</Pill>
                              </div>
                              <p className="mt-2 line-clamp-2 text-[10px] font-semibold leading-4 text-slate-600">{version.subject}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid h-full min-h-0 place-items-center text-center">
                      <div>
                        <FilePenLine className="mx-auto h-9 w-9 text-slate-700" />
                        <h2 className="mt-4 text-2xl font-black text-white">Select or create a draft</h2>
                        <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">Use the draft library or return to the AI Prompt stage.</p>
                      </div>
                    </div>
                  )}
                </Surface>

                <Surface className="min-h-0 email-scroll-region overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]" accent="cyan">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-300">Client-facing preview</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Slice brand, optional firm logo, and advisor signature.</p>
                    </div>
                    <div className="flex gap-1 rounded-xl border border-white/8 bg-black/30 p-1">
                      {(["desktop", "mobile"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPreviewMode(mode)}
                          className={cx(
                            "rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em]",
                            previewMode === mode ? "bg-white text-slate-950" : "text-slate-500",
                          )}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={cx("mx-auto transition-all", previewMode === "mobile" ? "max-w-[420px]" : "max-w-none")}>
                    <EmailPreview draft={activeDraft} branding={activeBranding} />
                  </div>
                </Surface>
              </section>
            ) : null}

            {stage === "approval" ? (
              <section className="grid min-h-full min-w-0 gap-2 xl:h-full xl:min-h-0 xl:grid-cols-[320px_minmax(0,1fr)]">
                <Surface className="min-h-0 overflow-hidden xl:min-h-0" accent="amber">
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="border-b border-white/8 p-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">Approval queue</p>
                      <h2 className="mt-1 text-xl font-black text-white">Advisor review</h2>
                      <p className="mt-2 text-[10px] font-semibold leading-4 text-slate-600">Approval is bound to the exact revision, branding, content hash, and recipient.</p>
                    </div>
                    <div className="min-h-0 flex-1 email-scroll-region overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]">
                      <div className="grid gap-2">
                        {approvals.map((approval) => (
                          <button
                            key={approval.id}
                            type="button"
                            onClick={() => setSelectedApprovalId(approval.id)}
                            className={cx(
                              "rounded-2xl border p-4 text-left transition",
                              selectedApprovalId === approval.id
                                ? "border-amber-300/28 bg-amber-500/[0.10]"
                                : "border-white/8 bg-white/[0.025] hover:border-white/15",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="line-clamp-2 text-xs font-black text-white">{approval.title}</p>
                              <Pill tone={statusTone(approval.status)}>{approval.status}</Pill>
                            </div>
                            <p className="mt-2 text-[10px] font-semibold leading-4 text-slate-600">{approval.recipientCount} recipient{approval.recipientCount === 1 ? "" : "s"} · {dateTime(approval.createdAt)}</p>
                          </button>
                        ))}
                        {!approvals.length ? (
                          <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-white/10 p-5 text-center">
                            <div>
                              <UserCheck className="mx-auto h-7 w-7 text-slate-700" />
                              <p className="mt-3 text-sm font-black text-white">No approvals yet</p>
                              <p className="mt-1 text-[10px] font-semibold text-slate-600">Request approval from the draft workspace.</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Surface>

                <div className="min-h-0 overflow-y-auto space-y-3 pr-0.5">
                  <Surface className="p-5 sm:p-6" accent="green">
                    {selectedApproval ? (
                      <div>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <Pill tone={statusTone(selectedApproval.status)}>{selectedApproval.status}</Pill>
                            <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">Final advisor approval</h1>
                            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                              Review the exact recipients, subjects, and preview. Editing content or branding afterward supersedes approval automatically.
                            </p>
                          </div>
                          <Pill tone="cyan">{selectedApproval.recipientCount} exact recipient{selectedApproval.recipientCount === 1 ? "" : "s"}</Pill>
                        </div>

                        <div className="mt-5 grid gap-3 lg:grid-cols-2">
                          {approvalDrafts.map((draft) => (
                            <article key={draft.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-white">{draft.clientName || "Unassigned client"}</p>
                                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">{draft.recipientEmail || "Recipient missing"}</p>
                                </div>
                                <Pill tone={statusTone(draft.status)}>{draft.status}</Pill>
                              </div>
                              <p className="mt-3 text-sm font-black text-white">{draft.subject}</p>
                              <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-slate-500">{draft.bodyPreview}</p>
                              <button type="button" onClick={() => { void chooseDraft(draft.id); setStage("drafts"); }} className="mt-3 text-[10px] font-black text-emerald-300 hover:text-emerald-200">
                                Open exact draft →
                              </button>
                            </article>
                          ))}
                        </div>

                        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
                          <div>
                            <Field label="Approval note">
                              <textarea
                                value={approvalNote}
                                onChange={(event) => setApprovalNote(event.target.value)}
                                className="min-h-28 w-full rounded-xl border border-white/10 bg-black/38 p-3 text-xs font-semibold leading-5 text-white outline-none ring-emerald-400 focus:ring-2"
                              />
                            </Field>
                            <label className="mt-3 flex items-start gap-3 rounded-2xl border border-amber-400/18 bg-amber-500/[0.07] p-4">
                              <input
                                type="checkbox"
                                checked={recipientConfirmed}
                                onChange={(event) => setRecipientConfirmed(event.target.checked)}
                                className="mt-1 h-4 w-4 accent-emerald-500"
                              />
                              <span>
                                <span className="block text-sm font-black text-white">I confirm these exact recipients, subjects, and branded previews.</span>
                                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">This releases or schedules an external communication. Later edits invalidate approval.</span>
                              </span>
                            </label>
                          </div>

                          <div className="rounded-2xl border border-white/8 bg-black/28 p-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Delivery controls</p>
                            <div className="mt-3 grid gap-2">
                              <Button variant="secondary" onClick={() => void approveOnly()} loading={busy === "approve"} disabled={!selectedApproval.canDecide || selectedApproval.status !== "Pending"}>
                                <BadgeCheck className="h-4 w-4" />
                                Approve only
                              </Button>
                              <input
                                type="datetime-local"
                                value={scheduleAt}
                                onChange={(event) => setScheduleAt(event.target.value)}
                                className="h-11 w-full rounded-xl border border-white/10 bg-[#030605] px-3 text-xs font-black text-white outline-none"
                              />
                              <Button variant="secondary" onClick={() => void scheduleApprovedDrafts()} loading={busy === "schedule"} disabled={!recipientConfirmed || !scheduleAt || selectedApproval.status !== "Approved"}>
                                <Clock3 className="h-4 w-4" />
                                Schedule approved email
                              </Button>
                              <Button onClick={() => void approveAndSend()} loading={busy === "approve-send"} disabled={!recipientConfirmed || selectedApproval.status !== "Pending"}>
                                <Send className="h-4 w-4" />
                                Approve and send
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid min-h-72 place-items-center text-center">
                        <div>
                          <UserCheck className="mx-auto h-9 w-9 text-slate-700" />
                          <h2 className="mt-4 text-2xl font-black text-white">Select an approval request</h2>
                          <p className="mt-2 text-sm font-semibold text-slate-500">The exact recipients and current revisions appear here.</p>
                        </div>
                      </div>
                    )}
                  </Surface>

                  <Surface className="p-5" accent="cyan">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-cyan-300">Delivery queue</p>
                        <h2 className="mt-1 text-xl font-black text-white">Scheduled, processing, and failed</h2>
                      </div>
                      <Pill tone="cyan">{deliveries.length}</Pill>
                    </div>

                    {deliveries.length ? (
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left">
                          <thead>
                            <tr className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">
                              <th className="px-3">Recipient</th>
                              <th className="px-3">Subject</th>
                              <th className="px-3">Scheduled</th>
                              <th className="px-3">Approval</th>
                              <th className="px-3">Delivery</th>
                              <th className="px-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deliveries.map((delivery) => (
                              <tr key={delivery.id} className="bg-white/[0.025]">
                                <td className="rounded-l-xl px-3 py-3">
                                  <p className="text-xs font-black text-white">{delivery.clientName}</p>
                                  <p className="mt-1 text-[10px] text-slate-500">{delivery.recipientEmail}</p>
                                </td>
                                <td className="max-w-xs px-3 py-3 text-xs font-semibold text-slate-300">{delivery.subject}</td>
                                <td className="px-3 py-3 text-xs font-semibold text-slate-500">{dateTime(delivery.scheduledAt)}</td>
                                <td className="px-3 py-3"><Pill tone={delivery.approvedAt ? "green" : "amber"}>{delivery.approvedAt ? "Approved" : "Pending"}</Pill></td>
                                <td className="px-3 py-3">
                                  <Pill tone={statusTone(delivery.status)}>{delivery.status}</Pill>
                                  {delivery.failureReason ? <p className="mt-1 max-w-xs text-[10px] text-amber-200">{delivery.failureReason}</p> : null}
                                </td>
                                <td className="rounded-r-xl px-3 py-3">
                                  <div className="flex gap-1">
                                    {delivery.cancellable ? (
                                      <Button variant="ghost" className="min-h-9 px-3" onClick={() => void cancelDelivery(delivery.id)} loading={busy === `cancel:${delivery.id}`}>
                                        Cancel
                                      </Button>
                                    ) : null}
                                    {delivery.retryable ? (
                                      <Button variant="secondary" className="min-h-9 px-3" onClick={() => void retryDelivery(delivery.id)} loading={busy === `retry:${delivery.id}`}>
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Retry
                                      </Button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="mt-4 grid min-h-40 place-items-center rounded-2xl border border-dashed border-white/10 text-center">
                        <div>
                          <Mail className="mx-auto h-7 w-7 text-slate-700" />
                          <p className="mt-3 text-sm font-black text-white">No delivery records yet</p>
                          <p className="mt-1 text-[10px] font-semibold text-slate-600">Active schedules, provider processing, and failures appear here. Completed sends move to the archive.</p>
                        </div>
                      </div>
                    )}
                  </Surface>
                </div>
              </section>
            ) : null}

            {stage === "archive" ? (
              <section className="grid min-h-full min-w-0 gap-2 xl:h-full xl:min-h-0 xl:grid-cols-[380px_minmax(0,1fr)]">
                <Surface className="min-h-0 overflow-hidden" accent="cyan">
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="shrink-0 border-b border-white/8 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Pill tone="cyan">
                            <History className="h-3.5 w-3.5" />
                            Durable communication history
                          </Pill>
                          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
                            Sent email archive
                          </h1>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                            Exact recipient, approval, delivery time, provider confirmation, and the branded email that was sent.
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          className="min-h-10 px-3"
                          onClick={() => void loadArchive({ deliveryId: selectedArchiveId })}
                          loading={archiveLoading}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Refresh
                        </Button>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <SoftCard className="!p-3 text-center">
                          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-600">Delivered</p>
                          <p className="mt-1 text-xl font-black text-white">{archive?.metrics.totalSent ?? payload.metrics.archiveCount}</p>
                        </SoftCard>
                        <SoftCard className="!p-3 text-center">
                          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-600">Recipients loaded</p>
                          <p className="mt-1 text-xl font-black text-white">{archive?.metrics.uniqueRecipients ?? 0}</p>
                        </SoftCard>
                        <SoftCard className="!p-3 text-center">
                          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-600">Live</p>
                          <p className="mt-1 text-xl font-black text-emerald-200">{archive?.metrics.liveSent ?? 0}</p>
                        </SoftCard>
                      </div>

                      <div className="relative mt-3">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                        <input
                          value={archiveSearch}
                          onChange={(event) => setArchiveSearch(event.target.value)}
                          placeholder="Search subject, client, recipient, or provider"
                          className="h-11 w-full rounded-xl border border-white/10 bg-black/38 pl-10 pr-3 text-xs font-bold text-white outline-none ring-cyan-400 placeholder:text-slate-700 focus:ring-2"
                        />
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 email-scroll-region overflow-y-auto overscroll-contain p-2.5 [scrollbar-gutter:stable]">
                      {archiveLoading && !archive ? (
                        <div className="grid h-full min-h-48 place-items-center text-center">
                          <div>
                            <Loader2 className="mx-auto h-7 w-7 animate-spin text-cyan-300" />
                            <p className="mt-3 text-sm font-black text-white">Loading sent communications</p>
                          </div>
                        </div>
                      ) : visibleArchiveItems.length ? (
                        <div className="grid gap-2">
                          {visibleArchiveItems.map((item) => {
                            const recipient = item.recipients[0];
                            const selected = selectedArchiveId === item.deliveryId;

                            return (
                              <button
                                key={item.deliveryId}
                                type="button"
                                onClick={() => void chooseArchiveItem(item.deliveryId)}
                                className={cx(
                                  "rounded-2xl border p-3.5 text-left transition",
                                  selected
                                    ? "border-cyan-300/30 bg-cyan-500/[0.10] shadow-lg shadow-cyan-950/15"
                                    : "border-white/8 bg-white/[0.025] hover:border-white/16 hover:bg-white/[0.045]",
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-black text-white">{item.subject}</p>
                                    <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">
                                      {recipient?.clientName || "Client"} · {recipient?.email || "Recipient unavailable"}
                                    </p>
                                  </div>
                                  <Pill tone={item.status === "Sent" ? "green" : "amber"}>{item.status}</Pill>
                                </div>
                                <p className="mt-2 line-clamp-2 text-[10px] font-semibold leading-4 text-slate-600">{item.bodyPreview}</p>
                                <div className="mt-3 flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">
                                  <span>{dateTime(item.sentAt)}</span>
                                  <span>v{item.revision}</span>
                                </div>
                              </button>
                            );
                          })}
                          {archive?.pagination.hasMore ? (
                            <Button
                              variant="ghost"
                              className="mt-1 w-full"
                              loading={archiveLoading}
                              onClick={() =>
                                void loadArchive({
                                  append: true,
                                  cursor: archive.pagination.nextCursor,
                                })
                              }
                            >
                              <History className="h-4 w-4" />
                              Load older sent emails
                            </Button>
                          ) : (
                            <p className="py-2 text-center text-[9px] font-black uppercase tracking-[0.13em] text-slate-700">
                              {archiveItems.length} of {archive?.metrics.totalSent ?? archiveItems.length} archived communications loaded
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="grid h-full min-h-48 place-items-center rounded-2xl border border-dashed border-white/10 p-6 text-center">
                          <div>
                            <Archive className="mx-auto h-8 w-8 text-slate-700" />
                            <p className="mt-3 text-sm font-black text-white">No sent emails match this view</p>
                            <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">
                              Successfully sent and simulated deliveries appear here automatically.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Surface>

                <Surface className="min-h-0 overflow-hidden" accent="green">
                  {activeArchiveItem ? (
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="shrink-0 border-b border-white/8 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Pill tone={activeArchiveItem.status === "Sent" ? "green" : "amber"}>
                                <CalendarCheck2 className="h-3.5 w-3.5" />
                                {activeArchiveItem.status}
                              </Pill>
                              <Pill tone="cyan">Revision {activeArchiveItem.revision}</Pill>
                              <Pill tone="slate">{activeArchiveItem.provider || "Provider unavailable"}</Pill>
                            </div>
                            <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                              {activeArchiveItem.subject}
                            </h2>
                            <p className="mt-2 text-xs font-semibold text-slate-500">
                              Sent by {activeArchiveItem.ownerName} · Approved by {activeArchiveItem.approvedBy || "Advisor"}
                            </p>
                          </div>
                          <Button variant="secondary" onClick={openArchivePrintView}>
                            <ExternalLink className="h-4 w-4" />
                            Print exact email
                          </Button>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          <SoftCard className="!p-3">
                            <div className="flex items-start gap-2.5">
                              <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                              <div className="min-w-0">
                                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-600">Recipient</p>
                                <p className="mt-1 truncate text-xs font-black text-white">{activeArchiveItem.recipients[0]?.clientName || "Client"}</p>
                                <p className="mt-1 truncate text-[10px] text-slate-500">{activeArchiveItem.recipients[0]?.email || "Unavailable"}</p>
                              </div>
                            </div>
                          </SoftCard>
                          <SoftCard className="!p-3">
                            <div className="flex items-start gap-2.5">
                              <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                              <div>
                                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-600">Approved</p>
                                <p className="mt-1 text-xs font-black text-white">{dateTime(activeArchiveItem.approvedAt)}</p>
                                <p className="mt-1 text-[10px] text-slate-500">{activeArchiveItem.approvedBy || "Advisor"}</p>
                              </div>
                            </div>
                          </SoftCard>
                          <SoftCard className="!p-3">
                            <div className="flex items-start gap-2.5">
                              <Send className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                              <div>
                                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-600">Sent</p>
                                <p className="mt-1 text-xs font-black text-white">{dateTime(activeArchiveItem.sentAt)}</p>
                                <p className="mt-1 text-[10px] text-slate-500">{activeArchiveItem.providerId || "Provider receipt pending"}</p>
                              </div>
                            </div>
                          </SoftCard>
                          <SoftCard className="!p-3">
                            <div className="flex items-start gap-2.5">
                              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                              <div>
                                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-600">Delivery record</p>
                                <p className="mt-1 text-xs font-black text-white">{activeArchiveItem.attemptCount} attempt{activeArchiveItem.attemptCount === 1 ? "" : "s"}</p>
                                <p className="mt-1 text-[10px] text-slate-500">Approval {activeArchiveItem.approvalId.slice(0, 10)}…</p>
                              </div>
                            </div>
                          </SoftCard>
                        </div>
                      </div>

                      <div className="grid min-h-0 min-w-0 flex-1 gap-2 p-2.5 xl:grid-cols-[minmax(0,1fr)_310px]">
                        <div className="min-h-0 overflow-hidden rounded-[1.4rem] border border-slate-200 bg-[#eaf0ed] p-2 shadow-inner">
                          {activeArchiveItem.html ? (
                            <iframe
                              title={`Archived email: ${activeArchiveItem.subject}`}
                              srcDoc={activeArchiveItem.html}
                              sandbox=""
                              className="h-[62vh] w-full rounded-[1rem] border-0 bg-white xl:h-full xl:min-h-0"
                            />
                          ) : (
                            <div className="h-full overflow-y-auto rounded-[1rem] bg-white p-6 text-sm leading-7 text-slate-800">
                              <pre className="whitespace-pre-wrap font-sans">{activeArchiveItem.body}</pre>
                            </div>
                          )}
                        </div>

                        <div className="min-h-0 overflow-y-auto rounded-[1.4rem] border border-white/8 bg-black/28 p-4">
                          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-300">Archive record</p>
                          <div className="mt-3 grid gap-3 text-xs">
                            <div>
                              <p className="font-black text-white">Requested by</p>
                              <p className="mt-1 font-semibold text-slate-500">{activeArchiveItem.requestedByName || activeArchiveItem.ownerName}</p>
                            </div>
                            <div>
                              <p className="font-black text-white">Scheduled for</p>
                              <p className="mt-1 font-semibold text-slate-500">{dateTime(activeArchiveItem.scheduledAt)}</p>
                            </div>
                            <div>
                              <p className="font-black text-white">Approval note</p>
                              <p className="mt-1 whitespace-pre-wrap font-semibold leading-5 text-slate-500">{activeArchiveItem.approvalNotes || "No approval note was recorded."}</p>
                            </div>
                            <div>
                              <p className="font-black text-white">Content integrity</p>
                              <p className="mt-1 break-all font-mono text-[10px] text-slate-600">{activeArchiveItem.contentHash}</p>
                            </div>
                          </div>

                          <div className="mt-5 border-t border-white/8 pt-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-cyan-300">Provider attempts</p>
                            <div className="mt-3 grid gap-2">
                              {activeArchiveItem.attemptHistory.length ? activeArchiveItem.attemptHistory.map((attempt) => (
                                <div key={`${attempt.attempt}-${attempt.at}`} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-black text-white">Attempt {attempt.attempt}</p>
                                    <Pill tone={statusTone(attempt.status)}>{attempt.status}</Pill>
                                  </div>
                                  <p className="mt-2 text-[10px] font-semibold text-slate-600">{dateTime(attempt.at)} · {attempt.provider || activeArchiveItem.provider || "Provider"}</p>
                                  {attempt.error ? <p className="mt-1 text-[10px] font-semibold text-amber-200">{attempt.error}</p> : null}
                                </div>
                              )) : (
                                <p className="text-[10px] font-semibold leading-4 text-slate-600">The provider confirmed delivery without additional retry records.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid h-full min-h-0 place-items-center p-8 text-center">
                      <div>
                        <History className="mx-auto h-10 w-10 text-slate-700" />
                        <h2 className="mt-4 text-2xl font-black text-white">Select a sent email</h2>
                        <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
                          The exact approved communication, timing, recipient, and provider history will appear here.
                        </p>
                      </div>
                    </div>
                  )}
                </Surface>
              </section>
            ) : null}
          </div>
        </div>
      </main>

      <Modal
        open={brandingOpen}
        onClose={() => setBrandingOpen(false)}
        title="Email branding and advisor signature"
        description="Slice remains visibly present while your wealth-management logo, firm identity, and professional signature can be added to every new draft. Changes applied to an active draft become part of the approval-bound content hash."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid content-start gap-3">
            <Toggle checked={activeBranding.showSliceBrand} onChange={(value) => setBranding({ ...activeBranding, showSliceBrand: value })} label="Show Slice brand" helper="Displays the Slice mark beside your firm identity." />
            <Field label="Firm name">
              <input value={activeBranding.firmName} onChange={(event) => setBranding({ ...activeBranding, firmName: event.target.value })} className="h-11 w-full rounded-xl border border-white/10 bg-black/38 px-3 text-xs font-bold text-white outline-none ring-emerald-400 focus:ring-2" />
            </Field>
            <Field label="Wealth manager logo URL" helper="Use a secure HTTPS image URL. Leave blank to display the firm name instead.">
              <input value={activeBranding.firmLogoUrl || ""} onChange={(event) => setBranding({ ...activeBranding, firmLogoUrl: event.target.value || null })} placeholder="https://.../logo.png" className="h-11 w-full rounded-xl border border-white/10 bg-black/38 px-3 text-xs font-bold text-white outline-none ring-emerald-400 focus:ring-2" />
            </Field>
            <Field label="Accent color">
              <div className="flex gap-2">
                <input type="color" value={safeHex(activeBranding.accentColor)} onChange={(event) => setBranding({ ...activeBranding, accentColor: event.target.value.toUpperCase() })} className="h-11 w-14 rounded-xl border border-white/10 bg-transparent p-1" />
                <input value={activeBranding.accentColor} onChange={(event) => setBranding({ ...activeBranding, accentColor: event.target.value })} className="h-11 flex-1 rounded-xl border border-white/10 bg-black/38 px-3 text-xs font-bold text-white outline-none ring-emerald-400 focus:ring-2" />
              </div>
            </Field>
          </div>

          <div className="grid content-start gap-3">
            {[
              ["Sign-off", "signOff"],
              ["Advisor name", "name"],
              ["Title", "title"],
              ["Company", "company"],
              ["Phone", "phone"],
              ["Email", "email"],
              ["Website", "website"],
            ].map(([label, key]) => (
              <Field key={key} label={label}>
                <input
                  value={activeBranding.signature[key as keyof EmailBrandingPreference["signature"]]}
                  onChange={(event) =>
                    setBranding({
                      ...activeBranding,
                      signature: { ...activeBranding.signature, [key]: event.target.value },
                    })
                  }
                  className="h-10 w-full rounded-xl border border-white/10 bg-black/38 px-3 text-xs font-bold text-white outline-none ring-emerald-400 focus:ring-2"
                />
              </Field>
            ))}
          </div>
        </div>

        <Field label="Disclosure" helper="Keep this concise and aligned with firm-approved language.">
          <textarea value={activeBranding.disclosure} onChange={(event) => setBranding({ ...activeBranding, disclosure: event.target.value })} className="min-h-24 w-full rounded-xl border border-white/10 bg-black/38 p-3 text-xs font-semibold leading-5 text-white outline-none ring-emerald-400 focus:ring-2" />
        </Field>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setBrandingOpen(false)}>Cancel</Button>
          <Button onClick={() => void saveBranding()} loading={busy === "branding"}>
            <ImageIcon className="h-4 w-4" />
            Save default branding
          </Button>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete selected drafts?"
        description="This permanently removes only unapproved drafts with no active generation, approval, or delivery record. Approved, scheduled, sent, and audited communications remain protected and can only be archived."
      >
        <div className="rounded-2xl border border-rose-400/18 bg-rose-500/[0.07] p-4">
          <div className="flex items-start gap-3">
            <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
            <div>
              <p className="text-sm font-black text-white">{selectedDraftIds.length} draft{selectedDraftIds.length === 1 ? "" : "s"} selected</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">A non-sensitive audit record of the deletion is retained.</p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Keep drafts</Button>
          <Button variant="danger" onClick={() => void deleteDrafts()} loading={busy === "delete"}>
            <Trash2 className="h-4 w-4" />
            Permanently delete
          </Button>
        </div>
      </Modal>
    </SliceBackground>
  );
}