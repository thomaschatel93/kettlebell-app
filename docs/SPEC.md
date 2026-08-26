# Kettlebell workout app — design spec

Date: 2026-08-25 (revised after review, see `REVIEW.md`)
Status: approved for planning

## 1. What this is

A personal web app, added to the iPhone Home Screen, that builds a kettlebell
workout from three inputs: the bells available right now, the movement patterns
to train, and the minutes available. It then walks through that workout one
exercise at a time, each with a picture and short cues.

Single user. No accounts, no server, no sync.

**The room it has to work in.** One person alone in a garage, sweating, breathing
hard, hands chalky or damp, phone propped on the floor or a bench a metre away,
music playing. Every interface decision below answers to that room, not to a desk.

## 2. Decisions made

| Decision | Choice | Why |
|---|---|---|
| Generator | Rules engine, runs on the phone | Fast, offline, free, and testable against hard rules |
| Platform | Next.js 15 PWA on Vercel, Add to Home Screen | No App Store, instant updates, already his stack |
| Media | One still per exercise, supplied by Thomas | Form accuracy matters more than convenience |
| Media pipeline | Files committed to `public/exercises/` | No storage service, no cost, no upload UI |
| Missing media | Cue text promoted, no empty placeholder | The card that most needs words should not reserve space for a picture |
| Focus picker | Movement patterns, labelled with body parts | How programming works, in language he already has |
| Time budget | Warm-up and cool-down inside the stated time | Swinging cold is how backs go |
| Formats | Circuits, complexes, classic strength sets | No EMOM in v1 |
| State | Kit profiles and history, on-device | No backend to run |
| Capability | Set once, stored | Changes over months, not sessions |
| Effort | Chosen per session | Changes every session |
| Offline | Manifest and icons in v1, service worker deferred | Installability is the value; precaching is the risk |

## 3. Data model

All records are plain JSON in the repo, so phase 2 can append to them from a
script and a human can read a diff.

### 3.1 Exercise

```ts
type Pattern    = 'hinge' | 'squat' | 'push' | 'pull' | 'carry' | 'core';
type Capability = 'beginner' | 'intermediate' | 'advanced';
type Effort     = 'easy' | 'normal' | 'hard';
type Mechanic   = 'ballistic' | 'grind' | 'carry';
type LoadBand   = 'light' | 'moderate' | 'heavy';

interface Exercise {
  id: string;                  // kebab-case, stable, matches the image filename
  name: string;
  patterns: Pattern[];         // primary pattern first
  capability: Capability;      // the skill needed to do it at all
  mechanic: Mechanic;
  unilateral: boolean;
  bells: 0 | 1 | 2;            // 0 for bodyweight warm-up and cool-down moves
  loadBand: LoadBand;
  secondsPerRep: number;
  defaultReps?: number;
  defaultWorkSeconds?: number; // carries, holds and every ancillary move
  needsBench: boolean;
  warmupSuitable: boolean;
  cooldownSuitable: boolean;
  image: string | null;        // '/exercises/<id>.webp'
  imagePanels: 1 | 2 | 3;      // ballistics need more than one position
  videoUrl?: string;           // phase 2 will populate this from Reels
  cues: {
    setup: string[];
    execution: string[];
    mistakes: string[];
  };
}
```

`loadBand` maps to a real bell at generation time. Take the active kit's unique
weights sorted ascending: `light` is the lightest, `heavy` the heaviest, and
`moderate` the middle one, rounding down. This is why a swing carries `heavy` and
an overhead press carries `light`.

**When a kit resolves fewer than three distinct weights, that mapping has broken
down.** A single 24 kg bell would otherwise prescribe overhead presses at swing
weight. In that case, `light` and `moderate` grinds take a 0.6× rep penalty, and
the Preview screen says so in plain words. The app must not sound confident where
its model has failed.

**`warmupSuitable` and `cooldownSuitable` are exclusive of the main pool.** A move
is either main work or ancillary, never both.

### 3.2 Combo

A complex: a chain of movements performed without putting the bell down.

```ts
interface Combo {
  id: string;
  name: string;
  capability: Capability;
  bells: 1 | 2;
  perSide: boolean;            // run the whole chain one side, then the other
  loadBand: LoadBand;          // governed by the weakest link, usually the press
  steps: { exerciseId: string; reps: number }[];
}
```

Patterns for a combo are derived from its member exercises, not stored.

### 3.3 Kit profile

```ts
interface KitProfile {
  id: 'home' | 'gym';
  name: string;
  bells: { weightKg: number; count: number }[];
  hasBench: boolean;
}
```

