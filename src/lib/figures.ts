// Side-view demo figures. Each move is two key poses; the player eases between them.
// Coordinates: viewBox 0 0 160 110, figure faces right, floor at y = 100.
export type V = [number, number];
export type Limb = { t: V; bend: 1 | -1 } | { a: [number, number] };
export type Prop = 'wall' | 'bed-right' | 'bed-left' | 'chair-left';
export interface Pose { hip: V; torso: number; arm: Limb; arm2?: Limb; leg: Limb; leg2?: Limb }
export interface Anim { a: Pose; b: Pose; props?: Prop[]; /** seconds for a full A→B→A cycle */ period?: number; /** fraction of the cycle held at B */ holdB?: number }

export const L = { torso: 34, neck: 5, head: 7.5, ua: 17, fa: 16, th: 22, sh: 21 };
const LEG = L.th + L.sh;
const rad = (d: number) => (d * Math.PI) / 180;
const add = (p: V, len: number, deg: number): V => [p[0] + len * Math.cos(rad(deg)), p[1] + len * Math.sin(rad(deg))];

/** Straight body from the ankles at `beta` degrees above the floor (plank-like positions). */
function body(ankle: V, beta: number) {
  return { hip: add(ankle, LEG, -beta), torso: -beta, leg: { t: ankle, bend: -1 as const } };
}
/** Straight line from the knees (knee push-up, kneeling side plank); shins lie on the floor behind. */
function kneeBody(knee: V, beta: number) {
  return { hip: add(knee, L.th, -beta), torso: -beta, leg: { a: [180 - beta, 180] as [number, number] } };
}
const STAND: Pose = { hip: [80, 55], torso: -90, arm: { a: [92, 90] }, leg: { t: [80, 98], bend: -1 } };
const down = { a: [92, 90] as [number, number] };

const pushup = (ankle: V, betaUp: number, betaDown: number, hand: V, props?: Prop[]): Anim => ({
  a: { ...body(ankle, betaUp), arm: { t: hand, bend: 1 } },
  b: { ...body(ankle, betaDown), arm: { t: hand, bend: 1 } },
  props,
});

const lyingBack = (hipY: number, torso: number): Pick<Pose, 'hip' | 'torso' | 'arm'> => ({ hip: [78, hipY], torso, arm: { a: [8, 2] } });
const prone = (lift: number): Pose => ({ hip: [52, 94], torso: -lift, arm: { a: [-lift * 2, -lift * 2] }, leg: { a: [180, 180] } });
const march = (near: boolean): Pose => ({
  hip: [80, 55], torso: -90,
  arm: { a: near ? [60, 20] : [120, 100] }, arm2: { a: near ? [120, 100] : [60, 20] },
  leg: near ? { a: [0, 90] } : { t: [80, 98], bend: -1 }, leg2: near ? { t: [80, 98], bend: -1 } : { a: [0, 90] },
});

const P = (a: Pose, b: Pose, extra: Partial<Anim> = {}): Anim => ({ a, b, ...extra });

