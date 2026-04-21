/**
 * Coach pricing tiers — determines BooGMe's platform fee on every lesson.
 * Free is the default; Pro/Elite require a monthly subscription (billing
 * not yet implemented — TODO below).
 *
 * The Stripe processing fee is charged on top of the lesson price and
 * passed to the student so coaches receive their full take-home amount
 * minus only the platform fee.
 */
export const PRICING_TIERS = {
  free: {
    label: "Free",
    monthlyFeeCents: 0,
    platformFeePercent: 12,
    description: "No monthly fee. 12% platform fee per lesson.",
  },
  pro: {
    label: "Pro",
    monthlyFeeCents: 4900,
    platformFeePercent: 8,
    description: "$49/mo. 8% platform fee per lesson.",
  },
  elite: {
    label: "Elite",
    monthlyFeeCents: 9900,
    platformFeePercent: 5,
    description: "$99/mo. 5% platform fee per lesson — best for high volume.",
  },
} as const;

export type PricingTier = keyof typeof PRICING_TIERS;

export const DEFAULT_PRICING_TIER: PricingTier = "free";

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
