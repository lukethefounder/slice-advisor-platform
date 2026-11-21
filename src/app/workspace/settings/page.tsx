"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDownToLine, ArrowUpRight, BellRing, Check, ChevronRight, CircleUserRound, Database, Eye, KeyRound, Link2, LoaderCircle, Palette, RefreshCw, RotateCcw, Save, Search, Settings2, ShieldCheck, SlidersHorizontal, UsersRound } from "lucide-react";
import {
  clearWorkspaceAppearancePreview, ensureNeuralDefaultPreference, hasWorkspaceAppearanceForVisit,
  notifyWorkspaceAppearanceChanged, previewWorkspaceAppearance, readSavedWorkspaceAppearancePreferences,
  rememberWorkspaceAppearanceForVisit, WORKSPACE_SETTINGS_KEY, THEME_KEY, DENSITY_KEY, ACCENT_KEY,
} from "@/lib/workspace/appearance";
import { DEFAULT_APPEARANCE, DEFAULT_NOTIFICATIONS, validateAppearance, type AccountSettingsResponse, type AppearanceSettings, type NotificationPreference } from "@/lib/account-settings/contracts";
import FounderBrokerSettings from "@/components/agent-broker/broker-settings";
import ResearchSharingSettings from "@/components/agent-broker/research-sharing-settings";
import css from "@/components/account-settings/settings-console.module.css";

type Section = "overview" | "profile" | "appearance" | "notifications" | "connections" | "team" | "security" | "data";
type EditableSection = "profile" | "appearance" | "notifications";
type LocalSettings = { appearance?: Partial<AppearanceSettings>; workspace?: { compactSidebar?: boolean; commandBarPinned?: boolean }; privacy?: { allowBrowserStorage?: boolean }; [key: string]: unknown };
type FormSettings = Pick<AccountSettingsResponse, "appearance" | "account" | "notifications"> & { privacy: { allowBrowserStorage: boolean } };
type Integration = { key: string; label: string; category: string; configured: boolean; liveEnabled?: boolean; safeStatus: string; note: string };
type Connections = { integrations: Integration[]; checkedAt: string };
const SECTIONS: Array<{ id: Section; title: string; note: string; keywords: string; icon: typeof Settings2 }> = [
  { id: "overview", title: "Overview", note: "Your control center", keywords: "home dashboard", icon: SlidersHorizontal },
  { id: "profile", title: "Profile", note: "Identity & time zone", keywords: "name email phone contact account", icon: CircleUserRound },
  { id: "appearance", title: "Appearance", note: "Display & accessibility", keywords: "theme dark light motion reduce text size density color navigation", icon: Palette },
  { id: "notifications", title: "Alerts", note: "Signals on your terms", keywords: "email sms push digest quiet hours cooldown threshold score", icon: BellRing },
  { id: "connections", title: "Connections", note: "Provider configuration", keywords: "integrations api market ai email storage neo4j broker alpaca trading", icon: Link2 },
  { id: "team", title: "Team & access", note: "Bring your team together", keywords: "invite members permissions firm colleague", icon: UsersRound },
  { id: "security", title: "Security", note: "Protect your account", keywords: "password two factor 2fa mfa sessions authenticator login recovery", icon: ShieldCheck },
  { id: "data", title: "Data & account", note: "Export & account controls", keywords: "privacy download deactivate delete retention browser storage research sharing consent", icon: Database },
];
const EMPTY_PROFILE = { id: "", name: "", email: "", phone: "", timezone: "America/Phoenix", platformStatus: "", createdAt: "" };
const timezones = ["America/Phoenix", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "UTC"];

