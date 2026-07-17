# Slice Intelligence Production Runbook

## Purpose

This runbook governs the deployment, operation, monitoring, incident response, rollback, and recovery of Slice Investment Intelligence.

Slice is an investment decision-support platform. It is not a broker, custodian, discretionary portfolio manager, automatic trading system, or guarantee of investment outcomes.

Autonomous trading and client-money movement must remain disabled.

---

## Operating States

### Shadow

Shadow is the default state.

In Shadow:

- Forecasts may be generated and stored.
- Models may be trained and evaluated.
- Simulations may be generated.
- Advisor drafts may be created.
- No output should be represented as validated production intelligence.
- No external client action should occur automatically.

### Pilot

Pilot is a controlled, monitored evaluation state.

Pilot requires:

- No critical health check failures.
- Current release-validation evidence.
- Accepted disclosures.
- Initial settled-outcome history.
- Point-in-time evidence coverage.
- No future-dated evidence.
- No critical model drift.
- Passed rate-limit, circuit-breaker, and incident-response drills.
- Human approval.

Pilot output remains decision-support evidence and requires advisor review.

### Production

Production requires all production launch gates, including:

- MFA and sensitive-action reauthentication.
- Current build, test, dependency, and secret-scan evidence.
- At least 100 settled horizon outcomes.
- Core-horizon sample coverage.
- At least 95% evidence-audit coverage.
- At least 90% validated evidence.
- No future-dated evidence.
- A human-promoted production model.
- A successful model-governance backtest.
- No critical model drift.
- No open incidents.
- No open service circuits.
- At least 100 recent guarded operations.
- At least 97% guarded-operation success.
- All recovery drills completed within 90 days.
- At least 14 days of monitored Pilot operation.
- Exact human confirmation.

Production does not enable trading or money movement.

---

## Pre-Deployment Checklist

1. Confirm the deployment commit SHA.
2. Run:

   ```text
   node scripts/intelligence-final-validation.mjs