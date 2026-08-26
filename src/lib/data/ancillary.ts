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

/**
 * Rendered as a checklist, not as hero cards, so these never need pictures.
 *
 * The cue text is therefore the whole of what he gets, and he reads it while he is
 * already moving. One short physical line beats three thorough ones here.
 *
 * Three things follow from how `buildAncillary` uses this list:
 * - It shuffles the pool and takes whatever fits the budget, so no move may depend
 *   on another having come first. Each one stands alone.
 * - It takes only four to six of them. That is why there are TWO pulse raisers
 *   rather than one: with a single raiser among seven moves, a warm-up of four
 *   missed it about two times in five, and a warm-up that never raises temperature
 *   is not a warm-up.
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
 */
export const ANCILLARY: Exercise[] = [
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
  move('doorway-chest-stretch', 'Doorway Chest Stretch', 'cooldown', {
    setup: ['Forearm flat on a door frame, elbow at shoulder height.'],
    execution: ['Step through slowly until the chest opens.', 'Hold there and keep breathing.'],
    mistakes: ['Ribs flaring and the back arching for more range.', 'Shoulder rolling forward under the stretch.'],
  }, 30, true),
];

export const ALL_EXERCISES: Exercise[] = [...EXERCISES, ...ANCILLARY];
