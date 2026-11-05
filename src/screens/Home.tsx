import { useState } from 'react';
import { Button, Card, Choices, Field, Notice, num } from '../components/ui';
import { LIMITS, bmi, bmiCategoryIndia, bmiCategoryWHO, inRange, lossTimeline, proteinTargetG, round1, waistToHeight } from '../lib/body';
import { evaluateSafety } from '../lib/safety';
import type { Measurement, Pacing, SessionKey } from '../lib/types';
import { today, useVault } from '../lib/vault-context';
import { PACES } from './Onboarding';
import Settings from './Settings';
import Train, { TrainingCard } from './Train';
import Workout from './Workout';

type Tab = 'today' | 'train' | 'body' | 'settings';

export default function Home() {
  const [tab, setTab] = useState<Tab>('today');
  const [workout, setWorkout] = useState<SessionKey | null>(null);
  if (workout) return <Workout sessionKey={workout} onExit={() => { setWorkout(null); setTab('today'); window.scrollTo(0, 0); }} />;
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-cream">
      <div className="flex-1 px-5 pb-28 pt-6">
        {tab === 'today' && <Today goBody={() => setTab('body')} onStart={setWorkout} />}
        {tab === 'train' && <Train onStart={setWorkout} />}
        {tab === 'body' && <Body />}
        {tab === 'settings' && <Settings />}
      </div>
      <nav aria-label="Main" className="fixed bottom-0 left-1/2 grid w-full max-w-md -translate-x-1/2 grid-cols-4 border-t border-line bg-white px-3 pb-5 pt-2">
        {([
          ['today', 'Today', 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z'],
          ['train', 'Train', 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12'],
          ['body', 'Body', 'M4 19V5M4 19h16M8 15l4-4 3 3 5-6'],
          ['settings', 'Settings', 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z'],
        ] as [Tab, string, string][]).map(([id, label, d]) => (
          <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} className={`flex flex-col items-center gap-1 text-[11px] ${tab === id ? 'font-extrabold text-charcoal' : 'font-bold text-slate'}`}>
            <span className={`flex h-[30px] w-11 items-center justify-center rounded-[10px] ${tab === id ? 'bg-gold' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
            </span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function weeklyAverages(ms: Measurement[], now = today()) {
  const day = (s: string) => Math.floor(Date.parse(s + 'T00:00:00Z') / 86_400_000);
  const n = day(now);
  const avg = (from: number, to: number) => {
    const w = ms.filter((m) => m.weightKg !== undefined && day(m.date) > n - to && day(m.date) <= n - from).map((m) => m.weightKg!);
    return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
  };
  return { thisWeek: avg(0, 7), lastWeek: avg(7, 14) };
}

function Today({ goBody, onStart }: { goBody: () => void; onStart: (k: SessionKey) => void }) {
  const { data, save } = useVault();
  const p = data.profile!, g = data.goals!;
  const ms = data.measurements ?? [];
  const status = evaluateSafety(data.health);
  const latest = [...ms].filter((m) => m.weightKg !== undefined).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const weight = latest?.weightKg ?? p.weightKg;
  const b = bmi(weight, p.heightCm);
  const { thisWeek, lastWeek } = weeklyAverages(ms);
  const tl = g.targetWeightKg ? lossTimeline(thisWeek ?? weight, g.targetWeightKg, g.pacing) : null;
  const [w, setW] = useState('');
  const wn = num(w);
  const wErr = w && !inRange(wn, LIMITS.weightKg) ? 'Between 30 and 250 kg.' : null;
  const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const loggedToday = ms.some((m) => m.date === today() && m.weightKg !== undefined);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <span className="text-[13px] font-semibold text-slate">{dateLabel}</span>
        <h1 className="text-[26px] font-extrabold tracking-tight">Hello{p.name ? `, ${p.name}` : ''}</h1>
      </div>

      {status === 'red' && <Notice tone="danger" title="Workouts locked">A safety answer needs a doctor's check first. You can change this in Settings once you are cleared.</Notice>}

      <TrainingCard onStart={onStart} />

      {tl && (
        <Card className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.06em] text-slate">Your goal · {PACES.find((x) => x.id === g.pacing)!.name} pace</span>
          <strong className="text-2xl tabular-nums">{round1(thisWeek ?? weight)} → {g.targetWeightKg} kg</strong>
          <span className="text-xs text-slate">About {round1(tl.weeklyKg)} kg a week, so roughly {tl.weeksMin}–{tl.weeksMax} weeks. An estimate, not a promise: weekly averages and your waist show real progress. Change pace in Settings.</span>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Card className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.06em] text-slate">Weight · 7-day avg</span>
          <strong className="text-2xl tabular-nums">{thisWeek !== null ? `${round1(thisWeek)} kg` : `${weight} kg`}</strong>
          <span className={`text-xs font-bold ${lastWeek !== null && thisWeek !== null && thisWeek < lastWeek ? 'text-good' : 'text-slate'}`}>
            {lastWeek !== null && thisWeek !== null ? `${thisWeek - lastWeek <= 0 ? '−' : '+'}${Math.abs(round1(thisWeek - lastWeek))} kg vs last week` : 'Weigh in 3 mornings a week'}
          </span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.06em] text-slate">Protein target</span>
          <strong className="text-2xl tabular-nums">{proteinTargetG(weight)} g</strong>
          <span className="text-xs text-slate">a day · estimate, 1.6 g/kg</span>
        </Card>
        <Card className="col-span-2 flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.06em] text-slate">BMI</span>
          <strong className="text-2xl tabular-nums">{b !== null ? b.toFixed(1) : "—"}</strong>
          {b !== null && <span className="text-xs text-slate">WHO: {bmiCategoryWHO(b)} · Indian cut-offs: {bmiCategoryIndia(b)}. A screening number only: it does not measure fat or muscle.</span>}
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <strong className="text-[15px]">{loggedToday ? "Today's weight is logged" : "Log this morning's weight"}</strong>
        {!loggedToday && (
          <>
            <Field label="Weight (kg)" type="number" inputMode="decimal" value={w} onChange={setW} error={wErr} />
            <Button disabled={wn === null || !!wErr} onClick={async () => { await save('measurements', [...ms, { id: crypto.randomUUID(), date: today(), weightKg: wn! }]); setW(''); }}>Save weight</Button>
          </>
        )}
        <button type="button" onClick={goBody} className="min-h-[44px] rounded-xl border-[1.5px] border-line text-sm font-bold">Add waist and other measurements</button>
      </Card>

    </div>
  );
}

const GUIDE: { key: keyof Measurement; label: string; how: string }[] = [
  { key: 'waistCm', label: 'Waist (cm)', how: 'Stand relaxed, breathe out normally. Tape level, midway between the bottom rib and the top of the hip bone (roughly at the navel). Snug, not pressing.' },
  { key: 'hipCm', label: 'Hip (cm)', how: 'Feet together. Tape around the widest part of the buttocks, level all the way round.' },
  { key: 'chestCm', label: 'Chest (cm)', how: 'Arms relaxed at the sides. Tape around the fullest part of the chest, under the armpits, after a normal breath out.' },
  { key: 'armCm', label: 'Upper arm (cm)', how: 'Arm hanging relaxed. Tape around the midpoint between shoulder tip and elbow. Same arm every time.' },
  { key: 'thighCm', label: 'Thigh (cm)', how: 'Standing, weight on both legs. Tape around the thigh just below the buttock crease. Same leg every time.' },
  { key: 'neckCm', label: 'Neck (cm)', how: 'Looking straight ahead, tape just below the Adam’s apple, sloping slightly down at the front.' },
];

function Body() {
  const { data, save } = useVault();
  const p = data.profile!;
  // Newest first; entries from the same day keep the most recently saved on top.
  const ms = (data.measurements ?? []).map((m, i) => ({ m, i })).sort((a, b) => b.m.date.localeCompare(a.m.date) || b.i - a.i).map((x) => x.m);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [date, setDate] = useState(today());
  const [msg, setMsg] = useState<string | null>(null);
  const parsed = Object.fromEntries(Object.entries(vals).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, num(v)]));
  const errs = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, k === 'weightKg' ? !inRange(v, LIMITS.weightKg) : !inRange(v, LIMITS.circumferenceCm)]));
  const any = Object.keys(parsed).length > 0;
  const valid = any && !Object.values(errs).some(Boolean) && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today();
  const lastWaist = ms.find((m) => m.waistCm !== undefined);
  const whtr = lastWaist ? waistToHeight(lastWaist.waistCm!, p.heightCm) : null;
  const use = (m: Measurement) => {
    const next: Record<string, string> = {};
    for (const k of ['weightKg', ...GUIDE.map((g) => g.key)] as (keyof Measurement)[]) if (typeof m[k] === 'number') next[k] = String(m[k]);
    setVals(next);
    setDate(today());
    setMsg(`Filled in from ${m.date}. Change any number that's different, then save.`);
    document.getElementById('new-measurement')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const progress = (['weightKg', ...GUIDE.map((g) => g.key)] as (keyof Measurement)[]).flatMap((k) => {
    const withK = [...ms].filter((m) => typeof m[k] === 'number').reverse();
    if (withK.length < 2) return [];
    const first = withK[0], last = withK.at(-1)!;
    const d = round1((last[k] as number) - (first[k] as number));
    return [{ k, label: k === 'weightKg' ? 'Weight (kg)' : GUIDE.find((g) => g.key === k)!.label, first, last, d }];
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[26px] font-extrabold tracking-tight">Body</h1>
      {whtr !== null && (
        <Card className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.06em] text-slate">Waist-to-height</span>
          <strong className="text-2xl tabular-nums">{whtr.toFixed(2)}</strong>
          <span className="text-xs text-slate">From {lastWaist!.waistCm} cm on {lastWaist!.date}. Waist is your main progress measure: lower over time is the aim.</span>
        </Card>
      )}
      {progress.length > 0 && (
        <Card className="flex flex-col gap-2">
          <strong className="text-[15px]">Progress so far</strong>
          {progress.map((x) => (
            <div key={x.k} className="flex items-baseline justify-between gap-2 text-sm">
              <span>{x.label.replace(/ \((cm|kg)\)/, '')}</span>
              <span className="text-right tabular-nums">
                {x.first[x.k] as number} → {x.last[x.k] as number}{' '}
                <strong className={x.d < 0 ? 'text-good' : 'text-slate'}>({x.d > 0 ? '+' : x.d < 0 ? '−' : '±'}{Math.abs(x.d)})</strong>
              </span>
            </div>
          ))}
          <span className="text-xs text-slate">First entry vs latest. For waist, lower is the aim.</span>
        </Card>
      )}
      <Card className="flex flex-col gap-3">
        <strong id="new-measurement" className="scroll-mt-4 text-[15px]">New measurement</strong>
        <Field label="Date" value={date} onChange={setDate} hint="YYYY-MM-DD" error={!/^\d{4}-\d{2}-\d{2}$/.test(date) ? `Write the date like ${today()}.` : date > today() ? 'Date cannot be in the future.' : null} />
        <Field label="Weight (kg)" type="number" inputMode="decimal" value={vals.weightKg ?? ''} onChange={(v) => { setVals({ ...vals, weightKg: v }); setMsg(null); }} error={errs.weightKg ? 'Between 30 and 250 kg.' : null} />
        {GUIDE.map((g) => (
          <div key={g.key} className="flex flex-col gap-1">
            <Field label={g.label} type="number" inputMode="decimal" value={vals[g.key] ?? ''} onChange={(v) => { setVals({ ...vals, [g.key]: v }); setMsg(null); }} error={errs[g.key] ? 'Between 15 and 250 cm.' : null} />
            <details className="text-xs text-slate">
              <summary className="cursor-pointer py-1 font-bold text-goldink">How to measure</summary>
              <p className="pt-1 leading-relaxed">{g.how}</p>
            </details>
          </div>
        ))}
        <Notice>Same time of day, same tape, same spot. Every 2 weeks is enough; small changes are often just water.</Notice>
        <Button disabled={!valid} onClick={async () => { await save('measurements', [...(data.measurements ?? []), { id: crypto.randomUUID(), date, ...(parsed as Partial<Measurement>) }]); setVals({}); setMsg('Saved. See it under History below.'); }}>Save measurement</Button>
        {!valid && (
          <span className="text-sm text-slate">
            {!any ? 'Enter at least one measurement to save.' : 'Fix the box marked in red to save.'}
          </span>
        )}
        {msg && <span role="status" className="text-sm font-bold text-good">{msg}</span>}
      </Card>

      <div className="flex flex-col gap-2">
        <strong className="text-base">History</strong>
        {ms.length === 0 && <p className="text-sm text-slate">No measurements yet.</p>}
        {ms.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-white p-3.5 text-sm">
            <div className="flex flex-col gap-0.5">
              <strong>{m.date}</strong>
              <span className="text-slate">
                {[m.weightKg && `${m.weightKg} kg`, m.waistCm && `waist ${m.waistCm}`, m.hipCm && `hip ${m.hipCm}`, m.chestCm && `chest ${m.chestCm}`, m.armCm && `arm ${m.armCm}`, m.thighCm && `thigh ${m.thighCm}`, m.neckCm && `neck ${m.neckCm}`].filter(Boolean).join(' · ')}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <button type="button" aria-label={`Use numbers from ${m.date}`} onClick={() => use(m)} className="min-h-[44px] rounded-lg bg-butter px-3 text-xs font-bold text-goldink">Use these</button>
              <button type="button" aria-label={`Delete measurement from ${m.date}`} onClick={() => { if (confirm(`Delete the measurement from ${m.date}?`)) save('measurements', (data.measurements ?? []).filter((x) => x.id !== m.id)); }} className="min-h-[44px] rounded-lg px-3 text-xs font-bold text-danger">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PaceChanger() {
  const { data, save, log } = useVault();
  const g = data.goals!;
  return (
    <Choices
      label="Pace"
      options={PACES.map((p) => ({ value: p.id, label: p.name }))}
      value={g.pacing}
      onChange={async (v: Pacing) => {
        if (v === g.pacing) return;
        await save('goals', { ...g, pacing: v, setAt: new Date().toISOString() });
        await log(`Pace changed from ${g.pacing} to ${v}`, 'You changed it in Settings. Targets and estimates were recalculated.');
      }}
    />
  );
}
