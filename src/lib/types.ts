// Shared data types. Each collection is stored encrypted on the device (see store.ts).

export type Sex = 'male' | 'female';
export type Pacing = 'gradual' | 'balanced' | 'challenging';
export type Experience = 'beginner' | 'intermediate' | 'advanced';

export interface Profile {
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  city: string;
  occupation: string;
  busyHoursPerDay: number;
  createdAt: string;
}

export type SafetyAnswerId = 'chest' | 'faint' | 'heart' | 'pain' | 'meds';
export type BodyArea = 'neck' | 'shoulder' | 'elbow' | 'wrist' | 'upper back' | 'lower back' | 'hip' | 'knee' | 'ankle' | 'other';

export interface HealthScreen {
  answers: Record<SafetyAnswerId, boolean>;
  painAreas: BodyArea[];
  notes: string;
  /** ISO date the user confirmed a doctor cleared them after a red-flag answer. */
  clearedByDoctorAt: string | null;
  completedAt: string;
}

export interface Lifestyle {
  wakeTime: string;
  sleepTime: string;
  sittingHours: number;
  walkingMinutes: number;
  minutesPerSession: number;
  trainingDays: string[];
  preferredTime: 'morning' | 'afternoon' | 'evening' | 'any';
  weekendsDifferent: boolean;
}

export interface FitnessCheck {
  experience: Experience;
  pushUps: number | null;
  squats60s: number | null;
  plankSeconds: number | null;
  canBriskWalk20: boolean | null;
  dislikes: string;
}

export type EquipmentId = 'bodyweight' | 'chair' | 'wall' | 'mat' | 'table' | 'bands' | 'dumbbells' | 'kettlebell' | 'pullupbar' | 'gym' | 'outdoor';

export interface Equipment {
  items: EquipmentId[];
  enoughFloorSpace: boolean;
}

export interface FoodPrefs {
  diet: 'vegetarian' | 'eggetarian' | 'non-vegetarian' | 'vegan';
  dislikes: string;
  allergies: string;
  mealsPerDay: number;
  cooking: 'none' | 'basic' | 'comfortable';
  budget: 'tight' | 'moderate' | 'flexible';
  eatingOut: 'rarely' | 'weekly' | 'often';
}

export type GoalId = 'fat-loss' | 'muscle-gain' | 'recomposition' | 'general-fitness' | 'strength' | 'endurance' | 'athletic' | 'mobility';

export interface Goals {
  ranked: GoalId[];
  targetWeightKg: number | null;
  pacing: Pacing;
  setAt: string;
}

export interface Measurement {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg?: number;
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  neckCm?: number;
}

export interface AuditEntry {
  at: string;
  what: string;
  why: string;
}

export type Feel = 'easy' | 'right' | 'hard' | 'pain';
export type SessionKey = 'A' | 'B';
export interface SlotState { exerciseId: string; target: number; streak: number }
export interface SetLog { exerciseId: string; set: number; target: number; done: number }
export interface ActiveSession { id: string; date: string; key: SessionKey; startedAt: string; stepIndex: number; sets: SetLog[]; feel: Record<string, Feel> }
export interface Training { startedAt: string; slots: Record<string, SlotState>; active: ActiveSession | null }
export interface SessionLog { id: string; date: string; key: SessionKey; startedAt: string; finishedAt: string; sets: SetLog[]; feel: Record<string, Feel>; changes: string[]; complete: boolean }

export interface Collections {
  profile: Profile;
  health: HealthScreen;
  lifestyle: Lifestyle;
  fitness: FitnessCheck;
  equipment: Equipment;
  food: FoodPrefs;
  goals: Goals;
  measurements: Measurement[];
  audit: AuditEntry[];
  onboarding: { done: boolean; step: number };
  training: Training;
  sessions: SessionLog[];
}

export type CollectionName = keyof Collections;
