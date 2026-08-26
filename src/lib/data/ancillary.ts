import type { Exercise } from '@/lib/types';
import { EXERCISES } from '@/lib/data/exercises';

const move = (
  id: string, name: string, kind: 'warmup' | 'cooldown', cues: Exercise['cues'],
  seconds = 30,
): Exercise => ({
  id, name, patterns: ['core'], capability: 'beginner', mechanic: 'grind',
  unilateral: false, bells: 0, loadBand: 'light', secondsPerRep: 0, defaultWorkSeconds: seconds,
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
 * Two things follow from how `buildAncillary` uses this list:
 * - It shuffles the pool and takes whatever fits the budget, so no move may depend
 *   on another having come first. Each one stands alone.
 * - `unilateral` stays false throughout. A move done on both sides is one checklist
 *   entry with a longer clock, not two steps, so those carry 40 seconds instead of 30.
 *
 * The warm-ups are a warm-up, not a stretching routine: one pulse raiser, then the
 * hips, shoulders and thoracic spine, because what follows is hinging and pressing
 * under load. The long holds all sit in the cool-down, where they belong.
 */
export const ANCILLARY: Exercise[] = [
  move('marching-on-the-spot', 'Marching on the Spot', 'warmup', {
    setup: ['Stand tall with your feet under your hips.'],
    execution: ['March on the spot, driving each knee up to hip height.', 'Swing the opposite arm with each step.'],
    mistakes: ['Shuffling with the knees low.', 'Chest folding forward as the pace picks up.'],
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
    execution: ['Swing the free leg forward and back, low and loose at first.', 'Let the range grow, then change sides.'],
    mistakes: ['Lower back arching to swing the leg higher.', 'Standing hip twisting to follow the swing.'],
  }, 40),
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
    execution: ['Sink the back hip towards the floor.', 'Reach the inside arm up and turn the chest to follow it.', 'Change sides halfway through.'],
    mistakes: ['Head turning while the ribs stay square.', 'Back rounding instead of the chest opening.'],
  }, 40),
  move('standing-hamstring-stretch', 'Standing Hamstring Stretch', 'cooldown', {
    setup: ['Put one heel on the floor a step in front of you, toes up.'],
    execution: ['Hinge back over the standing leg until the hamstring pulls.', 'Hold and breathe, then change sides.'],
    mistakes: ['Back rounding to reach further down.', 'Front knee bending to escape the stretch.'],
  }, 40),
  move('couch-stretch', 'Couch Stretch', 'cooldown', {
    setup: ['Kneel on one knee with the other foot flat in front.', 'Rest the back foot up a wall or sofa if that is comfortable.'],
    execution: ['Squeeze the back glute and tuck the hips under.', 'Stand tall through the chest and hold, then change sides.'],
    mistakes: ['Lower back arching instead of the hip opening.', 'Leaning forward over the front foot.'],
  }, 40),
  move('childs-pose', 'Child’s Pose', 'cooldown', {
    setup: ['Kneel and sit back on your heels with the knees wide.'],
    execution: ['Walk the hands forward and let the chest sink towards the floor.', 'Breathe slowly into the back of the ribs.'],
    mistakes: ['Shoulders shrugging up around the ears.', 'Hips lifting off the heels.'],
  }),
  move('seated-thoracic-twist', 'Seated Thoracic Twist', 'cooldown', {
    setup: ['Sit cross-legged or on a chair with a long spine.'],
    execution: ['Turn the ribs slowly to one side and hold there.', 'Keep the hips square, then turn the other way.'],
    mistakes: ['Pulling on the knee to force the turn.', 'Hips sliding round with the shoulders.'],
  }, 40),
  move('doorway-chest-stretch', 'Doorway Chest Stretch', 'cooldown', {
    setup: ['Forearm flat on a door frame, elbow at shoulder height.'],
    execution: ['Step through slowly until the chest opens.', 'Hold and breathe, then change sides.'],
    mistakes: ['Ribs flaring and the back arching for more range.', 'Shoulder rolling forward under the stretch.'],
  }, 40),
];

export const ALL_EXERCISES: Exercise[] = [...EXERCISES, ...ANCILLARY];
