"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PrefetchBudget, prefetchPath } from "@/lib/performance/navigation-policy";
/** Intent-only route warming. Does not load provider APIs, change pages, or intercept clicks. */
export default function NavigationAccelerator() {
 const router = useRouter();
 useEffect(() => {
  const budget = new PrefetchBudget(); let timer: number | null = null;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const permitted = () => navigator.onLine && document.visibilityState === "visible" && !connection?.saveData && !["slow-2g", "2g"].includes(connection?.effectiveType || "");
  const cancel = () => { if (timer !== null) window.clearTimeout(timer); timer = null; };
  const intend = (event: Event) => {
   if (!permitted() || !(event.target instanceof Element)) return;
   const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
   if (!anchor || anchor.hasAttribute("download") || anchor.getAttribute("target") === "_blank") return;
   const path = prefetchPath(anchor.href, location.origin); if (!path || path === location.pathname) return;
   cancel(); timer = window.setTimeout(() => {
    timer = null; if (!permitted() || !budget.claim(path)) return;
    // Next.js prefetch is a route read. Client effects do not run during prefetch.
    try { router.prefetch(path); } catch { /* Navigation remains available if warming fails. */ }
   }, event.type === "focusin" ? 50 : 150);
  };
  document.addEventListener("pointerover", intend); document.addEventListener("focusin", intend);
  document.addEventListener("pointerout", cancel); document.addEventListener("focusout", cancel); document.addEventListener("visibilitychange", cancel);
  return () => { cancel(); document.removeEventListener("pointerover", intend); document.removeEventListener("focusin", intend); document.removeEventListener("pointerout", cancel); document.removeEventListener("focusout", cancel); document.removeEventListener("visibilitychange", cancel); };
 }, [router]);
 return null;
}
