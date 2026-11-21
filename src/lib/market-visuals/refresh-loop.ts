type Timer = ReturnType<typeof setTimeout>;
export type RefreshEnvironment = {
  available: () => boolean;
  schedule: (run: () => void, milliseconds: number) => Timer;
  cancel: (timer: Timer) => void;
};

/** Completion-based polling: visibility/focus events cannot overlap an active read. */
export function createMarketRefreshLoop(
  run: () => Promise<unknown>,
  interval: () => number,
  environment: RefreshEnvironment,
) {
  let stopped = false, running = false;
  let timer: Timer | undefined;
  const clear = () => { if (timer !== undefined) environment.cancel(timer); timer = undefined; };
  const tick = async () => {
    clear();
    if (stopped || running) return;
    if (!environment.available()) return;
    running = true;
    try { await run(); } catch { /* The resource owns its error and retry state. */ }
    finally {
      running = false;
      if (!stopped && environment.available()) timer = environment.schedule(() => { void tick(); }, Math.max(1000, interval()));
    }
  };
  return {
    wake() { if (!stopped) void tick(); },
    pause() { clear(); },
    stop() { stopped = true; clear(); },
  };
}
