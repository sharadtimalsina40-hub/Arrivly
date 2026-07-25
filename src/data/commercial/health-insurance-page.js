// Content model + provider data for the /health-insurance commercial page.
//
// ⚠️ DATA-INTEGRITY NOTE
// There is NO verified structured pricing for health insurance in this repo.
// The `indicative_from_aud` figures below are INDICATIVE single-adult starting
// prices carried over from the previous page — they are NOT quotes and are NOT
// individually verified. The page renders them only with explicit "indicative,
// not a quote" labelling and never claims "cheapest" or "best price".
//
// What IS factual and safe to present as guidance:
//   • the visa-subclass → cover-type mapping (500 → OSHC; 485/482/491/bridging
//     → OVHC; Condition 8501), which is general, verifiable information.
// Verdict picks are therefore framed by VISA/USER TYPE (factual), not by
// invented price rankings.

export const dataIsVerified = false;
export const lastReviewed = '2026-05-22'; // matches the existing page's build

// Factual visa → cover-type mapping (general information, verifiable).
export const visaCover = [
  { code: '500', name: 'Student Visa', cover: 'OSHC', note: 'OSHC is mandatory for the full visa period and should be bought before you arrive.' },
  { code: '485', name: 'Temporary Graduate Visa', cover: 'OVHC', note: 'OSHC becomes invalid once the student visa ends — switch to OVHC with no gap in cover.' },
  { code: '482', name: 'Skills in Demand (TSS)', cover: 'OVHC', note: 'Compliant OVHC is required under Condition 8501. Confirm whether your employer arranges it.' },
  { code: '491', name: 'Skilled Work Regional', cover: 'OVHC', note: 'OVHC for the full duration; check your insurer’s hospital network covers your region.' },
  { code: 'bridging', name: 'Bridging Visa (A/B/C/E)', cover: 'OVHC', note: 'Continue OVHC without a gap; do not let cover lapse between visas.' },
  { code: 'other', name: 'Other work visa (407/408/494)', cover: 'OVHC', note: 'Most include Condition 8501 — check your visa grant notice via VEVO.' },
];

// INDICATIVE provider reference — NOT verified, NOT a quote. Prices are
// single-adult starting points only, used to explain the market, never ranked.
export const providers = [
  { id: 'medibank', name: 'Medibank', cover: 'Both OSHC + OVHC', visas: ['500', '485', '482', '491', 'bridging'], indicative_from_aud: 40, highlight: 'Large hospital network across Australia' },
  { id: 'bupa', name: 'Bupa', cover: 'Both OSHC + OVHC', visas: ['500', '485', '482', '491', 'bridging'], indicative_from_aud: 38, highlight: 'Instant policy certificate on purchase' },
  { id: 'nib', name: 'nib', cover: 'Both OSHC + OVHC', visas: ['500', '485', '482', '491', 'bridging'], indicative_from_aud: 37, highlight: 'Fast online setup, strong regional coverage' },
  { id: 'allianz', name: 'Allianz Care', cover: 'Both OSHC + OVHC', visas: ['500', '485', '482', '491', '494', 'bridging'], indicative_from_aud: 35, highlight: 'Competitive pricing, good for regional visas' },
  { id: 'aia', name: 'AIA', cover: 'OVHC only', visas: ['485', '482', '491', 'bridging'], indicative_from_aud: 60, highlight: 'Includes wellness perks and member benefits' },
  { id: 'ahm', name: 'ahm', cover: 'OSHC only', visas: ['500'], indicative_from_aud: 35, highlight: 'Simple, affordable student cover' },
];

// Verdict cards framed by USER SITUATION (factual), pointing to the cover TYPE
// needed and an indicative provider — never a price ranking.
export const verdicts = [
  { category: 'New Student Visa 500 holder', coverType: 'OSHC', providerId: 'ahm', reason: 'You need OSHC for the whole visa, bought before arrival. Student-only insurers like ahm keep it simple; the big funds (Bupa, Medibank, nib, Allianz) all sell compliant OSHC too.' },
  { category: 'Graduating to a 485 visa', coverType: 'OVHC', providerId: 'nib', reason: 'Your OSHC stops being valid — switch to OVHC before the student visa ends. Most major funds sell OVHC; compare on waiting periods, not just price.' },
  { category: 'Sponsored worker (482)', coverType: 'OVHC', providerId: 'allianz', reason: 'Condition 8501 requires compliant OVHC. Confirm in writing whether your employer pays — many expect you to arrange it yourself.' },
  { category: 'Living or working regionally (491)', coverType: 'OVHC', providerId: 'allianz', reason: 'Make sure the insurer’s hospital agreements cover your regional area, not just the capital cities.' },
];

