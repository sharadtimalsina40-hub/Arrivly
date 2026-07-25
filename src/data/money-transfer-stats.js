// Tested cost utilities for the /money-transfer commercial page.
//
// ⚠️ IMPORTANT DATA-INTEGRITY NOTE
// money-transfer.json is flagged PLACEHOLDER ILLUSTRATIVE and stores fee +
// exchange-rate MARKUP, but NOT an actual mid-market FX rate. Therefore we
// CANNOT compute "recipient gets ₹X / NPR X" without fabricating a rate.
// What IS honestly derivable is the TOTAL COST IN AUD of a transfer
// (upfront fee + the rate-margin cost), which is exactly the "a $0-fee
// transfer can still cost more" story — expressed in AUD, not invented
// foreign currency. Every figure on the page is labelled "illustrative
// model, not a live quote".
//
// Formulas
// --------
// upfrontFee(p, amount)   = fee_aud + (fee_percent/100) × amount
// netSend(p, amount)      = amount − upfrontFee            (what gets converted)
// rateMarginCost(p, amt)  = (rate_markup_percent/100) × netSend
// totalCostAud(p, amount) = upfrontFee + rateMarginCost    (true all-in cost)
// costPercent(p, amount)  = totalCostAud / amount × 100
//
// Self-check: `node src/data/money-transfer-stats.js`

import data from './money-transfer.json' with { type: 'json' };

export const providers = data.providers;
export const dataIsVerified = false; // json is flagged illustrative
export const latestVerified = providers.map((p) => p.last_verified).sort().at(-1);

export function upfrontFee(p, amount) {
  return p.fee_aud + (p.fee_percent / 100) * amount;
}
export function netSend(p, amount) {
  return amount - upfrontFee(p, amount);
}
export function rateMarginCost(p, amount) {
  return (p.rate_markup_percent / 100) * netSend(p, amount);
}
export function totalCostAud(p, amount) {
  return upfrontFee(p, amount) + rateMarginCost(p, amount);
}
export function costPercent(p, amount) {
  return (totalCostAud(p, amount) / amount) * 100;
}
export function round2(n) {
  return Math.round(n * 100) / 100;
}

// Rank providers by true all-in cost for a given send amount, cheapest first.
// Only includes providers that support the amount tier.
export function rankByCost(amount, tier) {
  return providers
    .filter((p) => (tier ? p.supports_amount.includes(tier) : true))
    .map((p) => ({
      id: p.id,
      name: p.name,
      fee: round2(upfrontFee(p, amount)),
      marginCost: round2(rateMarginCost(p, amount)),
      totalCost: round2(totalCostAud(p, amount)),
      costPct: round2(costPercent(p, amount)),
      markup: p.rate_markup_percent,
      feeLabel: p.fee_aud === 0 && p.fee_percent === 0 ? 'Free' : `$${p.fee_aud.toFixed(2)}${p.fee_percent ? ' + ' + p.fee_percent + '%' : ''}`,
    }))
    .sort((a, b) => a.totalCost - b.totalCost);
}

export default { providers, rankByCost, totalCostAud, latestVerified, dataIsVerified };

// ── Self-check ───────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (cond, msg) => {
    if (!cond) { console.error('✗ FAIL:', msg); process.exitCode = 1; }
    else console.log('✓', msg);
  };
  const wise = providers.find((p) => p.id === 'wise');
  const wu = providers.find((p) => p.id === 'western-union');
  const ofx = providers.find((p) => p.id === 'ofx');

  // Wise $500: fee 1.20 + 0.5% = 3.70; markup 0 → total 3.70
  assert(round2(upfrontFee(wise, 500)) === 3.7, 'Wise $500 upfront fee = $3.70 (1.20 + 0.5%)');
  assert(round2(totalCostAud(wise, 500)) === 3.7, 'Wise $500 total cost = $3.70 (0% markup)');

  // Western Union $500: fee 4.90; net 495.10; margin 2.5% = 12.38; total 17.28
  assert(round2(totalCostAud(wu, 500)) === 17.28, 'Western Union $500 total cost = $17.28 (fee + 2.5% margin)');

  // OFX $500: fee 0; margin 0.5% of 500 = 2.50; total 2.50 — cheapest despite "$0 fee" peers
  assert(round2(totalCostAud(ofx, 500)) === 2.5, 'OFX $500 total cost = $2.50 (0 fee, 0.5% margin)');

  const ranked = rankByCost(500, 'medium');
  assert(ranked[0].id === 'ofx', `cheapest at $500 is OFX (got ${ranked[0].id})`);
  assert(ranked.at(-1).id === 'western-union', `dearest at $500 is Western Union (got ${ranked.at(-1).id})`);

  // The headline insight: WU advertises $4.90 fee but its TRUE cost is ~7x OFX's.
  console.log(`\nInsight check — $500 transfer true cost: OFX $${ranked[0].totalCost} vs Western Union $${ranked.at(-1).totalCost}`);
  console.log('All money-transfer-stats checks done.');
}
