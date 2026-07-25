// Content model for the /sim-cards commercial landing page.
// This is the reusable pattern: each vertical (SIM, health insurance,
// money transfer) gets one of these files feeding the same components.
//
// DATA INTEGRITY RULES
// - `planId` must reference a real entry in src/data/sim-plans.js.
//   The page resolves the full plan record at build time; a bad id throws.
// - Pick categories mirror recommendations Arrivly has already published
//   (blog post "best-sim-card-…-2026" + the finder's own logic). Nothing new
//   is invented here.
// - Missing verticals of information are listed in `todos`, not faked.
//
// @typedef {Object} Pick
// @property {string} category  Short label, e.g. "Best for calling Nepal"
// @property {string} planId    id in sim-plans.js
// @property {string} reason    One-sentence, data-supported selection reason

export const picks = [
  {
    category: 'Best if you mainly need data + WhatsApp',
    planId: 'felix-25',
    reason:
      'True monthly billing (not 28-day), and unused data rolls over into a data bank instead of expiring.',
  },
  {
    category: 'Best for calling India, Vietnam or the Philippines',
    planId: 'lebara-25',
    reason:
      'Unlimited calls to 35 countries including India, Vietnam and the Philippines at the lowest price in this group.',
  },
  {
    category: 'Best for calling Nepal',
    planId: 'boost-39',
    reason:
      'The largest Nepal allowance of any plan we checked — 300 minutes per cycle — on the full Telstra network.',
  },
  {
    category: 'Best for heavy data users',
    planId: 'felix-unlimited',
    reason:
      'The only truly unlimited-data plan in this comparison. Speed is capped at 40Mbps — fine for streaming, not for large downloads.',
  },
  {
    category: 'Best first-week starter',
    planId: 'amaysim-7day',
    reason:
      'Cheapest way to get connected on arrival ($10, renews weekly) while you research a longer-term plan properly.',
  },
];

// Suitability cards — situation → what matters → recommendation.
export const suitability = [
  {
    situation: 'Newly arrived student',
    matters: 'Getting connected today without locking into the wrong plan.',
    planId: 'amaysim-7day',
    reasoning:
      'A $10 weekly plan buys time to compare properly. Switching later costs nothing — prepaid has no exit fees.',
  },
  {
    situation: 'Budget-conscious student',
    matters: 'Lowest ongoing cost with no intro-price traps.',
    planId: 'lycamobile-xs',
    reasoning:
      'Cheapest ongoing plan in this group on Telstra wholesale coverage. Check the current data quota — Lycamobile details still need click-through verification.',
  },
  {
    situation: 'Heavy data user',
    matters: 'Not running out of data mid-month.',
    planId: 'felix-unlimited',
    reasoning:
      'Unlimited data with a 40Mbps speed cap. If you need full speed, amaysim 80GB or Lycamobile XL (200GB) are the high-quota alternatives.',
  },
  {
    situation: 'Calls family overseas every week',
    matters: 'Whether your specific country is actually included — lists differ a lot.',
    planId: 'boost-39',
    reasoning:
      'Boost covers the widest set of South Asian destinations with real minutes (300 to Nepal, Bangladesh, Pakistan, Philippines). Lebara is cheaper if your country is in its unlimited list.',
  },
  {
    situation: 'Short-term visitor (under 3 months)',
    matters: 'No commitment, low total spend.',
    planId: 'amaysim-7day',
    reasoning:
      'Weekly renewal means you stop paying the week you leave. Expensive per GB if you stay longer — switch after a month.',
  },
  {
    situation: 'Living or working regionally',
    matters: 'Coverage outside the capital cities.',
    planId: 'boost-39',
    reasoning:
      'Boost resells the full Telstra network — the only plans here rated excellent for regional coverage. Vodafone-based MVNOs are the weakest outside metro areas.',
  },
];

