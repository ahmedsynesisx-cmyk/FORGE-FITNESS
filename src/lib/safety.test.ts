import { describe, expect, it } from 'vitest';
import { evaluateSafety, workoutsAllowed } from './safety';

const all = (v: boolean) => ({ chest: v, faint: v, heart: v, pain: v, meds: v });

describe('evaluateSafety', () => {
  it('incomplete screen never allows workouts', () => {
    expect(evaluateSafety(undefined)).toBe('incomplete');
    expect(evaluateSafety({ answers: { chest: false } as never, clearedByDoctorAt: null })).toBe('incomplete');
    expect(workoutsAllowed('incomplete')).toBe(false);
  });
  it('all "no" is clear', () => {
    expect(evaluateSafety({ answers: all(false), clearedByDoctorAt: null })).toBe('clear');
  });
  it('any red flag blocks workouts until doctor clearance', () => {
    for (const id of ['chest', 'faint', 'heart'] as const) {
      const s = evaluateSafety({ answers: { ...all(false), [id]: true }, clearedByDoctorAt: null });
      expect(s).toBe('red');
      expect(workoutsAllowed(s)).toBe(false);
    }
    const cleared = evaluateSafety({ answers: { ...all(false), chest: true }, clearedByDoctorAt: '2026-11-05' });
    expect(cleared).toBe('caution');
    expect(workoutsAllowed(cleared)).toBe(true);
  });
  it('pain or medicines means caution, not a block', () => {
    expect(evaluateSafety({ answers: { ...all(false), pain: true }, clearedByDoctorAt: null })).toBe('caution');
    expect(evaluateSafety({ answers: { ...all(false), meds: true }, clearedByDoctorAt: null })).toBe('caution');
  });
});
