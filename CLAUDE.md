# Arrivly — Claude Code Instructions

> This file tells Claude Code everything it needs to know about this project.
> Claude reads this automatically every session. Keep it updated as the project grows.

---

## What This Project Is

**Arrivly** is a comparison and recommendation platform for international students arriving in Australia.

**Short-term:** Compare SIM cards, OSHC health insurance, bank accounts, money transfer services, and other essentials for new arrivals.

**Long-term vision:** Full education and settlement platform — university comparison, course finder, PR pathway guidance, visa support.

**Revenue model:** Affiliate commissions. Users click through to providers via tracked links. We earn a commission per signup. No ads. No bias toward higher-paying providers — recommendations are based purely on best fit for the user.

**Target users:**
- International students arriving in Australia (student visa 500)
- Students already in Australia on 485, 482, 491 visas
- Primarily South Asian community (Nepalese, Indian, Filipino, Vietnamese)
- Mobile-first users — assume 80% are on phones

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Astro.js |
| Styling | Tailwind CSS |
| Interactivity | Alpine.js |
| Icons | Lucide |
| Fonts | Fraunces (serif display) + DM Sans (body) |
| Data | JSON files in /src/data/ |
| Hosting | Netlify |
| Backend | None (Phase 1) — all static |

**Important:** This is a static site. No backend, no database, no server-side code. All recommendation logic runs in the browser via JavaScript. Keep it this way until there is a clear reason to add a backend.

---

## Project Structure

```
arrivly/
├── src/
│   ├── pages/
│   │   ├── index.astro          ← Homepage / landing page
│   │   ├── sim-cards.astro      ← SIM card comparison (BUILT)
│   │   ├── oshc.astro           ← Health insurance (TODO)
│   │   ├── banks.astro          ← Bank accounts (TODO)
│   │   ├── money-transfer.astro ← Money transfer (TODO)
│   │   └── blog/
│   │       └── [slug].astro     ← Blog articles (TODO)
│   ├── components/
│   │   ├── Nav.astro            ← Site navigation
│   │   ├── Footer.astro         ← Site footer
│   │   └── ComparisonWizard.astro ← 3-step wizard component
│   ├── data/
│   │   ├── sim-cards.json       ← VERIFIED real data (15 May 2026)
│   │   ├── oshc.json            ← TODO
│   │   ├── banks.json           ← TODO
│   │   └── money-transfer.json  ← TODO
│   ├── content/
│   │   └── posts/               ← Blog posts in Markdown
│   └── styles/
│       └── global.css           ← Global styles
├── public/
│   └── favicon.svg
├── CLAUDE.md                    ← This file
├── astro.config.mjs
├── tailwind.config.cjs
└── package.json
```

---

## Design System

### Brand

- **Name:** Arrivly
- **Logo:** Arrivly wordmark in Fraunces serif, top-left corner always
- **Logo dot:** Small lime-green dot after the wordmark (brand signature)
- **Tagline:** "Everything you need when you arrive in Australia"

### Colors

```css
--black:   #0a0a0a    /* Primary text, buttons */
--white:   #fafaf8    /* Background */
--warm:    #f5f0e8    /* Card backgrounds */
--accent:  #c8f064    /* Lime green — CTA highlight, badges */
--text:    #1a1a1a    /* Body text */
--text-2:  #555555    /* Secondary text */
--text-3:  #999999    /* Tertiary, placeholders */
--border:  rgba(0,0,0,0.08)  /* Borders */
```

**Never use purple gradients or blue as primary.** The lime-green accent on near-white is the brand identity.

### Typography

```css
--serif: 'Fraunces', Georgia, serif     /* Headlines, logo, display text */
--sans:  'DM Sans', system-ui, sans-serif  /* Body, UI, labels */
```

- **Headlines:** Fraunces, light or regular weight, tight letter-spacing (-0.04em)
- **Body:** DM Sans, 400 weight, relaxed line-height (1.6-1.75)
- **Labels/badges:** DM Sans, 700 weight, uppercase, tracked

**Never use Inter, Roboto, Arial, or generic system fonts for display text.**

### Spacing

- Section padding: 80px top/bottom on desktop, 48px on mobile
- Content max-width: 1200px, centered
- Card padding: 24-32px
- Border radius: 20px for cards, 999px for pills/buttons

### Component Patterns

**Wizard cards (answer options):**
- White background, 1px border (border-gray-200)
- Rounded corners (rounded-xl)
- Icon top-left, title bold, subtitle gray
- Hover: border darkens, subtle background tint
- Selected: black border, light green tint background

