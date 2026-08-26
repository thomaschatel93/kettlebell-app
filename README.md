# Kettlebell

A personal workout app. Tell it which bells you have, which movement patterns you
want to train and how many minutes you have; it builds a workout and walks you
through it one exercise at a time.

Built for one person, one phone. No accounts, no server, no sync.

## How it works

Everything runs on the device. A pure, seeded rules engine turns a request plus the
exercise database into a flat list of steps; the interface walks that list and holds
no programming logic of its own. Kit profiles, history and the in-progress workout
live in `localStorage`.

The engine is deliberately not an LLM call. A rules engine can be held to hard
invariants — never prescribe a bell you do not own, never exceed the requested time
by more than ten per cent, never place two exercises sharing a movement pattern back
to back — and those invariants are tested against thousands of generated workouts.

```
src/lib/
  types.ts       every shared type
  rng.ts         seeded randomness, so a workout is reproducible from its seed
  kit.ts         your bells, and how they map to light / moderate / heavy
  pool.ts        which exercises are eligible for this request and this kit
  budget.ts      splitting the minutes into warm-up, main work and cool-down
  format.ts      circuit, complex or strength
  select.ts      choosing the exercises and the order they run in
  prescribe.ts   reps and rest, scaled by how hard you want it today
  fit.ts         the arithmetic that makes a workout land on time
  flatten.ts     turning a plan into the steps the screen walks
  generate.ts    the one public entry point
  storage.ts     the only module allowed to touch the browser
  data/          the exercise database
```

## Running it

```bash
npm install
npm run verify   # typecheck and the full test suite
npm run dev
```

## Documents

- `docs/SPEC.md` — what it does and why, decision by decision
- `docs/PLAN.md` — the implementation plan, task by task
- `docs/REVIEW.md` — the pre-implementation review that rewrote both
- `docs/image-brief.md` — the exercise illustrations, and what is still needed

## Status

The engine is complete and verified. The interface is not built yet.
