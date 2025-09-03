// Pricing engine for afterschool program
// Assumptions (can be adjusted once confirmed):
// - Searingtown 40% discount applies to (base + time add-ons).
// - Prepay weekly discount is subtracted after school discount.
// - Monthly = 4 weeks; 3 months = 12 weeks; 6 months = 24 weeks; Full school year (Sep–Jun) = 40 weeks.
// - Monthly $10/week discount applies to any days/week (1–5). Prepay 3/6/Year discounts apply only for 3–5 days/week.

export type TimeBlock = '4-6' | '3-6' | '4-7' | '3-7';
export type School = 'Searingtown' | 'Other';
export type BillingFrequency = 'weekly' | 'monthly' | '3months' | '6months' | 'year';

export interface PricingInput {
  daysPerWeek: 1 | 2 | 3 | 4 | 5;
  timeBlock: TimeBlock;
  school: School;
  frequency: BillingFrequency;
  extensionsEnabled?: boolean;
  // Abacus add-on
  abacusEnabled?: boolean;
  // Carrington waiver for the abacus registration fee
  isCarrington?: boolean;
}

export interface PricingBreakdown {
  baseWeekly: number;
  addOnWeekly: number;
  abacusWeekly: number;
  schoolDiscountWeekly: number;
  prepayDiscountWeekly: number;
  finalWeekly: number;
  periodWeeks: number;
  registrationFee: number;
  totalForPeriod: number;
}

const baseWeeklyMap: Record<PricingInput['daysPerWeek'], number> = {
  1: 75,
  2: 150,
  3: 225,
  4: 300,
  5: 375,
};

function addOnPerDay(timeBlock: TimeBlock): number {
  if (timeBlock === '3-7') return 50; // +$50/day
  if (timeBlock === '3-6' || timeBlock === '4-7') return 30; // +$30/day
  return 0; // '4-6'
}

function periodWeeksFor(frequency: BillingFrequency): number {
  switch (frequency) {
    case 'weekly':
      return 1;
    case 'monthly':
      return 4;
    case '3months':
      return 12;
    case '6months':
      return 24;
    case 'year':
      return 40; // Sep–Jun approx.
  }
}

function prepayWeeklyDiscount(
  frequency: BillingFrequency,
  daysPerWeek: PricingInput['daysPerWeek']
): number {
  if (frequency === 'monthly') return 10;
  const eligible3to5 = daysPerWeek >= 3;
  if (!eligible3to5) return 0;
  switch (frequency) {
    case '3months':
      return 25;
    case '6months':
      return 40;
    case 'year':
      return 40; // 10 months equivalent at 4 weeks/month
    default:
      return 0;
  }
}

export function calculatePrice(input: PricingInput): PricingBreakdown {
  const baseWeekly = baseWeeklyMap[input.daysPerWeek];
  const addOnWeekly = (input.extensionsEnabled ? addOnPerDay(input.timeBlock) : 0) * input.daysPerWeek;
  // Abacus: $350/month => $87.50/week equivalent
  const abacusWeekly = input.abacusEnabled ? +(350 / 4).toFixed(2) : 0;

  // Apply Searingtown discount (40%) to base + add-ons, only if enrolled 2+ days/week
  // School discount applies only to core program (base + time add-ons), not abacus
  const subtotal = baseWeekly + addOnWeekly;
  const eligibleForSchoolDiscount = input.school === 'Searingtown' && input.daysPerWeek >= 2;
  const schoolDiscountWeekly = eligibleForSchoolDiscount ? +(subtotal * 0.4).toFixed(2) : 0;

  // Prepay weekly discount
  const prepayDiscountWeekly = prepayWeeklyDiscount(input.frequency, input.daysPerWeek);

  // Final weekly = discounted core program + abacus weekly
  let finalWeekly = (subtotal - schoolDiscountWeekly - prepayDiscountWeekly) + abacusWeekly;
  if (finalWeekly < 0) finalWeekly = 0;
  finalWeekly = +finalWeekly.toFixed(2);

  const periodWeeks = periodWeeksFor(input.frequency);
  const registrationFee = input.abacusEnabled && !input.isCarrington ? 90 : 0;
  const totalForPeriod = +((finalWeekly * periodWeeks) + registrationFee).toFixed(2);

  return {
    baseWeekly,
    addOnWeekly,
    abacusWeekly,
    schoolDiscountWeekly,
    prepayDiscountWeekly,
    finalWeekly,
    periodWeeks,
    registrationFee,
    totalForPeriod,
  };
}
