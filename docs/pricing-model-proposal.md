# BooGMe Pricing Model: Research & Proposal

**Author:** Claude (deep market research, June 2026)
**Status:** DECIDED — founder chose a **flat 12%** on all lessons and content (no subscription, no tiers). Implemented in `shared/pricing.ts` and reflected across onboarding, Home, and both landing pages.
**Note:** This proposal recommended 10%; the founder selected 12%. Both sit inside the research-supported range (Sharetribe's top-performing marketplaces average 12.4%; Gurley's 10–15% sweet spot), and 12% remains well below every tutoring competitor (Preply 18–33%, Wyzant 25%+9%, iTalki 15–21%). The structural argument — flat, honest, no fee-increase trap — holds at either number.

---

## Executive Summary

After researching 20+ platforms across chess coaching, tutoring, freelance marketplaces, and creator economies, the recommendation is:

**A flat 10% commission on lessons and content, from day one, for all coaches. No tiers. No subscriptions. No founding-coach 0% promo.**

This is lower than every tutoring competitor (Preply 18-33%, Wyzant 25%, iTalki ~15%), simpler than every tiered system (Upwork, Teachable, current BooGMe code), and avoids the painful fee-increase trap that has caused seller revolts at Etsy, Poshmark, Mercari, and Airbnb.

---

## Part 1: Competitive Landscape

### Direct Tutoring/Coaching Competitors

| Platform | Coach/Tutor Fee | Student Fee | Effective Take Rate | Model |
|----------|----------------|-------------|-------------------|-------|
| **Preply** | 33% (new) → 18% (400+ hrs); **100% on trial lessons** | Subscription (4+ lessons/cycle) | 18-33% | Tiered commission |
| **Wyzant** | Flat 25% | 9% service fee | ~34% combined | Flat commission |
| **iTalki** | ~15% (reported range 15-30%) | None | ~15-30% | Flat commission |
| **Superprof** | 0% | $39-49 "Student Pass" | ~15-25% (demand-side) | Student subscription |
| **Chess.com** | Coaches set rates, platform takes a cut | Lesson purchase | Unknown (opaque) | Commission |
| **Venmo/Discord** | 0% | 0% | 0% | No platform (no protection) |

**Key insight:** The tutoring marketplace is a high-take-rate category (18-34%). BooGMe at 10-12% would be dramatically cheaper than any established competitor.

### Broader Marketplace Benchmarks

