import { useSyncExternalStore } from 'react';

/** Tiny dependency-free store with optional persistence. */
export function createStore<T extends object>(initial: T, persist?: { key: string; pick: (keyof T)[] }) {
  let state = initial;
  const listeners = new Set<() => void>();
  let storage: { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> } | null = null;
  try {
    storage = require('@react-native-async-storage/async-storage').default;
  } catch {
    storage = null;
  }
  const emit = () => listeners.forEach((l) => l());
  const save = () => {
    if (!persist || !storage) return;
    const data: Partial<T> = {};
    persist.pick.forEach((k) => (data[k] = state[k]));
    storage.setItem(persist.key, JSON.stringify(data)).catch(() => {});
  };
  const set = (patch: Partial<T> | ((s: T) => Partial<T>)) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    emit();
    save();
  };
  if (persist && storage) {
    storage
      .getItem(persist.key)
      .then((raw) => {
        if (raw) {
          try {
            state = { ...state, ...JSON.parse(raw), hydrated: true };
          } catch {}
        }
        state = { ...state, hydrated: true };
        emit();
      })
      .catch(() => {
        state = { ...state, hydrated: true };
        emit();
      });
  }
  function use<U>(selector: (s: T) => U): U {
    return useSyncExternalStore(
      (cb) => (listeners.add(cb), () => listeners.delete(cb)),
      () => selector(state),
      () => selector(state),
    );
  }
  return { use, set, get: () => state };
}
