import { useState } from 'react';
import { Button, Choices, Field, Notice, Page, YesNo, num } from '../components/ui';
import { LIMITS, assessTarget, bmi, bmiCategoryIndia, bmiCategoryWHO, inRange, lossTimeline, proteinTargetG, round1 } from '../lib/body';
import { validPasscode } from '../lib/crypto';
import { EMERGENCY_MESSAGE, SAFETY_QUESTIONS, evaluateSafety } from '../lib/safety';
import type { BodyArea, EquipmentId, FoodPrefs, GoalId, HealthScreen, Pacing, SafetyAnswerId } from '../lib/types';
import { today, useVault } from '../lib/vault-context';

const TOTAL = 11;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GOALS: { value: GoalId; label: string }[] = [
  { value: 'fat-loss', label: 'Fat loss' },
  { value: 'muscle-gain', label: 'Muscle gain' },
  { value: 'recomposition', label: 'Body recomposition' },
  { value: 'general-fitness', label: 'General fitness' },
  { value: 'strength', label: 'Strength' },
  { value: 'endurance', label: 'Cardio endurance' },
  { value: 'athletic', label: 'Athletic conditioning' },
  { value: 'mobility', label: 'Mobility and flexibility' },
];
const EQUIPMENT: { value: EquipmentId; label: string }[] = [
  { value: 'bodyweight', label: 'Bodyweight only' },
  { value: 'chair', label: 'Stable chair' },
  { value: 'wall', label: 'Clear wall' },
  { value: 'mat', label: 'Exercise mat' },
  { value: 'table', label: 'Sturdy table' },
  { value: 'bands', label: 'Resistance bands' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'pullupbar', label: 'Pull-up bar' },
  { value: 'gym', label: 'Gym access' },
  { value: 'outdoor', label: 'Outdoor space' },
];
const AREAS: BodyArea[] = ['neck', 'shoulder', 'elbow', 'wrist', 'upper back', 'lower back', 'hip', 'knee', 'ankle', 'other'];
export const PACES: { id: Pacing; name: string; rate: string; desc: string }[] = [
  { id: 'gradual', name: 'Gradual', rate: '~0.25% of body weight / week', desc: 'Lower starting volume, slow progression and more recovery flexibility. Best for building the habit.' },
  { id: 'balanced', name: 'Balanced', rate: '~0.5% / week', desc: 'Steady strength progression, regular walking and sustainable eating. Recommended for most people.' },
  { id: 'challenging', name: 'Challenging', rate: 'up to ~0.7% / week', desc: 'Faster volume increases and more structure. Never daily high intensity and never an unsafe calorie deficit.' },
];

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export default function Onboarding() {
  const { status, data, create, save, log } = useVault();
  const [step, setStep] = useState<number>(status === 'unlocked' ? Math.max(3, data.onboarding?.step ?? 3) : 0);
  const [age, setAge] = useState<string>(data.profile?.age ? String(data.profile.age) : '');

  const go = async (n: number) => {
    if (n >= 3) await save('onboarding', { done: false, step: n });
    setStep(n);
    window.scrollTo(0, 0);
  };
  const back = step > 0 && step !== 3 ? () => setStep(step - 1) : undefined;
  const progress = step / TOTAL;

  if (step === 0) return <Welcome onNext={() => setStep(1)} />;
  if (step === 1) return <AgeGate age={age} setAge={setAge} onBack={back} progress={progress} onNext={() => setStep(2)} />;
  if (step === 2)
    return (
      <PasscodeStep
        onBack={back}
        progress={progress}
        onCreate={async (p) => {
          await create(p);
          await save('onboarding', { done: false, step: 3 });
          setStep(3);
        }}
      />
    );
  if (step === 3) return <AboutStep initialAge={age} progress={progress} onNext={() => go(4)} />;
  if (step === 4) return <SafetyStep onBack={back} progress={progress} onNext={() => go(5)} />;
  if (step === 5) return <LifestyleStep onBack={back} progress={progress} onNext={() => go(6)} />;
  if (step === 6) return <FitnessStep onBack={back} progress={progress} onNext={() => go(7)} />;
  if (step === 7) return <EquipmentStep onBack={back} progress={progress} onNext={() => go(8)} />;
  if (step === 8) return <FoodStep onBack={back} progress={progress} onNext={() => go(9)} />;
  if (step === 9) return <GoalsStep onBack={back} progress={progress} onNext={() => go(10)} />;
  if (step === 10) return <PacingStep onBack={back} progress={progress} onNext={() => go(11)} />;
  return (
    <Summary
      onBack={back}
      onFinish={async () => {
        await save('onboarding', { done: true, step: TOTAL });
        await log('Created your first plan settings', 'Based on your onboarding answers.');
      }}
    />
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <Page title="Your coach, built around you." footer={<Button onClick={onNext}>Get started</Button>}>
      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-gold">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" />
        </svg>
      </div>
      <p className="text-base leading-relaxed text-slate">About 7 minutes of questions. Your answers stay on this device, encrypted with a passcode you choose. Every plan comes with the reason behind it.</p>
      <ul className="flex flex-col gap-2.5 text-sm">
        {['Evidence-based training and food', 'Works offline, no account needed', 'Not a substitute for a doctor, physiotherapist or dietitian'].map((t) => (
          <li key={t} className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B7A43" strokeWidth="2.5" aria-hidden="true">
              <path d="M5 12l5 5L20 7" />
            </svg>
            {t}
          </li>
        ))}
      </ul>
    </Page>
  );
}

