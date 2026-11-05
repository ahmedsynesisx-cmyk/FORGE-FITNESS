import Figure from '../components/Figure';
import { Button, Card, Notice } from '../components/ui';
import { byId } from '../lib/exercises';
import { initTraining, nextKey, nextTrainingDay, planSession, trainingDays, weekday } from '../lib/plan';
import { evaluateSafety } from '../lib/safety';
import type { SessionKey } from '../lib/types';
import { today, useVault } from '../lib/vault-context';

/** What today looks like, shown at the top of Today. */
export function TrainingCard({ onStart }: { onStart: (k: SessionKey) => void }) {
  const { data } = useVault();
  const status = evaluateSafety(data.health);
  if (status === 'red') {
    return (
      <div className="flex flex-col gap-2 rounded-3xl bg-gold p-5">
        <span className="text-xs font-extrabold uppercase tracking-[0.08em]">Today's training</span>
        <strong className="text-[22px] leading-tight tracking-tight">Walking and recovery only</strong>
        <span className="text-sm font-semibold">A brisk 30-minute walk still counts toward your 150+ minutes this week.</span>
      </div>
    );
  }
  const training = data.training ?? initTraining(data);
  const sessions = data.sessions ?? [];
  const doneToday = sessions.find((s) => s.date === today());
  const key = training.active?.key ?? nextKey(sessions);
  const plan = planSession(data, training, key);
  const isDay = trainingDays(data).includes(weekday());
  const yesterday = new Date(Date.now() - 86_400_000);
  const trainedYesterday = sessions.some((s) => s.date === today(yesterday));

  return (
    <div className="flex flex-col gap-2 rounded-3xl bg-gold p-5">
      <span className="text-xs font-extrabold uppercase tracking-[0.08em]">Today's training</span>
      {training.active ? (
        <>
          <strong className="text-[22px] leading-tight tracking-tight">Workout {key} in progress</strong>
          <Button variant="dark" onClick={() => onStart(key)}>Resume workout</Button>
        </>
      ) : doneToday ? (
        <>
          <strong className="text-[22px] leading-tight tracking-tight">Workout {doneToday.key} done. Nice work.</strong>
          <span className="text-sm font-semibold">Recover, eat your protein, and walk if you feel like it. Next workout: {nextTrainingDay(data)}.</span>
        </>
      ) : isDay ? (
        <>
          <strong className="text-[22px] leading-tight tracking-tight">Workout {key} · about {plan.minutes} min</strong>
          <span className="text-sm font-semibold">{plan.items.map((i) => i.exercise.name).join(' · ')}</span>
          {trainedYesterday && <span className="text-sm">You trained yesterday. If you're still sore, a walk today is fine.</span>}
          <Button variant="dark" onClick={() => onStart(key)}>Start workout</Button>
        </>
      ) : (
        <>
          <strong className="text-[22px] leading-tight tracking-tight">Rest or walk day</strong>
          <span className="text-sm font-semibold">Next workout: {nextTrainingDay(data)} (Workout {key}). A brisk 30-minute walk today counts toward your 150+ minutes.</span>
          <button type="button" onClick={() => onStart(key)} className="min-h-[44px] self-start text-sm font-bold underline">Train today anyway</button>
        </>
      )}
    </div>
  );
}

export default function Train({ onStart }: { onStart: (k: SessionKey) => void }) {
  const { data } = useVault();
  const status = evaluateSafety(data.health);
  const training = data.training ?? initTraining(data);
  const sessions = [...(data.sessions ?? [])].reverse();
  const next = training.active?.key ?? nextKey(data.sessions);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[26px] font-extrabold tracking-tight">Train</h1>
      {status === 'red' && <Notice tone="danger" title="Workouts locked">A safety answer needs a doctor's check first. You can change this in Settings once you are cleared.</Notice>}
      <Card className="flex flex-col gap-1">
        <strong className="text-[15px]">Your week</strong>
        <span className="text-sm text-slate">Full body on {trainingDays(data).join(', ')}, alternating Workout A and B. Brisk walks on the other days. A missed day isn't made up twice: you just carry on with the next workout.</span>
      </Card>

      {(['A', 'B'] as SessionKey[]).map((k) => {
        const p = planSession(data, training, k);
        return (
          <Card key={k} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <strong className="text-[17px]">Workout {k}{k === next ? ' · next' : ''}</strong>
              <span className="text-xs text-slate">about {p.minutes} min{p.deload ? ' · lighter week' : ''}</span>
            </div>
            {p.items.map((it) => (
              <details key={it.exercise.id} className="rounded-xl border border-line p-3">
                <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                  <span className="font-bold">{it.exercise.name}</span>
                  <span className="shrink-0 font-bold text-goldink">{it.sets} × {it.exercise.mode === 'time' ? `${it.target} s` : it.target}{it.exercise.perSide ? ' each side' : ''}</span>
                </summary>
                <Figure id={it.exercise.id} label={it.exercise.name} className="mx-auto mt-2 h-32 w-full max-w-[260px] rounded-xl bg-cream" />
                <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm">{it.exercise.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                <p className="mt-1 text-xs text-slate">Tip: {it.exercise.cues}</p>
              </details>
            ))}
            {status !== 'red' && <Button variant={k === next ? 'primary' : 'outline'} onClick={() => onStart(k)}>{training.active?.key === k ? 'Resume' : 'Start'} Workout {k}</Button>}
          </Card>
        );
      })}

      <Card className="flex flex-col gap-1">
        <strong className="text-[15px]">How it gets harder</strong>
        <span className="text-sm text-slate">
          Week 1 is 2 sets per move, then 3. Every 6th week is lighter so you recover. After each move you tap how it felt. Easy, or about right twice, with every set done: the target goes up. At 12 reps you move to a harder version. If something hurts, it gets easier. Only one thing changes at a time, and every change is explained.
        </span>
      </Card>

      <div className="flex flex-col gap-2">
        <strong className="text-base">History</strong>
        {sessions.length === 0 && <p className="text-sm text-slate">No workouts yet.</p>}
        {sessions.map((s) => (
          <details key={s.id} className="rounded-2xl border border-line bg-white p-3.5 text-sm">
            <summary className="flex cursor-pointer justify-between gap-2">
              <strong>{s.date} · Workout {s.key}</strong>
              <span className="text-slate">{s.complete ? `${s.sets.length} sets` : 'ended early'}</span>
            </summary>
            <ul className="mt-2 flex flex-col gap-0.5">
              {[...new Set(s.sets.map((x) => x.exerciseId))].map((id) => (
                <li key={id}>{byId(id)?.name}: {s.sets.filter((x) => x.exerciseId === id).map((x) => x.done).join(', ')}{s.feel[id] ? ` · ${s.feel[id] === 'right' ? 'about right' : s.feel[id] === 'pain' ? 'hurt' : s.feel[id]}` : ''}</li>
              ))}
            </ul>
            {s.changes.length > 0 && <ul className="mt-2 list-disc pl-5 text-slate">{s.changes.map((c) => <li key={c}>{c}</li>)}</ul>}
          </details>
        ))}
      </div>
    </div>
  );
}
