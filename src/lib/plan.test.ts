import { describe, expect, it } from 'vitest';
import { buildSteps, initTraining, nextKey, planSession, progress, setsFor } from './plan';
import type { Collections, SessionLog, SetLog } from './types';

const base = (over: Partial<Collections> = {}): Partial<Collections> => ({
  fitness: { experience: 'beginner', pushUps: 9, squats60s: null, plankSeconds: null, canBriskWalk20: true, dislikes: '' },
  health: { answers: { chest: false, faint: false, heart: false, pain: false, meds: false }, painAreas: [], notes: '', clearedByDoctorAt: null, completedAt: '' },
  lifestyle: { wakeTime: '', sleepTime: '', sittingHours: 8, walkingMinutes: 30, minutesPerSession: 45, trainingDays: ['Mon', 'Wed', 'Fri'], preferredTime: 'evening', weekendsDifferent: false },
  ...over,
});
const sets = (id: string, target: number, done: number[]): SetLog[] => done.map((d, i) => ({ exerciseId: id, set: i + 1, target, done: d }));

describe('starting plan', () => {
  it('uses the push-up test: 9 push-ups → floor push-ups at 6 reps', () => {
    const t = initTraining(base());
    expect(t.slots.push).toEqual({ exerciseId: 'pushup', target: 6, streak: 0 });
    expect(t.slots.squat.exerciseId).toBe('squat');
    expect(t.slots.hinge.exerciseId).toBe('glute-bridge');
  });
  it('knee pain removes knee-loading moves and keeps the chair sit-to-stand', () => {
    const d = base({ health: { ...base().health!, answers: { ...base().health!.answers, pain: true }, painAreas: ['knee'] } });
    const t = initTraining(d);
    expect(t.slots.squat.exerciseId).toBe('sit-to-stand');
    expect(t.slots.lunge).toBeUndefined();
    const p = planSession(d, t, 'B');
    expect(p.skipped).toContain('lunge');
  });
  it('week 1 starts with 2 sets, then 3, and every 6th week is lighter', () => {
    expect(setsFor(1, 45)).toBe(2);
    expect(setsFor(2, 45)).toBe(3);
    expect(setsFor(6, 45)).toBe(2);
    expect(setsFor(3, 20)).toBe(2);
  });
  it('sessions alternate A and B, and a 45-minute day fits', () => {
    expect(nextKey([])).toBe('A');
    expect(nextKey([{ sets: [{}] } as SessionLog])).toBe('B');
    expect(nextKey([{ sets: [] as SetLog[] } as SessionLog])).toBe('A');
    const d = base();
    const p = planSession(d, initTraining(d), 'B');
    expect(p.minutes).toBeLessThanOrEqual(45);
    const steps = buildSteps(p);
    expect(steps.filter((s) => s.kind === 'rest' && s.label === 'Rest').every((s) => s.seconds === 30)).toBe(true);
    expect(steps.some((s) => s.kind === 'rest' && s.askFeel === 'pushup')).toBe(true);
  });
});

describe('progression: one change at a time, never after pain', () => {
  const t = initTraining(base());
  it('easy with all sets done → +2 reps', () => {
    const r = progress(t, sets('pushup', 6, [6, 6]), { pushup: 'easy' });
    expect(r.training.slots.push.target).toBe(8);
    expect(r.changes[0]).toMatch(/goes up to 8 reps/);
  });
  it('"about right" needs two sessions before adding a rep', () => {
    const r1 = progress(t, sets('pushup', 6, [6, 6]), { pushup: 'right' });
    expect(r1.training.slots.push.target).toBe(6);
    expect(r1.changes).toHaveLength(0);
    const r2 = progress(r1.training, sets('pushup', 6, [6, 6]), { pushup: 'right' });
    expect(r2.training.slots.push.target).toBe(7);
  });
  it('at the top of the range → harder variation, reps reset', () => {
    const top = { ...t, slots: { ...t.slots, push: { exerciseId: 'pushup', target: 12, streak: 0 } } };
    const r = progress(top, sets('pushup', 12, [12, 12, 12]), { pushup: 'easy' });
    expect(r.training.slots.push).toEqual({ exerciseId: 'decline-pushup', target: 6, streak: 0 });
  });
  it('pain → easier variation and a physio note, never an increase', () => {
    const r = progress(t, sets('pushup', 6, [6, 6]), { pushup: 'pain' });
    expect(r.training.slots.push.exerciseId).toBe('knee-pushup');
    expect(r.changes[0]).toMatch(/physiotherapist/);
    expect(progress(t, [], { pushup: 'pain' }).training.slots.push.exerciseId).toBe('knee-pushup');
  });
  it('falling well short eases the target by one; hard keeps it', () => {
    const r = progress(t, sets('pushup', 6, [4, 3]), { pushup: 'hard' });
    expect(r.training.slots.push.target).toBe(6); // already at the bottom of 6–12
    const t8 = { ...t, slots: { ...t.slots, push: { exerciseId: 'pushup', target: 8, streak: 1 } } };
    expect(progress(t8, sets('pushup', 8, [5, 6]), {}).training.slots.push.target).toBe(7);
    expect(progress(t8, sets('pushup', 8, [8, 8]), { pushup: 'hard' }).training.slots.push).toEqual({ exerciseId: 'pushup', target: 8, streak: 0 });
  });
  it('timed holds go up 5 s at a time', () => {
    const tp = { ...t, slots: { ...t.slots, 'core-front': { exerciseId: 'plank', target: 30, streak: 0 } } };
    const r = progress(tp, sets('plank', 30, [30, 30]), { plank: 'easy' });
    expect(r.training.slots['core-front'].target).toBe(35);
  });
});
