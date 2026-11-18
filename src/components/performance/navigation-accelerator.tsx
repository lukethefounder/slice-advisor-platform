"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PrefetchBudget, prefetchPath } from "@/lib/performance/navigation-policy";
/** Intent-only production warming. Keeps the existing allowlist and bounded request budget. */
export default function NavigationAccelerator() {
  const router = useRouter();
  useEffect(() => {
    // Development compilation is not a useful prefetch benchmark; do not trigger it on hover.
    if (process.env.NODE_ENV !== "production") return;
    const budget = new PrefetchBudget();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let candidate: HTMLAnchorElement | null = null;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const permitted = () => navigator.onLine && document.visibilityState === "visible" && !connection?.saveData && !["slow-2g","2g"].includes(connection?.effectiveType || "");
    const cancel = () => { if (timer !== null) clearTimeout(timer); timer = null; candidate = null; };
    const intend = (event: Event) => {
      if (!permitted() || !(event.target instanceof Element)) return;
      if (event instanceof PointerEvent && (event.pointerType === "touch" || event.buttons !== 0)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self") || anchor.dataset.slicePrefetch === "off") return;
      const path = prefetchPath(anchor.href,location.origin);
      if (!path || path === location.pathname) return;
      // Moving between a link's icon and text must not cancel/restart the same intent.
      if (candidate === anchor) return;
      cancel(); candidate = anchor;
      timer = setTimeout(() => {
        timer = null;
        if (candidate !== anchor || !permitted() || !budget.claim(path)) return;
        try { router.prefetch(path); } catch { /* Clicking still performs normal navigation. */ }
      }, event.type === "focusin" ? 50 : 150);
    };
    const leave = (event: Event) => {
      const related = event instanceof MouseEvent || event instanceof FocusEvent ? event.relatedTarget : null;
      if (related instanceof Node && candidate?.contains(related)) return;
      cancel();
    };
    document.addEventListener("pointerover",intend); document.addEventListener("focusin",intend);
    document.addEventListener("pointerout",leave); document.addEventListener("focusout",leave);
    document.addEventListener("visibilitychange",cancel); window.addEventListener("offline",cancel);
    return () => { cancel(); document.removeEventListener("pointerover",intend); document.removeEventListener("focusin",intend); document.removeEventListener("pointerout",leave); document.removeEventListener("focusout",leave); document.removeEventListener("visibilitychange",cancel); window.removeEventListener("offline",cancel); };
  }, [router]);
  return null;
}