function AgeGate({ age, setAge, onNext, onBack, progress }: { age: string; setAge: (s: string) => void; onNext: () => void; onBack?: () => void; progress: number }) {
  const n = num(age);
  const minor = n !== null && n < 18;
  const valid = n !== null && inRange(n, LIMITS.age) && Number.isInteger(n);
  return (
    <Page title="How old are you?" subtitle="Forge is designed for adults. Training and diet advice for under-18s needs different rules." onBack={onBack} progress={progress} footer={<Button disabled={!valid} onClick={onNext}>Continue</Button>}>
      <Field label="Age (years)" type="number" inputMode="numeric" value={age} onChange={setAge} error={n !== null && !minor && !valid ? 'Enter a whole number between 18 and 100.' : null} />
      {minor && (
        <Notice tone="caution" title="Forge is for adults only">
          A PE teacher, sports coach or doctor can help you train safely for your age.
        </Notice>
      )}
    </Page>
  );
}

function PasscodeStep({ onCreate, onBack, progress }: { onCreate: (p: string) => Promise<void>; onBack?: () => void; progress: number }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const err = p1 ? validPasscode(p1) : null;
  const mismatch = p2.length > 0 && p1 !== p2;
  const ok = !!p1 && !err && p1 === p2;
  return (
    <Page
      title="Create a passcode"
      subtitle="It locks the app and encrypts everything you enter. It is never sent anywhere."
      onBack={onBack}
      progress={progress}
      footer={
        <Button
          disabled={!ok || busy}
          onClick={async () => {
            setBusy(true);
            await onCreate(p1);
          }}
        >
          {busy ? 'Securing…' : 'Create passcode'}
        </Button>
      }
    >
      <Field label="Passcode" type="password" value={p1} onChange={setP1} hint="At least 6 characters" error={err} autoComplete="new-password" />
      <Field label="Repeat passcode" type="password" value={p2} onChange={setP2} error={mismatch ? 'Passcodes do not match.' : null} autoComplete="new-password" />
      <Notice tone="caution" title="There is no reset">
        Forge cannot recover a forgotten passcode, because nothing is stored anywhere else. Write it down somewhere safe and make regular backups.
      </Notice>
    </Page>
  );
}

