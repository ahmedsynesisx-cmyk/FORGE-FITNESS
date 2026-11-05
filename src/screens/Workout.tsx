import { useEffect, useMemo, useRef, useState } from 'react';
import Figure from '../components/Figure';
import { Button, Card, Notice } from '../components/ui';
import { beep, keepAwake, setVoice, speak, stopSpeaking, unlockAudio, voiceOn } from '../lib/cues';
import { byId, COOLDOWN, WARMUP } from '../lib/exercises';
import { MOVE_ANIM } from '../lib/figures';
import { QUOTES } from '../lib/quotes';
import { buildSteps, initTraining, planSession, progress, type Step } from '../lib/plan';
import { EMERGENCY_MESSAGE } from '../lib/safety';
import type { ActiveSession, Feel, SessionKey, SessionLog, SetLog } from '../lib/types';
import { today, useVault } from '../lib/vault-context';

const FEELS: { id: Feel; label: string; color: string }[] = [
  { id: 'easy', label: 'Easy', color: '#16A34A' },
  { id: 'right', label: 'About right', color: '#CA8A04' },
  { id: 'hard', label: 'Hard', color: '#EA580C' },
  { id: 'pain', label: 'It hurt', color: '#DC2626' },
];

type Timer = { phase: 'idle' | 'ready' | 'run'; endsAt: number | null; pausedLeft: number | null; total: number };
const IDLE: Timer = { phase: 'idle', endsAt: null, pausedLeft: null, total: 0 };
/** Get-ready time before anything timed: room for the voice to say what's next, then 3-2-1 beeps. */
const READY_MS = 5000;

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
  const [voice, setVoiceState] = useState(voiceOn);
  const lastSec = useRef<number | null>(null);
  const exNo = (id: string) => plan.items.findIndex((i) => i.exercise.id === id) + 1;
  const moveNo = (i: number) => {
    const s = steps[i];
    return steps.slice(0, i + 1).filter((x) => x.kind === s.kind).length;
  };

  const step: Step | undefined = active ? steps[active.stepIndex] : undefined;
  const persist = (a: ActiveSession | null) => save('training', { ...training, active: a });

  // Enter a step: timed things count down by themselves; reps wait for one tap.
  const enter = (s: Step | undefined, index: number) => {
    lastSec.current = null;
    setAdjust(null);
    if (!s) return setTimer(IDLE);
    speak(announce(s, index));
    if (s.kind === 'rest') return setTimer({ phase: 'run', endsAt: Date.now() + s.seconds * 1000, pausedLeft: null, total: s.seconds * 1000 });
    const timed = s.kind !== 'work' || byId(s.exerciseId)?.mode === 'time';
    setTimer(timed ? { phase: 'ready', endsAt: Date.now() + READY_MS, pausedLeft: null, total: READY_MS } : IDLE);
  };

  // What the voice coach says when a step begins.
  const announce = (s: Step, i: number): string => {
    if (s.kind === 'rest') {
      if (s.label === 'Switch sides') return 'Switch sides.';
      const nxt = steps.slice(i + 1).find((x) => x.kind !== 'rest');
      const n = nxt ? (nxt.kind === 'work' ? `exercise ${exNo(nxt.exerciseId)} of ${plan.items.length}, ${byId(nxt.exerciseId)!.name}` : 'the cool-down') : 'finish';
      return `Rest, ${s.seconds} seconds. Next: ${n}.${s.askFeel ? ' Tap how that felt.' : ''}`;
    }
    if (s.kind !== 'work') return `${s.kind === 'warm' ? 'Warm-up' : 'Cool-down'}: ${s.name}, ${s.seconds} seconds.`;
    const e = byId(s.exerciseId)!;
    const head = s.set === 1 && !s.side ? `Exercise ${exNo(e.id)} of ${plan.items.length}. ${e.name}. ` : `${e.name}. `;
    const amount = e.mode === 'time' ? `${s.target} seconds${s.side ? `, side ${s.side}` : ''}. Get ready.` : `${s.target} reps${e.perSide ? ' each side' : ''}.`;
    return `${head}Set ${s.set} of ${s.sets}. ${amount}${e.mode === 'reps' && s.set === 1 ? ` Tip: ${e.cues}` : ''}`;
  };

  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    let release: (() => void) | undefined;
    void keepAwake().then((r) => (release = r));
    return () => { clearInterval(id); release?.(); stopSpeaking(); };
  }, [started]);

  const finish = async (a: ActiveSession, complete: boolean) => {
    const r = progress(training, a.sets, a.feel, data.health?.painAreas ?? []);
    const entry: SessionLog = { id: a.id, date: a.date, key: a.key, startedAt: a.startedAt, finishedAt: new Date().toISOString(), sets: a.sets, feel: a.feel, changes: r.changes, complete };
    await save('training', { ...r.training, active: null });
    await save('sessions', [...(data.sessions ?? []), entry]);
    for (const c of r.changes) await log('Workout plan updated', c);
    speak(complete ? 'Workout complete. Great work today.' : 'Workout saved.');
    setStarted(false);
    setSummary(entry);
  };

  const advance = async (a: ActiveSession, extra: SetLog[] = []) => {
    const next = { ...a, sets: [...a.sets, ...extra], stepIndex: a.stepIndex + 1 };
    if (next.stepIndex >= steps.length) return finish(next, true);
    setActive(next);
    enter(steps[next.stepIndex], next.stepIndex);
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
      const total = Math.round(timer.total / 1000);
      if (timer.phase === 'run' && step.kind !== 'rest' && total >= 20 && sec === Math.ceil(total / 2)) speak('Halfway. Keep going.');
    }
    if (left > 0) return;
    if (timer.phase === 'ready') {
      beep('go');
      lastSec.current = null;
      const secs = step.kind === 'work' ? step.target : step.seconds;
      if (step.kind === 'work') speak(step.set === 1 && !step.side ? `Go. ${byId(step.exerciseId)!.cues}` : 'Go.');
      else if (step.kind !== 'rest') speak(step.how);
      setTimer({ phase: 'run', endsAt: Date.now() + secs * 1000, pausedLeft: null, total: secs * 1000 });
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
    enter(steps[a.stepIndex], a.stepIndex);
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
          {plan.items.map((it, n) => (
            <details key={it.exercise.id} className="rounded-2xl border border-line bg-white p-3">
              <summary className="flex cursor-pointer items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Figure id={it.exercise.id} label={it.exercise.name} className="h-12 w-[72px] shrink-0 rounded-lg bg-cream" />
                  <strong className="text-[15px]">{n + 1}. {it.exercise.name}</strong>
                </span>
                <span className="shrink-0 text-sm font-bold text-goldink">{it.sets} × {it.exercise.mode === 'time' ? `${it.target} s` : it.target}{it.exercise.perSide ? ' each side' : ''}</span>
              </summary>
              <HowTo id={it.exercise.id} />
            </details>
          ))}
        </div>
        <Notice>Stop straight away if you feel chest pain, faintness or sharp pain. Every set should end with 1–3 reps still in the tank.</Notice>
        <Button onClick={start}>{resume ? 'Resume workout' : 'Start workout'}</Button>
        <span className="text-center text-xs text-slate">Timed moves run by themselves with beeps, and a voice coach talks you through each step. Turn your volume up. You can switch the voice off during the workout.</span>
      </Shell>
    );
  }

  // ---------- Player ----------
  const totalSec = Math.max(1, Math.round(timer.total / 1000));
  const rawLeft = timer.endsAt !== null ? Math.ceil((timer.endsAt - now) / 1000) : timer.pausedLeft !== null ? Math.ceil(timer.pausedLeft / 1000) : null;
  const left = rawLeft === null ? null : Math.max(0, Math.min(totalSec, rawLeft));
  const paused = timer.pausedLeft !== null;
  const ex = step.kind === 'work' ? byId(step.exerciseId)! : null;
  const upNext = steps.slice(active.stepIndex + 1).find((s) => s.kind !== 'rest');
  const pct = Math.round((active.stepIndex / steps.length) * 100);
  const theme = THEMES[themeOf(step, timer)];
  const demoId = step.kind === 'work' ? step.exerciseId : step.kind === 'rest' ? demoFor(upNext) : MOVE_ANIM[step.name];
  const counter =
    step.kind === 'work' ? `Exercise ${exNo(step.exerciseId)} of ${plan.items.length} · ${stepLabel(step)}`
    : step.kind === 'rest' ? (upNext ? `Up next: ${nameOf(upNext)}` : 'Last stretch coming up')
    : `${step.kind === 'warm' ? 'Warm-up' : 'Cool-down'} ${moveNo(active.stepIndex)} of ${step.kind === 'warm' ? WARMUP.length : COOLDOWN.length}`;
  const quote = QUOTES[Math.floor(now / 8000) % QUOTES.length];

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-6 pt-4 transition-colors duration-300" style={{ background: theme.bg }}>
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-label="Workout progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: theme.ring }} />
        </div>
        <button type="button" aria-label={voice ? 'Voice coach on' : 'Voice coach off'} aria-pressed={voice} onClick={() => { setVoice(!voice); setVoiceState(!voice); }} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />{voice ? <path d="M15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14" /> : <path d="M22 9l-6 6M16 9l6 6" />}
          </svg>
        </button>
        <button type="button" onClick={() => setConfirmEnd(true)} className="min-h-[44px] rounded-xl bg-white/80 px-3 text-sm font-bold text-slate">End</button>
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

      <div className="flex flex-1 flex-col items-center gap-3 pt-4 text-center">
        <span className="rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-white" style={{ background: theme.ring }}>{theme.label}</span>
        <span className="text-sm font-bold" style={{ color: theme.ink }}>{counter}</span>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{step.kind === 'work' ? ex!.name : step.kind === 'rest' ? step.label : step.name}</h1>

        {demoId && (
          <div className="w-full rounded-3xl bg-white p-2 shadow-sm">
            <Figure id={demoId} label={step.kind === 'rest' && upNext ? nameOf(upNext) : step.kind === 'work' ? ex!.name : step.kind === 'rest' ? '' : step.name} className="mx-auto h-36 w-full max-w-[300px]" />
          </div>
        )}

        <div className="relative flex h-[168px] w-[168px] items-center justify-center">
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="white" stroke="#FFFFFF" strokeWidth="10" />
            <circle cx="60" cy="60" r="52" fill="none" stroke={theme.ring} strokeOpacity="0.18" strokeWidth="10" />
            {left !== null && (
              <circle cx="60" cy="60" r="52" fill="none" stroke={theme.ring} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={RING} strokeDashoffset={RING * (1 - Math.min(1, (totalSec - left) / totalSec))} className="transition-[stroke-dashoffset] duration-300" />
            )}
            {left === null && <circle cx="60" cy="60" r="52" fill="none" stroke={theme.ring} strokeWidth="10" />}
          </svg>
          <div className="relative flex flex-col items-center">
            {left !== null ? (
              <>
                <strong aria-live="polite" data-testid="timer" className="text-[56px] font-extrabold leading-none tabular-nums" style={{ color: theme.ink }}>{left}</strong>
                <span className="text-xs font-bold text-slate">{timer.phase === 'ready' ? 'Get ready…' : paused ? 'Paused' : 'seconds'}</span>
              </>
            ) : step.kind === 'work' ? (
              <>
                <strong className="text-[56px] font-extrabold leading-none tabular-nums" style={{ color: theme.ink }}>{adjust ?? step.target}</strong>
                <span className="text-xs font-bold text-slate">reps{ex!.perSide ? ' each side' : ''}</span>
              </>
            ) : null}
          </div>
        </div>

        {step.kind === 'rest' && step.askFeel && (
          <div className="flex w-full flex-col gap-2" role="group" aria-label={`How did ${byId(step.askFeel)!.name} feel?`}>
            <span className="text-sm font-bold">How did {byId(step.askFeel)!.name} feel?</span>
            <div className="grid grid-cols-4 gap-1.5">
              {FEELS.map((f) => (
                <button key={f.id} type="button" aria-pressed={active.feel[step.askFeel!] === f.id} onClick={() => void setFeel(step.askFeel!, f.id)}
                  className="min-h-[48px] rounded-xl border-2 px-1 text-[13px] font-bold"
                  style={active.feel[step.askFeel!] === f.id ? { background: f.color, borderColor: f.color, color: '#fff' } : { background: '#fff', borderColor: f.color, color: f.color }}>
                  {f.label}
                </button>
              ))}
            </div>
            {active.feel[step.askFeel] === 'pain' && <span className="text-xs text-danger">Noted. Next time it will be an easier version.</span>}
          </div>
        )}

        {step.kind === 'work' && (
          <details className="w-full rounded-2xl bg-white/80 p-3 text-left">
            <summary className="cursor-pointer text-sm font-bold text-goldink">How to do it</summary>
            <HowTo id={ex!.id} />
          </details>
        )}
        {(step.kind === 'warm' || step.kind === 'cool') && <p className="max-w-xs text-sm text-slate">{step.how}</p>}

        <p key={quote} className="fade-in min-h-[40px] max-w-xs text-[15px] font-semibold italic" style={{ color: theme.ink }}>“{quote}”</p>
      </div>

      <div className="flex flex-col gap-2 pt-2">
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
            <Button variant="outline" onClick={() => setTimer((t) => ({ ...t, endsAt: (t.endsAt ?? Date.now()) + 30_000, total: t.total + 30_000 }))}>+30 s</Button>
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