export const suitability = [
  { situation: 'New Student Visa 500 holder', matters: 'Buying compliant OSHC before you fly.', coverType: 'OSHC', reasoning: 'OSHC must cover your entire 500 visa and be active from arrival. Buy before boarding.' },
  { situation: 'Couple studying together', matters: 'One couple policy vs two singles.', coverType: 'OSHC couple', reasoning: 'A couple policy usually beats two single policies — but only if you both need the same period.' },
  { situation: 'Family arriving with children', matters: 'Dependants must be covered too.', coverType: 'OSHC family', reasoning: 'Anyone on your visa must be covered. Family cover exists at every major fund.' },
  { situation: 'Moving from 500 to 485', matters: 'No gap between OSHC and OVHC.', coverType: 'OVHC', reasoning: 'Switch before the student visa ends. A gap can breach Condition 8501.' },
  { situation: 'Temporary worker on 482/491', matters: 'Compliant OVHC under 8501.', coverType: 'OVHC', reasoning: 'Confirm your employer’s role and check regional hospital coverage.' },
  { situation: 'Wants extras (dental/optical)', matters: 'OSHC/OVHC rarely include extras.', coverType: 'Extras add-on', reasoning: 'Extras are usually a separate add-on — weigh the extra premium against expected use.' },
];

export const scenarios = [
  { title: 'Single Student Visa 500, 24 months', needs: 'Compliant OSHC covering the full visa, bought before arrival.', coverType: 'OSHC single', tradeoff: 'Cheapest single OSHC vs a fund with a larger hospital network and direct billing.', outcome: 'Any compliant single OSHC meets the visa rule — compare on hospital network and direct billing, and get a dated quote for your exact start date.' },
  { title: 'Couple on the same 500 visa', needs: 'Cover for both partners for the same period.', coverType: 'OSHC couple', tradeoff: 'One couple policy vs two singles.', outcome: 'A couple policy usually costs less than two singles for identical dates — confirm both are on compliant cover.' },
  { title: 'Graduating student moving to 485', needs: 'Switch from OSHC to OVHC with no gap.', coverType: 'OVHC', tradeoff: 'Staying with your current fund vs switching for a better OVHC waiting period.', outcome: 'Line the OVHC start date up with your OSHC end date. Switching can reset pre-existing-condition waiting periods — check before you move.' },
];

export const sources = [
  { name: 'Department of Home Affairs — health insurance for visa holders', url: 'https://immi.homeaffairs.gov.au/help-support/meeting-our-requirements/health-insurance', verified: 'Which visas require OSHC vs OVHC, and Condition 8501', date: '2026-05-22' },
  { name: 'privatehealth.gov.au — overseas visitors and students cover', url: 'https://www.privatehealth.gov.au/health_insurance/overseas/', verified: 'Definitions of OSHC / OVHC and what each broadly covers', date: '2026-05-22' },
  { name: 'Provider policy pages (Medibank, Bupa, nib, Allianz, AIA, ahm)', url: 'https://www.privatehealth.gov.au/', verified: 'Provider names and cover categories only — prices are indicative and still require per-policy verification', date: '2026-05-22' },
];

export const warnings = [
  'The cheapest policy often carries more exclusions, longer waiting periods, or a higher excess.',
  'Waiting periods apply to many services — pre-existing conditions and pregnancy especially.',
  'Extras (dental, optical, physio) are usually NOT included in base OSHC/OVHC.',
  'Direct billing (no upfront payment at the clinic) is not available everywhere.',
  'Pharmaceutical benefits are capped — often a per-item and annual limit.',
  'A quoted premium changes with your start date, cover level and policy type.',
  'Visa and health-cover requirements can change — verify against the Department of Home Affairs.',
  'This page is general information, not personalised migration, legal or medical advice.',
];

export const todos = [
  'No verified insurance pricing exists — obtain and store real per-policy quotes (single/couple/family, by duration) before presenting any price as more than "indicative".',
  'Once verified, set dataIsVerified = true and add hospital/medical/pharmaceutical/waiting-period fields per policy so the comparison table can show real cover detail.',
  'No affiliate relationships approved for insurers yet — provider CTAs currently point to official pages with rel="noopener".',
  'Add analytics (insurance_comparison_started, etc.) once an analytics system is installed.',
  'Add an "OSHC vs OVHC" standalone guide and a "Student Visa 500" guide, then link them from Related guides.',
];