function readLocalSettings(): LocalSettings {
  if (typeof window === "undefined") return {};
  const stored = ensureNeuralDefaultPreference().stored as LocalSettings;
  return { ...stored, appearance: readSavedWorkspaceAppearancePreferences(), ...(hasWorkspaceAppearanceForVisit() ? { privacy: { ...stored.privacy, allowBrowserStorage: false } } : {}) };
}
function normalizeApiResponse(api: Partial<AccountSettingsResponse> & { appearance?: Partial<AppearanceSettings> }, local: LocalSettings = {}): FormSettings {
  const raw = { ...DEFAULT_APPEARANCE, ...api.appearance, ...local.appearance,
    compactSidebar: local.appearance?.compactSidebar ?? local.workspace?.compactSidebar ?? api.appearance?.compactSidebar ?? false,
    commandBarPinned: local.appearance?.commandBarPinned ?? local.workspace?.commandBarPinned ?? api.appearance?.commandBarPinned ?? true };
  raw.density = String(raw.density).toLowerCase() as AppearanceSettings["density"];
  if (String(raw.accent) === "Ruby" || String(raw.accent) === "Crimson") raw.accent = "emerald";
  if (String(raw.accent) === "Market Green") raw.accent = "market-green";
  if (String(raw.accent) === "Graphite") raw.accent = "graphite";
  let appearance = { ...DEFAULT_APPEARANCE };
  try { appearance = validateAppearance(raw); } catch { /* Invalid browser preferences cannot block account settings. */ }
  return { account: { ...EMPTY_PROFILE, ...api.account }, appearance,
    notifications: api.notifications?.map(item => ({ ...item })) ?? DEFAULT_NOTIFICATIONS.map(item => ({ ...item })),
    privacy: { allowBrowserStorage: local.privacy?.allowBrowserStorage ?? api.privacy?.allowBrowserStorage ?? true } };
}
function saveLocalSettings(settings: FormSettings) {
  if (typeof window === "undefined") return false;
  let browserStored = false;
  if (!settings.privacy.allowBrowserStorage) {
    rememberWorkspaceAppearanceForVisit(settings.appearance);
    try { for (const key of [WORKSPACE_SETTINGS_KEY, THEME_KEY, DENSITY_KEY, ACCENT_KEY]) window.localStorage.removeItem(key); } catch { /* Visit preference remains usable when storage is blocked. */ }
  } else {
    try {
      const prior = readLocalSettings();
      const next = { ...prior, appearance: settings.appearance, workspace: { ...prior.workspace, compactSidebar: settings.appearance.compactSidebar, commandBarPinned: settings.appearance.commandBarPinned }, privacy: { ...prior.privacy, allowBrowserStorage: true } };
      window.localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(next));
      window.localStorage.setItem(THEME_KEY, settings.appearance.mode); window.localStorage.setItem(DENSITY_KEY, settings.appearance.density); window.localStorage.setItem(ACCENT_KEY, settings.appearance.accent);
      rememberWorkspaceAppearanceForVisit(null); browserStored = true;
    } catch { rememberWorkspaceAppearanceForVisit(settings.appearance); }
  }
  notifyWorkspaceAppearanceChanged();
  return browserStored;
}
async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
  const value = await response.json(); init.signal?.throwIfAborted();
  if (!response.ok || value?.ok === false) throw new Error(typeof value?.error === "string" ? value.error : value?.error?.message || "The request could not be completed.");
  return value as T;
}
function sectionValue(settings: FormSettings, section: EditableSection) {
  return section === "profile" ? settings.account : section === "appearance" ? { appearance: settings.appearance, privacy: settings.privacy } : settings.notifications;
}
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const date = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : "Not recorded";
function Field({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) { return <label className={css.field}><span>{title}</span>{children}{hint && <small>{hint}</small>}</label>; }
function Toggle({ title, description, checked, onChange, disabled = false }: { title: string; description: string; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return <label className={css.toggle}><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} disabled={disabled} /><span className={css.switch} aria-hidden="true" /></label>;
}
function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) { return <header className={css.sectionHeading}><p className={css.eyebrow}>{eyebrow}</p><h2>{title}</h2><p>{children}</p></header>; }