**Exactly two profiles, fixed.** Home and Gym. The bells and the bench toggle are
editable; the profiles themselves cannot be added, deleted or renamed. That covers
the actual requirement, which is switching between two places, and removes a whole
class of invalid state.

Double-bell work requires `count >= 2` at the same weight.

### 3.4 Workout request

```ts
interface WorkoutRequest {
  kitProfileId: 'home' | 'gym';
  patterns: Pattern[];         // 1 to 6
  capability: Capability;      // from settings, not chosen per session
  effort: Effort;              // chosen every session
  totalMinutes: 15 | 20 | 30 | 45 | 60;
  format: 'auto' | Format;
  seed: number;
}
```

**Capability and effort are separate on purpose.** Capability answers "can I do a
snatch", changes over months, and decides which exercises exist. Effort answers
"how do I feel today", changes every session, and decides only reps and rest. A
single control doing both means an easy Tuesday silently deletes half the exercise
database, which is not what he meant, and he learns to pin the control at its
maximum.

### 3.5 Generated workout

The workout flattens into an ordered list of steps. The screen walks the list and
holds no logic of its own.

```ts
type Step =
  | {
      kind: 'work';
      exerciseId: string;
      name: string;
      bellKg: number | null;
      reps?: number;
      seconds?: number;
      side?: 'left' | 'right';   // unilateral work emits one step per side
      block: Block;
      round: number;
      totalRounds: number;
      indexInRound: number;
      itemsInRound: number;
      estSeconds: number;
    }
  | {
      kind: 'rest';
      seconds: number;
      nextName: string;
      block: Block;
      estSeconds: number;
    };
```

**Unilateral exercises emit two work steps, not one card reading "each side".**
The app holds his place instead of asking him to hold side, rep count and round in
his head at once while breathing hard.

### 3.6 History

```ts
interface HistoryEntry {
  id: string;
  createdAt: string;
  workout: Workout;            // the whole thing, not a summary
  mainExerciseIds: string[];   // the main block only, for the variety check
  workedSeconds: number;       // actual, accumulated from the clock
  felt?: 'easy' | 'right' | 'brutal';
}
```

**The whole workout is stored, not a list of ids.** Thirty entries is a few
hundred kilobytes. Everything worth building later — repeat last workout,
progression hints, "what did I press last time" — depends on this record existing
from session one, and sessions recorded before the change are gone for good.

`mainExerciseIds` exists because the variety check compares main-block work only.
Comparing against every id, warm-up included, can never match, which would make
the anti-repeat rule dead code.

## 4. The generator

A pure function: `generate(request, kit, exercises, combos, history) => Workout`.
No clock, no randomness beyond a seeded generator, no network. The same inputs
always produce the same workout, which is what makes it testable and what makes
"regenerate" work by advancing the seed.

### 4.1 Budget the time

- Warm-up: 15% of total, clamped to between 3 and 7 minutes.
- Cool-down: 10% of total, clamped to between 2 and 5 minutes.
- Main: whatever remains.

### 4.2 Build the pool

Keep an exercise if all of these hold:

- its `capability` is at or below the requested capability
- the active kit has the bells it needs, including a matched pair for doubles
- the kit has a bench if it needs one
- it trains at least one requested pattern
- it is not flagged warm-up or cool-down suitable

### 4.3 Choose the format

When `format` is `auto`:

1. Four or more patterns requested, choose **circuit**.
2. Otherwise 35 minutes or more, choose **strength**.
3. Otherwise choose **complex** if a combo fits the capability and kit, else circuit.

**The reported format must be the format actually built.** If the user picks
Complex and no combo is usable, a circuit is built and the workout says circuit.

### 4.4 Select the main work

**Circuit.** Between 3 and 7 exercises, never fewer than the number of requested
patterns. Cover every requested pattern at least once, then fill remaining slots
preferring whichever primary pattern is least represented so far.

**Complex.** One or two combos matching the capability and kit, repeated for rounds.

**Strength.** Three exercises run as a triset: one heavy grind as the primary, then
two accessories from different patterns, cycled for three to five rounds.

**Ordering.** Ballistics first, heavy grinds next, core and carries last, and no
two adjacent exercises sharing a primary pattern. Because a circuit repeats, the
last item of a round is adjacent to the first item of the next, so the wrap-around
counts too: the ordering problem is a circle, not a line.

