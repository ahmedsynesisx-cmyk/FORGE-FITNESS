// Pre-exercise safety screen. Our own wording, based on ACSM screening logic (Riebe et al. 2015).
// The official PAR-Q+ is not embedded because its terms require written permission for apps.

import type { HealthScreen, SafetyAnswerId } from './types';

export interface SafetyQuestion {
  id: SafetyAnswerId;
  text: string;
  /** A "yes" blocks workouts until the user confirms medical clearance. */
  redFlag: boolean;
}

export const SAFETY_QUESTIONS: SafetyQuestion[] = [
  { id: 'chest', text: 'Have you ever had chest pain, pressure or tightness during or after exercise?', redFlag: true },
  { id: 'faint', text: 'Have you fainted, or felt dizzy enough to lose your balance, while exercising?', redFlag: true },
  { id: 'heart', text: 'Has a doctor told you that you have a heart condition or high blood pressure?', redFlag: true },
  { id: 'pain', text: 'Do you have any current pain, injury or past fracture (back, neck, shoulder, knee or anywhere else)?', redFlag: false },
  { id: 'meds', text: 'Do you take regular medicines, or have a long-term medical condition?', redFlag: false },
];

export type SafetyStatus = 'red' | 'caution' | 'clear' | 'incomplete';

export function evaluateSafety(h: Pick<HealthScreen, 'answers' | 'clearedByDoctorAt'> | undefined): SafetyStatus {
  if (!h) return 'incomplete';
  const answered = SAFETY_QUESTIONS.every((q) => typeof h.answers?.[q.id] === 'boolean');
  if (!answered) return 'incomplete';
  const red = SAFETY_QUESTIONS.some((q) => q.redFlag && h.answers[q.id]);
  if (red && !h.clearedByDoctorAt) return 'red';
  if (red || h.answers.pain || h.answers.meds) return 'caution';
  return 'clear';
}

export function workoutsAllowed(status: SafetyStatus): boolean {
  return status === 'clear' || status === 'caution';
}

/** Symptoms that stop ordinary advice at any time (workout player and coach use this too). */
export const EMERGENCY_SIGNS = [
  'chest pain or pressure',
  'fainting or near-fainting',
  'severe or unusual breathlessness',
  'new weakness or numbness',
  'loss of bladder or bowel control',
];

export const EMERGENCY_MESSAGE =
  'Stop exercising now. If you have chest pain, fainting, severe breathlessness, new weakness or numbness, or loss of bladder or bowel control, call 108 or go to the nearest emergency department.';
