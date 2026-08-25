# Consolidated review — 2026-08-25

Two reviews, one engineering and one user research, against `SPEC.md` and
`PLAN.md` before any code was written. This document records what was found,
what I verified myself, and what I decided to do about each item. Rejections are
listed with reasons, not buried.

## Verdict

The architecture survived. The engine's arithmetic did not, and the workout
screen was designed for the wrong room.

Both reviewers independently reached the same headline: the generator is the
strong half and the runner is the weak half. The engine has four real defects
that stack into a broken time budget. The runner was written as if Thomas would
be holding the phone, looking at it, with dry hands. He will be a metre away,
breathing hard, with music playing.

Nothing found is fatal to the design. Everything is fixable in `src/lib` and in
the spec, before a line of it exists.

## What I verified myself

I re-derived the two headline numeric claims from the plan text rather than
trusting the review, and they hold:

**The ±10% time invariant fails across most of the sweep.**

| Session | Level | Estimate | Requested | Deviation |
|---|---|---|---|---|
| Strength 30 min | intermediate | 1605s | 1800s | 10.8% |
| Strength 45 min | intermediate | 1685s | 2700s | 37.6% |
| Strength 60 min | advanced | 1545s | 3600s | 57.1% |

**The ancillary blocks undershoot their own budget**, by 25s at 15 minutes and
235s at 60 minutes, before the main block contributes any error at all.

I also verified the image-slicing defect myself before either review landed: the
sheet's labels sit past the cell boundary, so a uniform 4×4 split puts each row's
labels into the next row's tile.

## Blocking defects — all accepted

Each of these would have shipped.

1. **The between-rounds rest leaks across the block boundary.** `buildSteps`
   emits a rest after every round including the last. The trailing-rest trim only
   fires at the very end of the whole step list, so the Main block's last rest
   survives because Cool-down follows it. `chooseRounds` budgeted for
   `r × round + (r-1) × rest`; the workout actually contains `r × rest`. The
   single-block test fixture hid it.
2. **`buildAncillary` costs a rest it never emits, and its six-item cap cannot
   fill a long warm-up.** 255 seconds is the hard ceiling against a 420-second
   budget.
3. **`chooseRounds` has no tolerance, and the strength clamp is applied after the
   fact.** Clamping an argmin into 3..5 cannot help but push the estimate outside
   the tolerance. Complex has the mirror problem: capped at 8 rounds it cannot
   reach a 45-minute budget at all.
4. **`orderCircuit` does not satisfy its own post-condition.** Fuzzed over 200,000
   sets: 15% of cases had a valid ordering it failed to find, and the swap pass
   destroyed the ballistic-first ordering in 35%. It also ignores the wrap-around,
   where the last item of a round meets the first item of the next, which collides
   43% of the time.
5. **The anti-repeat retry is dead code.** It compares main-block ids against a
   history record the runner writes with *all* ids, warm-up included, so the
   arrays can never be equal. The test built its fixture the way the engine wants
   rather than the way the runner writes, so it tested the implementation back at
   itself.
6. **`workedSeconds` is never accumulated.** The interval only runs on rest steps,
   so every history record, the Done screen and the Home minutes ring would read
   rest time or zero.
7. **The rest countdown will drift and reset.** `setInterval` decrementing a
   counter is throttled when a standalone PWA backgrounds and stops when the
   screen dims. On eviction and remount the rest restarts at full.
8. **Rest ends silently.** No sound, no vibration, and at zero the app throws away
   the one number he needed. Web haptics do not exist on iOS Safari, so audio is
   the only channel that reaches a metre.
9. **Unilateral work is one card.** "10 reps each side" with one Next button asks
   him to hold side, rep count and round in his head simultaneously.
10. **`level` does two incompatible jobs.** It filters the exercise pool by
    capability *and* sets reps and rest by effort. Pick "Starting out" on a flat
    Tuesday and the app silently deletes every advanced exercise from the pool.
    He will pin it to Experienced and the control dies.
11. **A single-bell kit collapses all three load bands onto one bell**, then
    prescribes overhead presses at swing weight with no warning. The app is most
    confident exactly where its model has broken down.
12. **Deleting the active kit profile crashes the app.** `activeId` is never
    validated against `profiles`.
13. **Nothing type-checks until Task 19.** Vitest transpiles without checking, so
    `npm test` passes on code with type errors.
14. **Every still would have been a white square on a near-black card.** The
    slicing script flattens onto `#ffffff`. Neither I nor the spec noticed.

## Accepted with modification

**Warm-up presentation.** The two reviews conflicted here: the engineer said cut
the twelve bodyweight warm-up images as nobody needs a picture of a hip circle;
the researcher said promote them, because warm-up runs first in every session so
the first thing seen is always a run of empty placeholders.