// Scenario walk-throughs. All figures resolve from plan data at build time.
export const scenarios = [
  {
    title: 'Staying 3 years, calls Nepal weekly',
    needs: 'Reliable Nepal minutes every cycle, coverage that survives a possible regional move, predictable cost over a long stay.',
    consideredIds: ['boost-39', 'lebara-25', 'lebara-40'],
    tradeoff:
      'Boost costs $14–19 more per cycle than Lebara but includes 300 Nepal minutes versus 30–50, and full Telstra coverage versus metro-focused Vodafone.',
    outcome:
      'Boost $39 — over a long stay, the calling allowance and network breadth outweigh the higher price. Budget its true cost: about $508/year on 28-day billing, not $468.',
  },
  {
    title: 'Uses 50GB+ every month',
    needs: 'A quota that never runs out, at sensible cost per GB.',
    consideredIds: ['felix-unlimited', 'amaysim-80', 'lycamobile-xl'],
    tradeoff:
      'Felix Unlimited removes quota anxiety but caps speed at 40Mbps. amaysim 80GB and Lycamobile XL (200GB) run at full speed but have hard limits — and Lycamobile’s details still need re-verification.',
    outcome:
      'Felix Unlimited if you value never thinking about data; amaysim 80GB if you want full speed and 80GB is genuinely enough.',
  },
  {
    title: 'Visiting for 6 weeks',
    needs: 'Connected on day one, minimal total spend, nothing to cancel.',
    consideredIds: ['amaysim-7day', 'lycamobile-xs'],
    tradeoff:
      'The 7-day plan costs more per GB than any 28-day plan, but you only ever pay for the weeks you are here.',
    outcome:
      'amaysim 7-Day $10 for a stay this short — about $60 total for six weeks with zero commitment.',
  },
];

// Sources — one per provider, from the verified_source fields in the data.
export const sources = [
  {
    name: 'Lebara Australia — 28-day prepaid plans',
    url: 'https://www.lebara.com.au/prepaid-plans/28-day/',
    verified: 'Prices, data quotas, international calling inclusions and Nepal minutes for the $25/$30/$40 plans',
    date: '2026-05-15',
  },
  {
    name: 'Boost Mobile — prepaid plans (Critical Information Summary PDF)',
    url: 'https://boost.com.au/prepaid-plans',
    verified: 'Prices, data, 300-minute international allowance and destination list for the $39 and $59 plans',
    date: '2026-05-15',
  },
  {
    name: 'Felix Mobile — plan page',
    url: 'https://felixmobile.com.au/plan',
    verified: 'Pricing, monthly billing cycle, data rollover, unlimited-plan speed cap, international add-on coverage',
    date: '2026-05-15',
  },
  {
    name: 'amaysim — SIM plans',
    url: 'https://www.amaysim.com.au/sim-plans',
    verified: 'Prices, data quotas, renewal periods and international call inclusions for the 42GB, 80GB and 7-day plans',
    date: '2026-05-15',
  },
  {
    name: 'Lycamobile Australia — plan pages',
    url: 'https://www.lycamobile.com.au/en/bundle/unlimited-plan-xs/',
    verified: 'Headline pricing only — data quotas and country lists were sourced from search snippets and still require click-through verification',
    date: '2026-05-15',
  },
];

// Editorial TODOs — content that must NOT be faked and is therefore absent.
export const todos = [
  'eSIM availability per plan — field does not exist in sim-plans.js yet; add and verify before publishing any eSIM guidance.',
  'Named human author + reviewer — repo has no real author identity; page credits the Arrivly editorial team until one is added.',
  '/how-we-rank standalone methodology page — currently covered by the on-page methodology section (#methodology).',
  'Analytics events (comparison_started etc.) — no analytics system is installed; add Plausible first, then instrument the finder.',
  'Re-verify Lycamobile data quotas and country lists by click-through (flagged in the data file).',
  'Replace remaining PLACEHOLDER affiliate_url fields as Commission Factory approvals land.',
];
