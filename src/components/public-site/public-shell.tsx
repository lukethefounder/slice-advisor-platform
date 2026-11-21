import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, Menu, ShieldCheck, Sparkles } from "lucide-react";
import css from "./public-shell.module.css";

export type PublicRouteKey = "home" | "platform" | "markets" | "knowledge-graph" | "capabilities" | "intelligence";
const PUBLIC_NAVIGATION: Array<{ key: PublicRouteKey; label: string; href: string }> = [
  { key: "platform", label: "Platform", href: "/platform" },
  { key: "markets", label: "Markets", href: "/markets" },
  { key: "knowledge-graph", label: "Knowledge graph", href: "/knowledge-graph" },
  { key: "capabilities", label: "Capabilities", href: "/capabilities" },
  { key: "intelligence", label: "Daily intelligence", href: "/daily-intelligence" },
];
function cx(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(" "); }

export function PublicBrandMark({ compact = false, subtitle = "Advisor Operating System" }: { compact?: boolean; subtitle?: string }) {
  return <div className={cx(css.brand, compact && css.compact)}>
    <div className={css.brandMark} aria-hidden="true">S<span /></div>
    {!compact && <div className={css.brandName}><strong>Slice</strong><small>{subtitle}</small></div>}
  </div>;
}

function NavigationLink({ href, label, active, mobile = false }: { href: string; label: string; active: boolean; mobile?: boolean }) {
  return <Link prefetch={false} href={href} aria-current={active ? "page" : undefined} className={cx(css.navLink, active && css.active, mobile && css.mobileLink)}>{label}</Link>;
}

export function PublicHeader({ active }: { active: PublicRouteKey }) {
  return <header className={css.header}>
    <div className={css.headerInner}>
      <Link prefetch={false} href="/" aria-label="Slice home" className={css.brandLink}><PublicBrandMark /></Link>
      <nav aria-label="Public navigation" className={css.desktopNav}>{PUBLIC_NAVIGATION.map(item => <NavigationLink key={item.key} href={item.href} label={item.label} active={active === item.key} />)}</nav>
      <div className={css.accessLinks}><Link prefetch={false} href="/client-login" className={css.clientLink}>Client login</Link><Link prefetch={false} href="/founder-login" className={css.founderLink}>Founder login<ArrowRight size={14} aria-hidden="true" /></Link></div>
      <details className={css.mobileMenu}>
        <summary><Menu className={css.menuClosed} size={20} aria-hidden="true" /><ChevronDown className={css.menuOpen} size={20} aria-hidden="true" /><span className="sr-only">Navigation menu</span></summary>
        <div className={css.menuPanel}><nav aria-label="Mobile public navigation"><NavigationLink href="/" label="Home" active={active === "home"} mobile />{PUBLIC_NAVIGATION.map(item => <NavigationLink key={item.key} href={item.href} label={item.label} active={active === item.key} mobile />)}</nav><div className={css.mobileAccess}><Link prefetch={false} href="/client-login" className={css.clientLink}>Client login</Link><Link prefetch={false} href="/founder-login" className={css.founderLink}>Founder login</Link></div></div>
      </details>
    </div>
  </header>;
}

export function PublicFooter() {
  return <footer className={css.footer}><div className={css.footerInner}>
    <Link prefetch={false} href="/" className={css.brandLink} aria-label="Slice home"><PublicBrandMark /></Link>
    <nav aria-label="Footer navigation">{PUBLIC_NAVIGATION.map(item => <Link prefetch={false} key={item.key} href={item.href}>{item.label}</Link>)}<Link prefetch={false} href="/security">Security</Link></nav>
    <p>Market intelligence and advisor workflow support. Provider state, source evidence, and review status should be confirmed before client-specific use.</p>
  </div></footer>;
}

export function PublicPage({ active, children }: { active: PublicRouteKey; children: ReactNode }) {
  return <div className={css.page} data-slice-public-shell="neural"><div className={css.ambient} aria-hidden="true" /><div className={css.content}><PublicHeader active={active} /><main>{children}</main><PublicFooter /></div></div>;
}

export function PublicHero({ eyebrow, title, description, actions, aside }: { eyebrow: string; title: ReactNode; description: string; actions?: ReactNode; aside?: ReactNode }) {
  return <section className={css.hero}><div className={cx(css.heroGrid, !aside && css.heroSolo)}><div><div className={css.eyebrowPill}><Sparkles size={14} aria-hidden="true" />{eyebrow}</div><h1>{title}</h1><p className={css.heroDescription}>{description}</p>{actions && <div className={css.heroActions}>{actions}</div>}</div>{aside && <div className={css.heroAside}>{aside}</div>}</div></section>;
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link prefetch={false} href={href} className={css.primary}>{children}<ArrowRight size={16} aria-hidden="true" /></Link>;
}
export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link prefetch={false} href={href} className={css.secondary}>{children}</Link>;
}
export function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className={css.sectionHeading}><div><div className={css.eyebrow}>{eyebrow}</div><h2>{title}</h2><p>{description}</p></div>{action && <div className={css.sectionAction}>{action}</div>}</div>;
}
export function PublicSurface({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "aside" }) {
  const Component = as;
  return <Component className={cx(css.surface, className)}>{children}</Component>;
}
export function TrustLine({ children }: { children: ReactNode }) {
  return <div className={css.trustLine}><CheckCircle2 size={16} aria-hidden="true" /><span>{children}</span></div>;
}
export function GovernanceBadge() {
  return <span className={css.governance}><ShieldCheck size={14} aria-hidden="true" />Review-first governance</span>;
}