Both are right, and the resolution satisfies both: render the warm-up and
cool-down as **one scrollable checklist card**, not one hero card per move. No
per-move images needed, so the twelve images are cut, and the unfinished feel
goes with them. One-exercise-per-screen is reserved for the main block, where it
earns its place.

**The image pipeline.** The engineer recommended deleting the slicer and
regenerating all 16 natively at 1024px. The tiles are genuinely small, 184–237px
wide, and will look soft next to natively generated ones. But I have a working
self-detecting slicer that cuts all 16 cleanly, and a populated app on day one is
worth more than a consistent one in three weeks. So: **slice now as placeholders,
regenerate natively over time**, and fix the two real defects the engineer found
in the pipeline regardless — never upscale, and flatten onto the card colour
rather than white.

**Kit profiles.** Cutting profile CRUD is right; cutting profiles is not. Thomas
explicitly asked to switch between home and gym. Two fixed profiles with editable
bells and a bench toggle, no add, no delete, no rename. That satisfies the
requirement and deletes the `activeId` crash along with the whole validation flow.

**The service worker.** Deferred. The manifest, the icons and standalone display
are what make it feel like an app, and they stay. Full offline precaching via
Serwist is the most failure-prone part of the build and the least load-bearing.
Add it the first time offline actually bites.

## Rejected

**"Cut the complex format."** The engineer makes a fair case: it removes the
`Combo` type, six hand-authored records, four functions and the two worst columns
of the failure table. Rejected anyway. Thomas explicitly chose complexes as one of
three formats, and said Instagram Reels are mostly showing exactly this. Cutting
it would remove the format that phase 2 exists to feed. The fix is to make the
fitting work, which is being done for the other two formats regardless.

**"Add progression logic."** Correctly identified by the researcher as the real
retention risk and correctly resisted. A progression model needs completion data
that will not exist for two months. Ship the record first.

**Per-set rep and weight logging.** Stays out, as Thomas decided. The one-tap
effort rating on the Done screen gets most of the value for one tap instead of
forty.

## Changes to the spec

- Split `level` into `capability`, set once and stored with the kit, and `effort`,
  chosen per session as Easy / Normal / Hard. Capability filters the pool; effort
  scales reps and rest.
- Add `side?: 'left' | 'right'` to the work `Step`, and emit two steps for
  unilateral exercises.
- Store the whole `Workout` on the `HistoryEntry`, plus `mainExerciseIds` for the
  variety check and an `effort` rating.
- Add `restEndsAt` to the active state and derive the countdown from the clock.
  Version the stored value, not just the key.
- Add `videoUrl?` to `Exercise` for phase 2, and let `imagePanels` be 1, 2 or 3.
- Rewrite the fitting rule: build the ancillary blocks first, give the main block
  the true remainder, search rounds and item counts together, and close the
  residual on the between-rounds rest rather than on reps.
- Add audio: three cues, on a preloaded media element unlocked by the Start tap.
- Rest counts up past zero rather than vanishing.
- Runner gains Previous, Skip, and +30s. Pause moves to the thumb zone. Exit
  splits into "Leave for now" and "End here", and "End here" writes a partial
  history record.
- The no-image card collapses the slot and promotes the cues instead of reserving
  empty space above them.
- Warn on Preview when the kit resolves fewer than three distinct weights, and
  when the filtered pool cannot cover a requested pattern.
- Lead the Preview with one line: the bells to fetch.
- Replace the streak ring with seven dots for the last seven days.
- Drop the unimplemented "match the day's patterns" rule from warm-up selection.
- Restate the adjacency invariant honestly: no two adjacent share a primary
  pattern *whenever the selected set admits such an ordering*.

## Changes to the plan

- A `typecheck` script, and `npm run typecheck && npm test` as the verification
  step in every task.
- Engine invariants tested against a small synthetic fixture database built to
  exercise the engine, with the real database asserted against the same
  invariants in a separate later task. The previous arrangement made a thin
  database fail the engine tests, and the stated remedy was to change the
  database until the test went green. That is how you get a database shaped by a
  test rather than by kettlebell programming.
- Task 3 split into main exercises, ancillary moves and combos.
- Task 16 split into the presentational cards and the runner state machine.
- Media moves before the runner, so the card is built against real assets.
- `orderCircuit` replaced with a largest-remaining-group greedy, which is complete
  when a valid ordering exists.
- A shared `tests/fixtures.ts`, replacing four drifting copies.
- The sweep cut from roughly 9,600 generations to a chosen matrix plus one
  property test, using `it.each` so a failure names itself.
- The 4×4 slicer replaced with the self-detecting version, and a test asserting
  every tile maps to a real exercise.
- `impeccable` runs against the runner with a seeded active workout, or the most
  important screen in the app never gets audited.
