import { useEffect, useRef, useState } from 'react';
import { ANIMS, joints, mix, phase, type Anim, type Prop, type V } from '../lib/figures';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Animated side-view demo of a move. `id` is an exercise id or a warm-up animation key. */
export default function Figure({ id, className = '', label }: { id: string; className?: string; label: string }) {
  const anim: Anim | undefined = ANIMS[id];
  const [t, setT] = useState(0);
  const start = useRef(performance.now());
  useEffect(() => {
    if (!anim || reduced()) return;
    let raf = 0;
    const tick = (now: number) => {
      setT(phase((now - start.current) / 1000, anim));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anim]);
  if (!anim) return null;
  const j = joints(mix(anim.a, anim.b, t));
  const line = (pts: V[], w: number, c: string) => <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
  const far = '#C9C2AF';
  const ink = '#1C1C1E';
  return (
    <svg viewBox="0 0 160 110" role="img" aria-label={`Demo: ${label}`} className={className}>
      <rect x="0" y="100" width="160" height="10" rx="2" fill="#ECE7D8" />
      {anim.props?.map((p) => <PropShape key={p} p={p} />)}
      {line([j.shoulder, j.elbow2, j.hand2], 6, far)}
      {line([j.hip, j.knee2, j.ankle2, j.toe2], 7, far)}
      {line([j.hip, j.knee, j.ankle, j.toe], 7.5, ink)}
      {line([j.hip, j.shoulder], 13, '#F2B705')}
      <circle cx={j.head[0]} cy={j.head[1]} r="7.5" fill={ink} />
      {line([j.shoulder, j.elbow, j.hand], 6.5, ink)}
    </svg>
  );
}

function PropShape({ p }: { p: Prop }) {
  const c = '#E3D9BC';
  if (p === 'wall') return <rect x="124" y="4" width="8" height="96" rx="2" fill={c} />;
  if (p === 'bed-right') return <rect x="100" y="80" width="58" height="20" rx="4" fill={c} />;
  if (p === 'bed-left') return <rect x="2" y="80" width="44" height="20" rx="4" fill={c} />;
  return (
    <g fill={c}>
      <rect x="22" y="80" width="52" height="5" rx="2" />
      <rect x="22" y="44" width="5" height="56" rx="2" />
      <rect x="68" y="84" width="4" height="16" />
    </g>
  );
}
