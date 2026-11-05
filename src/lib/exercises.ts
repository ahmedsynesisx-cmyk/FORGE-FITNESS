import type { BodyArea } from './types';

export type Pattern = 'push' | 'overhead' | 'squat' | 'lunge' | 'hinge' | 'pull' | 'core-front' | 'core-side';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  /** 1 = easiest in its chain. */
  level: number;
  mode: 'reps' | 'time';
  perSide?: boolean;
  muscles: string;
  steps: string[];
  cues: string;
  mistakes: string;
  /** Pain areas that rule this exercise out. */
  avoidIf: BodyArea[];
  needs?: 'chair' | 'bed';
}

const E = (e: Exercise) => e;

/** Bodyweight-only library, ordered easiest → hardest within each pattern. */
export const EXERCISES: Exercise[] = [
  // Horizontal push
  E({ id: 'wall-pushup', name: 'Wall push-up', pattern: 'push', level: 1, mode: 'reps', muscles: 'Chest, shoulders, triceps', avoidIf: ['wrist'],
    steps: ['Stand an arm\'s length from a wall, hands on it at chest height, a little wider than shoulders.', 'Keep a straight line from head to heels.', 'Bend your elbows to bring your chest towards the wall.', 'Push back to straight arms.'],
    cues: 'Elbows about 45° from your body, not flared out.', mistakes: 'Hips sagging; only moving the head.' }),
  E({ id: 'incline-pushup', name: 'Incline push-up', pattern: 'push', level: 2, mode: 'reps', needs: 'bed', muscles: 'Chest, shoulders, triceps', avoidIf: ['wrist'],
    steps: ['Hands on a sturdy bed edge or table, slightly wider than shoulders.', 'Walk your feet back until your body is a straight plank.', 'Lower your chest to the edge with control.', 'Push away until your arms are straight.'],
    cues: 'Squeeze your bottom so the hips stay in line.', mistakes: 'Using a surface that can slide.' }),
  E({ id: 'knee-pushup', name: 'Knee push-up', pattern: 'push', level: 3, mode: 'reps', muscles: 'Chest, shoulders, triceps', avoidIf: ['wrist', 'knee'],
    steps: ['Kneel with hands under shoulders, a little wider.', 'Lean forward so knees, hips and shoulders form a straight line.', 'Lower your chest to a fist-height above the floor.', 'Push back up.'],
    cues: 'Fold a towel under your knees.', mistakes: 'Sticking the bottom up in the air.' }),
  E({ id: 'pushup', name: 'Push-up', pattern: 'push', level: 4, mode: 'reps', muscles: 'Chest, shoulders, triceps, core', avoidIf: ['wrist'],
    steps: ['Hands under shoulders, a little wider; legs straight, on your toes.', 'Brace your stomach so you are one straight plank.', 'Lower until your chest is a fist-height from the floor.', 'Push the floor away to straight arms.'],
    cues: 'Breathe in on the way down, out as you push.', mistakes: 'Hips sagging or piking; half reps.' }),
  E({ id: 'decline-pushup', name: 'Feet-up push-up', pattern: 'push', level: 5, mode: 'reps', needs: 'bed', muscles: 'Upper chest, shoulders, triceps', avoidIf: ['wrist', 'shoulder'],
    steps: ['Feet on a bed edge or step, hands on the floor under your shoulders.', 'Hold a straight line from head to heels.', 'Lower your chest towards the floor.', 'Push back up.'],
    cues: 'Start with a low step; go higher over weeks.', mistakes: 'Letting the lower back arch.' }),
  // Overhead push
  E({ id: 'incline-pike', name: 'Hands-up pike push-up', pattern: 'overhead', level: 1, mode: 'reps', needs: 'bed', muscles: 'Shoulders, triceps', avoidIf: ['shoulder', 'wrist'],
    steps: ['Hands on a bed edge, walk feet back and lift your hips so your body makes an upside-down V.', 'Bend your elbows to lower the top of your head towards the edge.', 'Press back up.'],
    cues: 'Head moves slightly in front of the hands.', mistakes: 'Turning it into a normal push-up.' }),
  E({ id: 'pike-pushup', name: 'Pike push-up', pattern: 'overhead', level: 2, mode: 'reps', muscles: 'Shoulders, triceps', avoidIf: ['shoulder', 'wrist'],
    steps: ['Start in a push-up, then walk your feet in and lift your hips high (upside-down V).', 'Bend your elbows to lower your head towards the floor between your hands.', 'Press back up.'],
    cues: 'Elbows point back, not straight out.', mistakes: 'Dropping the hips.' }),
  // Squat
  E({ id: 'sit-to-stand', name: 'Chair sit-to-stand', pattern: 'squat', level: 1, mode: 'reps', needs: 'chair', muscles: 'Thighs, glutes', avoidIf: [],
    steps: ['Sit near the front of a sturdy chair, feet hip-width apart.', 'Lean forward slightly and stand up without using your hands.', 'Sit back down slowly, taking about 3 seconds.'],
    cues: 'Knees follow the line of your toes.', mistakes: 'Dropping into the chair.' }),
  E({ id: 'squat', name: 'Bodyweight squat', pattern: 'squat', level: 2, mode: 'reps', muscles: 'Thighs, glutes', avoidIf: ['knee'],
    steps: ['Feet shoulder-width apart, toes turned out a little.', 'Sit your hips back and down as if into a chair.', 'Go as low as you can with heels down and chest up.', 'Stand up by pushing through your whole foot.'],
    cues: 'Arms forward for balance.', mistakes: 'Heels lifting; knees caving inwards.' }),
  E({ id: 'pause-squat', name: 'Pause squat', pattern: 'squat', level: 3, mode: 'reps', muscles: 'Thighs, glutes', avoidIf: ['knee'],
    steps: ['Squat down as normal.', 'Hold the bottom position for 2 seconds.', 'Stand up strongly.'],
    cues: 'Stay tight at the bottom; don\'t relax.', mistakes: 'Bouncing out of the pause.' }),
  // Lunge (single leg)
  E({ id: 'split-squat', name: 'Split squat', pattern: 'lunge', level: 1, mode: 'reps', perSide: true, muscles: 'Thighs, glutes', avoidIf: ['knee'],
    steps: ['Stand in a long stride, back heel lifted. Hold a wall if needed.', 'Lower the back knee straight down towards the floor.', 'Push through the front foot to rise.', 'Do all reps, then switch legs.'],
    cues: 'Front shin roughly upright.', mistakes: 'Stance too narrow, like a tightrope.' }),
  E({ id: 'reverse-lunge', name: 'Reverse lunge', pattern: 'lunge', level: 2, mode: 'reps', perSide: true, muscles: 'Thighs, glutes', avoidIf: ['knee'],
    steps: ['Stand tall, feet hip-width.', 'Step one foot back and lower the back knee towards the floor.', 'Push through the front foot to return to standing.', 'Do all reps, then switch legs.'],
    cues: 'Most of your weight stays on the front foot.', mistakes: 'Leaning far forward.' }),
  E({ id: 'bulgarian-split-squat', name: 'Rear-foot-up split squat', pattern: 'lunge', level: 3, mode: 'reps', perSide: true, needs: 'chair', muscles: 'Thighs, glutes', avoidIf: ['knee', 'hip'],
    steps: ['Stand facing away from a chair; rest the top of one foot on the seat behind you.', 'Lower straight down on the front leg.', 'Push back up.', 'Do all reps, then switch legs.'],
    cues: 'Hop the front foot forward until the shin is fairly upright at the bottom.', mistakes: 'Using a chair that slides.' }),
  // Hinge
  E({ id: 'glute-bridge', name: 'Glute bridge', pattern: 'hinge', level: 1, mode: 'reps', muscles: 'Glutes, hamstrings', avoidIf: [],
    steps: ['Lie on your back, knees bent, feet flat and hip-width apart.', 'Squeeze your bottom and lift your hips until knees, hips and shoulders line up.', 'Pause one second, then lower slowly.'],
    cues: 'Push through your heels.', mistakes: 'Arching the lower back instead of using the glutes.' }),
  E({ id: 'single-leg-bridge', name: 'Single-leg glute bridge', pattern: 'hinge', level: 2, mode: 'reps', perSide: true, muscles: 'Glutes, hamstrings', avoidIf: ['lower back'],
    steps: ['Set up as for a glute bridge, then straighten one leg in the air.', 'Lift your hips using the planted leg.', 'Lower slowly. Do all reps, then switch.'],
    cues: 'Keep both hips level.', mistakes: 'Hips twisting to one side.' }),
  E({ id: 'shoulders-up-hip-thrust', name: 'Shoulders-up single-leg hip thrust', pattern: 'hinge', level: 3, mode: 'reps', perSide: true, needs: 'bed', muscles: 'Glutes, hamstrings', avoidIf: ['lower back', 'hip'],
    steps: ['Upper back against a bed edge or sofa, one foot planted, the other leg lifted.', 'Drive your hips up until your body is flat like a table.', 'Lower with control. Do all reps, then switch.'],
    cues: 'Chin slightly tucked, ribs down.', mistakes: 'Pushing with the lower back.' }),
  // Pull / upper back (no equipment)
  E({ id: 'prone-y-t', name: 'Lying Y-T raise', pattern: 'pull', level: 1, mode: 'reps', muscles: 'Upper back, rear shoulders', avoidIf: ['shoulder'],
    steps: ['Lie face down, forehead on a folded towel.', 'Arms overhead in a Y, thumbs up. Lift them a few centimetres and lower.', 'Then arms out to the sides in a T and do the same. That\'s one rep.'],
    cues: 'Squeeze your shoulder blades down and together.', mistakes: 'Lifting the head and neck.' }),
  E({ id: 'reverse-snow-angel', name: 'Reverse snow angel', pattern: 'pull', level: 2, mode: 'reps', muscles: 'Upper back, rear shoulders', avoidIf: ['shoulder'],
    steps: ['Lie face down, arms by your sides, palms down, hands slightly off the floor.', 'Sweep your arms out in a wide arc until they are overhead.', 'Sweep back to your sides. Keep the arms off the floor the whole time.'],
    cues: 'Slow and controlled: about 3 seconds each way.', mistakes: 'Rushing; letting the arms touch down.' }),
  E({ id: 'prone-swimmer', name: 'Prone swimmer', pattern: 'pull', level: 3, mode: 'reps', muscles: 'Upper back, lower back, shoulders', avoidIf: ['shoulder', 'lower back'],
    steps: ['Lie face down, lift chest and arms slightly.', 'Move your arms from overhead (Y) down to your sides, bending elbows like a W on the way.', 'Reverse back to overhead. That\'s one rep.'],
    cues: 'Keep your gaze on the floor.', mistakes: 'Cranking the neck up.' }),
  // Core: front
  E({ id: 'dead-bug', name: 'Dead bug', pattern: 'core-front', level: 1, mode: 'reps', perSide: true, muscles: 'Deep stomach muscles', avoidIf: [],
    steps: ['Lie on your back, arms up to the ceiling, knees bent at 90° above your hips.', 'Press your lower back gently into the floor.', 'Slowly lower one arm and the opposite leg towards the floor, then return.', 'Alternate sides.'],
    cues: 'Breathe out as you lower.', mistakes: 'Lower back lifting off the floor.' }),
  E({ id: 'plank', name: 'Forearm plank', pattern: 'core-front', level: 2, mode: 'time', muscles: 'Stomach, shoulders', avoidIf: ['shoulder'],
    steps: ['Forearms on the floor, elbows under shoulders.', 'Step your feet back so your body is one straight line.', 'Brace your stomach and squeeze your bottom. Hold.'],
    cues: 'Breathe normally; don\'t hold your breath.', mistakes: 'Hips too high or sagging.' }),
  E({ id: 'shoulder-tap-plank', name: 'Plank shoulder taps', pattern: 'core-front', level: 3, mode: 'time', muscles: 'Stomach, shoulders', avoidIf: ['shoulder', 'wrist'],
    steps: ['High plank on straight arms, feet a little wider than hips.', 'Tap one hand to the opposite shoulder, then switch.', 'Keep your hips as still as possible.'],
    cues: 'Slow taps beat fast ones.', mistakes: 'Hips rocking side to side.' }),
  // Core: side
  E({ id: 'knee-side-plank', name: 'Side plank from knees', pattern: 'core-side', level: 1, mode: 'time', perSide: true, muscles: 'Side stomach muscles', avoidIf: ['shoulder'],
    steps: ['Lie on your side, elbow under shoulder, knees bent behind you.', 'Lift your hips so knees, hips and shoulders line up.', 'Hold, then switch sides.'],
    cues: 'Push the floor away with your forearm.', mistakes: 'Hips drifting backwards.' }),
  E({ id: 'side-plank', name: 'Side plank', pattern: 'core-side', level: 2, mode: 'time', perSide: true, muscles: 'Side stomach muscles', avoidIf: ['shoulder'],
    steps: ['Lie on your side, elbow under shoulder, legs straight and stacked.', 'Lift your hips into a straight line from head to feet.', 'Hold, then switch sides.'],
    cues: 'Top foot in front of the bottom foot is easier.', mistakes: 'Letting the hips sink.' }),
];