**Result cards (recommendations):**
- Featured/top match: accent-colored top border or badge
- Price prominent top-right in black
- Stats in small grid below name
- Pros as green checkmark list
- Cons as gray cross list
- "Get this plan" CTA button — full width, black, rounded

**Progress bar:**
- Three equal segments at top of wizard
- Filled: black. Unfilled: gray-200
- No text labels — the bar tells the story

---

## Data Structure

### sim-cards.json schema

```json
{
  "id": "string",
  "name": "string",
  "provider": "string",
  "network": "string (Telstra / Optus / Vodafone)",
  "network_type": "string (Full Telstra / MVNO / etc)",
  "price_aud": "number",
  "price_ongoing_aud": "number",
  "price_intro_note": "string or null",
  "billing_cycle_days": "number (28 or 30 or 7)",
  "billing_warning": "boolean",
  "data_gb": "number (999 = unlimited)",
  "data_note": "string or null",
  "speed_mbps": "number or null",
  "international_calls": {
    "included": "boolean",
    "nepal_minutes": "number",
    "unlimited_countries": ["ISO 3166-1 alpha-2 codes"],
    "limited_minutes_countries": ["ISO codes"],
    "limited_minutes_amount": "number",
    "details": "string"
  },
  "coverage": {
    "metro": "excellent / good / fair / poor",
    "regional": "excellent / good / fair / poor",
    "remote": "excellent / good / fair / poor",
    "note": "string"
  },
  "best_for": ["calling-home", "data-heavy", "budget", "regional", "balanced", "short-stay"],
  "pros": ["string array"],
  "cons": ["string array"],
  "affiliate_url": "string (PLACEHOLDER until affiliate programs approved)",
  "official_url": "string",
  "last_verified": "YYYY-MM-DD",
  "verified_source": "string"
}
```

**Always use this exact schema when adding new plans.**

---

## Scoring Engine (SIM cards)

The recommendation engine uses a filter-then-score approach.

### Step 1 — Hard filters (remove plans that fail these)

```
If user selected "Calling home":
  Remove plans where international_calls.included = false

If user selected "Nepal" as country:
  Remove plans where nepal_minutes = 0
  (Currently only Boost $39 and Boost $59 and Lebara plans qualify)

If user selected "Budget" / "Cheapest":
  Remove plans where price_ongoing_aud > 25
```

### Step 2 — Score remaining plans

```
Base score: 100

Priority matching (Q1 — can be multi-select):
  + 30 per matching best_for tag

Stay duration (Q2):
  Short stay (< 6 months):  + 20 if billing_cycle_days = 7 or price_aud < 25
  Mid stay (6-12 months):   + 20 if billing_cycle_days = 28
  Long stay (1+ year):      + 20 if billing_cycle_days = 30 (monthly — Felix)

Country calling (Q3):
  + 40 if country in unlimited_countries
  + 25 if country in limited_minutes_countries (partial match)
  + 0  if country not covered

Coverage bonus:
  + 15 if user selects "Regional" and coverage.regional = excellent (Boost, Telstra)

Data bonus (if user selects "Maximum data"):
  + data_gb / 5 (capped at 40 points)
  Felix Unlimited (999GB) gets maximum data bonus

Budget bonus (if user selects "Cheapest"):
  + (50 - price_aud) / 2 — lower price = higher score
```

### Step 3 — Return top 3

Show #1 as "Best match", #2 and #3 as "Also consider."

---

## Special UI Rules

### Nepal calling warning
When user selects Nepal (NP) as their country, always show this message on results page:

> "Heads up: No Australian SIM includes unlimited Nepal calls. Boost gives you 300 mins/month. Lebara gives you 30–50 mins. Most students also use WhatsApp or Viber over data."

### Billing cycle warning
When a plan has billing_cycle_days = 28, show near the price:

> "Billed every 28 days — 13 payments per year, not 12"

Use orange/amber color. This is critical for user trust.

### Lycamobile disclaimer
Lycamobile data was sourced from search snippets (their site is JS-rendered). Show on Lycamobile result cards:

> "Verify current inclusions at lycamobile.com.au before purchasing"

### Verification badge
Show on every result card:

> "Verified [last_verified] · [verified_source]"

Small gray text at bottom of card.

---

## Affiliate Program Status

