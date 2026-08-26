import type { Exercise } from '@/lib/types';
import { EXERCISES } from '@/lib/data/exercises';

const move = (
  id: string, name: string, kind: 'warmup' | 'cooldown', cues: Exercise['cues'],
  seconds = 30, unilateral = false,
): Exercise => ({
  id, name, patterns: ['core'], capability: 'beginner', mechanic: 'grind',
  unilateral, bells: 0, loadBand: 'light', secondsPerRep: 0, defaultWorkSeconds: seconds,
  needsBench: false,
  warmupSuitable: kind === 'warmup',
  cooldownSuitable: kind === 'cooldown',
  image: null, imagePanels: 1, cues,
});

export interface AncillaryEssential {
  /** What the block must cover. One move per job is guaranteed a place. */
  job: string;
  /**
   * The moves that answer it. One is drawn at random, so the guarantee does not pin
   * the same move to every single session — a warm-up that always opened with the
   * same thirty seconds would be its own kind of wrong.
   */
  ids: readonly string[];
}

/**
 * The jobs a block may not leave to chance, named rather than left to the order of
 * the array below, because array order is a contract nobody can see and the next
 * person to add a move would break it without noticing.
 *
 * `buildAncillary` draws one move per job first and fills the rest of the budget at
 * random. It is the block builder that reads this, through `essentialJob` on the
 * records: the engine takes its data by injection and never imports this file.
 *
 * The warm-up: a pulse raiser, because a warm-up that does not raise temperature is
 * not a warm-up; and the unloaded hinge, because the hinge is the pattern almost
 * every session then loads, and grooving it costs thirty seconds.
 */
export const WARMUP_ESSENTIALS: readonly AncillaryEssential[] = [
  { job: 'pulse raiser', ids: ['marching-on-the-spot', 'heel-flicks'] },
  { job: 'unloaded hinge', ids: ['hip-hinge'] },
];

/**
 * The cool-down: only two, because a fifteen-minute cool-down has room for two moves
 * and forcing a third would either overrun the budget or crowd out everything else.
 *
 * Thoracic rotation, because most of the 34 main exercises are single-arm, so nearly
 * every session loads rotation, and the twist is the only move in the whole list that
 * addresses it — lose it to the shuffle and the mid-back gets nothing.
 *
 * Hips and hamstrings as one job with two answers, because the hinge is the primary
 * pattern of the app: every session with a swing or a deadlift in it has loaded the
 * posterior chain, and the hip flexors are the other half of the same hinge. Which of
 * the two he gets can vary; getting neither cannot.
 *
 * Chest and shoulders is deliberately NOT on this list. Pressing is common but it is
 * genuinely optional — a pull and hinge session contains none — so guaranteeing it
 * would spend a scarce slot on a stretch the session may not have earned.
 */
export const COOLDOWN_ESSENTIALS: readonly AncillaryEssential[] = [
  { job: 'thoracic rotation', ids: ['seated-thoracic-twist'] },
  { job: 'hips and hamstrings', ids: ['standing-hamstring-stretch', 'couch-stretch'] },
];

const ESSENTIAL_BY_ID = new Map<string, string>(
  [...WARMUP_ESSENTIALS, ...COOLDOWN_ESSENTIALS].flatMap((g) =>
    g.ids.map((id) => [id, g.job] as [string, string])),
);

/** Stamps the job onto the records the lists name. The lists stay the single source. */
const withEssentials = (moves: Exercise[]): Exercise[] =>
  moves.map((e) => {
    const job = ESSENTIAL_BY_ID.get(e.id);
    return job === undefined ? e : { ...e, essentialJob: job };
  });

/**
 * Rendered as a checklist, not as hero cards, so these never need pictures.
 *
 * The cue text is therefore the whole of what he gets, and he reads it while he is
 * already moving. One short physical line beats three thorough ones here.
 *
 * Three things follow from how `buildAncillary` uses this list:
 * - It shuffles the pool and takes whatever fits the budget, so no move may depend
 *   on another having come first. Each one stands alone.
 * - It takes only four to six of them, so every move added to this list lowers the
 *   odds of every other move appearing. That is why there are TWO pulse raisers
 *   rather than one: with a single raiser among seven moves, a warm-up of four
 *   missed it about two times in five, and a warm-up that never raises temperature
 *   is not a warm-up. It is also the reason this list should not grow much further
 *   without the block builder drawing by job rather than at random — measured
 *   figures are in the task report.
 * - `seconds` is per side on the moves flagged unilateral, and the engine emits one
 *   checklist line per side. A stretch written as forty seconds across two sides is
 *   twenty seconds a side, which is not a hold, so the holds are thirty a side.
 *   The dynamic two-sided warm-up moves stay at twenty a side: swinging a leg is a
 *   dose, not a hold.
 *
 * The warm-ups are a warm-up, not a stretching routine. Two raisers, then the hips,
 * shoulders and thoracic spine, then an unloaded rehearsal of each of the two
 * patterns the session will load: the squat and, above all, the hinge. Every static
 * hold sits in the cool-down, where it belongs.
 *
 * The five cool-down moves are one per job, and each is there because the session
 * that precedes it loaded that tissue: hamstrings and hip flexors after the hinging,
 * chest and front of the shoulder after the pressing, thoracic rotation after the
 * single-arm work, and the lats and lower back after everything. Drop one and the
 * cool-down stops covering something the session actually did.
 */
