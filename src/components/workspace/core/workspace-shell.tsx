"use client";
import Link from "@/components/performance/responsive-link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Menu, X, Search, Network, FlaskConical, Layers3, Settings, ShieldCheck, LogOut, LayoutDashboard, Sparkles, ChevronDown } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WORKSPACE_NAVIGATION_SECTIONS, workspaceRouteMeta, workspaceToolIsActive } from "@/lib/workspace/navigation";
import { applyWorkspaceAppearance, readWorkspaceAppearance } from "@/lib/workspace/appearance";
import { GreenSliceLogo, WorkspaceIcon } from "@/components/workspace/core/workspace-ui";
import { WorkspaceSessionContext, type WorkspaceSession } from "@/components/workspace/premium/session";
import css from "@/components/workspace/premium/premium.module.css";
const CommandPalette = dynamic(() => import("@/components/workspace/core/workspace-command-palette"), { ssr: false });
const ResearchContextBar = dynamic(() => import("@/components/connected-workspace/research-context-bar"), { ssr: false });
type Auth = {
    user?: {
        id: string;
        name?: string;
        email?: string;
    } | null;
    access?: {
        firm?: {
            id: string;
            name?: string;
        } | null;
        membership?: {
            role?: string;
        } | null;
    } | null;
};
export default function WorkspaceShell({ children, initialSession }: {
    children: ReactNode;
    initialSession?: WorkspaceSession;
}) {
    const path = usePathname(), meta = useMemo(() => workspaceRouteMeta(path), [path]);
    const [session, setSession] = useState<WorkspaceSession>(initialSession ?? { loading: true, error: "", user: null, firm: null, role: "" });
    const [drawer, setDrawer] = useState(false), [command, setCommand] = useState(false), [contextOpen, setContextOpen] = useState(false), [error, setError] = useState("");
    const side = useRef<HTMLElement>(null), main = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        let alive = true;
        let fingerprint = "";
        const update = () => { const next = readWorkspaceAppearance(), key = JSON.stringify(next); if (key !== fingerprint) {
            fingerprint = key;
            applyWorkspaceAppearance(next);
        } };
        update();
        const media = window.matchMedia("(prefers-color-scheme: dark)"), events = ["storage", "slice-theme-change", "slice-workspace-settings-change"];
        events.forEach(e => window.addEventListener(e, update));
        media.addEventListener("change", update);
        const ctrl = new AbortController(), timeout = window.setTimeout(() => ctrl.abort(), 12000);
        void fetch("/api/auth/me", { cache: "no-store", signal: ctrl.signal }).then(async (r) => {
            if (!alive)
                return;
            if (r.status === 401) {
                setSession({ loading: false, error: "", user: null, firm: null, role: "" });
                return;
            }
            if (!r.ok)
                throw new Error("Session details are temporarily unavailable.");
            const a = await r.json() as Auth;
            setSession({ loading: false, error: "", user: a.user ?? null, firm: a.access?.firm ?? null, role: a.access?.membership?.role || "Firm access" });
        }).catch(() => { if (!alive)
            return; if (!ctrl.signal.aborted)
            setSession({ loading: false, error: "Session details could not be loaded. Refresh the page to retry.", user: null, firm: null, role: "" });
        else
            setSession(s => ({ ...s, loading: false, error: "Session check timed out. Refresh to retry." })); }).finally(() => window.clearTimeout(timeout));
        return () => { alive = false; ctrl.abort(); window.clearTimeout(timeout); events.forEach(e => window.removeEventListener(e, update)); media.removeEventListener("change", update); };
    }, []);
    useEffect(() => { setDrawer(false); setCommand(false); }, [path]);
    useEffect(() => { const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand(v => !v);
    } if (e.key === "Escape") {
        setDrawer(false);
        setCommand(false);
    } }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); }, []);
    useEffect(() => {
        if (!drawer)
            return;
        const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        if (main.current)
            main.current.inert = true;
        side.current?.querySelector<HTMLButtonElement>("button")?.focus();
        const trap = (e: KeyboardEvent) => { if (e.key !== "Tab")
            return; const nodes = Array.from(side.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,[tabindex="0"]') ?? []).filter(n => n.getClientRects().length); const first = nodes[0], last = nodes.at(-1); if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
        } };
        const resize = () => { if (window.innerWidth > 760)
            setDrawer(false); };
        document.addEventListener("keydown", trap);
        window.addEventListener("resize", resize);
        return () => { document.body.style.overflow = overflow; if (main.current)
            main.current.inert = false; document.removeEventListener("keydown", trap); window.removeEventListener("resize", resize); (trigger.current || previous)?.focus(); };
    }, [drawer]);
    async function signOut() { try {
        const r = await fetch("/api/auth/logout", { method: "POST" });
        if (!r.ok)
            throw new Error();
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const k = sessionStorage.key(i);
            if (k?.startsWith("slice-research-context-v1:"))
                sessionStorage.removeItem(k);
        }
        window.dispatchEvent(new Event("slice-session-ended"));
        window.location.assign("/advisor-login");
    }
    catch {
        setError("Sign out did not complete. Retry before leaving a shared device.");
    } }
    const identity = session.user?.id ? `${session.user.id}:${session.firm?.id ?? "private"}` : null;
    const shortcuts = [{ href: "/workspace", title: "Overview", Icon: LayoutDashboard }, { href: "/workspace/personal-bot", title: "AI Studio", Icon: Sparkles }, { href: "/workspace/connected", title: "Connected workspace", Icon: Network }, { href: "/workspace/intelligence/strategy-lab", title: "Strategy Lab", Icon: FlaskConical }, { href: "/workspace/intelligence/scenarios", title: "Scenario Studio", Icon: Layers3 }];
    return <WorkspaceSessionContext.Provider value={session}><div className={`${css.root} slice-workspace-theme-root`}><a className={css.skip} href="#workspace-main">Skip to workspace</a><div className={css.shell}>
  {drawer && <button className={css.scrim} aria-label="Close navigation" onClick={() => setDrawer(false)}/>}
  <aside ref={side} className={`${css.sidebar} ${drawer ? css.drawer : ""}`} id="slice-premium-navigation" role={drawer ? "dialog" : undefined} aria-modal={drawer ? true : undefined} aria-label="Workspace navigation">
   <div className={css.brand}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Link href="/workspace" prefetch={false}><GreenSliceLogo /></Link><button className={`${css.iconButton} ${css.mobileOnly}`} onClick={() => setDrawer(false)} aria-label="Close navigation"><X /></button></div><p>Evidence into action.</p></div>
   <nav aria-label="Primary"><div className={css.group}><p className={css.groupTitle}>Your command space</p>{shortcuts.map(({ href, title, Icon }) => <Link key={href} href={href} prefetch={false} className={`${css.navItem} ${path === href ? css.navActive : ""}`} aria-current={path === href ? "page" : undefined}><Icon />{title}</Link>)}</div>
    {WORKSPACE_NAVIGATION_SECTIONS.map(s => <div className={css.group} key={s.id}><p className={css.groupTitle}>{s.label}</p>{s.tools.filter(t => !shortcuts.some(x => x.href === t.href)).map(t => <Link key={t.id} href={t.href} prefetch={false} className={`${css.navItem} ${workspaceToolIsActive(path, t.href) ? css.navActive : ""}`} aria-current={workspaceToolIsActive(path, t.href) ? "page" : undefined}><WorkspaceIcon name={t.icon}/>{t.label}</Link>)}</div>)}
   </nav><div className={css.navFooter}><Link className={css.navItem} href="/workspace/settings" prefetch={false}><Settings />Settings</Link><Link className={css.navItem} href="/security" prefetch={false}><ShieldCheck />Security</Link><button className={css.navItem} onClick={() => void signOut()}><LogOut />Sign out</button><div className={css.identity}><span className={css.avatar}>{session.user?.name?.slice(0, 1).toUpperCase() || "S"}</span><div><strong>{session.user?.name || "Slice workspace"}</strong><small>{session.role || "Protected access"}</small></div></div></div></aside>
   <div ref={main} className={css.main}><header className={css.topbar}><button ref={trigger} className={`${css.iconButton} ${css.mobileOnly}`} aria-label="Open navigation" aria-controls="slice-premium-navigation" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu /></button><div className={css.breadcrumb}>{session.firm?.name || "Slice"} / Workspace<strong>{path === "/workspace" ? "Overview" : path === "/workspace/personal-bot" ? "AI Studio" : meta.label}</strong></div><div className={css.topActions}><button className={css.searchTrigger} onClick={() => setCommand(true)} aria-label="Search workspace"><Search size={14}/><span>Find a workspace</span><kbd>Ctrl K</kbd></button><button className={`${css.button} ${css.contextToggle}`} onClick={() => setContextOpen(v => !v)} aria-expanded={contextOpen}><Network size={14}/>Context<ChevronDown size={12}/></button></div></header>
    {contextOpen && <div className={css.contextRegion}><Suspense fallback={<p className={css.muted}>Loading research context…</p>}><ResearchContextBar identity={identity}/></Suspense></div>}
    {error && <p role="alert" className={`${css.notice} ${css.error}`}>{error}</p>}<div id="workspace-main" tabIndex={-1}>{children}</div></div>
  </div>{command && <CommandPalette open onClose={() => setCommand(false)}/>}</div></WorkspaceSessionContext.Provider>;
}