export const byId = (id: string) => EXERCISES.find((e) => e.id === id);
export const chain = (p: Pattern) => EXERCISES.filter((e) => e.pattern === p).sort((a, b) => a.level - b.level);

/** Warm-up and cool-down: simple timed moves, the same for everyone. */
export const WARMUP = [
  { name: 'March on the spot', seconds: 60, how: 'Lift your knees and swing your arms.' },
  { name: 'Arm circles', seconds: 30, how: 'Small circles growing bigger, forwards then backwards.' },
  { name: 'Hip circles', seconds: 30, how: 'Hands on hips, draw big circles each way.' },
  { name: 'Easy squats', seconds: 30, how: 'Half-depth, slow and relaxed.' },
  { name: 'Hip hinge reach', seconds: 30, how: 'Soft knees, push hips back, reach hands down your legs, stand tall.' },
];
export const COOLDOWN = [
  { name: 'Slow walk and deep breaths', seconds: 60, how: 'Walk around the room, breathing slowly.' },
  { name: 'Chest stretch in a doorway', seconds: 30, how: 'Forearm on the door frame, step through gently.' },
  { name: 'Hip flexor stretch', seconds: 40, how: 'Half-kneel, tuck your bottom under, lean forward gently. 20 s each side.' },
  { name: 'Hamstring stretch', seconds: 40, how: 'Heel forward on the floor, hinge at the hips. 20 s each side.' },
];