| Platform | Supply-Side Fee | Model Type | Notes |
|----------|----------------|-----------|-------|
| **Fiverr** | Flat 20% | Commission | No volume discounts; 5.5% buyer fee on top |
| **Upwork** | Variable 0-15% (avg ~10%) | Algorithmic commission | Opaque; 3-10% buyer fee on top |
| **Etsy** | 6.5% + processing + ads | Commission + fees | Effective ~22% at maturity; started at 3.5% |
| **Teachable** | $39/mo + 7.5% OR $69/mo + 0% | Subscription + commission | Killed free tier June 2025 |
| **Skool** | $9/mo + 10% OR $99/mo + 2.9% | Subscription + commission | NOT 0% anymore (changed July 2025) |
| **Udemy** | 3% (self-referred) to 63% (organic) to 85% (subscription) | Variable commission | Progressively extracting more from creators |
| **Skillshare** | ~80% platform take | Revenue pool | Teacher sentiment overwhelmingly negative |
| **Thumbtack** | $5-150/lead | Pay-per-lead | Tried commission first, failed (couldn't control transaction) |
| **Airbnb** | 3% → 15.5% (PMS hosts) | Commission | Major backlash when raised to 15.5% |

### What the Research Says About Take Rates

| Source | Recommendation |
|--------|---------------|
| **Bill Gurley** (Benchmark) | Keep at or below 10-15% during growth; high rates are a "tax on the ecosystem" |
| **Andrew Chen** (a16z) | Subsidize the hard side (coaches), monetize the easy side (students) |
| **NFX** | Phase 1: below-market pricing → Phase 2: modest fees at critical mass → Phase 3: optimize |
| **Lenny Rachitsky** | Median marketplace take rate: 10-30%; education/services on higher end |
| **Industry average** | Launch: 5-10%; Mature: 15-25% |

---

## Part 2: Lessons From Fee Changes

The research surfaces a clear pattern: **starting low then raising fees is far more painful than starting at a fair rate.**

| Platform | What Happened | Result |
|----------|--------------|--------|
| **Etsy** | Raised 5% → 6.5% (30% increase) | 17,000 sellers struck; 51,000 petition signatures |
| **Poshmark** | Introduced new fee structure | Backlash so severe they **rolled back entirely** |
| **Mercari** | Went from 0% to 10% seller fee | Seller complaints, "fee fatigue," migration to alternatives |
| **Airbnb** | Moved PMS hosts from ~3% to 15.5% | Hosts had to raise rates 14-16% to maintain earnings |
| **Udemy** | Subscription share cut from 25% → 15% over 3 years | Instructors lost $30.7M in 2024; 30-67% revenue drops reported |
| **Skillshare** | Revenue share cut from ~50% → ~20% | Teacher sentiment "overwhelmingly negative" |

**The founding-coach 0% promo in the current Home.tsx copy would create exactly this trap.** Starting 20 coaches at 0% for 3 months means:
1. They anchor on 0% as "their rate"
2. At month 4, any fee feels like a punishment for loyalty
3. The coaches you most need to retain are the ones most angry

Uber's subsidies worked because rides are commoditized and drivers have no brand loyalty. Chess coaching is the opposite: coaches have personal brands, student relationships, and the option to just use Venmo. A fee increase gives them a reason to leave and take their students.

---

## Part 3: Why BooGMe's Position Is Unique

BooGMe has structural advantages that most marketplaces don't:

1. **Escrow controls the transaction.** Thumbtack abandoned commission because they couldn't control the transaction. BooGMe *does* — escrow is the product. This makes commission viable and disintermediation harder (going off-platform means losing payment protection).

2. **Content storefront is a second revenue stream.** Coaches can sell courses, PGN packs, videos, and custom content. This is recurring revenue that doesn't exist in Venmo/Discord coaching.

3. **AI matching is genuine value.** A 20-question assessment that surfaces 3 coaches tuned to how you learn is something a coach can't replicate independently. That's the value justifying the fee.

4. **The competition charges 2-3x more.** Preply takes 33% from new tutors plus 100% on trial lessons. Wyzant takes 25% + charges students 9%. A 10% flat fee is immediately competitive.

---

## Part 4: Four Options Evaluated

### Option A: Flat 10% Commission (Recommended)

```
Lessons:  10% platform fee on every lesson
Content:  10% platform fee on every content sale
Students: Free (Stripe processing fee passed through at checkout)
Coaches:  No subscription, no signup fee, no monthly fee
```

**Projected economics (per coach, 8 lessons/week at $65/hr):**
- Gross weekly: $520
- Platform fee: $52
- Coach take-home: $468 (90%)
- BooGMe monthly revenue per coach: ~$225

**Why this works:**
- **Simpler than every competitor.** One number. No tiers to understand, no thresholds to track.
- **Lower than every tutoring competitor.** Preply (18-33%), Wyzant (25%), iTalki (~15%). At 10%, BooGMe is the cheapest real platform.
- **Aligned with Bill Gurley's guidance.** At or below 10-15% during growth.
- **No fee-increase trap.** 10% is sustainable at scale — no need to raise it later.
- **Escrow justifies it.** The fee covers something real (escrow, matching, processing, support), and coaches can see that.
- **Content sales at the same rate** keeps things simple and avoids coaches feeling nickel-and-dimed.

**Risk:** 10% may leave money on the table long-term. But the research shows that starting low and raising is far harder than starting at a fair rate. 10% is sustainable.

### Option B: Current Tiered System (12% / 8% / 5%)

```
Free tier:  $0/mo, 12% per lesson
Pro tier:   $49/mo, 8% per lesson
Elite tier: $99/mo, 5% per lesson
```

**Problems:**
- **Complexity for zero coaches.** Tiers make sense when you have thousands of providers sorting themselves. With 20 founding coaches, tiers are confusing overhead.
- **12% is slightly high for launch.** Not dramatically so, but 12% is above Gurley's "10% sweet spot" and above iTalki's ~15% only if you compare to the floor, not the ceiling.
- **The subscription tiers create a perverse incentive.** A coach doing 8 lessons/week at $65 pays $405/mo at 12% (free tier) vs. $258/mo at 8% + $49/mo sub = $307/mo (Pro). The savings only kick in at ~$650/mo in lesson revenue. Below that, Pro is a net loss — and most founding coaches will be below that initially.
- **Anchoring risk.** Coaches who start on "free tier" may resent the name (implies a paid tier is expected) even if 12% is fair.

### Option C: Flat Fee / Skool-style ($29/mo + 3% processing)

```
Monthly subscription: $29/mo (covers platform, matching, escrow, support)
Transaction fee: 3% (covers Stripe processing only)
```

**Problems:**
- **Upfront cost kills cold-start.** A coach who hasn't earned a dollar yet pays $29/mo. This is exactly why Skool introduced a $9/mo tier — the $99/mo barrier was too high for new creators.
- **Misaligned with coach economics.** A subscription means the platform profits even when coaches don't. That's the opposite of the "we win when you win" ethos.
- **Doesn't work for 1-on-1 coaching.** Skool itself is designed for communities/courses, not 1-on-1 sessions. Every independent review confirms it's a poor fit for the BooGMe model.
- **The chess coaching market is small.** A $29/mo sub needs ~200 coaches to generate $6K/mo. A 10% commission on the same GMV generates the same revenue without any subscription barrier.

### Option D: Hybrid — 0% Founding + 10% at Scale

```
First 20 coaches: 0% for 3 months (or until $500 earned)
After founding period: 10% flat
All other coaches: 10% from day one
```

**Problems:**
- **The Mercari trap.** Going from 0% to any fee feels like a betrayal, even if 10% is objectively fair. Research shows this consistently.
- **Creates two classes of coach.** Coach #21 pays 10% from day one while Coach #1 still has two months of 0%. That breeds resentment.
- **Administrative complexity.** Need to track founding status, promo expiration dates, grandfathered rates. For 20 coaches, this is pure overhead.
- **Not necessary.** The founding coaches' real incentive is "first-mover advantage on a platform with built-in escrow, matching, and a storefront." That's the pitch — not a temporary fee discount.

---

## Part 5: The Founding Coach Pitch (Without 0%)

The research reveals that **non-monetary subsidies are often more effective than fee waivers** for cold-start supply acquisition:

- **Airbnb's free professional photography** (not fee waivers) is what drove early host supply
- **Uber's guaranteed minimums** (not 0% commission) attracted drivers
- **Etsy's low fees + massive demand access** was the pitch vs. eBay

For BooGMe, the founding-coach pitch should be:

1. **"10% — the lowest fee in online tutoring."** Preply takes 33%, Wyzant takes 25%. We take 10%. That's the headline.
2. **"Your own storefront."** Courses, PGN packs, videos — your content, your prices, your revenue stream. Nobody else offers this to chess coaches.
3. **"Escrow protects you too."** No more chasing students for payment. Money is held before the lesson starts.
4. **"AI sends students to you."** 20-question assessment → matched students appear in your inbox. No marketing, no self-promotion required.
5. **"Priority placement."** First 20 coaches get featured positioning in browse results for the first 6 months. (This is the Airbnb photography equivalent — a value-add, not a fee cut.)
6. **"You own your business."** Set your rate. Set your schedule. No exclusivity. Bring your existing students — they'll benefit from escrow too.

---

## Part 6: Content Sales Pricing

The research shows that applying the same rate to content and lessons is the cleanest approach:

- **Udemy's variable rates** (3% vs. 63% depending on acquisition channel) create confusion and resentment
- **Teachable charges 0-7.5%** on content but requires a $39-89/mo subscription
- **Fiverr's flat 20%** applies to everything (gigs, extras, tips) — simple and understood

**Recommendation:** 10% on content sales, same as lessons. One rate for everything. Coaches who bring their own students to buy content still benefit from the platform (hosting, delivery, payment processing, access control).

**Future consideration:** If content volume grows significantly, consider a lower rate (e.g., 5%) for coaches who also teach lessons on the platform. This rewards platform loyalty without tiers.

---

## Part 7: What This Means for the Codebase

The current `shared/pricing.ts` defines:
```ts
free:  { platformFeePercent: 12, monthlyFeeCents: 0 }
pro:   { platformFeePercent: 8,  monthlyFeeCents: 4900 }
elite: { platformFeePercent: 5,  monthlyFeeCents: 9900 }
```

If Option A is chosen, this simplifies to a single tier:
```ts
standard: { platformFeePercent: 10, monthlyFeeCents: 0 }
```

**Files affected:** `shared/pricing.ts`, `server/stripe.ts`, `server/webhooks.ts`, `server/routers.ts`, `client/src/pages/CoachLanding.tsx` (earnings calculator), `client/src/pages/Home.tsx` (pricing section), `client/src/pages/Coaches.tsx` (legacy), and any coach onboarding screens referencing tiers.

**Migration path:** Since no coaches exist yet and no payments have been processed, this is a clean swap — no backwards compatibility needed.

---

## Part 8: Copy Implications

With a flat 10% model, the marketing copy becomes clearer:

**Home.tsx stat strip (currently "0% · Platform fee until $100"):**
→ Replace with: `10%` / `That's it. One fee.` or `$0` / `Upfront cost`

**CoachLanding.tsx hero lede:**
→ "10% platform fee. The lowest in online tutoring. No subscriptions, no signup costs, no hidden charges."

**StudentLanding.tsx:**
→ Students don't pay platform fees, so the stat should be student-relevant: `escrow` / `Both sides protected` or `$0` / `Platform fee for students`

**The "founding coaches 0% for 3 months" banner on Home.tsx:**
→ Remove entirely. Replace with founding-coach value props (priority placement, featured profiles, storefront access).

---

## Part 9: Comparative Summary Table

| Model | Launch Fee | Sustainable? | Complexity | Cold-Start Risk | Coach Pitch |
|-------|-----------|-------------|-----------|----------------|-------------|
| **A: Flat 10%** | 10% from day one | Yes | Minimal | Low | "Lowest fee in tutoring" |
| **B: Tiered 12/8/5%** | 12% (free tier) | Yes | Moderate | Medium | Confusing for 20 coaches |
| **C: $29/mo + 3%** | $29/mo upfront | Depends on volume | Low | High (paywall) | "We charge even if you don't earn" |
| **D: 0% → 10%** | 0% for 3 months | No (fee increase trap) | High | High (Mercari trap) | Short-term only |

---

## Recommendation

**Option A: Flat 10% on everything, from day one, for all coaches.**

It's lower than every tutoring competitor, simpler than every tiered system, sustainable at scale, and avoids the fee-increase trap that has burned Etsy, Poshmark, Mercari, and Airbnb. The founding-coach incentive should be non-monetary (priority placement, featured profiles, early access) rather than a fee discount that creates a painful ratchet later.

When you're ready, I'll update `shared/pricing.ts` and all downstream code + copy to reflect the chosen model.

---

## Sources

### Direct Competitor Research
- Preply commission model: [help.preply.com](https://help.preply.com/en/articles/4171383-preply-commission-model)
- Preply hidden costs analysis: [tuton.io](https://tuton.io/blog/hidden-cost-marketplace-teaching-preply-numbers/)
- Wyzant fee structure: [support.wyzant.com](https://support.wyzant.com/tutors/tutor-payments/what-is-the-fee-structure-for-tutors-listed-on-wyzant/)
- Wyzant 2019 fee change: [wyzant.com/blog](https://www.wyzant.com/blog/tutor/platform-fee-changes/)

### Broader Marketplace Research
- Skool pricing (2026): [kourses.com](https://kourses.com/skool-pricing/)
- Teachable pricing restructure: [teachable.com/blog](https://www.teachable.com/blog/2025-pricing-and-plan-updates)
- Udemy instructor revenue: [classcentral.com](https://www.classcentral.com/report/udemy-broken-promise-instructor-payouts/)
- Fiverr fees: [hireecomexperts.com](https://hireecomexperts.com/fiverr-seller-fees-2026/)
- Upwork fee change: [freelancecompare.com](https://freelancecompare.com/blog/upwork-fees-explained)
- Thumbtack model evolution: [sharetribe.com](https://www.sharetribe.com/academy/why-thumbtack-succeeded/)

### Marketplace Theory
- Bill Gurley, "A Rake Too Far": [abovethecrowd.com](http://abovethecrowd.com/2013/04/18/a-rake-too-far/)
- Andrew Chen, The Cold Start Problem (2021)
- NFX Network Effects Bible: [nfx.com](https://www.nfx.com/post/network-effects-bible)
- Lenny Rachitsky marketplace benchmarks: [lennysnewsletter.com](https://www.lennysnewsletter.com/p/how-to-kickstart-and-scale-a-marketplace-911)

### Fee Increase Case Studies
- Etsy seller strike: [time.com](https://time.com/6165964/etsy-sellers-strike-over-increase/), [npr.org](https://www.npr.org/2022/04/11/1091123928/etsy-strike-2022)
- Poshmark fee reversal: [modernretail.co](https://www.modernretail.co/operations/poshmark-reverses-new-fee-structure-after-seller-backlash/)
- Mercari fee backlash: [modernretail.co](https://www.modernretail.co/technology/platforms-have-to-walk-a-very-fine-line-why-2024-was-the-year-of-the-resale-fee-wars/)
- Airbnb host fee increase: [hostaway.com](https://www.hostaway.com/blog/airbnb-host-only-fee-what-to-know-about-the-15-percent-host-fee/)

### Cold-Start Strategies
- Sharetribe supply-side strategies: [sharetribe.com](https://www.sharetribe.com/academy/how-to-build-supply-marketplace/)
- Uber driver subsidies: [medium.com](https://medium.com/@cagdasbalci0/how-uber-solved-the-cold-start-problem-a-masterclass-in-network-effects-5315d2292166)
- Etsy take rate evolution: [marketplacepulse.com](https://www.marketplacepulse.com/articles/etsy-fees)
- Depop/Vinted 0% models: [voolist.com](https://www.voolist.com/blog/marketplace-fees-comparison-2026)
