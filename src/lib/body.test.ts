import { describe, expect, it } from 'vitest';
import { assessTarget, bmi, bmiCategoryIndia, bmiCategoryWHO, lossTimeline, proteinTargetG, waistToHeight } from './body';

describe('bmi', () => {
  it('matches the hand calculation for 65.5 kg / 162 cm', () => {
    expect(bmi(65.5, 162)!).toBeCloseTo(24.958, 2);
  });
  it('rejects missing or impossible values instead of guessing', () => {
    expect(bmi(NaN, 162)).toBeNull();
    expect(bmi(65, 0)).toBeNull();
    expect(bmi(65, 300)).toBeNull();
    expect(bmi(5, 162)).toBeNull();
  });
  it('uses WHO and Indian cut-offs separately', () => {
    expect(bmiCategoryWHO(24.96)).toBe('Normal range');
    expect(bmiCategoryIndia(24.96)).toBe('Overweight');
    expect(bmiCategoryIndia(22.5)).toBe('Normal range');
    expect(bmiCategoryIndia(25)).toMatch(/Obesity/);
    expect(bmiCategoryWHO(18.4)).toBe('Underweight');
  });
});

describe('assessTarget', () => {
  it('accepts 59 kg at 162 cm as healthy', () => {
    const a = assessTarget(65.5, 59, 162)!;
    expect(a.ok).toBe(true);
    expect(a.kind).toBe('loss');
    expect(a.targetBmi).toBeCloseTo(22.48, 1);
  });
  it('flags a target below BMI 18.5 and suggests a safer one', () => {
    const a = assessTarget(65.5, 45, 162)!;
    expect(a.ok).toBe(false);
    expect(a.suggestedKg).toBeGreaterThanOrEqual(48.5);
    expect(bmi(a.suggestedKg!, 162)!).toBeGreaterThanOrEqual(18.5);
  });
  it('returns null when height is missing', () => {
    expect(assessTarget(65, 59, NaN)).toBeNull();
  });
});

describe('lossTimeline', () => {
  it('balanced pace is ~0.5%/week and never promises a fixed date', () => {
    const t = lossTimeline(65.5, 59, 'balanced')!;
    expect(t.weeklyKg).toBeCloseTo(0.3275, 3);
    expect(t.weeksMin).toBe(20);
    expect(t.weeksMax).toBeGreaterThan(t.weeksMin);
  });
  it('challenging pace is capped at 0.7%/week', () => {
    expect(lossTimeline(65.5, 59, 'challenging')!.weeklyKg / 65.5).toBeCloseTo(0.007, 5);
  });
  it('a 6 kg loss can never be scheduled in 3 weeks', () => {
    for (const p of ['gradual', 'balanced', 'challenging'] as const) expect(lossTimeline(65, 59, p)!.weeksMin).toBeGreaterThan(3);
  });
  it('no timeline for gain or equal targets', () => {
    expect(lossTimeline(60, 65, 'balanced')).toBeNull();
    expect(lossTimeline(60, 60, 'balanced')).toBeNull();
  });
});

describe('other', () => {
  it('protein ~1.6 g/kg', () => expect(proteinTargetG(65.5)).toBe(105));
  it('waist-to-height', () => {
    expect(waistToHeight(81, 162)).toBeCloseTo(0.5, 3);
    expect(waistToHeight(0, 162)).toBeNull();
  });
});
