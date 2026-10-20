import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/**
 * Keeps the screen awake while `enabled`. Unlike `useKeepAwake()`, it never throws:
 * - activation may fail or be denied (unsupported browser, insecure origin, hidden tab) -> ignored
 * - leaving before activation finishes (e.g. Back during loading) -> the late lock is released as soon as it arrives
 * - a lock is released at most once, and only if it was actually acquired
 */
export function useSafeKeepAwake(tag: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let held = false;
    const release = () => {
      if (!held) return;
      held = false; // prevents duplicate deactivation
      deactivateKeepAwake(tag).catch(() => {});
    };

    activateKeepAwakeAsync(tag)
      .then(() => {
        held = true;
        if (cancelled) release(); // screen closed while activating
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      release();
    };
  }, [tag, enabled]);
}