export const ANIMS: Record<string, Anim> = {
  'wall-pushup': P(
    { ...body([62, 98], 68), arm: { t: [122, 30], bend: 1 } },
    { ...body([62, 98], 55), arm: { t: [122, 30], bend: 1 } },
    { props: ['wall'] },
  ),
  'incline-pushup': pushup([50, 98], 42.5, 27, [110, 78], ['bed-right']),
  'knee-pushup': P({ ...kneeBody([56, 97], 34.8), arm: { t: [104, 98], bend: 1 } }, { ...kneeBody([56, 97], 11.3), arm: { t: [104, 98], bend: 1 } }),
  pushup: pushup([28, 96], 23.7, 7.5, [102, 98]),
  'decline-pushup': pushup([30, 76], 8.2, -7.5, [108, 98], ['bed-left']),
  'pike-pushup': P(
    { hip: [62, 58], torso: 39.8, arm: { t: [110, 98], bend: -1 }, leg: { t: [44, 98], bend: -1 } },
    { hip: [68, 60], torso: 58, arm: { t: [110, 98], bend: -1 }, leg: { t: [44, 98], bend: -1 } },
  ),
  'sit-to-stand': P(
    { hip: [60, 75], torso: -72, arm: { a: [15, 5] }, leg: { t: [84, 98], bend: -1 } },
    { hip: [80, 55], torso: -88, arm: { a: [15, 5] }, leg: { t: [84, 98], bend: -1 } },
    { props: ['chair-left'] },
  ),
  squat: P(
    { ...STAND, hip: [76, 55], arm: { a: [80, 85] }, leg: { t: [80, 98], bend: -1 } },
    { hip: [62, 80], torso: -55, arm: { a: [0, 0] }, leg: { t: [80, 98], bend: -1 } },
  ),
  'split-squat': P(
    { hip: [76, 62], torso: -90, arm: down, leg: { t: [100, 98], bend: -1 }, leg2: { t: [52, 96], bend: -1 } },
    { hip: [76, 80], torso: -90, arm: down, leg: { t: [100, 98], bend: -1 }, leg2: { t: [52, 96], bend: -1 } },
  ),
  'reverse-lunge': P(
    { hip: [80, 55], torso: -90, arm: down, leg: { t: [84, 98], bend: -1 }, leg2: { t: [80, 98], bend: -1 } },
    { hip: [66, 78], torso: -86, arm: down, leg: { t: [84, 98], bend: -1 }, leg2: { t: [36, 96], bend: -1 } },
  ),
  'bulgarian-split-squat': P(
    { hip: [78, 60], torso: -88, arm: down, leg: { t: [100, 98], bend: -1 }, leg2: { t: [42, 76], bend: -1 } },
    { hip: [76, 80], torso: -84, arm: down, leg: { t: [100, 98], bend: -1 }, leg2: { t: [42, 76], bend: -1 } },
    { props: ['chair-left'] },
  ),
  'glute-bridge': P(
    { ...lyingBack(93, 180), leg: { t: [102, 98], bend: -1 } },
    { ...lyingBack(73, 147), leg: { t: [102, 98], bend: -1 } },
  ),
  'single-leg-bridge': P(
    { ...lyingBack(93, 180), leg: { a: [-35, -35] }, leg2: { t: [102, 98], bend: -1 } },
    { ...lyingBack(73, 147), leg: { a: [-33, -33] }, leg2: { t: [102, 98], bend: -1 } },
  ),
  'shoulders-up-hip-thrust': P(
    { hip: [62, 90], torso: 219, arm: { a: [175, 180] }, leg: { a: [-55, -10] }, leg2: { t: [96, 98], bend: -1 } },
    { hip: [72, 74], torso: 176, arm: { a: [175, 180] }, leg: { a: [-4, -4] }, leg2: { t: [96, 98], bend: -1 } },
    { props: ['bed-left'] },
  ),
  'prone-y-t': P(prone(0), { ...prone(0), arm: { a: [-16, -16] } }),
  'prone-swimmer': P(prone(0), { ...prone(9), arm: { a: [-22, -22] } }),
  'dead-bug': P(
    { hip: [84, 93], torso: 180, arm: { a: [-90, -90] }, leg: { a: [-90, 0] } },
    { hip: [84, 93], torso: 180, arm: { a: [-160, -168] }, arm2: { a: [-90, -90] }, leg: { a: [-90, 0] }, leg2: { a: [-8, -4] } },
  ),
  plank: P({ ...body([26, 96], 12), arm: { a: [90, 0] } }, { ...body([26, 96], 13), arm: { a: [92, 0] } }, { period: 3 }),
  'shoulder-tap-plank': P(
    { ...body([26, 96], 23.7), arm: { t: [99, 98], bend: 1 }, arm2: { t: [99, 98], bend: 1 } },
    { ...body([26, 96], 23.7), arm: { t: [94, 70], bend: 1 }, arm2: { t: [99, 98], bend: 1 } },
  ),
  'knee-side-plank': P(
    { ...kneeBody([56, 97], 6), hip: [77, 96], arm: { a: [-90, -90] }, arm2: { a: [90, 0] } },
    { ...kneeBody([56, 97], 12), arm: { a: [-90, -90] }, arm2: { a: [90, 0] } },
    { period: 3 },
  ),
  'side-plank': P(
    { ...body([26, 96], 9), hip: [68, 92], arm: { a: [-90, -90] }, arm2: { a: [90, 0] } },
    { ...body([26, 96], 12), arm: { a: [-90, -90] }, arm2: { a: [90, 0] } },
    { period: 3 },
  ),
  // Warm-up and cool-down
  march: P(march(true), march(false), { period: 1.4 }),
  'arm-circles': P({ ...STAND, arm: { a: [-100, -100] } }, { ...STAND, arm: { a: [60, 60] } }, { period: 1.6 }),
  'hip-circles': P(
    { ...STAND, hip: [75, 55], torso: -96, arm: { a: [115, 25] } },
    { ...STAND, hip: [85, 55], torso: -84, arm: { a: [115, 25] } },
  ),
  'easy-squat': P({ ...STAND, arm: { a: [70, 60] } }, { hip: [70, 68], torso: -70, arm: { a: [10, 0] }, leg: { t: [80, 98], bend: -1 } }),
  'hip-hinge': P({ ...STAND }, { hip: [70, 57], torso: -22, arm: { a: [80, 85] }, leg: { t: [80, 98], bend: -1 } }),
  'chest-stretch': P(
    { ...STAND, arm: { a: [180, -90] }, arm2: down },
    { ...STAND, hip: [83, 55], torso: -84, arm: { a: [184, -90] }, arm2: down },
    { period: 4 },
  ),
  'hip-flexor': P(
    { hip: [74, 84], torso: -90, arm: { a: [100, 20] }, leg: { t: [100, 98], bend: -1 }, leg2: { a: [144, 180] } },
    { hip: [78, 86], torso: -82, arm: { a: [100, 20] }, leg: { t: [100, 98], bend: -1 }, leg2: { a: [140, 180] } },
    { period: 4 },
  ),
  hamstring: P(
    { hip: [72, 57], torso: -90, arm: down, leg: { t: [98, 98], bend: -1 }, leg2: { t: [66, 98], bend: -1 } },
    { hip: [66, 59], torso: -42, arm: { a: [70, 70] }, leg: { t: [98, 98], bend: -1 }, leg2: { t: [66, 98], bend: -1 } },
    { period: 4 },
  ),
};
ANIMS['incline-pike'] = ANIMS['pike-pushup'];
// Side view can't show a sideways arm sweep, so the snow angel uses the slow version of the lying arm lift.
ANIMS['reverse-snow-angel'] = { ...ANIMS['prone-y-t'], period: 3.2 };
ANIMS['pause-squat'] = { ...ANIMS.squat, holdB: 0.35, period: 3.6 };

