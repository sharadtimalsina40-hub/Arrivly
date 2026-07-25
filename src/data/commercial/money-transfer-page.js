// Content model for the /money-transfer commercial landing page.
// Verdict/suitability picks reference real provider ids in money-transfer.json.
// NOTE: that data is flagged illustrative — every rendered figure on the page
// is labelled "illustrative model, not a live quote", and no fabricated FX
// recipient amounts are shown (only AUD total-cost, which is derivable).

export const verdicts = [
  {
    category: 'Best all-in cost',
    providerId: 'ofx',
    reason: 'Zero transfer fee and the lowest exchange-rate markup (0.5%) of the group — cheapest true cost on medium and large transfers.',
    limitation: 'Bank deposit only, $250 minimum, and 1–2 business days rather than minutes.',
  },
  {
    category: 'Best real exchange rate',
    providerId: 'wise',
    reason: 'The only service here using the mid-market rate with no markup; the fee is small and shown upfront before you confirm.',
    limitation: 'Bank deposit only — no cash pickup, and the recipient needs a bank account.',
  },
  {
    category: 'Best for cash pickup',
    providerId: 'remitly',
    reason: 'Cash pickup at thousands of agent locations with express transfers arriving in minutes; first transfer usually fee-free.',
    limitation: 'Exchange rate carries a markup, so the all-in cost is higher than Wise or OFX.',
  },
  {
    category: 'Widest payout reach',
    providerId: 'worldremit',
    reason: 'Bank, cash pickup and mobile wallet across a very broad country network — useful where recipients lack a bank account.',
    limitation: 'Higher markup than Wise; less competitive on larger amounts.',
  },
];

export const suitability = [
  { situation: 'Sending small amounts often', matters: 'Flat fees hurt most on small sends.', providerId: 'wise', reasoning: 'A low fixed fee plus the real rate keeps the percentage cost down on $100–$200 transfers.' },
  { situation: 'Sending tuition or a lump sum', matters: 'On big amounts the rate margin dwarfs the fee.', providerId: 'ofx', reasoning: 'Zero fee and the lowest markup make OFX cheapest once you clear its $250 minimum.' },
  { situation: 'Family needs cash in hand', matters: 'Recipient has no bank account.', providerId: 'remitly', reasoning: 'Reliable cash pickup in minutes; accept a slightly higher rate as the price of convenience.' },
  { situation: 'You want it there in minutes', matters: 'Speed over squeezing every dollar.', providerId: 'remitly', reasoning: 'Express tier delivers in minutes. Western Union is the alternative for the widest cash network.' },
  { situation: 'First transfer only', matters: 'Promotions apply once, then rates revert.', providerId: 'remitly', reasoning: 'A fee-free/promo-rate first transfer is genuinely cheapest once — but compare the ongoing rate before you commit to a provider.' },
];

// Scenario "considered" providers reference real ids. Figures are computed at
// build time from the (illustrative) cost model — never hand-typed.
export const scenarios = [
  { title: 'Sending A$100 home', amount: 100, tier: 'small', consideredIds: ['wise', 'remitly', 'western-union'],
    note: 'On small amounts a flat fee is a big percentage. The real-rate provider usually wins.' },
  { title: 'Sending A$500 to family', amount: 500, tier: 'medium', consideredIds: ['ofx', 'wise', 'western-union'],
    note: 'The "$0 fee" providers are not automatically cheapest — the rate margin is where the cost hides.' },
  { title: 'Sending A$2,000 tuition', amount: 2000, tier: 'large', consideredIds: ['ofx', 'wise', 'worldremit'],
    note: 'On large amounts the exchange-rate markup dominates; the fee barely matters.' },
];

export const sources = [
  { name: 'Wise — Australia pricing', url: 'https://wise.com/au/', verified: 'Fee structure and mid-market rate claim', date: '2026-05-29' },
  { name: 'Remitly — Australia', url: 'https://www.remitly.com/au/en', verified: 'Fee, delivery speed tiers, cash pickup availability, first-transfer promo', date: '2026-05-29' },
  { name: 'OFX — Australia', url: 'https://www.ofx.com/en-au/', verified: 'Zero-fee threshold, $250 minimum, delivery time', date: '2026-05-29' },
  { name: 'WorldRemit — Australia', url: 'https://www.worldremit.com/en-au', verified: 'Payout methods, country network, fee structure', date: '2026-05-29' },
  { name: 'Western Union — Australia', url: 'https://www.westernunion.com/au/en/home.html', verified: 'Cash network, fee and speed claims', date: '2026-05-29' },
];

export const warnings = [
  'A "$0 fee" transfer can still cost more — the exchange-rate margin is a hidden cost that often exceeds a flat fee.',
  'Promotional rates usually apply to your first transfer only, then revert to the ongoing rate.',
  'Exchange rates move constantly. A rate you see now is not the rate you lock in at send time.',
  'Delivery estimates ("minutes", "1–2 days") are estimates, not guarantees.',
  'Paying by credit card usually costs more than a bank transfer or debit card.',
  'The recipient’s own bank may charge a receiving fee the sender cannot see.',
  'Cash pickup availability and agent locations vary by country and city.',
  'Identity verification can delay a first transfer by hours or days.',
  'Always confirm the final recipient amount inside the provider’s app before you send.',
];

export const todos = [
  'money-transfer.json is illustrative — verify every fee, markup, corridor and speed against each provider’s live pricing page, then set dataIsVerified = true.',
  'Store an actual mid-market FX rate per corridor if you want to show recipient amounts in foreign currency (NPR/INR/PHP). Currently only AUD total-cost is shown, because that is all the data supports.',
  'Replace remaining PLACEHOLDER affiliate_url values (only Wise is live) as approvals land.',
  'Add analytics (transfer_comparison_started, transfer_provider_clicked, etc.) once an analytics system is installed — none exists yet.',
  'Add Australia-to-Nepal / India / Philippines corridor guides, then link them from Related guides.',
];
