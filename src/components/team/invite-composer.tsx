"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Copy, Link2, LoaderCircle, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import { TEAM_INVITE_ROLES, normalizeTeamEmail, type InvitationResult, type TeamOverview, type TeamRole } from "@/lib/team/contracts";
import css from "./team.module.css";

export function InvitationReceipt({ result }: { result: InvitationResult }) {
  const [copied, setCopied] = useState(false), [copyError, setCopyError] = useState("");
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { setCopied(false); setCopyError(""); }, [result.invite.id]);
  async function copy() {
    try { await navigator.clipboard.writeText(result.invite.inviteLink || ""); setCopied(true); setCopyError(""); }
    catch { field.current?.focus(); field.current?.select(); setCopyError("The link is selected. Press Ctrl+C or use your device's copy command."); }
  }
  return <section className={css.receipt} aria-label="Created invitation">
    <h3><Check size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 7 }} />Invitation ready for {result.invite.email}</h3>
    <p>{result.message}</p>
    <label className={css.field}><span>Private invitation link</span><input ref={field} readOnly value={result.invite.inviteLink || ""} onFocus={event => event.target.select()} /></label>
    <button className={css.button} type="button" onClick={() => void copy()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Link copied" : "Copy invitation link"}</button>
    <small>{result.invite.role} · Expires {new Date(result.invite.expiresAt).toLocaleString()}. Share with {result.invite.email}. This link is shown here once; you can replace it from Team & access.</small>
    <p role="status" aria-live="polite">{copyError || (copied ? "Copied to your clipboard." : "")}</p>
  </section>;
}
export function RoleVerification({ password, factor, onPassword, onFactor }: { password: string; factor: string; onPassword: (value: string) => void; onFactor: (value: string) => void }) {
  return <div className={css.verify}>
    <p><ShieldCheck size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />This role includes supervision or administration. Verify your account to grant it.</p>
    <label className={css.field}><span>Your current password</span><input type="password" autoComplete="current-password" maxLength={256} value={password} onChange={event => onPassword(event.target.value)} /></label>
    <label className={css.field}><span>Your authenticator or recovery code, if enabled</span><input autoComplete="one-time-code" maxLength={80} value={factor} onChange={event => onFactor(event.target.value)} /></label>
  </div>;
}
export default function InviteComposer({ firmId, canInvite, roles = [...TEAM_INVITE_ROLES], compact = false, onCreated }: {
  firmId: string | null; canInvite: boolean; roles?: TeamOverview["roles"]; compact?: boolean; onCreated?: (result: InvitationResult) => void;
}) {
  const [email, setEmail] = useState(""), [role, setRole] = useState<TeamRole>(roles.find(row => row.role === "Associate Advisor")?.role ?? roles[0]?.role ?? "Member");
  const [delivery, setDelivery] = useState<"link" | "email">("link"), [password, setPassword] = useState(""), [factor, setFactor] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [result, setResult] = useState<InvitationResult | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { controller.current?.abort(); setResult(null); setError(""); setBusy(false); setPassword(""); setFactor(""); }, [firmId]);
  const definition = roles.find(item => item.role === role) ?? roles[0];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !canInvite || !firmId || !definition) return;
    if (!normalizeTeamEmail(email)) { setError("Enter your colleague's email address."); return; }
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setBusy(true); setError(""); setResult(null);
    try {
      const next = await intelligenceFetch<InvitationResult>("/api/team-invites", { method: "POST", signal: request.signal,
        body: JSON.stringify({ action: "create", firmId, email, role: definition.role, delivery, ...(definition.elevated ? { currentPassword: password, factorCode: factor } : {}) }) }, { retries: 0 });
      if (request.signal.aborted || controller.current !== request) return;
      setResult(next); setEmail(""); setPassword(""); setFactor(""); onCreated?.(next);
    } catch (caught) { if (!request.signal.aborted && controller.current === request && !isAbortError(caught)) setError(caught instanceof Error ? caught.message : "The invitation could not complete. Refresh the team list before retrying."); }
    finally { if (controller.current === request && !request.signal.aborted) setBusy(false); }
  }
  return <section className={compact ? css.compact : undefined} aria-label="Invite a colleague">
    <h2>Invite a colleague</h2><p className={css.muted}>Their email, the right role, and one private link. Existing Slice accounts can join with their current credentials.</p>
    {!canInvite || !firmId ? <p className={css.notice}>An active firm and invitation permission are required. Ask your firm owner to enable access.</p> : <form className={css.form} onSubmit={submit}>
      <label className={css.field}><span>Colleague’s email</span><input required type="email" autoComplete="email" placeholder="colleague@yourfirm.com" maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
      <label className={css.field}><span>Role in your firm</span><select value={definition?.role || ""} disabled={busy} onChange={event => { setRole(event.target.value as TeamRole); setPassword(""); setFactor(""); }}>{roles.map(item => <option key={item.role} value={item.role}>{item.label}</option>)}</select><small>{definition?.detail}</small></label>
      <fieldset className={css.choices} disabled={busy}><legend>How would you like to invite them?</legend>
        <label className={css.choice}><input type="radio" name={`delivery-${firmId}`} checked={delivery === "link"} onChange={() => setDelivery("link")} /><span><Link2 size={13} style={{ display: "inline", marginRight: 5 }} />Copy a link<small>Share in your own email or message.</small></span></label>
        <label className={css.choice}><input type="radio" name={`delivery-${firmId}`} checked={delivery === "email"} onChange={() => setDelivery("email")} /><span><Mail size={13} style={{ display: "inline", marginRight: 5 }} />Email invitation<small>Uses your configured email provider.</small></span></label>
      </fieldset>
      {definition?.elevated && <RoleVerification password={password} factor={factor} onPassword={setPassword} onFactor={setFactor} />}
      <button type="submit" className={css.button} disabled={busy || !definition || (definition.elevated && !password)}>{busy ? <LoaderCircle size={15} className={css.spinner} /> : <UserPlus size={15} />}{busy ? "Creating invitation…" : delivery === "email" ? "Create and email invitation" : "Create invitation link"}</button>
    </form>}
    {error && <p className={css.error} role="alert">{error}</p>}
    {result && <InvitationReceipt result={result} />}
  </section>;
}
