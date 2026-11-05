import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Notice } from '../components/ui';
import { beep, keepAwake, unlockAudio } from '../lib/cues';
import { byId } from '../lib/exercises';
import { buildSteps, initTraining, planSession, progress, type Step } from '../lib/plan';
import { EMERGENCY_MESSAGE } from '../lib/safety';
import type { ActiveSession, Feel, SessionKey, SessionLog, SetLog } from '../lib/types';
import { today, useVault } from '../lib/vault-context';

const FEELS: { id: Feel; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'right', label: 'About right' },
  { id: 'hard', label: 'Hard' },
  { id: 'pain', label: 'It hurt' },
];

type Timer = { phase: 'idle' | 'ready' | 'run'; endsAt: number | null; pausedLeft: number | null };
const IDLE: Timer = { phase: 'idle', endsAt: null, pausedLeft: null };

export default function Workout({ sessionKey, onExit }: { sessionKey: SessionKey; onExit: () => void }) {
  const { data, save, log } = useVault();
  const training = data.training ?? initTraining(data);
  const plan = useMemo(() => planSession(data, training, sessionKey), [sessionKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const steps = useMemo(() => buildSteps(plan), [plan]);
  const resume = training.active && training.active.key === sessionKey ? training.active : null;

  const [active, setActive] = useState<ActiveSession | null>(resume);
  const [started, setStarted] = useState(false);
  const [timer, setTimer] = useState<Timer>(IDLE);
  const [now, setNow] = useState(() => Date.now());
  const [adjust, setAdjust] = useState<number | null>(null);
  const [painNote, setPainNote] = useState(false);
  const [summary, setSummary] = useState<SessionLog | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const lastSec = useRef<number | null>(null);

  const step: Step | undefined = active ? steps[active.stepIndex] : undefined;
  const persist = (a: ActiveSession | null) => save('training', { ...training, active: a });

  // Enter a step: timed things count down by themselves; reps wait for one tap.
  const enter = (s: Step | undefined) => {
    lastSec.current = null;
    setAdjust(null);
    if (!s) return setTimer(IDLE);
    if (s.kind === 'rest') return setTimer({ phase: 'run', endsAt: Date.now() + s.seconds * 1000, pausedLeft: null });
    const timed = s.kind !== 'work' || byId(s.exerciseId)?.mode === 'time';
    setTimer(timed ? { phase: 'ready', endsAt: Date.now() + 3000, pausedLeft: null } : IDLE);
  };

  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    let release: (() => void) | undefined;
    void keepAwake().then((r) => (release = r));
    return () => { clearInterval(id); release?.(); };
  }, [started]);

  const finish = async (a: ActiveSession, complete: boolean) => {
    const r = progress(training, a.sets, a.feel, data.health?.painAreas ?? []);
    const entry: SessionLog = { id: a.id, date: a.date, key: a.key, startedAt: a.startedAt, finishedAt: new Date().toISOString(), sets: a.sets, feel: a.feel, changes: r.changes, complete };
    await save('training', { ...r.training, active: null });
    await save('sessions', [...(data.sessions ?? []), entry]);
    for (const c of r.changes) await log('Workout plan updated', c);
    setStarted(false);
    setSummary(entry);
  };

  const advance = async (a: ActiveSession, extra: SetLog[] = []) => {
    const next = { ...a, sets: [...a.sets, ...extra], stepIndex: a.stepIndex + 1 };
    if (next.stepIndex >= steps.length) return finish(next, true);
    setActive(next);
    enter(steps[next.stepIndex]);
    await persist(next);
  };

  const logFor = (s: Step, done: number): SetLog[] => (s.kind === 'work' ? [{ exerciseId: s.exerciseId, set: s.set, target: s.target, done }] : []);

  // The clock: beeps at 3-2-1, then moves on by itself.
  useEffect(() => {
    if (!started || !active || !step || timer.endsAt === null) return;
    const left = (timer.endsAt - now) / 1000;
    const sec = Math.ceil(left);
    if (sec !== lastSec.current) {
      lastSec.current = sec;
      if (sec >= 1 && sec <= 3) beep('tick');
    }
    if (left > 0) return;
    if (timer.phase === 'ready') {
      beep('go');
      lastSec.current = null;
      const secs = step.kind === 'work' ? step.target : step.seconds;
      setTimer({ phase: 'run', endsAt: Date.now() + secs * 1000, pausedLeft: null });
      return;
    }
    beep(step.kind === 'rest' ? 'go' : 'end');
    setTimer(IDLE);
    void advance(active, logFor(step, step.kind === 'work' ? step.target : 0));
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    unlockAudio();
    const a: ActiveSession = active ?? { id: crypto.randomUUID(), date: today(), key: sessionKey, startedAt: new Date().toISOString(), stepIndex: 0, sets: [], feel: {} };
    setActive(a);
    setStarted(true);
    enter(steps[a.stepIndex]);
    await persist(a);
  };

  const pause = () => setTimer((t) => (t.endsAt === null ? t : { ...t, endsAt: null, pausedLeft: t.endsAt - Date.now() }));
  const unpause = () => { unlockAudio(); setTimer((t) => (t.pausedLeft === null ? t : { ...t, endsAt: Date.now() + t.pausedLeft, pausedLeft: null })); };

  const setFeel = async (id: string, f: Feel) => {
    if (!active) return;
    const a = { ...active, feel: { ...active.feel, [id]: f } };
    setActive(a);
    await persist(a);
  };

  const hurts = async () => {
    if (!active || step?.kind !== 'work') return;
    const id = step.exerciseId;
    // Skip the rest of this exercise's sets: jump past the rest step that follows its last set.
    const feelAt = steps.findIndex((x, j) => j >= active.stepIndex && x.kind === 'rest' && x.askFeel === id);
    const a = { ...active, feel: { ...active.feel, [id]: 'pain' as Feel }, stepIndex: feelAt === -1 ? active.stepIndex : feelAt };
    setPainNote(true);
    await advance(a);
  };

  // ---------- Summary ----------
  if (summary) {
    const mins = Math.max(1, Math.round((Date.parse(summary.finishedAt) - Date.parse(summary.startedAt)) / 60000));
    return (
      <Shell title={summary.complete ? 'Workout done' : 'Workout saved'}>
        <Card className="flex flex-col gap-1">
          <strong className="text-2xl">{summary.sets.length} sets · {mins} min</strong>
          <span className="text-sm text-slate">Workout {summary.key}. Saved to your history.</span>
        </Card>
        <Card className="flex flex-col gap-2">
          <strong className="text-[15px]">Next time</strong>
          {summary.changes.length ? (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">{summary.changes.map((c) => <li key={c}>{c}</li>)}</ul>
          ) : (
            <span className="text-sm text-slate">Same targets. Forge raises them once a move feels easy or about right with every set done, so progress stays safe.</span>
          )}
        </Card>
        <Notice>Walk on your rest days to reach 150+ minutes a week. Eat your protein today.</Notice>
        <Button onClick={onExit}>Back to Today</Button>
      </Shell>
    );
  }

  // ---------- Overview before starting ----------
  if (!started || !active || !step) {
    return (
      <Shell title={`Workout ${plan.key}`} onBack={onExit}>
        <span className="-mt-2 text-sm text-slate">
          About {plan.minutes} min · week {plan.week}{plan.deload ? ' · lighter week to recover' : ''} · {plan.items.length} exercises · 30 s rest between sets
        </span>
        {plan.skipped.length > 0 && <Notice tone="caution">Some moves are left out because of the pain you reported ({plan.skipped.join(', ')}). See a physiotherapist before adding them.</Notice>}
        <div className="flex flex-col gap-2">
          {plan.items.map((it) => (
            <details key={it.exercise.id} className="rounded-2xl border border-line bg-white p-3.5">
              <summary className="flex cursor-pointer items-center justify-between gap-2">
                <strong className="text-[15px]">{it.exercise.name}</strong>
                <span className="shrink-0 text-sm font-bold text-goldink">{it.sets} × {it.exercise.mode === 'time' ? `${it.target} s` : it.target}{it.exercise.perSide ? ' each side' : ''}</span>
              </summary>
              <HowTo id={it.exercise.id} />
            </details>
          ))}
        </div>
        <Notice>Stop straight away if you feel chest pain, faintness or sharp pain. Every set should end with 1–3 reps still in the tank.</Notice>
        <Button onClick={start}>{resume ? 'Resume workout' : 'Start workout'}</Button>
        <span className="text-center text-xs text-slate">Warm-up and timed moves run by themselves with beeps. Keep your volume up.</span>
      </Shell>
    );
  }

  // ---------- Player ----------
  const left = timer.endsAt !== null ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : timer.pausedLeft !== null ? Math.ceil(timer.pausedLeft / 1000) : null;
  const paused = timer.pausedLeft !== null;
  const ex = step.kind === 'work' ? byId(step.exerciseId)! : null;
  const nextStep = steps.slice(active.stepIndex + 1).find((s) => s.kind !== 'rest');
  const nextLabel = nextStep ? (nextStep.kind === 'work' ? `${byId(nextStep.exerciseId)!.name}, set ${nextStep.set} of ${nextStep.sets}` : nextStep.name) : 'Finish';
  const pct = Math.round((active.stepIndex / steps.length) * 100);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-cream px-5 pb-8 pt-5">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded bg-line" role="progressbar" aria-label="Workout progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-1.5 rounded bg-gold" style={{ width: `${pct}%` }} />
        </div>
        <button type="button" onClick={() => setConfirmEnd(true)} className="min-h-[44px] px-2 text-sm font-bold text-slate">End</button>
      </div>

      {confirmEnd && (
        <Card className="mt-3 flex flex-col gap-2">
          <strong>End the workout now?</strong>
          <span className="text-sm text-slate">Sets you've done are saved. Targets only change for moves you finished.</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirmEnd(false)}>Keep going</Button>
            <Button variant="dark" onClick={() => { setConfirmEnd(false); void finish(active, false); }}>End workout</Button>
          </div>
        </Card>
      )}

      {painNote && (
        <div className="mt-3">
          <Notice tone="danger" title="Stopped that exercise">
            It's been skipped for today and will be made easier next time. {EMERGENCY_MESSAGE}
            <button type="button" className="mt-2 block min-h-[44px] font-bold underline" onClick={() => setPainNote(false)}>OK</button>
          </Notice>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
        <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-slate">
          {stepLabel(step)}
        </span>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">
          {step.kind === 'work' ? ex!.name : step.kind === 'rest' ? `Next: ${nextLabel}` : step.name}
        </h1>

        {timer.phase === 'ready' && <span className="text-sm font-bold text-goldink">Get ready…</span>}
        {left !== null && <strong aria-live="polite" data-testid="timer" className="text-[72px] font-extrabold leading-none tabular-nums">{left}</strong>}
        {step.kind === 'work' && ex!.mode === 'reps' && (
          <strong className="text-[56px] font-extrabold leading-none tabular-nums">{step.target}<span className="ml-2 text-xl text-slate">reps{ex!.perSide ? ' each side' : ''}</span></strong>
        )}
        {(step.kind === 'warm' || step.kind === 'cool') && <p className="max-w-xs text-sm text-slate">{step.how}</p>}
        {step.kind === 'work' && (
          <details className="w-full rounded-2xl border border-line bg-white p-3 text-left">
            <summary className="cursor-pointer text-sm font-bold text-goldink">How to do it</summary>
            <HowTo id={ex!.id} />
          </details>
        )}

        {step.kind === 'rest' && step.askFeel && (
          <div className="flex w-full flex-col gap-2" role="group" aria-label={`How did ${byId(step.askFeel)!.name} feel?`}>
            <span className="text-sm font-bold">How did {byId(step.askFeel)!.name} feel?</span>
            <div className="grid grid-cols-2 gap-2">
              {FEELS.map((f) => (
                <button key={f.id} type="button" aria-pressed={active.feel[step.askFeel!] === f.id} onClick={() => void setFeel(step.askFeel!, f.id)}
                  className={`min-h-[48px] rounded-xl border-[1.5px] text-sm font-bold ${active.feel[step.askFeel!] === f.id ? (f.id === 'pain' ? 'border-danger bg-dangerbg text-danger' : 'border-charcoal bg-butter') : 'border-line bg-white'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {active.feel[step.askFeel] === 'pain' && <span className="text-xs text-danger">Noted. Next time it will be an easier version.</span>}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {step.kind === 'work' && ex!.mode === 'reps' && adjust === null && (
          <>
            <Button onClick={() => void advance(active, logFor(step, step.target))}>Done: {step.target} reps</Button>
            <button type="button" onClick={() => setAdjust(step.target)} className="min-h-[44px] text-sm font-bold text-goldink">Did a different number?</button>
          </>
        )}
        {step.kind === 'work' && adjust !== null && (
          <>
            <div className="flex items-center justify-center gap-4">
              <button type="button" aria-label="One less" onClick={() => setAdjust(Math.max(0, adjust - 1))} className="h-14 w-14 rounded-2xl border-[1.5px] border-line bg-white text-2xl font-bold">−</button>
              <strong className="w-16 text-center text-4xl tabular-nums" aria-live="polite">{adjust}</strong>
              <button type="button" aria-label="One more" onClick={() => setAdjust(Math.min(100, adjust + 1))} className="h-14 w-14 rounded-2xl border-[1.5px] border-line bg-white text-2xl font-bold">+</button>
            </div>
            <Button onClick={() => void advance(active, logFor(step, adjust))}>Save {adjust} {ex!.mode === 'time' ? 'seconds' : 'reps'}</Button>
          </>
        )}
        {step.kind === 'rest' && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setTimer((t) => ({ ...t, endsAt: (t.endsAt ?? Date.now()) + 30_000 }))}>+30 s</Button>
            <Button onClick={() => { setTimer(IDLE); void advance(active); }}>Skip rest</Button>
          </div>
        )}
        {timer.phase !== 'idle' && step.kind !== 'rest' && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={paused ? unpause : pause}>{paused ? 'Resume' : 'Pause'}</Button>
            {step.kind === 'work' && timer.phase === 'run' ? (
              <Button variant="dark" onClick={() => { const held = step.target - (left ?? 0); setTimer(IDLE); void advance(active, logFor(step, Math.max(0, held))); }}>Stop early</Button>
            ) : (
              <Button variant="dark" onClick={() => { setTimer(IDLE); void advance(active); }}>Skip</Button>
            )}
          </div>
        )}
        {step.kind === 'work' && <button type="button" onClick={() => void hurts()} className="min-h-[44px] text-sm font-bold text-danger">This hurts: stop this exercise</button>}
      </div>
    </div>
  );
}

function stepLabel(s: Step) {
  if (s.kind === 'rest') return s.label;
  if (s.kind === 'work') return `Set ${s.set} of ${s.sets}${s.side ? ` · side ${s.side}` : ''}`;
  return s.kind === 'warm' ? 'Warm-up' : 'Cool-down';
}

function HowTo({ id }: { id: string }) {
  const e = byId(id)!;
  return (
    <div className="flex flex-col gap-2 pt-2 text-sm">
      <span className="text-xs text-slate">{e.muscles}{e.needs ? ` · needs a sturdy ${e.needs}` : ''}</span>
      <ol className="flex list-decimal flex-col gap-1 pl-5">{e.steps.map((s) => <li key={s}>{s}</li>)}</ol>
      <span><strong>Tip:</strong> {e.cues}</span>
      <span><strong>Avoid:</strong> {e.mistakes}</span>
    </div>
  );
}

function Shell({ title, children, onBack }: { title: string; children: React.ReactNode; onBack?: () => void }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-4 bg-cream px-5 pb-8 pt-5">
      {onBack && (
        <button type="button" aria-label="Back" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-line bg-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      )}
      <h1 className="text-[26px] font-extrabold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}