That distinction has teeth. A largest-remaining-group greedy is complete for a
line but not for a circle, and no rotation can repair a wrap clash, because
rotation preserves every circular adjacency. The bound on feasibility differs too:
a line needs no pattern to exceed `ceil(n/2)` of the slots, a circle needs
`floor(n/2)`. So the ordering uses that greedy made complete by backtracking, with
the plain greedy kept as the fallback for a set that admits no circular ordering
at all. A set of four hinges has no valid arrangement, so the rule
is stated honestly: **no two adjacent share a primary pattern whenever the
selected set admits such an ordering.**

**Pattern coverage.** Only a circuit has enough slots to guarantee full coverage.
A complex or a strength block covers as many requested patterns as it has slots.
The setup screen says so when the chosen format cannot cover everything asked for,
and offers the switch inline rather than hiding it behind a disclosure.

**History.** Exercises used in the last two workouts get a quarter of their normal
selection weight, compared against `mainExerciseIds`. The generator tries to avoid
repeating the previous main set, advancing the seed and retrying up to five times,
then accepting what it has so a small pool still returns a workout.

### 4.5 Fit to the budget

The previous rule was wrong and produced sessions up to 57% short. This is the
corrected one.

1. **Build the ancillary blocks first**, and measure what they actually cost.
2. **Give the main block the true remainder**, not a nominal 75% share.
3. **Search rounds and item counts together**, not rounds alone. Circuits search
   3 to 7 items × 1 to 10 rounds; strength searches 3 to 5 rounds; complexes
   search one or two combos × 1 to 10 rounds.
4. **Rank candidates on pattern coverage first, then on time deviation.** Ranking
   on time alone silently drops requested patterns to save nine seconds.
5. **Close the residual on the between-rounds rest**, clamped to between 30 and
   180 seconds. Rest is the right knob: changing reps changes the training
   stimulus, changing rest within a sane band does not.
6. **Show the result.** The Preview screen states the computed estimate next to
   the request, "about 27 min for a 30 minute session". A number he can see beats
   an invariant that fails quietly.

Base prescriptions, before effort modifiers:

| Format | Work | Rest between items | Rest between rounds |
|---|---|---|---|
| Circuit | `defaultReps`, or `defaultWorkSeconds` for carries and holds | 30s | 75s |
| Complex | the chain, both sides if unilateral | none inside the chain | 90s |
| Strength | 5 reps | 90s between exercises | 90s |

Strength carries a between-rounds rest of 90s. Zero would run the last exercise of
one round straight into the first of the next, which is a metcon, not a strength
protocol.

Effort modifiers: easy takes 0.7× the reps and 1.5× the rest; hard takes 1.2× the
reps and 0.8× the rest. Reps round to the nearest whole number, minimum three.
Rest rounds to the nearest five seconds. There is exactly one copy of this rule
and every path uses it.

Duration estimate per work step: `reps × secondsPerRep`, or `defaultWorkSeconds`
for carries and holds. Unilateral exercises emit two steps, so the doubling falls
out of the step list rather than being applied twice.

### 4.6 Warm-up and cool-down

Fill each from the exercises flagged suitable until the block's budget is met.
Any ancillary move that takes a bell uses the `light` band; moves with `bells: 0`
take none.

Selection is not pattern-matched to the day's work. A general warm-up is fine, and
the rule was never implemented.

## 5. Screens

Four tabs: **Home, Workout, History, Kit**. Eight screens sit across them; Setup,
Preview, Workout, Rest and Done are the five stages of the Workout tab.

1. **Home.** Greeting, two activity rings (workouts in the last seven days, total
   minutes) and a seven-dot row for the last week. The active kit as a chip. A
   large primary button to start, and a Resume button above it when a workout is
   in progress and less than three hours old.
2. **Setup.** Kit selector, six pattern chips each subtitled with its body parts,
   an effort control reading Easy / Normal / Hard, time chips, and format behind a
   disclosure defaulting to Auto. Warnings appear inline as controls, not as text.
3. **Preview.** **Leads with the bells to fetch**: "You'll need: 16 kg, 24 kg. No
   bench." Then the format, the computed estimate against the request, and every
   block with its exercises, bells and prescriptions. Regenerate, or Start.
4. **Workout.** The still filling the upper area, the exercise name, a bell badge,
   the prescription, the side when unilateral, block and round position with a
   progress bar. Cues below. A full-width Next button.
5. **Rest.** A large countdown, the name of what is coming next, Skip rest, and
   **+30s**. At zero it does not vanish: it keeps counting, upward, showing how far
   over he is, so returning to the phone tells him something.
6. **Done.** Worked time against the estimate, exercises completed, patterns
   trained, and a one-tap **Easy / Right / Brutal** rating.
