"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Network, RefreshCw, Save } from "lucide-react";
import type { ResearchSharingPreference } from "@/lib/agent-desk/research-access-types";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import { useWorkspaceSession } from "@/components/workspace/premium/session";
import css from "./broker-settings.module.css";

type Response = { ok: true; preference: ResearchSharingPreference };
const ENDPOINT = "/api/research-sharing";
function checked(response: Response) {
  const value = response?.preference;
  if (response?.ok !== true || value?.version !== 1 || typeof value.enabled !== "boolean" || value.scope !== "opt-in-public-market-sources" || typeof value.detail !== "string" || typeof value.revocation !== "string") {
    throw new Error("The research sharing preference could not be verified.");
  }
  return value;
}

export default function ResearchSharingSettings() {
  const session = useWorkspaceSession();
  if (session.loading || !session.user?.id || !session.firm?.id) return null;
  return <ResearchSharingWorkspace key={`${session.user.id}:${session.firm.id}`} />;
}

export function ResearchSharingWorkspace() {
  const [value, setValue] = useState<ResearchSharingPreference | null>(null), [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const alive = useRef(false), denied = useRef(false), busy = useRef(false), sequence = useRef(0), request = useRef<AbortController | null>(null);
  const cancelRequest = useCallback(() => { sequence.current++; request.current?.abort(); request.current = null; }, []);
  const revoke = useCallback(() => {
    denied.current = true; sequence.current++; request.current?.abort(); request.current = null; busy.current = false;
    setValue(null); setEnabled(false); setLoading(false); setSaving(false); setNotice(""); setError("Your session ended. Sign in again to review your research sharing preference.");
  }, []);
  const load = useCallback(async () => {
    if (!alive.current || denied.current || busy.current || request.current) return;
    const id = ++sequence.current, controller = new AbortController(); request.current = controller;
    try {
      const response = await intelligenceFetch<Response>(ENDPOINT, { method: "GET", signal: controller.signal }, { retries: 0, timeoutMs: 20000 });
      if (!alive.current || denied.current || id !== sequence.current) return;
      const preference = checked(response); setValue(preference); setEnabled(preference.enabled); setError("");
    } catch (caught) {
      if (!alive.current || denied.current || id !== sequence.current || isAbortError(caught)) return;
      if ([401, 403].includes((caught as { status?: number })?.status ?? 0)) { revoke(); return; }
      setError(caught instanceof Error ? caught.message : "Research sharing could not be loaded.");
    } finally {
      if (alive.current && id === sequence.current) { request.current = null; setLoading(false); }
    }
  }, [revoke]);
  useEffect(() => {
    alive.current = true; denied.current = false;
    window.addEventListener("slice-session-ended", revoke);
    void Promise.resolve().then(() => { if (alive.current) void load(); });
    return () => { alive.current = false; cancelRequest(); window.removeEventListener("slice-session-ended", revoke); };
  }, [cancelRequest, load, revoke]);
  const save = async () => {
    if (!alive.current || denied.current || busy.current || !value || enabled === value.enabled) return;
    request.current?.abort(); const id = ++sequence.current, controller = new AbortController(); request.current = controller; busy.current = true;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await intelligenceFetch<Response>(ENDPOINT, { method: "POST", body: JSON.stringify({ enabled }), signal: controller.signal }, { retries: 0, timeoutMs: 20000 });
      if (!alive.current || denied.current || id !== sequence.current) return;
      const preference = checked(response); setValue(preference); setEnabled(preference.enabled);
      setNotice(preference.enabled ? "Public research source sharing is enabled for your account." : "Public research source sharing is disabled for future reads.");
    } catch (caught) {
      if (!alive.current || denied.current || id !== sequence.current || isAbortError(caught)) return;
      if ([401, 403].includes((caught as { status?: number })?.status ?? 0)) { revoke(); return; }
      setError(`${caught instanceof Error ? caught.message : "The change could not be verified."} Reload your preference before retrying.`);
    } finally {
      if (alive.current && id === sequence.current) { request.current = null; busy.current = false; setSaving(false); }
    }
  };
  return <ResearchSharingView value={value} enabled={enabled} loading={loading} saving={saving} error={error} notice={notice} onEnabled={setEnabled} onSave={() => void save()} onReload={() => void load()} />;
}

export function ResearchSharingView({ value, enabled, loading, saving, error, notice, onEnabled, onSave, onReload }: {
  value: ResearchSharingPreference | null; enabled: boolean; loading: boolean; saving: boolean; error: string; notice: string;
  onEnabled: (value: boolean) => void; onSave: () => void; onReload: () => void;
}) {
  return <section id="research-sharing" className={css.panel} aria-label="Public research sharing preference">
    <div className={css.sectionHead}><div><p className={css.eyebrow}><Network size={13} aria-hidden />RESEARCH / YOUR CHOICE</p><h3>Contribute public-market sources.</h3><p>Choose whether public source metadata from your research can be read by the founder’s agent team across workspaces. Sharing is disabled by default and does not grant access to the agents.</p></div><span className={css.tag}>{value ? value.enabled ? "Sharing enabled" : "Sharing disabled" : "Preference not loaded"}</span></div>
    {loading && <p role="status" className={css.small}>Loading your saved sharing preference…</p>}
    {error && <div className={css.notice} data-tone="negative" role="alert"><p>{error}</p><button type="button" className={css.textButton} onClick={onReload} disabled={saving}>Reload preference<RefreshCw size={12} aria-hidden /></button></div>}
    {notice && <p className={css.notice} data-tone="positive" role="status">{notice}</p>}
    {value && <><p className={css.small}>{value.detail}</p><p className={css.small}>{value.revocation}</p></>}
    <label className={css.toggle}><input type="checkbox" checked={enabled} disabled={!value || loading || saving} onChange={event => onEnabled(event.target.checked)} /><span>Allow sharing of my eligible public research sources<small>Public titles, source links, publishers, and recorded publication dates. Private notes, client documents, account records, messages, credentials, and licensed feeds are excluded.</small></span></label>
    <div className={css.actions}><button type="button" className={css.primary} disabled={!value || loading || saving || enabled === value.enabled} onClick={onSave}>{saving ? <RefreshCw size={14} className={css.spin} aria-hidden /> : <Save size={14} aria-hidden />}{saving ? "Saving preference…" : "Save sharing preference"}</button><span className={css.small}>{value?.updatedAt ? `Saved ${new Date(value.updatedAt).toLocaleString()}` : "No opt-in recorded"}</span></div>
  </section>;
}
