/** Beta removes Slice usage allowances and application execution deadlines.
 * Provider entitlements, cancellation, security, and recoverable worker leases remain independent. */
export function researchBetaEnabled(env: Record<string, string | undefined>): boolean {
  const value = (env.SLICE_PULSE_BETA_UNCAPPED ?? "true").trim().toLowerCase();
  if(value!=="true" && value!=="false") throw new Error("SLICE_PULSE_BETA_UNCAPPED must be true or false.");
  return value === "true";
}
export function scenarioTrackingEnabled(env: Record<string, string | undefined>): boolean {
  const value = env.SLICE_SCENARIO_CRON_ENABLED?.trim().toLowerCase();
  if (value === undefined || value === "") return researchBetaEnabled(env);
  if (value !== "true" && value !== "false") throw new Error("SLICE_SCENARIO_CRON_ENABLED must be true or false.");
  return value === "true";
}
export function researchBetaSummary(env: Record<string, string | undefined>) {
  const enabled=researchBetaEnabled(env);
  return {enabled,mode:enabled?"beta-uncapped" as const:"standard" as const,
    label:enabled?"Beta access · no Slice usage or execution time limits":"Research · configured application allowances",
    applicationDeadlines: enabled ? "disabled" as const : "configured" as const,
    coverage:["Market data gateway","Historical imports","Intelligence operation usage and estimated-cost budgets","AI Studio request allowances","Scenario active-record allowance","Application API and research-client execution deadlines","Background-job execution deadlines"],
    preserved:["Authentication and firm permissions","Provider limits and endpoint entitlements","Security request protection","Provider connection failover and database safety","Hosting execution limits and recoverable worker leases","Data validation, context size and calculation work limits","Audit records and frozen scenarios"],
    providerAccess:"not-verified-by-configuration" as const};
}
