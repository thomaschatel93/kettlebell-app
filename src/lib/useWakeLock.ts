'use client';

import { useEffect, useRef } from 'react';

/**
 * Holds the screen on for the workout.
 *
 * The phone is on the floor a metre away and nobody is going to touch it
 * between a swing and a squat, so without this the screen dims and locks
 * halfway through the first round and the whole screen is useless.
 *
 * Safari supports this from 16.4. Where it is unavailable the app carries on
 * and says nothing: there is no fallback worth having, and a warning about a
 * browser API is not something to put in front of someone mid-set.
 *
 * The browser releases the lock whenever the document hides - a call, a
 * notification, a switch to the music app - and does NOT hand it back on the
 * way in, so it is retaken on every `visibilitychange`.
 */
export function useWakeLock(active: boolean): void {
  const lock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let cancelled = false;

    const request = async (): Promise<void> => {
      // Requesting while hidden throws, so the visibility check is part of the
      // request rather than a nicety.
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        lock.current = await navigator.wakeLock.request('screen');
      } catch {
        // Denied, or released between the check and the call. Nothing to say.
      }
    };

    void request();
    document.addEventListener('visibilitychange', request);

    return () => {
      // `cancelled` matters because `request` is async: an effect that is torn
      // down while the promise is in flight would otherwise store a sentinel
      // nothing will ever release.
      cancelled = true;
      document.removeEventListener('visibilitychange', request);
      void lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [active]);
}
