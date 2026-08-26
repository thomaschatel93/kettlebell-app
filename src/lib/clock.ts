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
