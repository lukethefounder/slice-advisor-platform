"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light";
type Density = "comfortable" | "compact";
type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";

const THEME_KEY = "slice-theme-mode-v1";
const DENSITY_KEY = "slice-density-mode-v1";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isLightTheme(theme: ThemeMode) {
  return theme === "light";
}

function textStrong(theme: ThemeMode) {
  return isLightTheme(theme) ? "text-slate-950" : "text-white";
}

function textMuted(theme: ThemeMode) {
  return isLightTheme(theme) ? "text-slate-600" : "text-slate-400";
}

function textFaint(theme: ThemeMode) {
  return isLightTheme(theme) ? "text-slate-500" : "text-slate-500";
}

function surface(theme: ThemeMode) {
  return isLightTheme(theme)
    ? "border-sky-200/80 bg-white/82 shadow-xl shadow-sky-900/10"
    : "border-white/10 bg-zinc-950/82 shadow-2xl shadow-black/30";
}

function tintSurface(theme: ThemeMode) {
  return isLightTheme(theme)
    ? "border-sky-200/80 bg-sky-50/80"
    : "border-white/10 bg-white/[0.045]";
}

function toneClasses(tone: Tone, theme: ThemeMode) {
  if (isLightTheme(theme)) {
    const light: Record<Tone, string> = {
      red: "border-red-200 bg-red-50 text-red-800",
      green: "border-emerald-200 bg-emerald-50 text-emerald-800",
      amber: "border-amber-200 bg-amber-50 text-amber-800",
      purple: "border-purple-200 bg-purple-50 text-purple-800",
      cyan: "border-sky-200 bg-sky-50 text-sky-800",
      blue: "border-blue-200 bg-blue-50 text-blue-800",
      slate: "border-slate-200 bg-slate-50 text-slate-800",
    };
    return light[tone];
  }

  const dark: Record<Tone, string> = {
    red: "border-red-500/30 bg-red-500/10 text-red-100",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-100",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-100",
    slate: "border-slate-500/20 bg-slate-500/10 text-slate-100",
  };
  return dark[tone];
}

function Card({
  children,
  className = "",
  theme,
}: {
  children: ReactNode;
  className?: string;
  theme: ThemeMode;
}) {
  return (
    <div className={cx("relative overflow-hidden rounded-[2rem] border p-5 backdrop-blur-xl", surface(theme), className)}>
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "slate",
  theme,
}: {
  children: ReactNode;
  tone?: Tone;
  theme: ThemeMode;
}) {
  return (
    <span className={cx("inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]", toneClasses(tone, theme))}>
      {children}
    </span>
  );
}

function SettingButton({
  active,
  title,
  detail,
  tone,
  theme,
  onClick,
}: {
  active: boolean;
  title: string;
  detail: string;
  tone: Tone;
  theme: ThemeMode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-[1.5rem] border p-4 text-left transition hover:-translate-y-1",
        active ? toneClasses(tone, theme) : tintSurface(theme),
      )}
    >
      <div className={cx("text-lg font-black", textStrong(theme))}>{title}</div>
      <p className={cx("mt-2 text-sm font-semibold leading-6", textMuted(theme))}>{detail}</p>
      <div className="mt-4">
        <Pill tone={active ? "green" : "slate"} theme={theme}>
          {active ? "Active" : "Choose"}
        </Pill>
      </div>
    </button>
  );
}

