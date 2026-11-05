// Body calculations. Sources are in /docs (Phase 2 evidence). Every output is labelled with its limits in the UI.

import type { Pacing } from './types';

export const LIMITS = {
  age: [18, 100],
  heightCm: [120, 230],
  weightKg: [30, 250],
  circumferenceCm: [15, 250],
} as const;

export function inRange(v: number | null | undefined, [lo, hi]: readonly [number, number]): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
}

export function bmi(weightKg: number, heightCm: number): number | null {
  if (!inRange(weightKg, LIMITS.weightKg) || !inRange(heightCm, LIMITS.heightCm)) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** WHO adult categories. */
export function bmiCategoryWHO(b: number): string {
  if (b < 18.5) return 'Underweight';
  if (b < 25) return 'Normal range';
  if (b < 30) return 'Overweight';
  return 'Obesity';
}

/** Asian Indian consensus cut-offs (Misra et al. 2009; reaffirmed 2025). BMI alone does not diagnose obesity. */
export function bmiCategoryIndia(b: number): string {
  if (b < 18.5) return 'Underweight';
  if (b < 23) return 'Normal range';
  if (b < 25) return 'Overweight';
  return 'Obesity range (BMI only)';
}

export function waistToHeight(waistCm: number, heightCm: number): number | null {
  if (!inRange(waistCm, LIMITS.circumferenceCm) || !inRange(heightCm, LIMITS.heightCm)) return null;
  return waistCm / heightCm;
}

/** Weekly loss as a fraction of body weight. Challenging is capped at 0.7%/week (Garthe et al. 2011). */
export const PACE_RATE: Record<Pacing, number> = { gradual: 0.0025, balanced: 0.005, challenging: 0.007 };

export interface TargetAssessment {
  kind: 'loss' | 'gain' | 'maintain';
  ok: boolean;
  targetBmi: number;
  message: string;
  /** Suggested safer target when ok is false. */
  suggestedKg?: number;
}

export function assessTarget(currentKg: number, targetKg: number, heightCm: number): TargetAssessment | null {
  const tb = bmi(targetKg, heightCm);
  if (tb === null || bmi(currentKg, heightCm) === null) return null;
  const m2 = (heightCm / 100) ** 2;
  const diff = targetKg - currentKg;
  const kind = Math.abs(diff) < 0.5 ? 'maintain' : diff < 0 ? 'loss' : 'gain';
  if (tb < 18.5) {
    const suggestedKg = Math.ceil(18.5 * m2 * 2) / 2;
    return { kind, ok: false, targetBmi: tb, suggestedKg, message: `A target of ${targetKg} kg is below the healthy BMI range for your height. A safer lowest target is about ${suggestedKg} kg.` };
  }
  if (kind === 'loss' && tb >= 23) {
    return { kind, ok: true, targetBmi: tb, message: `Reasonable first milestone. It is still above the Indian "normal" BMI band, so you can review it once you reach it.` };
  }
  if (kind === 'loss') return { kind, ok: true, targetBmi: tb, message: 'This target sits inside the healthy BMI range for your height.' };
  if (kind === 'gain' && tb >= 25) {
    return { kind, ok: true, targetBmi: tb, message: 'This would move you into a higher BMI band. That can be fine if the gain is muscle; waist size will tell us.' };
  }
  return { kind, ok: true, targetBmi: tb, message: kind === 'gain' ? 'A gain target. Progress will be tracked slowly to favour muscle over fat.' : 'Maintaining weight while changing body composition.' };
}

export interface Timeline {
  weeklyKg: number;
  /** Optimistic and realistic ends, in weeks. Real progress is not linear. */
  weeksMin: number;
  weeksMax: number;
}

export function lossTimeline(currentKg: number, targetKg: number, pacing: Pacing): Timeline | null {
  if (!(currentKg > targetKg)) return null;
  const weeklyKg = currentKg * PACE_RATE[pacing];
  const diff = currentKg - targetKg;
  return { weeklyKg, weeksMin: Math.ceil(diff / weeklyKg), weeksMax: Math.ceil(diff / (weeklyKg * 0.75)) };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Protein baseline ~1.6 g/kg/day (Morton et al. 2018). */
export function proteinTargetG(weightKg: number): number {
  return Math.round(weightKg * 1.6);
}
