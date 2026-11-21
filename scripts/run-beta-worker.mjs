import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { runAgentMarketStreams } from "./agent-market-stream.mjs";

export const BETA_TRACKING_TASKS = [
  { name: "Research jobs", path: "/api/cron/backend?mode=work&batch=8", intervalMs: 15_000 },
  { name: "Watchlist observations", path: "/api/cron/workspace-watchlists?users=100&lists=250", intervalMs: 60_000 },
  { name: "Forward strategy observations", path: "/api/cron/strategy-scenarios", intervalMs: 60_000 },
  { name: "Founder agent monitoring", path: "/api/cron/agent-desk", intervalMs: 15_000 },
  { name: "Forecast outcome tracking", path: "/api/cron/intelligence-forecast-settlement?limit=25", intervalMs: 300_000 },
];

export function workerConfiguration(env) {
  const base = new URL(env.SLICE_BETA_WORKER_URL || "http://localhost:3000");
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error("SLICE_BETA_WORKER_URL must be an HTTP(S) application URL without credentials, query, or fragment.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (!local && base.protocol !== "https:") throw new Error("A remote beta worker requires HTTPS.");
  const secret = String(env.CRON_SECRET || "").trim();
  if (!secret) throw new Error("Set CRON_SECRET in .env.local (and restart the app) before starting continuous tracking.");
  return { origin: base.origin, secret };
}

export async function runTrackingTask(task, config, signal, dependencies = {}) {
  const request = dependencies.fetch || fetch;
  const log = dependencies.log || console.log;
  const sleep = dependencies.sleep || ((ms, signal) => new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
    const timer = setTimeout(finish, ms);
    if (signal.aborted) finish(); else signal.addEventListener("abort", finish, { once: true });
  }));
  let failures = 0;
  while (!signal.aborted) {
    let wait = task.intervalMs;
    try {
      const response = await request(new URL(task.path, config.origin), {
        method: "GET", redirect: "error", cache: "no-store", signal,
        headers: { authorization: `Bearer ${config.secret}`, accept: "application/json" },
      });
      const result = await response.json().catch(() => ({}));
      if ([401, 403].includes(response.status)) {
        log(`${task.name}: authorization was rejected. Check the app and worker use the same CRON_SECRET; restart this worker after correcting it.`);
        return;
      }
      if (!response.ok || result.ok === false) throw new Error(`HTTP ${response.status}`);
      failures = 0;
      log(`${new Date().toISOString()} ${task.name}: ${result.skipped ? "nothing due or disabled" : "check complete"}`);
    } catch {
      if (signal.aborted) return;
      failures++;
      wait = Math.min(300_000, task.intervalMs * 2 ** Math.min(failures, 5));
      log(`${task.name}: connection/provider unavailable; retrying in ${Math.ceil(wait / 1000)} seconds. Saved records remain in the app.`);
    }
    // Each task schedules its next check only after the current request settles.
    await sleep(wait, signal);
  }
}

async function main() {
  const { default: nextEnv } = await import("@next/env");
  nextEnv.loadEnvConfig(process.cwd());
  const config = workerConfiguration(process.env);
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  console.log(`Slice beta tracking started for ${config.origin}. Keep the app and this terminal running. Ctrl+C stops the worker.`);
  try { await Promise.all([...BETA_TRACKING_TASKS.map(task => runTrackingTask(task, config, controller.signal)), runAgentMarketStreams(config, controller.signal)]); }
  finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error instanceof Error ? error.message : "The beta worker could not start."); process.exitCode = 1; });
}
