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
}

export interface PricingBreakdown {
  baseWeekly: number;
  addOnWeekly: number;
  schoolDiscountWeekly: number;
  prepayDiscountWeekly: number;
  finalWeekly: number;
  periodWeeks: number;
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
      return 50;
    default:
      return 0;
  }
}

export function calculatePrice(input: PricingInput): PricingBreakdown {
  const baseWeekly = baseWeeklyMap[input.daysPerWeek];
  const addOnWeekly = addOnPerDay(input.timeBlock) * input.daysPerWeek;

  // Apply Searingtown discount (40%) to base + add-ons
  const subtotal = baseWeekly + addOnWeekly;
  const schoolDiscountWeekly = input.school === 'Searingtown' ? +(subtotal * 0.4).toFixed(2) : 0;

  // Prepay weekly discount
  const prepayDiscountWeekly = prepayWeeklyDiscount(input.frequency, input.daysPerWeek);

  let finalWeekly = subtotal - schoolDiscountWeekly - prepayDiscountWeekly;
  if (finalWeekly < 0) finalWeekly = 0;
  finalWeekly = +finalWeekly.toFixed(2);

  const periodWeeks = periodWeeksFor(input.frequency);
  const totalForPeriod = +(finalWeekly * periodWeeks).toFixed(2);

  return {
    baseWeekly,
    addOnWeekly,
    schoolDiscountWeekly,
    prepayDiscountWeekly,
    finalWeekly,
    periodWeeks,
    totalForPeriod,
  };
}
