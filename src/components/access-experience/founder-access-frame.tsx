"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { ArrowUpRight, Eye, EyeOff, GitBranch, LockKeyhole, Network, Pause, Play, RefreshCw, ShieldCheck } from "lucide-react";

import { useAmbientMotion } from "@/components/future-workspace/use-ambient-motion";
import styles from "./founder-access.module.css";

type FounderAccessProps = {
  email: string;
  secret: string;
  onEmailChange: (value: string) => void;
  onSecretChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  message: string;
};

const NETWORK_POINTS = Array.from({ length: 48 }, (_, index) => {
  const ring = Math.floor(index / 16);
  const angle = (index % 16) * (Math.PI / 8) + ring * 0.21;
  const radius = 91 + ring * 47;
  return {
    x: Number((280 + Math.cos(angle) * radius * 1.22).toFixed(3)),
    y: Number((200 + Math.sin(angle) * radius * 0.87).toFixed(3)),
    ring,
  };
});

function FounderConstellation() {
  const gradientId = useId().replace(/:/g, "");

  return (
    <div className={styles.constellation}>
      <svg viewBox="0 0 560 400" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#59dfba" />
            <stop offset="55%" stopColor="#5ecfd7" />
            <stop offset="100%" stopColor="#bee89c" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="#93d8c1" strokeOpacity=".12">
          <ellipse cx="280" cy="200" rx="112" ry="80" />
          <ellipse cx="280" cy="200" rx="169" ry="120" />
          <ellipse cx="280" cy="200" rx="226" ry="161" />
          <path d="M20 200H540M280 15V385" strokeDasharray="3 7" />
        </g>
        <g fill="none" stroke={`url(#${gradientId})`} strokeWidth=".7" strokeOpacity=".3">
          {NETWORK_POINTS.map((point, index) => {
            const next = NETWORK_POINTS[(index + (point.ring === 2 ? 13 : 3)) % NETWORK_POINTS.length];
            return <path key={index} d={`M${point.x} ${point.y}L${next.x} ${next.y}`} />;
          })}
        </g>
        <g fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.4" className={styles.paths}>
          <path d="M72 90C158 90 172 200 280 200S409 86 485 112" />
          <path d="M69 301C180 301 192 200 280 200S401 292 487 292" />
          <path d="M280 37C331 98 234 124 280 200S335 307 280 364" />
        </g>
        <g fill={`url(#${gradientId})`}>
          {NETWORK_POINTS.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={point.ring === 0 ? 2.6 : 1.8} opacity={point.ring === 2 ? 0.6 : 0.9} />)}
        </g>
        <circle cx="280" cy="200" r="49" fill="#143b35" stroke="#81dec4" strokeOpacity=".6" />
        <circle cx="280" cy="200" r="59" fill="none" stroke="#7ed9c0" strokeOpacity=".15" />
        <text x="280" y="206" fill="#d4fff0" textAnchor="middle" fontSize="36" fontWeight="700" fontFamily="inherit">S</text>
      </svg>
      <span className={`${styles.networkLabel} ${styles.labelMedia}`}><i />MEDIA<span>Stories & sources</span></span>
      <span className={`${styles.networkLabel} ${styles.labelTechnical}`}><i />TECHNICAL<span>Price & structure</span></span>
      <span className={`${styles.networkLabel} ${styles.labelEconomy}`}><i />ECONOMY<span>Sectors & cycles</span></span>
      <div className={styles.networkCaption}><GitBranch size={12} aria-hidden="true" />Conceptual research network</div>
    </div>
  );
}

