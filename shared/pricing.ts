/**
 * Coach pricing — determines BooGMe's platform fee on every lesson and
 * content sale.
 *
 * One flat fee for all coaches: no subscription, no tiers, no upfront cost.
 * The percentage covers AI matching, escrow, payment processing, and support.
 *
 * The Stripe processing fee is charged on top of the lesson price and
 * passed to the student so coaches receive their full take-home amount
 * minus only the platform fee.
 *
 * NOTE: PRICING_TIERS is kept as a keyed map (rather than a bare constant) so
 * the fee logic stays uniform and any legacy `pricingTier` value stored on a
 * coach profile resolves through getTierFeePercent() to the standard rate.
 */
export const PRICING_TIERS = {
  standard: {
    label: "Standard",
    monthlyFeeCents: 0,
    platformFeePercent: 12,
    description: "Flat 12% on lessons and content. No subscription, no tiers.",
  },
} as const;

export type PricingTier = keyof typeof PRICING_TIERS;

export const DEFAULT_PRICING_TIER: PricingTier = "standard";

// Stripe processing fee — added to the student's total at checkout.
export const STRIPE_FEE_PERCENT = 2.9;
export const STRIPE_FEE_FIXED_CENTS = 30;

export function getTierFeePercent(tier: PricingTier | string | null | undefined): number {
  const key = (tier ?? DEFAULT_PRICING_TIER) as PricingTier;
  return PRICING_TIERS[key]?.platformFeePercent ?? PRICING_TIERS[DEFAULT_PRICING_TIER].platformFeePercent;
}

export function calculateStripeFeeCents(amountCents: number): number {
  return Math.round((amountCents * STRIPE_FEE_PERCENT) / 100) + STRIPE_FEE_FIXED_CENTS;
}

/**
 * Given a coach's lesson price (what they want per lesson) and tier,
 * compute the breakdown the booking flow needs:
 *   - studentTotalCents:  what the student is charged (lesson + Stripe fee)
 *   - platformFeeCents:   tier % of lesson price
 *   - applicationFeeCents: platform fee + Stripe fee (the platform's cut)
 *   - coachPayoutCents:   lesson price - platform fee
 */
export function calculateLessonBreakdown(params: {
  lessonPriceCents: number;
  tier: PricingTier | string | null | undefined;
}) {
  const feePercent = getTierFeePercent(params.tier);
  const platformFeeCents = Math.round((params.lessonPriceCents * feePercent) / 100);
  const coachPayoutCents = params.lessonPriceCents - platformFeeCents;

  // Stripe fee is computed on the total the student is charged. Use a
  // fixed-point approximation: charge fee on lesson price (the dominant
  // term). The Stripe fee on the fee itself is a rounding rounding error.
  const stripeFeeCents = calculateStripeFeeCents(params.lessonPriceCents);
  const studentTotalCents = params.lessonPriceCents + stripeFeeCents;

  // Platform's application_fee in destination charges = platform fee +
  // Stripe processing fee, so the coach receives the full coachPayoutCents.
  const applicationFeeCents = platformFeeCents + stripeFeeCents;

  return {
    studentTotalCents,
    platformFeeCents,
    stripeFeeCents,
    applicationFeeCents,
    coachPayoutCents,
    feePercent,
  };
}