export const ANCILLARY: Exercise[] = withEssentials([
  move('marching-on-the-spot', 'Marching on the Spot', 'warmup', {
    setup: ['Stand tall with your feet under your hips.'],
    execution: ['March on the spot, driving each knee up to hip height.', 'Swing the opposite arm with each step.'],
    mistakes: ['Shuffling with the knees low.', 'Chest folding forward as the pace picks up.'],
  }),
  move('heel-flicks', 'Heel Flicks', 'warmup', {
    setup: ['Stand tall with your feet under your hips.'],
    execution: ['Jog on the spot, flicking each heel up towards your backside.', 'Stay light and keep the contacts quiet.'],
    mistakes: ['Leaning back so the flick comes from the hips.', 'Landing heavily through the heels.'],
  }),
  move('arm-circles', 'Arm Circles', 'warmup', {
    setup: ['Stand tall with your arms out to the sides at shoulder height.'],
    execution: ['Circle the arms forward, letting the circles grow.', 'Halfway through, reverse and circle them back.'],
    mistakes: ['Shoulders creeping up towards the ears.', 'Ribs flaring as the arms pass overhead.'],
  }),
  move('cat-cow', 'Cat-Cow', 'warmup', {
    setup: ['On all fours, hands under the shoulders, knees under the hips.'],
    execution: ['Round the upper back and drop the head.', 'Reverse it: lift the chest and let the belly sink.', 'Move with the breath.'],
    mistakes: ['Moving only at the lower back while the ribs stay still.', 'Elbows locking out hard.'],
  }),
  move('leg-swings', 'Leg Swings', 'warmup', {
    setup: ['Hold a wall or door frame and stand on one leg.'],
    execution: ['Swing the free leg forward and back, low and loose at first.', 'Let the range grow as it frees up.'],
    mistakes: ['Lower back arching to swing the leg higher.', 'Standing hip twisting to follow the swing.'],
  }, 20, true),
  move('hip-hinge', 'Hip Hinge', 'warmup', {
    setup: ['Feet hip width, knees soft, hands flat on the front of your hips.'],
    execution: ['Push the hips straight back and let the chest come forward.', 'Go until you feel the hamstrings, then drive the hips through to stand.', 'Keep the back flat from head to tailbone throughout.'],
    mistakes: ['Bending the knees and squatting instead of sending the hips back.', 'Lower back rounding at the bottom.', 'Chin poking forward so the neck leaves the line of the spine.'],
  }),
  move('glute-bridge', 'Glute Bridge', 'warmup', {
    setup: ['Lie on your back, knees bent, heels close to your hips.'],
    execution: ['Push through the heels and lift the hips into one straight line.', 'Squeeze the glutes at the top, then lower slowly.'],
    mistakes: ['Lower back arching instead of the glutes finishing the lift.', 'Pushing through the toes so the heels lift.'],
  }),
  move('bodyweight-squat', 'Bodyweight Squat', 'warmup', {
    setup: ['Feet a little wider than your hips, toes turned out slightly.'],
    execution: ['Sit down between your hips with the chest tall.', 'Drive the knees out, then stand up.', 'Go a little deeper each rep.'],
    mistakes: ['Heels lifting off the floor at the bottom.', 'Knees caving in towards each other.'],
  }),
  move('worlds-greatest-stretch', 'World’s Greatest Stretch', 'warmup', {
    setup: ['Step one foot forward into a long lunge, both hands on the floor inside the front foot.'],
    execution: ['Sink the back hip towards the floor.', 'Reach the inside arm up and turn the chest to follow it.', 'Come back down and repeat, do not hold.'],
    mistakes: ['Head turning while the ribs stay square.', 'Back rounding instead of the chest opening.'],
  }, 20, true),
  move('standing-hamstring-stretch', 'Standing Hamstring Stretch', 'cooldown', {
    setup: ['Put one heel on the floor a step in front of you, toes up.'],
    execution: ['Hinge back over the standing leg until the hamstring pulls.', 'Hold there and keep breathing.'],
    mistakes: ['Back rounding to reach further down.', 'Front knee bending to escape the stretch.'],
  }, 30, true),
  move('couch-stretch', 'Couch Stretch', 'cooldown', {
    setup: ['Kneel on one knee with the other foot flat in front.', 'Rest the back foot up a wall or sofa if that is comfortable.'],
    execution: ['Squeeze the back glute and tuck the hips under.', 'Stand tall through the chest and hold.'],
    mistakes: ['Lower back arching instead of the hip opening.', 'Leaning forward over the front foot.'],
  }, 30, true),
  move('childs-pose', 'Child’s Pose', 'cooldown', {
    setup: ['Kneel and sit back on your heels with the knees wide.'],
    execution: ['Walk the hands forward and let the chest sink towards the floor.', 'Breathe slowly into the back of the ribs.'],
    mistakes: ['Shoulders shrugging up around the ears.', 'Hips lifting off the heels.'],
  }),
  move('seated-thoracic-twist', 'Seated Thoracic Twist', 'cooldown', {
    setup: ['Sit cross-legged or on a chair with a long spine.'],
    execution: ['Turn the ribs slowly to one side and hold there.', 'Keep the hips square and the shoulders level.'],
    mistakes: ['Pulling on the knee to force the turn.', 'Hips sliding round with the shoulders.'],
  }, 30, true),
  move('doorway-chest-stretch', 'Doorway Chest Stretch', 'cooldown', {
    setup: ['Forearm flat on a door frame, elbow at shoulder height.'],
    execution: ['Step through slowly until the chest opens.', 'Hold there and keep breathing.'],
    mistakes: ['Ribs flaring and the back arching for more range.', 'Shoulder rolling forward under the stretch.'],
  }, 30, true),
]);

export const ALL_EXERCISES: Exercise[] = [...EXERCISES, ...ANCILLARY];
