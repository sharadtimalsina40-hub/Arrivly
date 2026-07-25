// Derived statistics for the SIM commercial landing page.
// Everything here is COMPUTED from src/data/sim-plans.js — no hand-typed claims.
//
// Formula documentation
// ---------------------
// effectiveAnnualCost(plan):
//   ongoing price per renewal × renewals per year, where
//   renewals per year = 365 / billing_cycle_days.
//   A "$25 per 28 days" plan therefore costs 25 × (365/28) = $325.9 ≈ $326/yr,
//   not the $300/yr the headline "monthly" price implies.
//   Rounded to the nearest dollar for display.
//
// headlineAnnualCost(plan):
//   ongoing price × 12 — what a user assumes when they read "$25/month".
//
// annualGap(plan): effective − headline. Positive = the plan quietly costs more.
//
// Self-check: `node src/data/sim-stats.js` runs the assertions at the bottom.

import plans from './sim-plans.js';

export function effectiveAnnualCost(plan) {
  return Math.round(plan.price_ongoing_aud * (365 / plan.billing_cycle_days));
}

export function headlineAnnualCost(plan) {
  return plan.price_ongoing_aud * 12;
}

export function annualGap(plan) {
  return effectiveAnnualCost(plan) - headlineAnnualCost(plan);
}

export function dataDisplay(plan) {
  return plan.data_gb >= 900 ? 'Unlimited' : `${plan.data_gb}GB`;
}

const providers = [...new Set(plans.map((p) => p.provider))];
const cycle28 = plans.filter((p) => p.billing_cycle_days === 28);
const latestVerified = plans
  .map((p) => p.last_verified)
  .sort()
  .at(-1);

// Plans ranked by how much their effective annual cost exceeds the headline
// "price × 12" figure — the raw material for the original-insight section.
const gapRanked = plans
  .map((p) => ({
    id: p.id,
    name: p.name,
    provider: p.provider,
    cycleDays: p.billing_cycle_days,
    monthly: p.price_ongoing_aud,
    headline: headlineAnnualCost(p),
    effective: effectiveAnnualCost(p),
    gap: annualGap(p),
  }))
  .sort((a, b) => b.gap - a.gap);

export const stats = {
  planCount: plans.length,
  providerCount: providers.length,
  providers,
  latestVerified,
  cycle28Count: cycle28.length,
  gapRanked,
  totalGapAcross28DayPlans: cycle28.reduce((sum, p) => sum + annualGap(p), 0),
};

export default stats;

// ── Self-check (run: node src/data/sim-stats.js) ─────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (cond, msg) => {
    if (!cond) {
      console.error('✗ FAIL:', msg);
      process.exitCode = 1;
    } else {
      console.log('✓', msg);
    }
  };

  const lebara25 = plans.find((p) => p.id === 'lebara-25');
  assert(effectiveAnnualCost(lebara25) === 326, 'Lebara $25 @28d → $326/yr (25 × 365/28)');
  assert(headlineAnnualCost(lebara25) === 300, 'Lebara $25 headline → $300/yr');
  assert(annualGap(lebara25) === 26, 'Lebara $25 gap → $26/yr');

  const felix25 = plans.find((p) => p.id === 'felix-25');
  assert(effectiveAnnualCost(felix25) === 304, 'Felix 25GB @30d → $304/yr (25 × 365/30)');

  const boost39 = plans.find((p) => p.id === 'boost-39');
  assert(effectiveAnnualCost(boost39) === 508, 'Boost $39 @28d → $508/yr');

  assert(stats.planCount === 12, `plan count is 12 (got ${stats.planCount})`);
  assert(stats.cycle28Count === 9, `9 of 12 plans renew every 28 days (got ${stats.cycle28Count})`);
  console.log('\nAll sim-stats checks done.');
}
