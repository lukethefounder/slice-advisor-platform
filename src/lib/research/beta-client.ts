/** The server advertises the same beta policy used by API routes. No extra request. */
export function browserBetaEnabled(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.sliceBeta !== "false";
}

/** Zero means no Slice elapsed-time cutoff. User navigation/cancellation still aborts. */
export function applicationRequestTimeout(configuredMs: number): number {
  return browserBetaEnabled() ? 0 : Math.max(1_000, configuredMs);
}

export function startApplicationDeadline(controller: AbortController, configuredMs: number, message = "The request timed out."): number | undefined {
  const duration = applicationRequestTimeout(configuredMs);
  return duration > 0 && typeof window !== "undefined"
    ? window.setTimeout(() => controller.abort(new DOMException(message, "TimeoutError")), duration)
    : undefined;
}