7. **History.** Reverse-chronological, expanding into what was done.
8. **Kit.** Two profiles, their bells as a row of weight chips rather than a
   keyboard, a bench toggle, and the capability setting.

### 5.1 Warm-up and cool-down presentation

**One scrollable checklist card per block, not one hero card per move.** Hip
circles and leg swings do not each need a full screen, an image and a Next button.
One-exercise-per-screen is reserved for the main block, where it earns its place.

This is also why the fourteen bodyweight ancillary stills were cut. Without it, every
session would open with three to seven minutes of empty placeholders, and first
impressions of the app would be formed entirely from the part that was
deprioritised.

### 5.2 Controls on the workout screen

- **Next**, full width, bottom.
- **Previous**, always enabled, no confirmation. Wet hands produce phantom taps
  and there must be a way back.
- **Skip**, for a work step. Three lines of code, and it prevents abandoning a
  session over a shoulder that is not having it today.
- **Pause**, in the bottom row beside Next. The phone is on the floor; the top
  edge is the furthest reach and the worst target from a crouch.
- **Exit**, in the header, split in two: **Leave for now**, which keeps the
  session so Home can resume it, and **End here**, which writes a partial history
  record before clearing. Nothing in this app may delete a session that happened.

### 5.3 Sound

Three cues on a preloaded HTML `<audio>` element, unlocked by the Start tap: a
tick at three, two and one, a single tone at zero, and nothing else.

A media element is used rather than Web Audio because iOS silences Web Audio with
the hardware ringer switch, whereas user-initiated media plays on the media
channel and mixes over music. Vibration is not an option: `navigator.vibrate` does
not exist on iOS Safari.

Everything else in this design assumes the phone is a metre away. Sound is the
only output channel that reaches that far while he is mid-plank.

### 5.4 Exercise card with no image

The media slot **collapses**. No dashed placeholder, no reserved space. Setup and
execution move up to heading size and the "watch out for" line is always visible.
For an exercise with no picture the words are the entire content, and they should
not sit under a large empty rectangle. The layout differing between illustrated
and unillustrated exercises is fine; this is one app for one person, not a design
system.

**Inside a complex, suppress the set-up cues.** A chain member's `setup` lines are
written for performing that exercise on its own, and they are wrong mid-chain: the
clean says "Bell just outside the foot on the working side… take the grip", but in
`clean-press-squat` the bell arrives from the previous front squat and never touches
the floor until the chain ends. Show `setup` only for the FIRST step of a chain, and
only on its first round; every later step, and the whole second side of a per-side
chain, shows `execution` and `mistakes` alone. The data stays as it is — those cues
are correct for the standalone exercise, so it is the card that has to know where it
is being shown.

### 5.5 Pause

Pause freezes the countdown and the worked-time clock. The session record stores
working time, not wall-clock time, so fetching a bell does not corrupt the history.

## 6. Visual style

Dark throughout. Near-black background, dark grey cards with generous corner
rounding, a single orange accent for primary actions and progress, tinted pill
tags for movement patterns, bold white headings on grey supporting text, and the
primary button full width and pinned at the bottom. Modelled on the reference
screenshots supplied on 2026-08-25.

Accessibility floor: text contrast at WCAG AA, tap targets at least 44px, motion
reduced when the system asks. The countdown must read at arm's length, so it is
set large.

**The dim text token is banned from the workout and rest screens.** Grey on near
black passes AA at a desk and is mush at a metre through sweat on the glass.

**Exercise stills are flattened onto the card colour, never white.** A pure white
square inside a dark card is the most visible defect the media pipeline can ship.

## 7. Storage

`localStorage`, versioned keys, and a version stamped inside each value so a shape
change can be detected and discarded rather than crashing the runner.

- `kb.kits.v1` — the two profiles, which is active, and the capability setting
- `kb.history.v1` — last 30 workouts, each holding a whole `Workout`
- `kb.prefs.v1` — last used patterns, effort and time, as the next default
- `kb.active.v1` — the workout in progress

```ts
interface ActiveState {
  v: 1;
  workout: Workout;
  stepIndex: number;
  workedSeconds: number;
  restEndsAt: number | null;      // absolute epoch ms, never a counter
  pausedRemainingMs: number | null;
}
```

**Timers derive from the clock, never from tick counts.** iOS throttles intervals
in backgrounded tabs and stops them when the screen dims, and it evicts standalone
webviews aggressively. A counter decremented by `setInterval` will drift, stall,
and reset to full on remount. Storing an absolute deadline makes throttling,
drift and remounting all harmless, and the interval only drives repaints.