const RING = 2 * Math.PI * 52;
type ThemeId = 'ready' | 'work' | 'reps' | 'rest' | 'warm' | 'cool';
const THEMES: Record<ThemeId, { bg: string; ring: string; ink: string; label: string }> = {
  ready: { bg: '#FFEFB0', ring: '#E0A800', ink: '#7A5600', label: 'Get ready' },
  work: { bg: '#FBD9D9', ring: '#DC2626', ink: '#A51C1C', label: 'Hold it' },
  reps: { bg: '#FFE3CC', ring: '#EA580C', ink: '#9A3A08', label: 'Your set' },
  rest: { bg: '#D4F0DD', ring: '#16A34A', ink: '#14653A', label: 'Rest' },
  warm: { bg: '#FFE3CC', ring: '#F97316', ink: '#9A3A08', label: 'Warm-up' },
  cool: { bg: '#DAE6FC', ring: '#2563EB', ink: '#1E40AF', label: 'Cool-down' },
};
function themeOf(s: Step, t: Timer): ThemeId {
  if (t.phase === 'ready') return 'ready';
  if (s.kind === 'rest') return 'rest';
  if (s.kind !== 'work') return s.kind;
  return byId(s.exerciseId)?.mode === 'time' ? 'work' : 'reps';
}
const nameOf = (s: Step) => (s.kind === 'work' ? byId(s.exerciseId)!.name : s.kind === 'rest' ? s.label : s.name);
const demoFor = (s: Step | undefined) => (!s ? undefined : s.kind === 'work' ? s.exerciseId : s.kind === 'rest' ? undefined : MOVE_ANIM[s.name]);

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
