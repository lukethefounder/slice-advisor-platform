/** Refresh a visible countdown only when its displayed seconds/minutes can change. */
export function retryDelay(remainingMs: number): number | null {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;
  if (remainingMs <= 60000) return Math.max(16, Math.min(1000, remainingMs));
  const minutes = Math.ceil(remainingMs / 60000);
  return Math.max(16, Math.min(60000, remainingMs - (minutes - 1) * 60000));
}
