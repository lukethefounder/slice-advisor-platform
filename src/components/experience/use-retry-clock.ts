"use client";
import { useEffect, useState } from "react";
import { retryDelay } from "@/lib/experience/retry-clock";
export function useRetryClock(retryAt: number): number {
  const [clock,setClock] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => { if (timer !== null) clearTimeout(timer); timer = null; };
    const update = () => {
      clear();
      if (document.visibilityState === "hidden") return;
      const now = Date.now(); setClock(now);
      const delay = retryDelay(retryAt - now);
      if (delay !== null) timer = setTimeout(update,delay);
    };
    update(); document.addEventListener("visibilitychange",update);
    return () => { clear(); document.removeEventListener("visibilitychange",update); };
  }, [retryAt]);
  return clock;
}
