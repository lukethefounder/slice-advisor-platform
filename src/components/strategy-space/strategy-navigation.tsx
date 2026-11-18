"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { STRATEGY_TABS } from "@/lib/strategy-space/routes";
import css from "./strategy-space.module.css";
export default function StrategyNavigation(){
 const path=usePathname();
 return <header className={css.navigation}><div className={css.brand}><span className={css.orbit} aria-hidden="true"/><div><small>SLICE / STRATEGY WORKSPACE</small><strong>Research. Test. Observe.</strong></div></div><nav aria-label="Strategy Lab sections">{STRATEGY_TABS.map(t=><Link key={t.href} href={t.href} prefetch={false} className={path===t.href?css.active:""} aria-current={path===t.href?"page":undefined}><b>{t.label}</b><span>{t.detail}</span></Link>)}</nav></header>;
}
