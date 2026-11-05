// Sound and vibration cues for the workout player. Everything fails quietly: a missing API must never break a workout.
let ctx: AudioContext | null = null;

/** Call from a tap (Start / Resume) so the browser allows sound afterwards. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function beep(kind: 'tick' | 'go' | 'end' = 'tick') {
  try {
    if (ctx) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = kind === 'tick' ? 660 : kind === 'go' ? 990 : 880;
      const len = kind === 'tick' ? 0.12 : 0.45;
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + len);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + len);
    }
    navigator.vibrate?.(kind === 'tick' ? 80 : 300);
  } catch {
    /* no sound available */
  }
}

/** Keeps the screen on during a workout where the browser supports it. */
export async function keepAwake(): Promise<() => void> {
  let lock: { release: () => Promise<void> } | null = null;
  const req = async () => {
    try {
      lock = await (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null;
    } catch {
      lock = null;
    }
  };
  const onVis = () => { if (document.visibilityState === 'visible') void req(); };
  await req();
  document.addEventListener('visibilitychange', onVis);
  return () => {
    document.removeEventListener('visibilitychange', onVis);
    void lock?.release().catch(() => undefined);
  };
}
