"use client";
import { useEffect, useRef } from "react";
import { createMarketRefreshLoop } from "./refresh-loop";

/** Active views check for newer observations; hidden and offline views stop polling. */
export function useMarketRefresh(enabled: boolean, identity: string, run: () => Promise<unknown>, intervalMs: number) {
  const callback = useRef(run), cadence = useRef(intervalMs);
  useEffect(() => { callback.current = run; cadence.current = intervalMs; }, [run, intervalMs]);
  useEffect(() => {
    if (!enabled) return;
    const available = () => document.visibilityState === "visible" && navigator.onLine;
    const loop = createMarketRefreshLoop(() => callback.current(), () => cadence.current, {
      available, schedule: (fn, ms) => setTimeout(fn, ms), cancel: clearTimeout,
    });
    const wake = () => { if (available()) loop.wake(); else loop.pause(); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake); window.addEventListener("offline", wake); window.addEventListener("focus", wake);
    loop.wake();
    return () => {
      loop.stop(); document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake); window.removeEventListener("offline", wake); window.removeEventListener("focus", wake);
    };
  }, [enabled, identity]);
}
