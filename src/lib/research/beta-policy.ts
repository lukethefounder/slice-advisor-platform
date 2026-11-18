/** Business allowances only. This policy never grants provider access or disables security. */
export function researchBetaEnabled(env: Record<string, string | undefined>): boolean {
  const value = (env.SLICE_PULSE_BETA_UNCAPPED ?? "false").trim().toLowerCase();
  if(value!=="true" && value!=="false") throw new Error("SLICE_PULSE_BETA_UNCAPPED must be true or false.");
  return value === "true";
}
export function researchBetaSummary(env: Record<string, string | undefined>) {
  const enabled=researchBetaEnabled(env);
  return {enabled,mode:enabled?"beta-uncapped" as const:"standard" as const,
    label:enabled?"Beta access · application usage allowances disabled":"Research · configured application allowances",
    coverage:["Market data gateway","Historical imports","Intelligence operation usage and estimated-cost budgets","AI Studio request allowances","Scenario active-record allowance"],
    preserved:["Authentication and firm permissions","Provider limits and endpoint entitlements","Security request protection","Circuit breakers and operation leases","Data validation, context size and calculation work limits","Audit records and frozen scenarios"],
    providerAccess:"not-verified-by-configuration" as const};
}