function AboutStep({ initialAge, onNext, progress }: { initialAge: string; onNext: () => void; progress: number }) {
  const { data, save } = useVault();
  const p = data.profile;
  const [f, setF] = useState({
    name: p?.name ?? '',
    age: p?.age ? String(p.age) : initialAge,
    sex: (p?.sex ?? null) as 'male' | 'female' | null,
    height: p?.heightCm ? String(p.heightCm) : '',
    weight: p?.weightKg ? String(p.weightKg) : '',
    city: p?.city ?? '',
    occupation: p?.occupation ?? '',
    busy: p?.busyHoursPerDay !== undefined ? String(p.busyHoursPerDay) : '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const age = num(f.age), h = num(f.height), w = num(f.weight), busy = num(f.busy);
  const errs = {
    age: f.age && !(age !== null && inRange(age, LIMITS.age) && Number.isInteger(age)) ? 'Forge is for ages 18 to 100.' : null,
    height: f.height && !inRange(h, LIMITS.heightCm) ? 'Between 120 and 230 cm.' : null,
    weight: f.weight && !inRange(w, LIMITS.weightKg) ? 'Between 30 and 250 kg.' : null,
    busy: f.busy && !(busy !== null && busy >= 0 && busy <= 20) ? 'Between 0 and 20 hours.' : null,
  };
  const complete = !!(age && h && w && f.sex && f.city.trim() && f.occupation.trim() && busy !== null) && !Object.values(errs).some(Boolean);
  const b = complete ? bmi(w!, h!) : null;
  return (
    <Page
      title="About you"
      subtitle="Used only for your own calculations. Biological sex matters for energy estimates."
      progress={progress}
      footer={
        <Button
          disabled={!complete}
          onClick={async () => {
            await save('profile', { name: f.name.trim(), age: age!, sex: f.sex!, heightCm: h!, weightKg: w!, city: f.city.trim(), occupation: f.occupation.trim(), busyHoursPerDay: busy!, createdAt: p?.createdAt ?? new Date().toISOString() });
            const m = data.measurements ?? [];
            if (!m.some((x) => x.date === today() && x.weightKg === w)) await save('measurements', [...m, { id: crypto.randomUUID(), date: today(), weightKg: w! }]);
            onNext();
          }}
        >
          Continue
        </Button>
      }
    >
      <Field label="First name (optional)" value={f.name} onChange={set('name')} autoComplete="given-name" />
      <Field label="Age (years)" type="number" inputMode="numeric" value={f.age} onChange={set('age')} error={errs.age} />
      <Choices label="Biological sex" options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} value={f.sex} onChange={(v) => setF({ ...f, sex: v })} />
      <Field label="Height (cm)" type="number" inputMode="decimal" value={f.height} onChange={set('height')} error={errs.height} />
      <Field label="Current weight (kg)" type="number" inputMode="decimal" value={f.weight} onChange={set('weight')} error={errs.weight} hint="Morning, after the toilet, before eating, if you can" />
      <Field label="City" value={f.city} onChange={set('city')} autoComplete="address-level2" />
      <Field label="Occupation or main daily activity" value={f.occupation} onChange={set('occupation')} placeholder="e.g. student, office job, shop work" />
      <Field label="Hours of work or study per day" type="number" inputMode="decimal" value={f.busy} onChange={set('busy')} error={errs.busy} />
      {b !== null && (
        <Notice title={`BMI ${b.toFixed(1)}`}>
          WHO: {bmiCategoryWHO(b)} · Indian cut-offs: {bmiCategoryIndia(b)}. BMI is only a screening number. It does not measure body fat, muscle or health.
        </Notice>
      )}
    </Page>
  );
}

function SafetyStep({ onNext, onBack, progress }: { onNext: () => void; onBack?: () => void; progress: number }) {
  const { data, save, log } = useVault();
  const [answers, setAnswers] = useState<Partial<Record<SafetyAnswerId, boolean>>>(data.health?.answers ?? {});
  const [areas, setAreas] = useState<BodyArea[]>(data.health?.painAreas ?? []);
  const [notes, setNotes] = useState(data.health?.notes ?? '');
  const [stopped, setStopped] = useState(false);
  const answered = SAFETY_QUESTIONS.every((q) => typeof answers[q.id] === 'boolean');
  const painNeedsArea = answers.pain === true && areas.length === 0;

  const persist = async (clearedByDoctorAt: string | null) => {
    const h: HealthScreen = { answers: answers as HealthScreen['answers'], painAreas: answers.pain ? areas : [], notes: notes.trim(), clearedByDoctorAt, completedAt: new Date().toISOString() };
    await save('health', h);
    return evaluateSafety(h);
  };

  if (stopped)
    return (
      <Page title="Please see a doctor first" onBack={() => setStopped(false)} progress={progress}
        footer={
          <>
            <Button variant="outline" onClick={async () => { await persist(today()); await log('Workouts unlocked', 'You confirmed a doctor cleared you to exercise.'); onNext(); }}>
              A doctor has cleared me to exercise
            </Button>
            <Button variant="dark" onClick={async () => { await persist(null); await log('Workouts locked', 'A safety answer can be a sign of a heart or circulation problem.'); onNext(); }}>
              Continue without workouts for now
            </Button>
          </>
        }
      >
        <p className="text-[15px] leading-relaxed">One of your answers can be a sign of a heart or circulation problem. Exercise could be risky until a doctor has checked you.</p>
        <p className="text-[15px] leading-relaxed">Workouts stay locked until you confirm you have been cleared. You can still set up food, walking and measurements.</p>
        <Notice tone="danger" title="If it is happening now">{EMERGENCY_MESSAGE}</Notice>
      </Page>
    );

  return (
    <Page title="Safety check" subtitle="Required before any workout. Your answers only change what is safe for you." onBack={onBack} progress={progress}
      footer={
        <Button
          disabled={!answered || painNeedsArea}
          onClick={async () => {
            const s = await persist(data.health?.clearedByDoctorAt ?? null);
            if (s === 'red') setStopped(true);
            else onNext();
          }}
        >
          {answered ? 'Continue' : `Answer all ${SAFETY_QUESTIONS.length} to continue`}
        </Button>
      }
    >
      {SAFETY_QUESTIONS.map((q) => (
        <YesNo key={q.id} question={q.text} value={answers[q.id]} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
      ))}
      {answers.pain && (
        <>
          <Choices label="Where? (choose all that apply)" multi options={AREAS.map((a) => ({ value: a, label: a[0].toUpperCase() + a.slice(1) }))} value={areas} onChange={(v) => setAreas(toggle(areas, v))} />
          <Field label="Anything else we should know? (optional)" value={notes} onChange={setNotes} placeholder="e.g. old knee injury, physio said avoid jumping" />
          <Notice tone="caution">Exercises that load these areas will be swapped or eased. Pain that is new, sharp or getting worse needs a doctor or physiotherapist.</Notice>
        </>
      )}
    </Page>
  );
}

function LifestyleStep({ onNext, onBack, progress }: { onNext: () => void; onBack?: () => void; progress: number }) {
  const { data, save } = useVault();
  const l = data.lifestyle;
  const [f, setF] = useState({
    wake: l?.wakeTime ?? '07:00', sleep: l?.sleepTime ?? '23:00', sitting: l ? String(l.sittingHours) : '', walking: l ? String(l.walkingMinutes) : '',
    minutes: l ? String(l.minutesPerSession) : '', days: l?.trainingDays ?? [], pref: (l?.preferredTime ?? null) as 'morning' | 'afternoon' | 'evening' | 'any' | null, weekends: l?.weekendsDifferent ?? null,
  });
  const sitting = num(f.sitting), walking = num(f.walking), minutes = num(f.minutes);
  const errs = {
    sitting: f.sitting && !(sitting !== null && sitting >= 0 && sitting <= 20) ? 'Between 0 and 20 hours.' : null,
    walking: f.walking && !(walking !== null && walking >= 0 && walking <= 600) ? 'Between 0 and 600 minutes.' : null,
    minutes: f.minutes && !(minutes !== null && minutes >= 10 && minutes <= 120) ? 'Between 10 and 120 minutes.' : null,
  };
  const complete = sitting !== null && walking !== null && minutes !== null && f.days.length > 0 && f.pref && f.weekends !== null && !Object.values(errs).some(Boolean);
  const [h1, m1] = f.wake.split(':').map(Number), [h2, m2] = f.sleep.split(':').map(Number);
  const sleepH = ((h1 * 60 + m1 - (h2 * 60 + m2) + 1440) % 1440) / 60;
  return (
    <Page title="Your daily life" subtitle="So the plan fits your real week, not an ideal one." onBack={onBack} progress={progress}
      footer={<Button disabled={!complete} onClick={async () => { await save('lifestyle', { wakeTime: f.wake, sleepTime: f.sleep, sittingHours: sitting!, walkingMinutes: walking!, minutesPerSession: minutes!, trainingDays: f.days, preferredTime: f.pref!, weekendsDifferent: !!f.weekends }); onNext(); }}>Continue</Button>}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Usual wake time" type="time" value={f.wake} onChange={(v) => setF({ ...f, wake: v })} />
        <Field label="Usual bedtime" type="time" value={f.sleep} onChange={(v) => setF({ ...f, sleep: v })} />
      </div>
      {Number.isFinite(sleepH) && (
        <p className={`-mt-1 text-xs font-semibold ${sleepH < 7 ? 'text-caution' : 'text-good'}`}>
          About {round1(sleepH)} hours in bed. {sleepH < 7 ? 'Adults are advised 7 or more hours of sleep.' : 'Within the 7+ hours advised for adults.'}
        </p>
      )}
      <Field label="Hours sitting per day" type="number" inputMode="decimal" value={f.sitting} onChange={(v) => setF({ ...f, sitting: v })} error={errs.sitting} />
      <Field label="Minutes walking per day (roughly)" type="number" inputMode="numeric" value={f.walking} onChange={(v) => setF({ ...f, walking: v })} error={errs.walking} />
      <Field label="Minutes you can realistically train per session" type="number" inputMode="numeric" value={f.minutes} onChange={(v) => setF({ ...f, minutes: v })} error={errs.minutes} hint="Include warm-up and cool-down. Be honest; a plan you can keep beats a perfect one." />
      <Choices label="Days you could train" multi options={DAYS.map((d) => ({ value: d, label: d }))} value={f.days} onChange={(v) => setF({ ...f, days: toggle(f.days, v) })} />
      <Choices label="Preferred time" options={[{ value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }, { value: 'evening', label: 'Evening' }, { value: 'any', label: 'Any time' }]} value={f.pref} onChange={(v) => setF({ ...f, pref: v })} />
      <YesNo question="Are your weekends very different from weekdays?" value={f.weekends} onChange={(v) => setF({ ...f, weekends: v })} />
    </Page>
  );
}

function FitnessStep({ onNext, onBack, progress }: { onNext: () => void; onBack?: () => void; progress: number }) {
  const { data, save } = useVault();
  const x = data.fitness;
  const [f, setF] = useState({ exp: x?.experience ?? null, push: x?.pushUps != null ? String(x.pushUps) : '', squat: x?.squats60s != null ? String(x.squats60s) : '', plank: x?.plankSeconds != null ? String(x.plankSeconds) : '', walk: x?.canBriskWalk20 ?? null, dislikes: x?.dislikes ?? '' });
  const n = (s: string, max: number) => { const v = num(s); return v !== null && v >= 0 && v <= max && Number.isInteger(v) ? v : null; };
  const bad = (s: string, max: number) => (s !== '' && n(s, max) === null ? `A whole number from 0 to ${max}.` : null);
  const errs = { push: bad(f.push, 200), squat: bad(f.squat, 200), plank: bad(f.plank, 1200) };
  const complete = f.exp && !Object.values(errs).some(Boolean);
  return (
    <Page title="Fitness check" subtitle="Optional and safe. Skip any test. Never push to pain or exhaustion." onBack={onBack} progress={progress}
      footer={<Button disabled={!complete} onClick={async () => { await save('fitness', { experience: f.exp!, pushUps: n(f.push, 200), squats60s: n(f.squat, 200), plankSeconds: n(f.plank, 1200), canBriskWalk20: f.walk, dislikes: f.dislikes.trim() }); onNext(); }}>Continue</Button>}
    >
      <Choices label="Training experience" options={[{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} value={f.exp} onChange={(v) => setF({ ...f, exp: v })} />
      <Field label="Full push-ups with good form (leave blank to skip)" type="number" inputMode="numeric" value={f.push} onChange={(v) => setF({ ...f, push: v })} error={errs.push} />
      <Field label="Controlled bodyweight squats in 60 seconds (optional)" type="number" inputMode="numeric" value={f.squat} onChange={(v) => setF({ ...f, squat: v })} error={errs.squat} />
      <Field label="Plank hold in seconds (optional)" type="number" inputMode="numeric" value={f.plank} onChange={(v) => setF({ ...f, plank: v })} error={errs.plank} />
      <YesNo question="Can you walk briskly for 20–30 minutes without stopping?" value={f.walk} onChange={(v) => setF({ ...f, walk: v })} />
      <Field label="Exercises you dislike (optional)" value={f.dislikes} onChange={(v) => setF({ ...f, dislikes: v })} placeholder="e.g. burpees, jumping" />
    </Page>
  );
}

function EquipmentStep({ onNext, onBack, progress }: { onNext: () => void; onBack?: () => void; progress: number }) {
  const { data, save } = useVault();
  const [items, setItems] = useState<EquipmentId[]>(data.equipment?.items ?? ['bodyweight']);
  const [space, setSpace] = useState<boolean | null>(data.equipment?.enoughFloorSpace ?? null);
  return (
    <Page title="Equipment and space" subtitle="Bodyweight is a complete starting point. Only pick what you really have." onBack={onBack} progress={progress}
      footer={<Button disabled={items.length === 0 || space === null} onClick={async () => { await save('equipment', { items, enoughFloorSpace: !!space }); onNext(); }}>Continue</Button>}
    >
      <Choices label="What do you have?" multi options={EQUIPMENT} value={items} onChange={(v) => setItems(toggle(items, v))} />
      <YesNo question="Do you have floor space to lie down with arms stretched out?" value={space} onChange={setSpace} />
      {items.includes('table') && <Notice tone="caution">Table rows are only offered after a safety check that the table is heavy and cannot tip or slide.</Notice>}
      {!items.some((i) => ['bands', 'pullupbar', 'dumbbells', 'kettlebell', 'gym'].includes(i)) && (
        <Notice>Honest note: without something to pull on, back and biceps are the hardest muscles to train well. Forge will show this gap and may suggest a low-cost band later.</Notice>
      )}
    </Page>
  );
}

function FoodStep({ onNext, onBack, progress }: { onNext: () => void; onBack?: () => void; progress: number }) {
  const { data, save } = useVault();
  const x = data.food;
  const [f, setF] = useState<Partial<FoodPrefs> & { meals: string }>({ ...x, meals: x?.mealsPerDay ? String(x.mealsPerDay) : '' });
  const meals = num(f.meals);
  const mealsErr = f.meals && !(meals !== null && meals >= 1 && meals <= 8 && Number.isInteger(meals)) ? 'Between 1 and 8.' : null;
  const complete = f.diet && f.cooking && f.budget && f.eatingOut && meals && !mealsErr;
  return (
    <Page title="Food" subtitle="Plans use Indian foods and household portions. Nothing is assumed." onBack={onBack} progress={progress}
      footer={<Button disabled={!complete} onClick={async () => { await save('food', { diet: f.diet!, dislikes: (f.dislikes ?? '').trim(), allergies: (f.allergies ?? '').trim(), mealsPerDay: meals!, cooking: f.cooking!, budget: f.budget!, eatingOut: f.eatingOut! }); onNext(); }}>Continue</Button>}
    >
      <Choices label="Diet" options={[{ value: 'vegetarian', label: 'Vegetarian' }, { value: 'eggetarian', label: 'Eggetarian' }, { value: 'non-vegetarian', label: 'Non-vegetarian' }, { value: 'vegan', label: 'Vegan' }]} value={f.diet ?? null} onChange={(v) => setF({ ...f, diet: v })} />
      <Field label="Foods you don't eat or dislike (optional)" value={f.dislikes ?? ''} onChange={(v) => setF({ ...f, dislikes: v })} placeholder="e.g. bitter gourd, mutton" />
      <Field label="Food allergies (optional)" value={f.allergies ?? ''} onChange={(v) => setF({ ...f, allergies: v })} placeholder="e.g. peanuts" />
      <Field label="Meals per day" type="number" inputMode="numeric" value={f.meals} onChange={(v) => setF({ ...f, meals: v })} error={mealsErr} />
      <Choices label="Cooking" options={[{ value: 'none', label: "Can't cook" }, { value: 'basic', label: 'Simple recipes' }, { value: 'comfortable', label: 'Comfortable' }]} value={f.cooking ?? null} onChange={(v) => setF({ ...f, cooking: v })} />
      <Choices label="Food budget" options={[{ value: 'tight', label: 'Tight' }, { value: 'moderate', label: 'Moderate' }, { value: 'flexible', label: 'Flexible' }]} value={f.budget ?? null} onChange={(v) => setF({ ...f, budget: v })} />
      <Choices label="Eating out" options={[{ value: 'rarely', label: 'Rarely' }, { value: 'weekly', label: 'About weekly' }, { value: 'often', label: 'Often' }]} value={f.eatingOut ?? null} onChange={(v) => setF({ ...f, eatingOut: v })} />
    </Page>
  );
}

function GoalsStep({ onNext, onBack, progress }: { onNext: () => void; onBack?: () => void; progress: number }) {
  const { data, save } = useVault();
  const [ranked, setRanked] = useState<GoalId[]>(data.goals?.ranked ?? []);
  const [target, setTarget] = useState(data.goals?.targetWeightKg ? String(data.goals.targetWeightKg) : '');
  const p = data.profile!;
  const t = num(target);
  const a = t !== null ? assessTarget(p.weightKg, t, p.heightCm) : null;
  const tErr = target && !inRange(t, LIMITS.weightKg) ? 'Between 30 and 250 kg.' : null;
  const conflict = ranked.includes('fat-loss') && ranked.includes('muscle-gain') && !ranked.includes('recomposition');
  return (
    <Page title="Your goals" subtitle="Tap in order of importance. The first one leads the plan." onBack={onBack} progress={progress}
      footer={<Button disabled={ranked.length === 0 || !!tErr || (a !== null && !a.ok)} onClick={async () => { await save('goals', { ranked, targetWeightKg: t, pacing: data.goals?.pacing ?? 'balanced', setAt: new Date().toISOString() }); onNext(); }}>Continue</Button>}
    >
      <div className="flex flex-col gap-2">
        {GOALS.map((g) => {
          const i = ranked.indexOf(g.value);
          return (
            <button key={g.value} type="button" aria-pressed={i >= 0} onClick={() => setRanked(toggle(ranked, g.value))}
              className={`flex min-h-[52px] items-center justify-between rounded-2xl px-4 text-left text-[15px] font-semibold ${i >= 0 ? 'border-2 border-charcoal bg-butter' : 'border-[1.5px] border-line bg-white'}`}>
              {g.label}
              {i >= 0 && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-charcoal text-xs font-extrabold text-white">{i + 1}</span>}
            </button>
          );
        })}
      </div>
      {conflict && <Notice>Losing fat and gaining muscle at the same time is called body recomposition. It's realistic for beginners, but slower than either goal alone.</Notice>}
      <Field label="Target weight in kg (optional)" type="number" inputMode="decimal" value={target} onChange={setTarget} error={tErr} hint="A provisional target. Waist size and strength matter more than the scale." />
      {a && <Notice tone={a.ok ? 'info' : 'danger'} title={`Target BMI ${a.targetBmi.toFixed(1)}`}>{a.message}</Notice>}
    </Page>
  );
}

function PacingStep({ onNext, onBack, progress }: { onNext: () => void; onBack?: () => void; progress: number }) {
  const { data, save, log } = useVault();
  const [pace, setPace] = useState<Pacing>(data.goals?.pacing ?? 'balanced');
  return (
    <Page title="Choose your pace" subtitle="You can change it any time, and the plan recalculates. Faster never skips recovery." onBack={onBack} progress={progress}
      footer={<Button onClick={async () => { await save('goals', { ...data.goals!, pacing: pace, setAt: new Date().toISOString() }); await log(`Pace set to ${pace}`, 'Your choice during setup.'); onNext(); }}>Build my plan</Button>}
    >
      {PACES.map((p) => (
        <button key={p.id} type="button" aria-pressed={pace === p.id} onClick={() => setPace(p.id)}
          className={`flex flex-col gap-1.5 rounded-[18px] p-4 text-left ${pace === p.id ? 'border-2 border-charcoal bg-butter' : 'border-[1.5px] border-line bg-white'}`}>
          <span className="flex w-full justify-between gap-2"><strong className="text-[17px]">{p.name}</strong><span className="text-right text-[13px] font-bold text-goldink">{p.rate}</span></span>
          <span className="text-[13px] leading-snug text-slate">{p.desc}</span>
        </button>
      ))}
    </Page>
  );
}

function Summary({ onFinish, onBack }: { onFinish: () => Promise<void>; onBack?: () => void }) {
  const { data } = useVault();
  const p = data.profile!, g = data.goals!;
  const status = evaluateSafety(data.health);
  const tl = g.targetWeightKg ? lossTimeline(p.weightKg, g.targetWeightKg, g.pacing) : null;
  const rows: [string, string][] = [
    ['Pace', PACES.find((x) => x.id === g.pacing)!.name],
    ['Strength', status === 'red' ? 'Locked until medical clearance' : '3 full-body days a week'],
    ['Walking', '2–3 days, building to 150+ minutes a week'],
    ['Protein', `about ${proteinTargetG(p.weightKg)} g a day (1.6 g/kg)`],
  ];
  if (tl) rows.push(['Estimate to target', `about ${tl.weeksMin}–${tl.weeksMax} weeks (~${round1(tl.weeklyKg)} kg/week)`]);
  return (
    <Page title="Your plan settings" onBack={onBack} footer={<Button variant="dark" onClick={onFinish}>Go to Today</Button>}>
      <div className="flex flex-col gap-2.5 rounded-[18px] bg-butter p-4">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 text-sm"><span className="text-slate">{k}</span><strong className="text-right">{v}</strong></div>
        ))}
      </div>
      {status === 'caution' && <Notice tone="caution">You mentioned pain, an injury, a condition or medicines. Exercises for affected areas will be eased, and you can report pain during any workout.</Notice>}
      {status === 'red' && <Notice tone="danger">Workouts are locked because of a safety answer. Food, walking and measurements still work.</Notice>}
      {tl && <Notice>Estimates assume a steady pace. Real weight goes up and down with water, food and salt, so Forge tracks weekly averages and your waist instead of promising a date.</Notice>}
      <Notice>Why full body? Training each muscle about twice a week builds it better than once a week, and it survives busy weeks.</Notice>
      <p className="text-xs text-slate">Workout plans and the exercise library arrive in the next update.</p>
    </Page>
  );
}
