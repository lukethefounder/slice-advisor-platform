"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/account-security/policy";
import css from "./team.module.css";
type Invite = { firmName: string; role: string; emailMasked: string; inviterName: string; expiresAt: string; existingAccount: boolean; mfaRequired: boolean };
export default function InviteAcceptance() {
  const [code, setCode] = useState(""), [invite, setInvite] = useState<Invite | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [complete, setComplete] = useState(false);
  const [name, setName] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [factor, setFactor] = useState(""), [error, setError] = useState("");
  const submitController = useRef<AbortController | null>(null);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("code") || "", controller = new AbortController();
    setCode(value);
    if (!value) { setLoading(false); setError("This invitation is missing its private code. Open the complete link your colleague shared."); return; }
    void intelligenceFetch<{ ok: true; invite: Invite }>(`/api/team-invites/send?code=${encodeURIComponent(value)}`, { signal: controller.signal }, { retries: 0 })
      .then(result => { if (!controller.signal.aborted) { setInvite(result.invite); setError(""); } })
      .catch(caught => { if (!controller.signal.aborted && !isAbortError(caught)) setError(caught instanceof Error ? caught.message : "The invitation could not be verified."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); submitController.current?.abort(); };
  }, []);
  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!invite || busy) return;
    if (!invite.existingAccount && password !== confirm) { setError("Your passwords do not match."); return; }
    const controller = new AbortController(); submitController.current = controller;
    setBusy(true); setError("");
    try {
      await intelligenceFetch("/api/auth/invite-register", { method: "POST", signal: controller.signal, body: JSON.stringify({ inviteCode: code, name: name.trim(), password, factorCode: factor }) }, { retries: 0 });
      if (controller.signal.aborted || submitController.current !== controller) return;
      setPassword(""); setConfirm(""); setFactor(""); setComplete(true);
      window.location.assign("/workspace");
    } catch (caught) {
      if (controller.signal.aborted || submitController.current !== controller || isAbortError(caught)) return;
      if (caught && typeof caught === "object" && "code" in caught && caught.code === "MFA_REQUIRED") setInvite({ ...invite, mfaRequired: true });
      setError(caught instanceof Error ? caught.message : "The account could not join. If the invitation was accepted, sign in to open your workspace.");
    } finally { if (!controller.signal.aborted && submitController.current === controller) setBusy(false); }
  }
  return <main className={css.acceptPage}>
    <nav className={css.acceptNav} aria-label="Invitation navigation"><Link href="/" className={css.brand}>SLICE</Link><Link href="/founder-login" className={css.textLink}>Sign in to your account</Link></nav>
    <div className={css.acceptGrid}><section><p className={css.eyebrow}><ShieldCheck size={14} />A connected workspace</p><h1 className={css.acceptTitle}>{invite ? `Join ${invite.firmName}.` : "Great work starts together."}</h1><p className={css.muted}>{invite ? `${invite.inviterName} invited you as ${invite.role}.` : "Your private invitation connects you to the team and the research they share."}</p>
      <div className={css.steps}><div className={css.step}><b>01</b><div><strong>Your account</strong><span>Use your existing Slice credentials or create your own account.</span></div></div><div className={css.step}><b>02</b><div><strong>The right access</strong><span>The inviting firm chooses your role. Your password remains yours.</span></div></div><div className={css.step}><b>03</b><div><strong>One shared workspace</strong><span>Start collaborating on research, strategy, and assigned client work.</span></div></div></div>
      {invite && <p className={css.muted}>For {invite.emailMasked} · Expires {new Date(invite.expiresAt).toLocaleString()}</p>}
    </section><section className={css.acceptCard} aria-label="Accept team invitation">
      {loading ? <div className={css.empty} role="status"><LoaderCircle size={28} className={css.spinner} /><h2>Verifying your invitation</h2><p>Checking the firm, recipient, and available access.</p></div> : complete ? <div className={css.empty}><CheckCircle2 size={32} /><h2>You’re part of the team.</h2><p>Your membership is active.</p><Link className={css.button} href="/workspace">Open workspace</Link></div> : invite ? <>
        <p className={css.eyebrow}><LockKeyhole size={13} />{invite.existingAccount ? "Connect your account" : "Create your account"}</p><h2>{invite.existingAccount ? "Welcome back." : "Make it yours."}</h2><p className={css.muted}>{invite.existingAccount ? "Enter the password for the invited email. Your current account and other firm memberships are preserved." : `Create a password or passphrase with ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters. Password managers and spaces are welcome.`}</p>
        <form className={css.form} onSubmit={join}>
          {!invite.existingAccount && <label className={css.field}><span>Your full name</span><input required autoComplete="name" maxLength={120} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>}
          <label className={css.field}><span>{invite.existingAccount ? "Existing password" : "Create password"}</span><input type="password" required autoComplete={invite.existingAccount ? "current-password" : "new-password"} minLength={invite.existingAccount ? undefined : MIN_PASSWORD_LENGTH} maxLength={invite.existingAccount ? 256 : MAX_PASSWORD_LENGTH} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
          {!invite.existingAccount && <label className={css.field}><span>Confirm password</span><input type="password" required autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} value={confirm} disabled={busy} onChange={event => setConfirm(event.target.value)} /></label>}
          {invite.mfaRequired && <label className={css.field}><span>Authenticator or unused recovery code</span><input required autoComplete="one-time-code" maxLength={80} value={factor} disabled={busy} onChange={event => setFactor(event.target.value)} /><small>Your account’s second factor also protects joining a new firm.</small></label>}
          {error && <p className={css.error} role="alert">{error}</p>}
          <button className={css.button} type="submit" disabled={busy}>{busy ? <LoaderCircle size={15} className={css.spinner} /> : <ShieldCheck size={15} />}{busy ? "Verifying and joining…" : "Join firm and open workspace"}</button>
        </form>
      </> : <><LockKeyhole size={26} /><h2>Invitation unavailable</h2><p className={css.error} role="alert">{error}</p><p className={css.muted}>Ask the sender to replace the invitation from Team & access. If you already joined, sign in with your own credentials.</p><Link href="/founder-login" className={css.secondary}>Go to sign in</Link></>}
    </section></div>
  </main>;
}
