/**
 * The one place in `src/lib` that reads the clock, and the reason every other
 * module in here can be tested by passing a fixed string in.
 *
 * `generate` takes `now` and `seed` as arguments precisely so the engine has no
 * hidden inputs. Nothing else in `src/lib` may call this: a screen reads the
 * clock at the moment of the tap and hands the values down.
 *
 * It lives outside any component body on purpose. Next 16's React Compiler
 * ruleset rejects `Date.now()` written inside one, whether or not it is only
 * ever reached from an event handler:
 *
 *   error  Cannot call impure function during render  react-hooks/purity
 *
 * That rule is right about render and wrong about a click, and the fix it wants
 * is this: keep the impure read in a plain function the component calls.
 *
 * Both values come off ONE reading, so the seed and the timestamp stamped on a
 * workout always agree about when it was built.
 */
export interface Tick {
  /** Epoch milliseconds, used as the generator's seed. */
  seed: number;
  /** The same instant as an ISO string, used as the workout's createdAt. */
  now: string;
}

export const tick = (): Tick => {
  const at = new Date();
  return { seed: at.getTime(), now: at.toISOString() };
};

/**
 * Epoch milliseconds, on its own.
 *
 * The runner needs the raw number rather than a `Tick`: it stamps an absolute
 * deadline on a rest (`restEndsAt`) and measures worked time from the gap
 * between two readings, and neither wants an ISO string built alongside.
 *
 * It lives here for the reason the whole file exists. `Date.now()` written in a
 * component body is rejected outright:
 *
 *   error  Cannot call impure function during render  react-hooks/purity
 *
 * Called from here it is a plain function the component may call - from an
 * event handler, an effect, a timer callback, or a lazy `useState` initialiser.
 * Every screen that needs the clock reads it through this, so there is still
 * exactly one line in the app that asks the machine what time it is.
 */
export const nowMs = (): number => Date.now();

/**
 * Seconds as `m:ss`, which is the only shape a duration is ever shown in.
 *
 * Takes the magnitude, so the caller decides what a negative reading MEANS -
 * the rest screen says "Over by 0:24" rather than "-0:24", because the number
 * he actually wants at that moment is how long he has been resting, not a
 * signed distance from a deadline he has already passed.
 */
export function mmss(seconds: number): string {
  const whole = Math.abs(Math.trunc(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