export default function FounderAccessFrame({ email, secret, onEmailChange, onSecretChange, onSubmit, loading, message }: FounderAccessProps) {
  const { ref, moving, paused, toggle } = useAmbientMotion();
  const [reveal, setReveal] = useState(false);
  const [caps, setCaps] = useState(false);

  return (
    <main ref={ref} className={styles.root} data-moving={moving ? "true" : "false"}>
      <div className={styles.mesh} aria-hidden="true" />
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Slice home"><span>S</span><div>Slice<small>FOUNDER COMMAND</small></div></Link>
        <div className={styles.headerActions}>
          <button type="button" onClick={toggle} aria-pressed={paused} className={styles.motionButton}>{paused ? <Play size={13} /> : <Pause size={13} />}<span>{paused ? "Resume motion" : "Pause motion"}</span></button>
          <Link href="/client-login">Client access <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
      </header>

      <div className={styles.layout}>
        <section className={styles.story} aria-labelledby="founder-access-title">
          <div className={styles.eyebrow}><span />INTELLIGENCE, WITH PERSPECTIVE.</div>
          <h1 id="founder-access-title">See the system.<br /><em>Shape your next move.</em></h1>
          <p className={styles.description}>The evidence. The connections. The possibilities.<br />Bring your research and your firm into one clear view.</p>
          <FounderConstellation />
          <div className={styles.storyFooter}>
            <span><Network size={15} aria-hidden="true" />Connected research</span>
            <span><GitBranch size={15} aria-hidden="true" />Traceable evidence</span>
            <span><ShieldCheck size={15} aria-hidden="true" />Human judgment</span>
          </div>
        </section>

        <section className={styles.accessCard} aria-labelledby="founder-signin-title">
          <div className={styles.cardTop}><span className={styles.accessPill}><LockKeyhole size={11} aria-hidden="true" />FOUNDER & FIRM ACCESS</span><span className={styles.accessMark} aria-hidden="true"><Network size={24} /></span></div>
          <p className={styles.welcome}>YOUR NEXT CHAPTER STARTS HERE</p>
          <h2 id="founder-signin-title">Welcome to<br />your command.</h2>
          <p className={styles.cardDescription}>Continue with your firm owner or invited advisor account.</p>

          <form onSubmit={onSubmit} className={styles.form} aria-busy={loading}>
            <label htmlFor="founder-email">Work email</label>
            <input id="founder-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={320} value={email} onChange={event => onEmailChange(event.target.value)} placeholder="you@yourfirm.com" disabled={loading} />
            <label htmlFor="founder-password">Password</label>
            <div className={styles.secretField}>
              <input id="founder-password" name="password" type={reveal ? "text" : "password"} autoComplete="current-password" required maxLength={256} value={secret} onChange={event => onSecretChange(event.target.value)} onKeyUp={event => setCaps(event.getModifierState("CapsLock"))} onBlur={() => setCaps(false)} disabled={loading} />
              <button type="button" aria-label={reveal ? "Hide password" : "Show password"} aria-pressed={reveal} aria-controls="founder-password" onClick={() => setReveal(value => !value)} disabled={loading}>{reveal ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
            {caps && <p role="status" className={styles.caps}>Caps Lock is on.</p>}
            <button type="submit" className={styles.submit} disabled={loading}><span>{loading ? "Verifying your access…" : "Enter your workspace"}</span>{loading ? <RefreshCw size={17} className={styles.spinner} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />}</button>
          </form>

          {message && <p role="status" aria-live="polite" className={styles.message}>{message}</p>}
          <div className={styles.accountHelp}><p>Joining a firm? Use your invitation to set up your account.</p><Link href="/advisor-signup">Create a firm account <ArrowUpRight size={13} aria-hidden="true" /></Link></div>
          <div className={styles.securityLine}><LockKeyhole size={12} aria-hidden="true" /><p>Your existing account permissions determine which workspace and controls you can access.</p></div>
          <Link className={styles.securityLink} href="/security">View security information <ArrowUpRight size={12} aria-hidden="true" /></Link>
        </section>
      </div>

      <footer className={styles.footer}><span>SLICE / THE CONNECTED INTELLIGENCE PLATFORM</span><span>Evidence into perspective. Perspective into action.</span></footer>
    </main>
  );
}
