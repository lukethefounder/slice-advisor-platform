"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_SLICE_PLATFORM_SETTINGS,
  SLICE_GLOBAL_SETTINGS_KEY,
  SLICE_SETTINGS_UPDATED_EVENT,
  applySliceSettings,
  detectSliceUserIdentity,
  getSliceSettingsUserKey,
  loadSliceSettingsFromStorage,
  normalizeSliceSettings,
  saveSliceSettingsToStorage,
  type SliceAccentPreset,
  type SliceAiTone,
  type SliceAppearance,
  type SliceConfirmationLevel,
  type SliceDensity,
  type SliceDigestFrequency,
  type SlicePlatformSettings,
} from "@/components/user-theme-provider";

type SectionId =
  | "appearance"
  | "workspace"
  | "notifications"
  | "privacy"
  | "accessibility"
  | "advisor-ai";

type Tone = "red" | "blue" | "cyan" | "green" | "amber" | "purple" | "slate";

const sections: Array<{
  id: SectionId;
  label: string;
  description: string;
}> = [
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme, accent color, density, and display style.",
  },
  {
    id: "workspace",
    label: "Workspace",
    description: "Default landing behavior and workspace layout preferences.",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Market, client, compliance, email, and digest preferences.",
  },
  {
    id: "privacy",
    label: "Privacy & Security",
    description: "Sensitive action confirmations, masking, and auto-lock behavior.",
  },
  {
    id: "accessibility",
    label: "Accessibility",
    description: "Motion, contrast, focus, and text-size controls.",
  },
  {
    id: "advisor-ai",
    label: "Advisor AI",
    description: "AI tone, review requirements, draft depth, and retention style.",
  },
];

const accentOptions: Array<{
  id: SliceAccentPreset;
  label: string;
  helper: string;
  preview: string;
}> = [
  {
    id: "auto",
    label: "Auto",
    helper: "Red in dark mode, blue in light mode",
    preview: "linear-gradient(135deg,#dc2626,#2563eb)",
  },
  {
    id: "red",
    label: "Red",
    helper: "Classic Slice",
    preview: "#dc2626",
  },
  {
    id: "blue",
    label: "Blue",
    helper: "Clean advisor light mode",
    preview: "#2563eb",
  },
  {
    id: "cyan",
    label: "Cyan",
    helper: "Research terminal",
    preview: "#0891b2",
  },
  {
    id: "emerald",
    label: "Emerald",
    helper: "Positive portfolio tone",
    preview: "#16a34a",
  },
  {
    id: "purple",
    label: "Purple",
    helper: "AI-first workspace",
    preview: "#9333ea",
  },
  {
    id: "amber",
    label: "Amber",
    helper: "Alert-oriented",
    preview: "#d97706",
  },
];

const workspaceViews = [
  ["overview", "Daily Brain"],
  ["command", "AI Command"],
  ["clients", "Clients"],
  ["emails", "Email Center"],
  ["watchlists", "Markets"],
  ["portfolio", "Portfolio"],
  ["briefings", "Reports"],
  ["compliance", "Compliance"],
  ["system", "System"],
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneClasses(tone: Tone) {
  const tones: Record<Tone, string> = {
    red: "border-red-500/25 bg-red-500/10 text-red-100",
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-100",
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-100",
    purple: "border-purple-500/25 bg-purple-500/10 text-purple-100",
    slate: "border-white/10 bg-white/[0.055] text-slate-100",
  };

  return tones[tone];
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span className={cx("inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]", toneClasses(tone))}>
      {children}
    </span>
  );
}

function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-[1.75rem] border border-white/10 bg-zinc-950/78 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl", className)}>
      {children}
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
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  tone = "red",
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  tone?: Tone;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left transition hover:bg-white/[0.075]"
    >
      <div>
        <div className="text-sm font-black text-white">{title}</div>
        <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
      </div>

      <span
        className={cx(
          "relative h-7 w-12 shrink-0 rounded-full border transition",
          checked ? toneClasses(tone) : "border-white/10 bg-black/40 text-slate-300",
        )}
      >
        <span
          className={cx(
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition",
            checked ? "left-6" : "left-1",
          )}
        />
      </span>
    </button>
  );
}

function ChoiceButton<T extends string>({
  value,
  active,
  title,
  description,
  onSelect,
  tone = "red",
}: {
  value: T;
  active: boolean;
  title: string;
  description: string;
  onSelect: (value: T) => void;
  tone?: Tone;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cx(
        "rounded-2xl border p-4 text-left transition hover:-translate-y-0.5",
        active ? toneClasses(tone) : "border-white/10 bg-white/[0.045] text-slate-100 hover:bg-white/[0.075]",
      )}
    >
      <div className="text-sm font-black">{title}</div>
      <div className="mt-1 text-xs leading-5 opacity-80">{description}</div>
    </button>
  );
}

function SettingsSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
      >
        {options.map(([optionValue, labelValue]) => (
          <option key={optionValue} value={optionValue}>
            {labelValue}
          </option>
        ))}
      </select>
    </label>
  );
}

function SettingsNumber({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
      />
    </label>
  );
}

export default function WorkspaceSettingsPage() {
  const [settings, setSettings] = useState<SlicePlatformSettings>(DEFAULT_SLICE_PLATFORM_SETTINGS);
  const [section, setSection] = useState<SectionId>("appearance");
  const [userIdentity, setUserIdentity] = useState<string | null>(null);
  const [message, setMessage] = useState("Settings are stored locally and applied platform-wide.");

  const userStorageKey = useMemo(
    () => (userIdentity ? getSliceSettingsUserKey(userIdentity) : null),
    [userIdentity],
  );

  function persist(nextSettings: SlicePlatformSettings, nextMessage = "Settings saved.") {
    const normalized = normalizeSliceSettings(nextSettings);

    setSettings(normalized);
    saveSliceSettingsToStorage(normalized, SLICE_GLOBAL_SETTINGS_KEY);

    if (userStorageKey) {
      saveSliceSettingsToStorage(normalized, userStorageKey);
    }

    applySliceSettings(normalized);
    window.dispatchEvent(new Event(SLICE_SETTINGS_UPDATED_EVENT));
    window.dispatchEvent(new Event("slice-theme-updated"));
    setMessage(nextMessage);
  }

  function update<K extends keyof SlicePlatformSettings>(
    key: K,
    value: SlicePlatformSettings[K],
  ) {
    persist({
      ...settings,
      [key]: value,
    });
  }

  function resetSettings() {
    persist(DEFAULT_SLICE_PLATFORM_SETTINGS, "Settings reset to Slice defaults.");
  }

  useEffect(() => {
    let active = true;

    async function load() {
      const global = loadSliceSettingsFromStorage(SLICE_GLOBAL_SETTINGS_KEY);
      const identity = await detectSliceUserIdentity();

      if (!active) return;

      setUserIdentity(identity);

      if (identity) {
        const scoped = loadSliceSettingsFromStorage(getSliceSettingsUserKey(identity));
        const merged = normalizeSliceSettings({
          ...global,
          ...scoped,
        });

        setSettings(merged);
        applySliceSettings(merged);
        return;
      }

      setSettings(global);
      applySliceSettings(global);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const activeSection = sections.find((item) => item.id === section) ?? sections[0];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.36),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-5 text-white">
      <div className="mx-auto grid max-w-[1500px] gap-5">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-2xl shadow-red-950/25 backdrop-blur-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="red">Workspace Settings</Pill>
                <Pill tone={settings.appearance === "light" ? "blue" : "red"}>
                  {settings.appearance}
                </Pill>
                <Pill tone="cyan">
                  {userIdentity ? "User scoped" : "Browser fallback"}
                </Pill>
              </div>

              <h1 className="mt-4 text-4xl font-black md:text-6xl">
                Advisor platform settings.
              </h1>
              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400">
                Control Slice’s appearance, workspace behavior, notifications, privacy,
                accessibility, and advisor AI defaults. These settings apply across the
                platform and persist locally even after logout.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Back to Workspace
              </a>
              <button
                type="button"
                onClick={resetSettings}
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 hover:bg-red-500/20"
              >
                Reset Defaults
              </button>
            </div>
          </div>
        </header>

        <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">
          {message} {userIdentity ? `Active user key: ${userIdentity}` : "No login identity detected, so browser fallback is active."}
        </div>

        <section className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="h-fit">
            <div className="grid gap-2">
              {sections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={cx(
                    "rounded-2xl border p-4 text-left transition",
                    section === item.id
                      ? "border-white bg-white text-slate-950"
                      : "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.075]",
                  )}
                >
                  <div className="text-sm font-black">{item.label}</div>
                  <div className={cx("mt-1 text-xs leading-5", section === item.id ? "text-slate-600" : "text-slate-500")}>
                    {item.description}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader
              eyebrow={activeSection.label}
              title={activeSection.label}
              description={activeSection.description}
              action={
                <Pill tone={section === "appearance" ? "blue" : "cyan"}>
                  Live applied
                </Pill>
              }
            />

            {section === "appearance" ? (
              <div className="mt-6 grid gap-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <ChoiceButton<SliceAppearance>
                    value="dark"
                    active={settings.appearance === "dark"}
                    title="Dark"
                    description="Black and red Slice default."
                    tone="red"
                    onSelect={(value) => update("appearance", value)}
                  />
                  <ChoiceButton<SliceAppearance>
                    value="light"
                    active={settings.appearance === "light"}
                    title="Light"
                    description="White and blue advisor mode."
                    tone="blue"
                    onSelect={(value) => update("appearance", value)}
                  />
                  <ChoiceButton<SliceAppearance>
                    value="system"
                    active={settings.appearance === "system"}
                    title="System"
                    description="Follow device appearance."
                    tone="cyan"
                    onSelect={(value) => update("appearance", value)}
                  />
                </div>

                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Accent color
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {accentOptions.map((accent) => (
                      <button
                        key={accent.id}
                        type="button"
                        onClick={() => update("accentPreset", accent.id)}
                        className={cx(
                          "rounded-2xl border p-4 text-left transition",
                          settings.accentPreset === accent.id
                            ? "border-white bg-white text-slate-950"
                            : "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.075]",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="h-8 w-8 rounded-full border border-white/20"
                            style={{ background: accent.preview }}
                          />
                          <div>
                            <div className="text-sm font-black">{accent.label}</div>
                            <div className={cx("mt-1 text-xs", settings.accentPreset === accent.id ? "text-slate-600" : "text-slate-500")}>
                              {accent.helper}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <ChoiceButton<SliceDensity>
                    value="comfortable"
                    active={settings.density === "comfortable"}
                    title="Comfortable"
                    description="Premium spacing for demos and daily use."
                    tone="slate"
                    onSelect={(value) => update("density", value)}
                  />
                  <ChoiceButton<SliceDensity>
                    value="compact"
                    active={settings.density === "compact"}
                    title="Compact"
                    description="Tighter layout for advisor power users."
                    tone="cyan"
                    onSelect={(value) => update("density", value)}
                  />
                </div>
              </div>
            ) : null}

            {section === "workspace" ? (
              <div className="mt-6 grid gap-4">
                <SettingsSelect<string>
                  label="Default workspace view"
                  value={settings.defaultWorkspaceView}
                  options={workspaceViews as Array<[string, string]>}
                  onChange={(value) => update("defaultWorkspaceView", value)}
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleRow
                    title="Compact metric cards"
                    description="Use tighter metric cards across dashboards when supported."
                    checked={settings.compactMetricCards}
                    onChange={(value) => update("compactMetricCards", value)}
                    tone="cyan"
                  />
                  <ToggleRow
                    title="Open workspace links in new tab"
                    description="Useful when advisors want to keep the command center open."
                    checked={settings.openWorkspaceLinksInNewTab}
                    onChange={(value) => update("openWorkspaceLinksInNewTab", value)}
                    tone="cyan"
                  />
                  <ToggleRow
                    title="Floating assistant"
                    description="Show Slice AI / personal bot floating access when available."
                    checked={settings.showFloatingAssistant}
                    onChange={(value) => update("showFloatingAssistant", value)}
                    tone="purple"
                  />
                  <ToggleRow
                    title="Email quick access"
                    description="Show quick access to the client email center when available."
                    checked={settings.showEmailQuickAccess}
                    onChange={(value) => update("showEmailQuickAccess", value)}
                    tone="green"
                  />
                  <ToggleRow
                    title="Draggable workspace overlays"
                    description="Keep draggable overlays and power widgets enabled when supported."
                    checked={settings.showDraggableOverlays}
                    onChange={(value) => update("showDraggableOverlays", value)}
                    tone="amber"
                  />
                </div>
              </div>
            ) : null}

            {section === "notifications" ? (
              <div className="mt-6 grid gap-4">
                <SettingsSelect<SliceDigestFrequency>
                  label="Digest frequency"
                  value={settings.digestFrequency}
                  options={[
                    ["off", "Off"],
                    ["daily", "Daily"],
                    ["weekly", "Weekly"],
                  ]}
                  onChange={(value) => update("digestFrequency", value)}
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleRow
                    title="Market alerts"
                    description="Notify for watchlist, market, risk, and signal updates."
                    checked={settings.marketAlerts}
                    onChange={(value) => update("marketAlerts", value)}
                    tone="amber"
                  />
                  <ToggleRow
                    title="Client task alerts"
                    description="Notify for client follow-ups, reviews, and overdue items."
                    checked={settings.clientTaskAlerts}
                    onChange={(value) => update("clientTaskAlerts", value)}
                    tone="purple"
                  />
                  <ToggleRow
                    title="Compliance alerts"
                    description="Notify for compliance gates, approvals, and review flags."
                    checked={settings.complianceAlerts}
                    onChange={(value) => update("complianceAlerts", value)}
                    tone="red"
                  />
                  <ToggleRow
                    title="Email delivery alerts"
                    description="Notify after client email drafts are delivered, simulated, or failed."
                    checked={settings.emailDeliveryAlerts}
                    onChange={(value) => update("emailDeliveryAlerts", value)}
                    tone="green"
                  />
                  <ToggleRow
                    title="Alert sound"
                    description="Allow sound cues for urgent workspace alerts when supported."
                    checked={settings.alertSound}
                    onChange={(value) => update("alertSound", value)}
                    tone="cyan"
                  />
                </div>
              </div>
            ) : null}

            {section === "privacy" ? (
              <div className="mt-6 grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <SettingsSelect<SliceConfirmationLevel>
                    label="Confirmation level"
                    value={settings.confirmationLevel}
                    options={[
                      ["standard", "Standard"],
                      ["strict", "Strict"],
                    ]}
                    onChange={(value) => update("confirmationLevel", value)}
                  />

                  <SettingsNumber
                    label="Auto-lock minutes"
                    value={settings.autoLockMinutes}
                    min={0}
                    max={240}
                    onChange={(value) => update("autoLockMinutes", value)}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleRow
                    title="Mask client data"
                    description="Blur elements tagged as client-sensitive until hovered."
                    checked={settings.maskClientData}
                    onChange={(value) => update("maskClientData", value)}
                    tone="purple"
                  />
                  <ToggleRow
                    title="Confirm sensitive actions"
                    description="Require extra confirmation for sending, deleting, approving, or client-facing actions."
                    checked={settings.requireSensitiveActionConfirmations}
                    onChange={(value) => update("requireSensitiveActionConfirmations", value)}
                    tone="red"
                  />
                  <ToggleRow
                    title="Local-only preferences"
                    description="Keep preferences in this browser by default instead of assuming cross-device sync."
                    checked={settings.localOnlyPreferences}
                    onChange={(value) => update("localOnlyPreferences", value)}
                    tone="cyan"
                  />
                </div>
              </div>
            ) : null}

            {section === "accessibility" ? (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <ToggleRow
                  title="Reduce motion"
                  description="Minimize transitions and animations across the platform."
                  checked={settings.reduceMotion}
                  onChange={(value) => update("reduceMotion", value)}
                  tone="cyan"
                />
                <ToggleRow
                  title="Larger text"
                  description="Increase the base platform text size."
                  checked={settings.largeText}
                  onChange={(value) => update("largeText", value)}
                  tone="blue"
                />
                <ToggleRow
                  title="High contrast"
                  description="Increase border and contrast strength."
                  checked={settings.highContrast}
                  onChange={(value) => update("highContrast", value)}
                  tone="amber"
                />
                <ToggleRow
                  title="Focus outlines"
                  description="Show strong keyboard focus outlines for accessibility."
                  checked={settings.focusOutlines}
                  onChange={(value) => update("focusOutlines", value)}
                  tone="green"
                />
              </div>
            ) : null}

            {section === "advisor-ai" ? (
              <div className="mt-6 grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <SettingsSelect<SliceAiTone>
                    label="Advisor AI tone"
                    value={settings.advisorAiTone}
                    options={[
                      ["balanced", "Balanced"],
                      ["concise", "Concise"],
                      ["executive", "Executive"],
                      ["detailed", "Detailed"],
                    ]}
                    onChange={(value) => update("advisorAiTone", value)}
                  />

                  <SettingsSelect<SlicePlatformSettings["defaultDraftDepth"]>
                    label="Default draft depth"
                    value={settings.defaultDraftDepth}
                    options={[
                      ["short", "Short"],
                      ["standard", "Standard"],
                      ["thorough", "Thorough"],
                    ]}
                    onChange={(value) => update("defaultDraftDepth", value)}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleRow
                    title="Require advisor approval for client content"
                    description="Keep client emails, recommendations, and briefings approval-gated."
                    checked={settings.requireAdvisorApprovalForClientContent}
                    onChange={(value) => update("requireAdvisorApprovalForClientContent", value)}
                    tone="red"
                  />
                  <ToggleRow
                    title="Retain prompt history"
                    description="Keep prompt/output history available for review and audit workflows when supported."
                    checked={settings.retainPromptHistory}
                    onChange={(value) => update("retainPromptHistory", value)}
                    tone="amber"
                  />
                </div>
              </div>
            ) : null}
          </Card>
        </section>

        <Card>
          <SectionHeader
            eyebrow="Preview"
            title="Theme preview"
            description="This preview shows how the selected appearance and accent will feel across the workspace."
            action={<Pill tone={settings.appearance === "light" ? "blue" : "red"}>{settings.appearance}</Pill>}
          />

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                Client Alert
              </div>
              <div className="mt-2 text-2xl font-black text-white">Review Required</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Recommendation language detected. Advisor approval remains required.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-cyan-500/25 bg-cyan-500/10 p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Market Workspace
              </div>
              <div className="mt-2 text-2xl font-black text-white">Custom Board</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                TradingView chart, custom metric rail, and generated alert standards.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-emerald-500/25 bg-emerald-500/10 p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                Saved
              </div>
              <div className="mt-2 text-2xl font-black text-white">Persistent</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Stored locally and reapplied by the global settings provider.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}