/** Which demo a warm-up or cool-down move uses. */
export const MOVE_ANIM: Record<string, string> = {
  'March on the spot': 'march',
  'Arm circles': 'arm-circles',
  'Hip circles': 'hip-circles',
  'Easy squats': 'easy-squat',
  'Hip hinge reach': 'hip-hinge',
  'Slow walk and deep breaths': 'march',
  'Chest stretch in a doorway': 'chest-stretch',
  'Hip flexor stretch': 'hip-flexor',
  'Hamstring stretch': 'hamstring',
};

// ---------- geometry ----------
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
function lerpLimb(a: Limb, b: Limb, t: number): Limb {
  if ('t' in a && 't' in b) return { t: lerpV(a.t, b.t, t), bend: a.bend };
  if ('a' in a && 'a' in b) return { a: [lerp(a.a[0], b.a[0], t), lerp(a.a[1], b.a[1], t)] };
  return t < 0.5 ? a : b;
}
export function mix(a: Pose, b: Pose, t: number): Pose {
  return {
    hip: lerpV(a.hip, b.hip, t), torso: lerp(a.torso, b.torso, t),
    arm: lerpLimb(a.arm, b.arm, t), arm2: lerpLimb(a.arm2 ?? a.arm, b.arm2 ?? b.arm, t),
    leg: lerpLimb(a.leg, b.leg, t), leg2: lerpLimb(a.leg2 ?? a.leg, b.leg2 ?? b.leg, t),
  };
}

/** Two-segment limb: fixed angles, or reach a target point (simple inverse kinematics). */
function solve(start: V, limb: Limb, l1: number, l2: number): [V, V] {
  if ('a' in limb) {
    const j = add(start, l1, limb.a[0]);
    return [j, add(j, l2, limb.a[1])];
  }
  const dx = limb.t[0] - start[0], dy = limb.t[1] - start[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const phi = (Math.atan2(dy, dx) * 180) / Math.PI;
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const alpha = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  const j = add(start, l1, phi + limb.bend * alpha);
  return [j, add(start, d, phi)];
}

export interface Joints { hip: V; shoulder: V; head: V; elbow: V; hand: V; elbow2: V; hand2: V; knee: V; ankle: V; toe: V; knee2: V; ankle2: V; toe2: V }
export function joints(p: Pose): Joints {
  const shoulder = add(p.hip, L.torso, p.torso);
  const head = add(shoulder, L.neck + L.head, p.torso);
  const [elbow, hand] = solve(shoulder, p.arm, L.ua, L.fa);
  const [elbow2, hand2] = solve(shoulder, p.arm2 ?? p.arm, L.ua, L.fa);
  const [knee, ankle] = solve(p.hip, p.leg, L.th, L.sh);
  const [knee2, ankle2] = solve(p.hip, p.leg2 ?? p.leg, L.th, L.sh);
  const foot = (k: V, an: V) => add(an, 7, (Math.atan2(an[1] - k[1], an[0] - k[0]) * 180) / Math.PI - 90);
  return { hip: p.hip, shoulder, head, elbow, hand, elbow2, hand2, knee, ankle, toe: foot(knee, ankle), knee2, ankle2, toe2: foot(knee2, ankle2) };
}

/** Smooth back-and-forth: 0 → 1 → 0 over one period, with an optional hold at the end position. */
export function phase(seconds: number, anim: Anim) {
  const period = anim.period ?? 2.4;
  const hold = anim.holdB ?? 0.12;
  const x = (seconds % period) / period;
  const move = (1 - hold) / 2;
  const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;
  if (x < move) return ease(x / move);
  if (x < move + hold) return 1;
  return 1 - ease((x - move - hold) / move);
}
