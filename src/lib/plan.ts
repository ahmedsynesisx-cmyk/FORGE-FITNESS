import { byId, chain, COOLDOWN, WARMUP, type Exercise, type Pattern } from './exercises';
import type { BodyArea, Collections, Feel, SessionKey, SessionLog, SetLog, SlotState, Training } from './types';

type Data = Partial<Collections>;

export const SESSIONS: Record<SessionKey, Pattern[]> = {
  A: ['push', 'squat', 'pull', 'hinge', 'core-front'],
  B: ['push', 'lunge', 'pull', 'overhead', 'hinge', 'core-side'],
};
export const REST_SECONDS = 30;
export const REPS = { min: 6, max: 12 };
export const HOLD = { min: 20, max: 45, step: 5 };
const DEFAULT_DAYS = ['Mon', 'Wed', 'Fri'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const allowed = (e: Exercise, pain: BodyArea[]) => !e.avoidIf.some((a) => pain.includes(a));
const bottom = (e: Exercise) => (e.mode === 'time' ? HOLD.min : REPS.min);
const top = (e: Exercise) => (e.mode === 'time' ? HOLD.max : REPS.max);

/** Nearest allowed exercise in the chain, preferring the wanted level, then easier, then harder. */
export function pickInChain(pattern: Pattern, level: number, pain: BodyArea[]): Exercise | null {
  const c = chain(pattern).filter((e) => allowed(e, pain));
  if (!c.length) return null;
  const easierOrSame = c.filter((e) => e.level <= level);
  return easierOrSame.at(-1) ?? c[0];
}

/** Starting point for each movement, from the person's own fitness check. */
export function initTraining(data: Data, now = new Date()): Training {
  const f = data.fitness;
  const pain = data.health?.painAreas ?? [];
  const bump = f?.experience === 'advanced' ? 2 : f?.experience === 'intermediate' ? 1 : 0;
  const slots: Record<string, SlotState> = {};
  const patterns = [...new Set([...SESSIONS.A, ...SESSIONS.B])];
  for (const p of patterns) {
    let level = 1 + bump;
    let target: number | null = null;
    let targetMode: 'reps' | 'time' | null = null;
    if (p === 'push') {
      targetMode = 'reps';
      const n = f?.pushUps;
      level = n == null ? 2 : n < 1 ? 1 : n < 5 ? 2 : n < 8 ? 3 : n < 15 ? 4 : 5;
      if (n != null && n >= 1) target = clamp(Math.round(n * 0.7), REPS.min, REPS.max);
    }
    if (p === 'squat') level = 2 + bump;
    if (p === 'core-front' && (f?.plankSeconds ?? 0) >= 30) {
      level = Math.max(level, 2);
      targetMode = 'time';
      target = clamp(Math.round((f!.plankSeconds! * 0.6) / HOLD.step) * HOLD.step, HOLD.min, HOLD.max);
    }
    const e = pickInChain(p, level, pain);
    if (!e) continue;
    if (target === null || targetMode !== e.mode) target = e.mode === 'time' ? HOLD.min : 8;
    slots[p] = { exerciseId: e.id, target, streak: 0 };
  }
  return { startedAt: now.toISOString(), slots, active: null };
}

export function weekNumber(training: Training, now = new Date()) {
  return Math.floor((now.getTime() - Date.parse(training.startedAt)) / (7 * 86_400_000)) + 1;
}

/** Hard sets per exercise: start low, build up, lighter every 6th week. */
export function setsFor(week: number, minutes: number) {
  if (minutes < 25 || week <= 1 || week % 6 === 0) return 2;
  return 3;
}

export interface PlannedExercise { pattern: Pattern; exercise: Exercise; sets: number; target: number }
export interface PlannedSession { key: SessionKey; week: number; deload: boolean; items: PlannedExercise[]; skipped: Pattern[]; minutes: number }

export function planSession(data: Data, training: Training, key: SessionKey, now = new Date()): PlannedSession {
  const week = weekNumber(training, now);
  const sets = setsFor(week, data.lifestyle?.minutesPerSession ?? 45);
  const items: PlannedExercise[] = [];
  const skipped: Pattern[] = [];
  for (const p of SESSIONS[key]) {
    const s = training.slots[p];
    const e = s && byId(s.exerciseId);
    if (!s || !e) skipped.push(p);
    else items.push({ pattern: p, exercise: e, sets, target: s.target });
  }
  const plan = { key, week, deload: week > 1 && week % 6 === 0, items, skipped, minutes: 0 };
  plan.minutes = Math.max(5, Math.round(buildSteps(plan).reduce((t, s) => t + s.seconds, 0) / 300) * 5);
  return plan;
}

export type Step =
  | { kind: 'warm' | 'cool'; name: string; how: string; seconds: number }
  | { kind: 'work'; exerciseId: string; set: number; sets: number; target: number; side?: 1 | 2; seconds: number }
  | { kind: 'rest'; seconds: number; askFeel?: string; label: string };

export function buildSteps(plan: Pick<PlannedSession, 'items'>): Step[] {
  const steps: Step[] = WARMUP.map((w) => ({ kind: 'warm' as const, ...w }));
  plan.items.forEach((it, i) => {
    const e = it.exercise;
    const lastExercise = i === plan.items.length - 1;
    for (let set = 1; set <= it.sets; set++) {
      const est = e.mode === 'time' ? it.target : it.target * 3 * (e.perSide ? 2 : 1);
      if (e.mode === 'time' && e.perSide) {
        steps.push({ kind: 'work', exerciseId: e.id, set, sets: it.sets, target: it.target, side: 1, seconds: est });
        steps.push({ kind: 'rest', seconds: 10, label: 'Switch sides' });
        steps.push({ kind: 'work', exerciseId: e.id, set, sets: it.sets, target: it.target, side: 2, seconds: est });
      } else steps.push({ kind: 'work', exerciseId: e.id, set, sets: it.sets, target: it.target, seconds: est });
      const lastSet = set === it.sets;
      if (!(lastSet && lastExercise)) steps.push({ kind: 'rest', seconds: REST_SECONDS, label: 'Rest', ...(lastSet ? { askFeel: e.id } : {}) });
      else steps.push({ kind: 'rest', seconds: 15, label: 'Last one done', askFeel: e.id });
    }
  });
  COOLDOWN.forEach((c) => steps.push({ kind: 'cool', ...c }));
  return steps;
}

/** Which session is next: A and B simply alternate (any workout with at least one set counts), so a missed day never stacks up work. */
export function nextKey(sessions: SessionLog[] = []): SessionKey {
  return sessions.filter((s) => s.sets.length > 0).length % 2 === 0 ? 'A' : 'B';
}

export function trainingDays(data: Data) {
  const d = data.lifestyle?.trainingDays ?? [];
  return d.length ? d : DEFAULT_DAYS;
}
export const weekday = (date = new Date()) => WEEKDAYS[date.getDay()];
export function nextTrainingDay(data: Data, from = new Date()) {
  const days = trainingDays(data);
  for (let i = 1; i <= 7; i++) {
    const d = new Date(from.getTime() + i * 86_400_000);
    if (days.includes(weekday(d))) return weekday(d);
  }
  return days[0];
}

const name = (id: string) => byId(id)?.name ?? id;
const unit = (e: Exercise, n: number) => (e.mode === 'time' ? `${n} s` : `${n} reps${e.perSide ? ' each side' : ''}`);

/**
 * Progression after a workout. One change per exercise at most, and never an increase after pain.
 * Returns the updated training state and a plain-English reason for every change.
 */
export function progress(training: Training, sets: SetLog[], feel: Record<string, Feel>, pain: BodyArea[] = []): { training: Training; changes: string[] } {
  const slots = { ...training.slots };
  const changes: string[] = [];
  for (const [pattern, slot] of Object.entries(slots)) {
    const done = sets.filter((s) => s.exerciseId === slot.exerciseId);
    const e = byId(slot.exerciseId)!;
    const f = feel[e.id] ?? 'right';
    if (!done.length && f !== 'pain') continue;
    const hitAll = done.every((s) => s.done >= s.target);
    if (f === 'pain') {
      const easier = chain(e.pattern).filter((x) => x.level < e.level && allowed(x, pain)).at(-1);
      if (easier) {
        slots[pattern] = { exerciseId: easier.id, target: bottom(easier) + (easier.mode === 'time' ? 0 : 2), streak: 0 };
        changes.push(`${e.name} hurt, so next time it's ${easier.name} instead. If the same spot hurts again, please see a physiotherapist.`);
      } else {
        slots[pattern] = { ...slot, target: Math.max(bottom(e), slot.target - (e.mode === 'time' ? HOLD.step : 2)), streak: 0 };
        changes.push(`${e.name} hurt and there's no easier version, so the target drops to ${unit(e, slots[pattern].target)}. Stop any move that causes sharp pain; see a physiotherapist if it continues.`);
      }
      continue;
    }
    if (!hitAll) {
      const avg = done.reduce((t, s) => t + s.done, 0) / done.length;
      if (avg <= slot.target - 2) {
        const t = Math.max(bottom(e), slot.target - (e.mode === 'time' ? HOLD.step : 1));
        if (t !== slot.target) changes.push(`${e.name}: you averaged ${Math.round(avg)} against a target of ${slot.target}, so next time aims for ${unit(e, t)}.`);
        slots[pattern] = { ...slot, target: t, streak: 0 };
      } else slots[pattern] = { ...slot, streak: 0 };
      continue;
    }
    if (f === 'hard') {
      slots[pattern] = { ...slot, streak: 0 };
      continue;
    }
    const streak = slot.streak + (f === 'easy' ? 2 : 1);
    if (streak < 2) {
      slots[pattern] = { ...slot, streak };
      continue;
    }
    if (slot.target < top(e)) {
      const t = Math.min(top(e), slot.target + (e.mode === 'time' ? HOLD.step : f === 'easy' ? 2 : 1));
      slots[pattern] = { ...slot, target: t, streak: 0 };
      changes.push(`${e.name}: every set done and it felt ${f === 'easy' ? 'easy' : 'about right'}${f === 'easy' ? '' : ' twice in a row'}, so the target goes up to ${unit(e, t)}.`);
      continue;
    }
    const harder = chain(e.pattern).find((x) => x.level > e.level && allowed(x, pain));
    if (harder) {
      slots[pattern] = { exerciseId: harder.id, target: bottom(harder), streak: 0 };
      changes.push(`You've reached the top of the range on ${e.name}. Next step up: ${harder.name}, starting at ${unit(harder, bottom(harder))}.`);
    } else {
      slots[pattern] = { ...slot, streak: 0 };
      changes.push(`${e.name} is at the top of its range. Make it harder by moving slower: take 3 seconds on the way down.`);
    }
  }
  return { training: { ...training, slots }, changes };
}

export { name as exerciseName };
