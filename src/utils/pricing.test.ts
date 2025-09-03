import { describe, it, expect } from 'vitest';
import { calculatePrice, type PricingInput } from './pricing';

function price(input: Partial<PricingInput>): ReturnType<typeof calculatePrice> {
  const base: PricingInput = {
    daysPerWeek: 3,
    timeBlock: '4-6',
    school: 'Other',
    frequency: 'weekly',
  };
  return calculatePrice({ ...base, ...input } as PricingInput);
}

describe('pricing engine', () => {
  it('base weekly prices (4-6, no discounts)', () => {
    expect(price({ daysPerWeek: 1 }).finalWeekly).toBe(75);
    expect(price({ daysPerWeek: 2 }).finalWeekly).toBe(150);
    expect(price({ daysPerWeek: 3 }).finalWeekly).toBe(225);
    expect(price({ daysPerWeek: 4 }).finalWeekly).toBe(300);
    expect(price({ daysPerWeek: 5 }).finalWeekly).toBe(375);
  });

  it('applies time add-ons per day', () => {
    // 3 days, 3-6 => +$30/day => +$90 weekly
    const r1 = price({ daysPerWeek: 3, timeBlock: '3-6' });
    expect(r1.addOnWeekly).toBe(90);
    expect(r1.finalWeekly).toBe(225 + 90);

    // 5 days, 3-7 => +$50/day => +$250 weekly
    const r2 = price({ daysPerWeek: 5, timeBlock: '3-7' });
    expect(r2.addOnWeekly).toBe(250);
    expect(r2.finalWeekly).toBe(375 + 250);
  });

  it('applies Searingtown 40% discount on (base + add-ons)', () => {
    // 4 days, 4-6: base 300, add-on 0 => subtotal 300, 40% => 120 off
    const r = price({ daysPerWeek: 4, timeBlock: '4-6', school: 'Searingtown' });
    expect(r.schoolDiscountWeekly).toBeCloseTo(120, 2);
    expect(r.finalWeekly).toBeCloseTo(180, 2);
  });

  it('applies prepay weekly discounts after school discount', () => {
    // Example: 3 days, 3-6, Searingtown, 3 months
    // Base 225 + add-on 90 = 315; 40% of 315 = 126; subtotal after school = 189
    // 3-month discount = $25/week (eligible since 3-5 days)
    const r = price({ daysPerWeek: 3, timeBlock: '3-6', school: 'Searingtown', frequency: '3months' });
    expect(r.schoolDiscountWeekly).toBeCloseTo(126, 2);
    expect(r.prepayDiscountWeekly).toBe(25);
    expect(r.finalWeekly).toBeCloseTo(189 - 25, 2);
    expect(r.periodWeeks).toBe(12);
    expect(r.totalForPeriod).toBeCloseTo((189 - 25) * 12, 2);
  });

  it('monthly discount $10/week applies regardless of days (1-5)', () => {
    const r1 = price({ daysPerWeek: 1, frequency: 'monthly' });
    expect(r1.prepayDiscountWeekly).toBe(10);
    const r2 = price({ daysPerWeek: 5, frequency: 'monthly' });
    expect(r2.prepayDiscountWeekly).toBe(10);
  });

  it('3/6/year prepay discounts require 3–5 days', () => {
    const rIneligible = price({ daysPerWeek: 2, frequency: '6months' });
    expect(rIneligible.prepayDiscountWeekly).toBe(0);
    const rEligible = price({ daysPerWeek: 3, frequency: '6months' });
    expect(rEligible.prepayDiscountWeekly).toBe(40);
  });

  it('never returns negative weekly price', () => {
    // Aggressive discounts should not drop below 0
    const r = price({
      daysPerWeek: 1,
      timeBlock: '4-6',
      school: 'Searingtown',
      frequency: 'year',
    });
    expect(r.finalWeekly).toBeGreaterThanOrEqual(0);
  });
});