export default function WorkspaceSettingsPage() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [density, setDensity] = useState<Density>("comfortable");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    const storedDensity = window.localStorage.getItem(DENSITY_KEY);

    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      document.documentElement.dataset.sliceTheme = storedTheme;
    }

    if (storedDensity === "comfortable" || storedDensity === "compact") {
      setDensity(storedDensity);
    }
  }, []);

  function applyTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
    document.documentElement.dataset.sliceTheme = nextTheme;
    window.dispatchEvent(new Event("slice-theme-change"));
  }

  function applyDensity(nextDensity: Density) {
    setDensity(nextDensity);
    window.localStorage.setItem(DENSITY_KEY, nextDensity);
  }

  return (
    <main className={cx("relative min-h-screen overflow-hidden", isLightTheme(theme) ? "bg-sky-50 text-slate-950" : "bg-[#050505] text-white")}>
      <div className="pointer-events-none fixed inset-0">
        {isLightTheme(theme) ? (
          <>
            <div className="absolute left-[-16%] top-[-18%] h-[34rem] w-[34rem] rounded-full bg-sky-300/60 blur-3xl" />
            <div className="absolute right-[-12%] top-[10%] h-[32rem] w-[32rem] rounded-full bg-blue-200/75 blur-3xl" />
            <div className="absolute bottom-[-18%] left-[28%] h-[30rem] w-[30rem] rounded-full bg-cyan-200/75 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.13)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.13)_1px,transparent_1px)] bg-[size:44px_44px]" />
          </>
        ) : (
          <>
            <div className="absolute left-[-16%] top-[-18%] h-[34rem] w-[34rem] rounded-full bg-red-700/25 blur-3xl" />
            <div className="absolute right-[-12%] top-[10%] h-[32rem] w-[32rem] rounded-full bg-cyan-700/10 blur-3xl" />
            <div className="absolute bottom-[-18%] left-[28%] h-[30rem] w-[30rem] rounded-full bg-red-500/10 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px]" />
          </>
        )}
      </div>

      <div className="relative mx-auto grid max-w-[1600px] gap-4 px-4 py-4 md:px-6">
        <header className={cx("rounded-[2rem] border p-5 shadow-2xl backdrop-blur-xl", surface(theme))}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="blue" theme={theme}>Enhanced Settings</Pill>
                <Pill tone={theme === "light" ? "cyan" : "red"} theme={theme}>{theme} mode</Pill>
                <Pill tone="green" theme={theme}>High contrast text</Pill>
              </div>

              <h1 className={cx("mt-4 text-4xl font-black leading-tight tracking-tight md:text-6xl", textStrong(theme))}>
                Make Slice feel right without losing readability.
              </h1>

              <p className={cx("mt-3 max-w-5xl text-sm font-semibold leading-7", textMuted(theme))}>
                Light mode now uses a light blue gradient, white/sky surfaces, and dark slate typography so text remains visible. Dark mode keeps the black/red advisor command feel.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/workspace"
                prefetch={false}
                className={cx("rounded-2xl border px-4 py-3 text-sm font-black transition hover:-translate-y-0.5", toneClasses("slate", theme))}
              >
                Back to Workspace
              </Link>
              <Link
                href="/workspace/custom-board"
                prefetch={false}
                className={cx("rounded-2xl border px-4 py-3 text-sm font-black transition hover:-translate-y-0.5", toneClasses("cyan", theme))}
              >
                Custom Board
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card theme={theme}>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-400">
              Appearance
            </div>
            <h2 className={cx("mt-2 text-3xl font-black", textStrong(theme))}>Choose your workspace mode</h2>
            <p className={cx("mt-2 max-w-4xl text-sm font-semibold leading-7", textMuted(theme))}>
              These settings are stored in local storage and read by the workspace. When you return to the workspace, it will use the selected appearance.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <SettingButton
                active={theme === "dark"}
                title="Dark command mode"
                detail="Black/red advisor command styling with deep contrast and premium market-desk feel."
                tone="red"
                theme={theme}
                onClick={() => applyTheme("dark")}
              />
              <SettingButton
                active={theme === "light"}
                title="Light blue mode"
                detail="White and sky-blue gradient styling with dark slate text so every label stays readable."
                tone="cyan"
                theme={theme}
                onClick={() => applyTheme("light")}
              />
            </div>
          </Card>

          <Card theme={theme}>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-green-400">
              Live Preview
            </div>
            <div className={cx("mt-4 rounded-[1.5rem] border p-4", tintSurface(theme))}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={cx("text-sm font-black", textStrong(theme))}>Client Portal Inbox</div>
                  <div className={cx("mt-1 text-xs font-semibold", textMuted(theme))}>Readable in {theme} mode</div>
                </div>
                <Pill tone="purple" theme={theme}>Active</Pill>
              </div>

              <div className="mt-4 grid gap-2">
                <div className={cx("rounded-2xl border p-3", tintSurface(theme))}>
                  <div className={cx("text-xs font-black", textStrong(theme))}>Risk update submitted</div>
                  <div className={cx("mt-1 text-xs font-semibold", textMuted(theme))}>Dark text remains readable on light surfaces.</div>
                </div>
                <div className={cx("rounded-2xl border p-3", toneClasses("cyan", theme))}>
                  <div className={cx("text-xs font-black", textStrong(theme))}>Light blue gradient</div>
                  <div className={cx("mt-1 text-xs font-semibold", textMuted(theme))}>Blue accents without washing out text.</div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card theme={theme}>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
              Layout Density
            </div>
            <h3 className={cx("mt-2 text-2xl font-black", textStrong(theme))}>Fit more on screen</h3>
            <p className={cx("mt-2 text-sm font-semibold leading-6", textMuted(theme))}>
              Choose how compact the workspace should feel.
            </p>

            <div className="mt-5 grid gap-3">
              <SettingButton
                active={density === "comfortable"}
                title="Comfortable"
                detail="More breathing room and softer card spacing."
                tone="purple"
                theme={theme}
                onClick={() => applyDensity("comfortable")}
              />
              <SettingButton
                active={density === "compact"}
                title="Compact"
                detail="Tighter dashboard spacing for one-monitor advisor work."
                tone="green"
                theme={theme}
                onClick={() => applyDensity("compact")}
              />
            </div>
          </Card>

          <Card theme={theme}>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
              Search Overlay
            </div>
            <h3 className={cx("mt-2 text-2xl font-black", textStrong(theme))}>Always above content</h3>
            <p className={cx("mt-2 text-sm font-semibold leading-6", textMuted(theme))}>
              The workspace search dropdown now uses a fixed high-z-index overlay so it pulls over the screen and does not get hidden behind panels.
            </p>

            <div className={cx("mt-5 rounded-[1.5rem] border p-4", toneClasses("amber", theme))}>
              <div className={cx("text-sm font-black", textStrong(theme))}>Search behavior</div>
              <p className={cx("mt-2 text-xs font-semibold leading-5", textMuted(theme))}>
                Type, arrow down, press enter, or click the closest matching result.
              </p>
            </div>
          </Card>

          <Card theme={theme}>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
              Advisor Feel
            </div>
            <h3 className={cx("mt-2 text-2xl font-black", textStrong(theme))}>Premium but usable</h3>
            <p className={cx("mt-2 text-sm font-semibold leading-6", textMuted(theme))}>
              The goal is a workspace that looks high-end without becoming cluttered: fewer tabs, clearer routes, and stronger visual hierarchy.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Pill tone="red" theme={theme}>Dark red</Pill>
              <Pill tone="cyan" theme={theme}>Light blue</Pill>
              <Pill tone="green" theme={theme}>High contrast</Pill>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}