| Provider | Program | Status | Commission |
|----------|---------|--------|-----------|
| Boost Mobile | Commission Factory | NOT YET APPLIED | TBC |
| Lebara | Commission Factory | NOT YET APPLIED | TBC |
| Felix Mobile | Direct / Commission Factory | NOT YET APPLIED | TBC |
| amaysim | Commission Factory | NOT YET APPLIED | TBC |
| Lycamobile | Direct | NOT YET APPLIED | TBC |

**All affiliate_url fields currently say PLACEHOLDER.**
**Do not replace these until affiliate accounts are approved.**
**When replacing, use the correct tracked URL from the affiliate dashboard.**

---

## Content Priorities (Blog)

These articles should be written before launch — each targets a real search query:

1. **"Best SIM card for Nepalese students in Australia 2026"**
   Key finding: Only Boost Mobile ($39) and Lebara include Nepal minutes. No other provider does.

2. **"Lebara vs Lycamobile Australia — which is better for international students?"**
   Key finding: Lebara includes Nepal (30 mins), Lycamobile does not. Lycamobile has more data.

3. **"The 28-day billing trick — how Australian SIM cards charge you 13 times a year"**
   Key finding: Most providers use 28-day cycles, not monthly. This is rarely disclosed upfront.

4. **"Best SIM card for regional Australia — international students on 491 visa"**
   Key finding: Only Telstra-network plans (Boost, Telstra direct) reliably work in regional areas.

5. **"Do I need OSHC? Complete guide for international students in Australia 2026"**

---

## What NOT to do

- **Never recommend a plan without verified data.** If a plan's data is uncertain, mark it clearly.
- **Never show placeholder affiliate links as real links.** Keep them as PLACEHOLDER until approved.
- **Never add features before the current category works perfectly.** Fix sim-cards fully before building oshc.
- **Never use purple gradient backgrounds, Inter font, or generic AI design patterns.**
- **Never make the wizard auto-skip questions.** Every question contributes to better recommendations.
- **Never remove the billing cycle warning.** It is the most important trust signal on the site.

---

## Current Status (as of 15 May 2026)

### Done
- [x] Astro project set up with Tailwind
- [x] SIM card comparison page built (/sim-cards)
- [x] 12 plans with verified real data
- [x] 3-question wizard with multi-select on Q1
- [x] Scoring engine with filter-then-score logic
- [x] Nepal-specific messaging
- [x] Billing cycle warnings
- [x] Coverage information per plan
- [x] Clean result cards with pros/cons

### In progress
- [ ] Landing page / homepage (index)
- [ ] Brand name confirmed: Arrivly
- [ ] Domain: arrivly.com.au (not yet purchased)

### Next up
- [ ] Purchase arrivly.com.au domain
- [ ] Apply for Commission Factory affiliate account
- [ ] Apply for Boost, Lebara, Felix affiliate programs
- [ ] Replace PLACEHOLDER affiliate URLs with real tracked links
- [ ] Write Nepal SIM article (highest priority SEO content)
- [ ] Deploy to Netlify
- [ ] OSHC comparison page

### Later
- [ ] Bank account comparison
- [ ] Money transfer comparison
- [ ] University comparison (long-term vision)
- [ ] User accounts / saved comparisons
- [ ] Mobile app

---

## Commands

```bash
# Start development server
npm run dev
# → http://localhost:4321

# Build for production
npm run build

# Preview production build
npm run preview

# Check for broken links or errors
npm run astro check
```

---

## Important Notes for Claude

1. **Always use verified data.** If asked to add a new plan, ask for the official source URL before writing any data.

2. **Preserve the scoring engine logic.** The filter-then-score approach is intentional. Do not simplify it back to score-only — that caused Felix to win every recommendation regardless of user input.

3. **The design system is intentional.** Fraunces + DM Sans + lime accent is the brand. Do not switch to Inter/Roboto or purple/blue gradients.

4. **Mobile first.** Every component must work on 375px width before desktop. Most users are on phones.

5. **Keep it honest.** Disclaimers, billing warnings, and verification badges are not optional. They are the core value proposition. A site that admits limitations is more trustworthy than one that hides them.

6. **One category at a time.** Do not start building OSHC, banks, or money transfer until SIM cards is fully working and deployed.

7. **The long-term vision is education.** University comparison, PR pathways, and course finding will come later. Don't over-engineer for it now, but don't make architectural decisions that would prevent it.

---

*Last updated: 15 May 2026*
*Owner: Jackieo*
