import type { Combo } from '@/lib/types';

/**
 * A complex is a chain performed without putting the bell down, so the only rule
 * that matters is that each move can be entered from where the last one finished.
 * A clean ends in the rack, so a press or a front squat follows it. A swing ends
 * with the bell hanging, so a clean or a high pull follows it. Anything that needs
 * a fresh set-up from the floor breaks the chain and is not in here.
 *
 * Three consequences run through the whole file:
 * - `loadBand` is the weakest link, which is almost always the press. One bell is
 *   carried through the entire chain; a bell you can swing is not a bell you can
 *   press, so the press sets the weight and everything else is done light.
 * - `capability` is at least that of the most demanding member.
 * - `perSide` is honest. A single-bell chain that starts with a one-handed clean
 *   runs all the way down one side before it changes, so it is per side. A chain
 *   held in both hands is not.
 *
 * No carry appears in any chain. `planItems` overrides `defaultReps` with the step
 * reps, and a carry has `secondsPerRep: 0`, so a carry inside a combo would cost
 * zero seconds and quietly wreck the time estimate.
 */
export const COMBOS: Combo[] = [
  {
    id: 'clean-press-squat',
    name: 'Clean, Press, Squat',
    capability: 'intermediate',
    bells: 1,
    perSide: true,
    loadBand: 'light',        // the press governs; a swing-weight bell will not press
    steps: [
      { exerciseId: 'clean', reps: 3 },
      { exerciseId: 'overhead-press', reps: 3 },
      { exerciseId: 'racked-front-squat', reps: 3 },
    ],
    // The clean lands the bell in the rack, the press leaves it back in the rack,
    // and the front squat is done from the rack. The bell only leaves the rack to
    // start the next clean.
  },
  {
    id: 'high-pull-clean-push-press',
    name: 'High Pull, Clean, Push Press',
    capability: 'intermediate',
    bells: 1,
    perSide: true,
    loadBand: 'moderate',     // the push press takes more than a strict press, but not swing weight
    steps: [
      { exerciseId: 'high-pull', reps: 5 },
      { exerciseId: 'clean', reps: 3 },
      { exerciseId: 'push-press', reps: 3 },
    ],
    // Every move starts from the same one-handed hang. The high pull sends the bell
    // back down to it, the clean takes it from there into the rack, and the push
    // press goes overhead and returns to the rack.
  },
  {
    id: 'deadlift-swing',
    name: 'Deadlift into Swings',
    capability: 'beginner',
    bells: 1,
    perSide: false,
    loadBand: 'heavy',        // no press in the chain, and both moves want a heavy bell
    steps: [
      { exerciseId: 'deadlift', reps: 5 },
      { exerciseId: 'two-hand-swing', reps: 10 },
    ],
    // The plainest chain in the set and the one a beginner can do on day one: the
    // deadlift finishes standing with the bell hanging from both hands, which is
    // exactly where the swing starts.
  },
  {
    id: 'goblet-lunge-halo',
    name: 'Goblet Squat, Lunge, Halo',
    capability: 'beginner',
    bells: 1,
    perSide: false,
    loadBand: 'light',        // the halo governs; a squat-weight bell will not circle the head
    steps: [
      { exerciseId: 'goblet-squat', reps: 5 },
      { exerciseId: 'reverse-lunge', reps: 4 },
      { exerciseId: 'halo', reps: 3 },
    ],
    // The bell never leaves the chest. All three are held in the same two-handed
    // position, so the only thing that changes between moves is what the legs do.
  },
  {
    id: 'figure-8-swing',
    name: 'Figure 8 into Swings',
    capability: 'intermediate',
    bells: 1,
    perSide: false,
    loadBand: 'moderate',     // the figure 8 governs; it is a control move, not a heavy one
    steps: [
      { exerciseId: 'figure-8', reps: 5 },
      { exerciseId: 'two-hand-swing', reps: 8 },
    ],
    // The figure 8 is done hinged with the bell passing between the legs, which is
    // the bottom of the swing. Take the free hand onto the handle on the last pass
    // and swing from there without standing up in between.
  },
  {
    id: 'snatch-windmill-squat',
    name: 'Snatch, Windmill, Front Squat',
    capability: 'advanced',
    bells: 1,
    perSide: true,
    loadBand: 'light',        // the windmill governs, and it is the move that punishes a heavy bell
    steps: [
      { exerciseId: 'snatch', reps: 3 },
      { exerciseId: 'windmill', reps: 2 },
      { exerciseId: 'racked-front-squat', reps: 3 },
    ],
    // The snatch finishes locked out overhead, which is the windmill's start
    // position. Stand up out of the last windmill, lower the bell to the rack for
    // the front squats, then drop it back to the hang for the next snatch.
  },
];