Reads never throw. Corrupt JSON, an unknown version, or an `activeId` naming a
profile that no longer exists all fall back to a valid default rather than
bricking the app on a phone with no console.

## 8. Installability

A web app manifest set to standalone display, an app icon and an apple-touch-icon.
Added to the Home Screen it opens without browser chrome.

A service worker is **not** in v1. Precaching is the most failure-prone part of the
build and the least load-bearing, and it can be added the first time a missing
signal actually costs a workout.

Keep-awake uses the Wake Lock API, requested when a workout starts and released on
finish, exit, or when the page hides. Where the browser refuses, the app carries on
and says nothing.

**iOS partitions storage between Safari and an installed Home Screen app.** The kit
must be set up inside the installed app. This is not fixable; it goes in the
install checklist.

## 9. Testing

The generator is pure, so it is unit tested with Vitest.

**Engine invariants are tested against a small synthetic fixture database** built
to exercise the engine, not against the real exercise data. The real database is
asserted against the same invariants in a separate, later test. Testing the engine
against real data means a thin database fails the engine tests, and the remedy
becomes "change the database until it goes green", which shapes the database
around a test rather than around kettlebell programming.

Invariants:

1. Never prescribes a bell absent from the active kit.
2. Only selects two-bell exercises when the kit holds a matched pair.
3. Only selects bench exercises when the profile has a bench.
4. A circuit covers every requested pattern. A complex or strength block covers as
   many as it has slots for.
5. The **whole workout** lands within 10% of the requested time, ancillary blocks
   included.
6. No two adjacent main exercises share a primary pattern, wrap-around included,
   whenever the selected set admits such an ordering.
7. Nothing above the requested capability appears.
8. The same seed produces the same workout; a different seed does not.
9. Given a pool larger than the block size, the main set differs from the previous
   workout, compared on `mainExerciseIds` as the runner actually writes them.
10. Exercises with no image still generate and still render.
11. Blocks always run warm-up, then main, then cool-down, and no rest leaks across
    a block boundary.
12. Unilateral exercises emit two steps, one per side.
13. The reported format is the format actually built.

Data integrity, tested separately: unique ids, every combo step resolves, every
non-null image path exists on disk, and every grid tile maps to a real exercise.

**Types are checked in every task.** Vitest transpiles without type-checking, so
`npm run typecheck` runs alongside `npm test` everywhere.

## 10. Out of scope for v1

EMOM and interval formats, per-set rep and weight logging, swapping an exercise
for another mid-workout, progression and auto-loading, an exercise browser,
accounts, cloud sync, and Apple Health. All can be added later without reworking
the data model.

Progression is the real retention risk and it is still correctly deferred: a
progression model needs completion data that will not exist for two months. The
record is being built now so that the data is there when it is wanted.

## 11. Phase 2, designed for but not built

Turning an Instagram Reel into database entries.

The referenced repo (`Shrinjita/Transcribe-Reels`) transcribes reel *audio* via
AssemblyAI. That is the wrong signal: kettlebell reels are music over silent
demonstration, so the transcript is empty or is song lyrics. It also carries no
licence, so its code will not be copied.

The workable pipeline, run by hand and not on a schedule:

1. `yt-dlp` fetches the reel and its caption text.
2. `ffmpeg` samples frames across the clip.
3. Claude reads the frames and the caption, and identifies the exercises and the
   order they are chained in.
4. A proposed `Exercise` or `Combo` record is produced for review, and added only
   once approved.

Both tools are already installed. Automated downloading sits against Instagram's
terms, so this stays a manual personal tool operated on reels chosen one at a time.

It should not be built until twenty real sessions have happened. The database has
41 records and he does not yet know which ones are missing.

## 12. Open items

- The exercise stills. Fifteen come from the supplied grid; fourteen need
  generating. Listed in `docs/image-brief.md`.
- The grid tiles are 184–237px wide, so they are placeholders. Regenerate natively
  at 1024px over time. Never upscale on the way in.
- Two grid tiles (Clean and Press, Snatch) show only the lockout and need
  regenerating as multi-panel images.
- **Eight ballistics cannot be taught by one still**: swing, single-arm swing,
  clean, snatch, high pull, push press, figure 8 and windmill. A still of a swing
  at chest height is indistinguishable from a front raise, which is the exact
  error the picture exists to prevent. These need `imagePanels: 2` or `3`.
- The Turkish get-up has six distinct positions. It stays out of the main pool
  until it has proper media.
- Front Raise is dropped as it is not kettlebell programming.