export default function WorkspaceSettingsPage() {
  const mounted = useRef(true), requestSequence = useRef(0), loader = useRef<AbortController | null>(null);
  const [settings, setSettings] = useState<FormSettings>(() => normalizeApiResponse({}, readLocalSettings()));
  const [saved, setSaved] = useState<FormSettings | null>(null), [account, setAccount] = useState<AccountSettingsResponse | null>(null);
  const [activeTab, setActiveTab] = useState<Section>("overview"), [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState<EditableSection | null>(null), [initialized, setInitialized] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean }>({ text: "", error: false });
  const [connections, setConnections] = useState<Connections | null>(null), [connectionsError, setConnectionsError] = useState(""), [connectionsLoading, setConnectionsLoading] = useState(false), [connectionRevision, setConnectionRevision] = useState(0);
  const [downloading, setDownloading] = useState(false), [dangerAction, setDangerAction] = useState<"deactivateAccount" | "deleteAccount">("deactivateAccount");
  const [confirmation, setConfirmation] = useState(""), [currentPassword, setCurrentPassword] = useState(""), [factorCode, setFactorCode] = useState(""), [closing, setClosing] = useState(false);
  const dirty = useMemo(() => ({ profile: saved !== null && !same(sectionValue(settings, "profile"), sectionValue(saved, "profile")), appearance: saved !== null && !same(sectionValue(settings, "appearance"), sectionValue(saved, "appearance")), notifications: saved !== null && !same(settings.notifications, saved.notifications) }), [saved, settings]);
  const anyDirty = Object.values(dirty).some(Boolean);

  const loadSettings = useCallback(async () => {
    loader.current?.abort(); const controller = new AbortController(); loader.current = controller; const id = ++requestSequence.current;
    setLoading(true); setNotice({ text: "", error: false });
    try {
      const api = await fetchJson<AccountSettingsResponse>("/api/account-settings", { signal: controller.signal });
      if (!mounted.current || controller.signal.aborted || id !== requestSequence.current) return;
      if (!api.account?.id || !api.ok) throw new Error("The account response was incomplete. Retry to load your settings.");
      const next = normalizeApiResponse(api, readLocalSettings());
      setAccount(api); setSettings(next); setSaved(next); setInitialized(true);
    } catch (error) {
      if (!mounted.current || controller.signal.aborted || id !== requestSequence.current) return;
      setNotice({ text: error instanceof Error ? error.message : "Settings could not be loaded.", error: true });
    } finally { if (mounted.current && id === requestSequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true; void loadSettings();
    const restoreTab = () => { const value = window.location.hash.slice(1); if (value === "founder-broker") setActiveTab("connections"); else if (value === "research-sharing") setActiveTab("data"); else if (SECTIONS.some(item => item.id === value)) setActiveTab(value as Section); };
    restoreTab(); window.addEventListener("hashchange", restoreTab);
    return () => { mounted.current = false; requestSequence.current++; loader.current?.abort(); clearWorkspaceAppearancePreview(); window.removeEventListener("hashchange", restoreTab); };
  }, [loadSettings]);
  useEffect(() => { if (initialized) previewWorkspaceAppearance(settings.appearance); }, [initialized, settings.appearance]);
  useEffect(() => {
    if (!anyDirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect); return () => window.removeEventListener("beforeunload", protect);
  }, [anyDirty]);
  useEffect(() => {
    if (activeTab !== "connections" || !account?.account.id) return;
    const controller = new AbortController(); setConnectionsLoading(true); setConnectionsError("");
    void fetchJson<Connections>("/api/integrations/status", { signal: controller.signal }).then(value => {
      if (!Array.isArray(value.integrations)) throw new Error("Connection status was incomplete. Refresh to retry.");
      if (!controller.signal.aborted) setConnections(value);
    }).catch(error => { if (!controller.signal.aborted) setConnectionsError(error instanceof Error ? error.message : "Connection status is unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setConnectionsLoading(false); });
    return () => controller.abort();
  }, [activeTab, account?.account.id, connectionRevision]);

  function selectTab(section: Section) { setActiveTab(section); setSearch(""); window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${section}`); }
  function updateAppearance<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) { setInitialized(true); setSettings(previous => ({ ...previous, appearance: { ...previous.appearance, [key]: value } })); }
  function updatePrivacy(_key: "allowBrowserStorage", value: boolean) { setSettings(previous => ({ ...previous, privacy: { allowBrowserStorage: value } })); }
  function resetSection(section: EditableSection) {
    if (!saved) return;
    setSettings(previous => section === "profile" ? { ...previous, account: { ...saved.account } } : section === "appearance" ? { ...previous, appearance: { ...saved.appearance }, privacy: { ...saved.privacy } } : { ...previous, notifications: saved.notifications.map(item => ({ ...item })) });
    setNotice({ text: "Unsaved changes in this section were discarded.", error: false });
  }
  async function saveSettings(section: EditableSection = "appearance") {
    if (!account || saving || closing) return;
    const snapshot = structuredClone(settings), owner = account.account.id, sequence = requestSequence.current;
    const body = section === "profile" ? { action: "saveProfile", account: { name: snapshot.account.name, email: snapshot.account.email, phone: snapshot.account.phone, timezone: snapshot.account.timezone } }
      : section === "appearance" ? { action: "saveAppearance", appearance: snapshot.appearance, allowBrowserStorage: snapshot.privacy.allowBrowserStorage }
      : { action: "saveNotifications", notifications: snapshot.notifications };
    setSaving(section); setNotice({ text: "", error: false });
    try {
      const api = await fetchJson<AccountSettingsResponse>("/api/account-settings", { method: "POST", body: JSON.stringify(body) });
      if (!api.ok || api.account?.id !== owner) throw new Error("The save response did not match your account. Reload Settings to confirm the saved state.");
      const canonical = normalizeApiResponse(api);
      // A completed explicit save may outlive navigation; persist the deliberate choice without reopening a preview.
      let browserStorageBlocked = false;
      if (section === "appearance") { browserStorageBlocked = !saveLocalSettings({ ...snapshot, appearance: canonical.appearance, privacy: canonical.privacy }) && canonical.privacy.allowBrowserStorage; if (!mounted.current) clearWorkspaceAppearancePreview(); }
      if (!mounted.current || sequence !== requestSequence.current) return;
      setAccount(api);
      setSaved(previous => previous ? section === "profile" ? { ...previous, account: canonical.account } : section === "appearance" ? { ...previous, appearance: canonical.appearance, privacy: canonical.privacy } : { ...previous, notifications: canonical.notifications } : canonical);
      setSettings(previous => {
        if (!same(sectionValue(previous, section), sectionValue(snapshot, section))) return previous;
        return section === "profile" ? { ...previous, account: canonical.account } : section === "appearance" ? { ...previous, appearance: canonical.appearance, privacy: canonical.privacy } : { ...previous, notifications: canonical.notifications };
      });
      setNotice({ text: browserStorageBlocked ? "Appearance saved to your account. This browser blocked local storage, so its display choice is retained for this visit." : `${section === "notifications" ? "Alert preferences" : section === "appearance" ? "Appearance" : "Profile"} saved.`, error: false });
    } catch (error) { if (mounted.current && sequence === requestSequence.current) setNotice({ text: error instanceof Error ? error.message : "Settings could not be saved.", error: true }); }
    finally { if (mounted.current && sequence === requestSequence.current) setSaving(null); }
  }
  async function downloadPreferences() {
    setDownloading(true); setNotice({ text: "", error: false });
    try {
      const data = await fetchJson<unknown>("/api/account-settings?export=account-preferences"); if (!mounted.current) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "Slice_Account_Preferences.json"; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice({ text: "Your account preference export is ready.", error: false });
    } catch (error) { if (mounted.current) setNotice({ text: error instanceof Error ? error.message : "The export failed.", error: true }); }
    finally { if (mounted.current) setDownloading(false); }
  }
  async function closeAccount() {
    const phrase = dangerAction === "deactivateAccount" ? "DEACTIVATE" : "DELETE MY ACCOUNT";
    if (confirmation !== phrase || !currentPassword || closing) return;
    setClosing(true); setNotice({ text: "", error: false });
    try {
      const result = await fetchJson<{ ok: boolean; redirectTo: string }>("/api/account-settings", { method: "POST", body: JSON.stringify({ action: dangerAction, confirmation, currentPassword, factorCode }) });
      if (mounted.current) window.location.assign(result.redirectTo);
    } catch (error) { if (mounted.current) { setNotice({ text: error instanceof Error ? error.message : "The account action failed.", error: true }); setClosing(false); } }
    finally { if (mounted.current) { setCurrentPassword(""); setFactorCode(""); } }
  }
  function notification(index: number, patch: Partial<NotificationPreference>) { setSettings(previous => ({ ...previous, notifications: previous.notifications.map((item, i) => i === index ? { ...item, ...patch } : item) })); }
  function saveBar(section: EditableSection) { return <footer className={css.saveBar}><span>{dirty[section] ? "Unsaved changes in this section" : "All changes in this section saved"}</span><div><button className={css.secondary} disabled={!dirty[section] || !!saving || closing} onClick={() => resetSection(section)}><RotateCcw size={14} />Discard</button><button className={css.primary} disabled={!dirty[section] || !!saving || closing} onClick={() => void saveSettings(section)}>{saving === section ? <LoaderCircle size={14} className={css.spin} /> : <Save size={14} />}{saving === section ? "Saving…" : "Save changes"}</button></div></footer>; }
  const enabledNotifications = settings.notifications.filter(item => item.enabled).length;
  const visibleSections = SECTIONS.filter(item => `${item.title} ${item.note} ${item.keywords}`.toLowerCase().includes(search.trim().toLowerCase()));
  const section = SECTIONS.find(item => item.id === activeTab)!;
  const busy = loading || !!saving || closing;

  return <main className={css.console}>
    <header className={css.hero}>
      <div className={css.heroNetwork} aria-hidden="true"><svg viewBox="0 0 400 220"><path d="M30 175L112 45L204 117L300 35L370 170L204 117L126 195L112 45M30 175L126 195L300 35M112 45L370 170" />{[[30,175],[112,45],[204,117],[300,35],[370,170],[126,195]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i===2?9:5} style={{animationDelay:`${i*.4}s`}} />)}</svg></div>
      <div><p className={css.eyebrow}><Settings2 size={13} />SLICE / ACCOUNT CONSOLE</p><h1>Make Slice <em>yours.</em></h1><p>A focused space for your identity, working environment, connections, and account protection.</p><div className={css.identity}><span>{account?.account.name || "Your workspace"}</span><span>{account?.memberships[0]?.firmName || "Personal account"}</span><span>{anyDirty ? "Changes waiting to be saved" : "Preferences stay under your control"}</span></div></div>
      <Link href="/workspace" className={css.heroLink} prefetch={false}>Back to workspace<ArrowUpRight size={15} /></Link>
    </header>
    <div className={css.layout}>
      <aside className={css.sidebar}>
        <label className={css.search}><Search size={15}/><input aria-label="Search settings" placeholder="Find a setting…" value={search} onChange={event=>setSearch(event.target.value)} /></label>
        <nav aria-label="Settings sections">{visibleSections.map(item=><button key={item.id} onClick={()=>selectTab(item.id)} aria-current={activeTab===item.id?"page":undefined}><item.icon size={17}/><span><strong>{item.title}</strong><small>{item.note}</small></span>{(item.id==="profile"||item.id==="appearance"||item.id==="notifications")&&dirty[item.id]?<span className={css.dirtyDot} aria-label="Unsaved changes"/>:<ChevronRight size={13}/>}</button>)}</nav>
        {!visibleSections.length&&<p className={css.empty}>No settings match. <button onClick={()=>setSearch("")}>Clear search</button></p>}
        <Link href="/security" className={css.sidebarSecurity} prefetch={false}><ShieldCheck size={18}/><span>Security Center<small>Sessions, authenticator & audit</small></span><ArrowUpRight size={14}/></Link>
      </aside>
      <section className={css.content} aria-label={section.title}>
        {notice.text&&<div role={notice.error?"alert":"status"} className={css.notice} data-error={notice.error}>{notice.text}{!account&&!loading&&<button className={css.secondary} onClick={()=>void loadSettings()}><RefreshCw size={13}/>Retry</button>}</div>}
        {loading?<div className={css.loading} role="status"><LoaderCircle size={25} className={css.spin}/><h2>Loading your account</h2><p>Fetching your saved preferences and access details.</p></div>:!account?<div className={css.empty}><h2>Settings are unavailable</h2><p>Your saved display preferences remain in place. Sign in or retry the connection.</p><Link href="/founder-login" className={css.primary}>Sign in<ArrowUpRight size={15}/></Link></div>:<>
          {activeTab==="overview"&&<><Heading eyebrow="YOUR WORKSPACE" title={`Welcome, ${account.account.name.split(" ")[0] || "back"}.`}>Tune how you work, see what is connected, and keep your account protected.</Heading>
            <div className={css.metrics}><div><span>Account</span><strong>{account.account.platformStatus}</strong><small>Member since {new Date(account.account.createdAt).toLocaleDateString()}</small></div><div><span>Authenticator</span><strong>{account.security.mfaEnabled?"Enabled":"Set up"}</strong><Link href="/security" prefetch={false}>Review protection<ArrowUpRight size={12}/></Link></div><div><span>Alert preferences</span><strong>{enabledNotifications} <small>enabled channels</small></strong><button onClick={()=>selectTab("notifications")}>Adjust filters<ArrowUpRight size={12}/></button></div></div>
            <div className={css.quickGrid}>{SECTIONS.filter(item=>!["overview","data"].includes(item.id)).map(item=><button className={css.quickCard} key={item.id} onClick={()=>selectTab(item.id)}><item.icon size={22}/><strong>{item.title}</strong><span>{item.note}</span><ArrowUpRight size={17}/></button>)}</div>
            <div className={css.featureRow}><div><p className={css.eyebrow}>YOUR RESEARCH, YOUR RULES</p><h3>Build an approach that fits your process.</h3><p>Choose research weights in Intelligence or create your own entry and exit criteria in Strategy Studio.</p></div><Link href="/workspace/strategy-lab" className={css.secondary} prefetch={false}>Open Strategy Studio<ArrowUpRight size={15}/></Link></div>
          </>}
          {activeTab==="profile"&&<><Heading eyebrow="ACCOUNT IDENTITY" title="Your profile.">Keep your name, contact number, and time zone current. Team roles are managed separately by your firm.</Heading>
            <div className={css.accountIdentity}><span className={css.avatar}>{account.account.name.slice(0,2).toUpperCase()}</span><div><strong>{account.account.name}</strong><span>{account.account.email}</span></div><span className={css.badge}>{account.account.platformStatus}</span></div>
            <fieldset className={css.formGrid} disabled={busy}><Field title="Full name"><input maxLength={120} autoComplete="name" value={settings.account.name} onChange={event=>setSettings(previous=>({...previous,account:{...previous.account,name:event.target.value}}))}/></Field><Field title="Contact number" hint="Stored as your contact detail. SMS delivery requires its own configured provider."><input maxLength={50} type="tel" autoComplete="tel" value={settings.account.phone} onChange={event=>setSettings(previous=>({...previous,account:{...previous.account,phone:event.target.value}}))}/></Field><Field title="Sign-in email" hint="This account identity is read-only here. An unverified address cannot replace it."><input value={settings.account.email} readOnly type="email"/></Field><Field title="Time zone" hint="Quiet hours for supported alert delivery use this time zone."><input list="slice-timezones" maxLength={100} value={settings.account.timezone} onChange={event=>setSettings(previous=>({...previous,account:{...previous.account,timezone:event.target.value}}))}/><datalist id="slice-timezones">{timezones.map(zone=><option key={zone} value={zone}/>)}</datalist></Field></fieldset>{saveBar("profile")}
          </>}
          {activeTab==="appearance"&&<><Heading eyebrow="DISPLAY & ACCESSIBILITY" title="Set your atmosphere.">Preview changes as you make them. Save to keep them; leaving this page restores your saved appearance.</Heading>
            <fieldset disabled={busy} className={css.appearanceFields}><div className={css.themeGrid}>{(["dark","light","system"] as const).map(mode=><button type="button" key={mode} onClick={()=>updateAppearance("mode",mode)} aria-pressed={settings.appearance.mode===mode} className={css.themeChoice}><span className={css.themePreview} data-theme={mode}><i/><i/><i/><i/></span><strong>{mode==="system"?"Follow system":`${mode[0].toUpperCase()}${mode.slice(1)} neural`}</strong>{settings.appearance.mode===mode&&<Check size={15}/>}</button>)}</div>
            <div className={css.formGrid}><Field title="Text size"><select value={settings.appearance.textScale} onChange={event=>updateAppearance("textScale",event.target.value as AppearanceSettings["textScale"])}><option value="standard">Standard</option><option value="large">Large</option><option value="extra-large">Extra large</option></select></Field><Field title="Content density"><select value={settings.appearance.density} onChange={event=>updateAppearance("density",event.target.value as AppearanceSettings["density"])}><option value="comfortable">Comfortable</option><option value="compact">Compact</option><option value="spacious">Spacious</option></select></Field><Field title="Accent"><select value={settings.appearance.accent} onChange={event=>updateAppearance("accent",event.target.value as AppearanceSettings["accent"])}><option value="market-green">Neural mint</option><option value="emerald">Emerald</option><option value="teal">Teal</option><option value="blue">Cyan blue</option><option value="graphite">Graphite</option></select></Field><Field title="Panel style"><select value={settings.appearance.cardStyle} onChange={event=>updateAppearance("cardStyle",event.target.value as AppearanceSettings["cardStyle"])}><option value="glass">Layered glass</option><option value="solid">Solid</option><option value="minimal">Minimal</option></select></Field></div>
            <div className={css.toggleGroup}><Toggle title="Reduce motion" description="Quiet the neural animations and moving effects while keeping the full interface." checked={settings.appearance.motion==="reduced"} onChange={value=>updateAppearance("motion",value?"reduced":"full")}/><Toggle title="Compact navigation" description="Use the narrower workspace navigation layout." checked={settings.appearance.compactSidebar} onChange={value=>updateAppearance("compactSidebar",value)}/><Toggle title="Pin the command bar" description="Keep the command bar in its pinned workspace position." checked={settings.appearance.commandBarPinned} onChange={value=>updateAppearance("commandBarPinned",value)}/><Toggle title="Remember appearance in this browser" description="When off, saved appearance stays available for this visit and local appearance keys are removed. Other workspace storage is managed by its own features." checked={settings.privacy.allowBrowserStorage} onChange={value=>updatePrivacy("allowBrowserStorage",value)}/></div></fieldset>{saveBar("appearance")}
          </>}
          {activeTab==="notifications"&&<><Heading eyebrow="SIGNAL FILTERS" title="Hear what matters.">Choose which market alerts qualify for each channel. Quiet hours use {saved?.account.timezone || account.account.timezone}; configuration and delivery are shown separately.</Heading>
            <div className={css.info}><BellRing size={18}/><p>Dashboard alerts and digests stay inside Slice. Advisor email delivery requires an enabled email provider. SMS and push preferences are retained for their workflows; their simulated queue records do not confirm external delivery.</p><button onClick={()=>selectTab("connections")}>Check connections<ArrowUpRight size={13}/></button></div>
            <fieldset disabled={busy} className={css.channelList}>{settings.notifications.map((item,index)=><article key={item.channel} className={css.channel}><Toggle title={item.channel==="Digest"?"Daily digest":item.channel} description={item.channel==="Dashboard"?"In-app alert feed":item.channel==="Email"?"Advisor email alert filtering":item.channel==="Digest"?"Saved daily intelligence summaries":"Workflow preferences · verify external delivery separately"} checked={item.enabled} onChange={value=>notification(index,{enabled:value})}/><details><summary>Thresholds, quiet hours & frequency<ChevronRight size={13}/></summary><div className={css.formGrid}><Field title="Minimum score"><input type="number" min={0} max={100} step={1} value={Number.isFinite(item.minScore)?item.minScore:""} onChange={event=>notification(index,{minScore:event.target.valueAsNumber})}/></Field><Field title="Minimum urgency"><select value={item.minUrgency} onChange={event=>notification(index,{minUrgency:event.target.value as NotificationPreference["minUrgency"]})}>{["Low","Medium","High","Critical"].map(value=><option key={value}>{value}</option>)}</select></Field>{item.channel!=="Dashboard"&&item.channel!=="Digest"&&<><Field title="Quiet hours start" hint="Leave both times empty to turn quiet hours off."><input type="time" value={item.quietHoursStart||""} onChange={event=>notification(index,{quietHoursStart:event.target.value||null})}/></Field><Field title="Quiet hours end"><input type="time" value={item.quietHoursEnd||""} onChange={event=>notification(index,{quietHoursEnd:event.target.value||null})}/></Field><Field title="Minimum interval (minutes)"><input type="number" min={0} max={1440} step={1} value={Number.isFinite(item.cooldownMinutes)?item.cooldownMinutes:""} onChange={event=>notification(index,{cooldownMinutes:event.target.valueAsNumber})}/></Field></>}{item.channel!=="Digest"&&<Toggle title="Digest only" description="Suppress individual alerts for this channel; review your in-app daily digest." checked={item.digestOnly} onChange={value=>notification(index,{digestOnly:value})}/>}</div></details></article>)}</fieldset>{saveBar("notifications")}
            <div className={css.delivery}><h3>Recent delivery records</h3><p>Provider-reported delivery is distinct from a simulation or an in-app record.</p>{account.deliveries.length?<div className={css.tableWrap}><table><thead><tr><th>Channel</th><th>Evidence</th><th>Recorded</th></tr></thead><tbody>{account.deliveries.map(row=><tr key={row.id}><td>{row.channel}</td><td>{(row.channel==="Dashboard"||row.channel==="Digest")?`In-app · ${row.status}`:row.simulated?`Simulation · ${row.status}`:row.status==="Delivered"?"Provider reported delivery":row.status}</td><td>{date(row.createdAt)}</td></tr>)}</tbody></table></div>:<p>No delivery records yet.</p>}</div>
          </>}
          {activeTab==="connections"&&<FounderBrokerSettings />}
          {activeTab==="connections"&&<><Heading eyebrow="SERVICE CONFIGURATION" title="Know what is connected.">Check configuration for the providers behind research, market data, communication, and storage.</Heading><div className={css.tools}><span>Last checked: {date(connections?.checkedAt)}</span><button className={css.secondary} disabled={connectionsLoading} onClick={()=>setConnectionRevision(value=>value+1)}><RefreshCw size={14} className={connectionsLoading?css.spin:undefined}/>Refresh status</button></div><p className={css.note}>Configured means the required server settings are present. A successful live request is needed to establish service availability and data entitlement.</p>{connectionsError&&<div className={css.notice} data-error="true" role="alert">{connectionsError}</div>}{connectionsLoading&&!connections?<div className={css.loading} role="status"><LoaderCircle className={css.spin}/>Reading configuration…</div>:<div className={css.connectionGrid}>{connections?.integrations.map(item=><article key={item.key} className={css.connection}><div><Link2 size={19}/><span className={css.badge} data-status={item.safeStatus}>{item.safeStatus==="Ready"?"Configured":item.safeStatus}</span></div><small>{item.category}</small><h3>{item.label}</h3><p>{item.note}</p>{item.liveEnabled!==undefined&&<span className={css.small}>Live delivery {item.liveEnabled?"enabled":"disabled"}</span>}</article>)}</div>}</>}
          {activeTab==="team"&&<><Heading eyebrow="COLLABORATION" title="A shared workspace, clearly assigned.">Bring colleagues into your firm and give each member the access their work requires.</Heading><div className={css.featureRow}><div><UsersRound size={30}/><h3>Invite your team in a few steps.</h3><p>Open the team workspace, choose a colleague and role, then create an invitation. Firm permissions govern who can invite and manage members.</p></div><Link href="/workspace/team" className={css.primary} prefetch={false}>Open team & invitations<ArrowUpRight size={15}/></Link></div><h3 className={css.listTitle}>Your active memberships</h3>{account.memberships.length?account.memberships.map(item=><div className={css.membership} key={item.id}><span className={css.avatar}><UsersRound size={20}/></span><div><strong>{item.firmName}</strong><small>{item.role}</small></div><span className={css.badge}>Active</span></div>):<p className={css.note}>No active firm membership is recorded for this account.</p>}</>}
          {activeTab==="security"&&<><Heading eyebrow="ACCOUNT PROTECTION" title="Security with evidence.">Manage authenticator verification, passwords, active sessions, and the account audit trail in one dedicated place.</Heading><div className={css.securityHero}><ShieldCheck size={42}/><div><span className={css.eyebrow}>AUTHENTICATOR</span><h3>{account.security.mfaEnabled?"Enrolled and enabled":"Ready to set up"}</h3><p>{account.security.mfaEnabled?"An authenticator is enrolled for this account. Review recovery codes and active sessions in the Security Center.":"Add an authenticator to require a second factor at sign-in. The Security Center guides you through verification before enabling it."}</p></div></div><div className={css.quickGrid}><Link href="/security" className={css.quickCard} prefetch={false}><KeyRound size={22}/><strong>Password & authenticator</strong><span>Verified changes and recovery</span><ArrowUpRight size={16}/></Link><Link href="/security" className={css.quickCard} prefetch={false}><Eye size={22}/><strong>Sessions & access</strong><span>Review and revoke active sessions</span><ArrowUpRight size={16}/></Link></div><div className={css.featureRow}><div><h3>Review your protection.</h3><p>Last security review: {date(account.security.lastSecurityReviewAt)}. Authentication controls are enforced through their dedicated verification flows.</p></div><Link href="/security" className={css.primary} prefetch={false}>Open Security Center<ArrowUpRight size={15}/></Link></div></>}
          {activeTab==="data"&&<><Heading eyebrow="PRIVACY & ACCOUNT" title="Keep control of your records.">Download your account preferences, manage browser appearance storage, or review account closure.</Heading><div className={css.featureRow}><div><ArrowDownToLine size={25}/><h3>Export account preferences</h3><p>Download your profile, display preferences, alert filters, saved privacy preferences, and firm membership labels as JSON. Financial records and client documents are exported from their own workspaces.</p></div><button className={css.primary} disabled={downloading} onClick={()=>void downloadPreferences()}>{downloading?<LoaderCircle className={css.spin} size={15}/>:<ArrowDownToLine size={15}/>}Download JSON</button></div><div className={css.featureRow}><div><h3>Browser appearance storage</h3><p>{settings.privacy.allowBrowserStorage?"Appearance is remembered on this browser after you save it.":"Appearance is retained for the current visit without local appearance keys."} Change this preference in Appearance.</p></div><button className={css.secondary} onClick={()=>selectTab("appearance")}>Open appearance<ArrowUpRight size={15}/></button></div><details className={css.archive}><summary>Previously recorded privacy preferences</summary><p>These are historical preferences retained with your account. They do not independently enforce deletion, consent, masking, or data retention across the platform.</p><dl>{Object.entries(account.privacy).filter(([key])=>key!=="allowBrowserStorage").map(([key,value])=><div key={key}><dt>{key.replace(/([A-Z])/g," $1")}</dt><dd>{typeof value==="boolean"?(value?"Enabled preference":"Disabled preference"):String(value)}</dd></div>)}</dl></details>
            <ResearchSharingSettings />
            <details className={css.danger}><summary>Deactivate or delete your account</summary><p>Deactivation suspends access and revokes every session. Deletion removes your account and records linked to it by account ownership. Shared-firm creators must complete an ownership and record-retention review first.</p><fieldset disabled={busy}><div className={css.formGrid}><Field title="Account action"><select value={dangerAction} onChange={event=>{setDangerAction(event.target.value as typeof dangerAction);setConfirmation("");}}><option value="deactivateAccount">Deactivate account</option><option value="deleteAccount">Permanently delete account</option></select></Field><Field title={`Type ${dangerAction==="deactivateAccount"?"DEACTIVATE":"DELETE MY ACCOUNT"} to confirm`}><input autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></Field><Field title="Current password"><input type="password" autoComplete="current-password" maxLength={1024} value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}/></Field><Field title="Authenticator or recovery code" hint="Required if an authenticator is enrolled."><input autoComplete="one-time-code" maxLength={80} value={factorCode} onChange={event=>setFactorCode(event.target.value)}/></Field></div></fieldset><button className={css.dangerButton} disabled={busy||!currentPassword||confirmation!==(dangerAction==="deactivateAccount"?"DEACTIVATE":"DELETE MY ACCOUNT")} onClick={()=>void closeAccount()}>{closing?<LoaderCircle size={14} className={css.spin}/>:<KeyRound size={14}/>}Verify and {dangerAction==="deactivateAccount"?"deactivate":"permanently delete"}</button></details>
          </>}
        </>}
      </section>
    </div>
    <footer className={css.footer}><span>SLICE / PERSONAL CONTROL NETWORK</span><span>Account settings · Firm permissions · Verified protection</span></footer>
  </main>;
}
