import { useEffect, useRef } from 'react';
import type { RemoteHandler, RemoteKey } from './remote';
export type { RemoteHandler, RemoteKey } from './remote';

// Desktop-browser stand-in for the TV remote, so the TV screen can be tried at /tv with a keyboard.
const MAP: Record<string, RemoteKey> = {
  PageUp: 'channelUp', PageDown: 'channelDown', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  i: 'info', g: 'guide', l: 'last',
};

export function useRemoteKeys(handler: RemoteHandler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      const key = (/^[0-9]$/.test(e.key) ? e.key : MAP[e.key]) as RemoteKey | undefined;
      if (!key) return;
      if (key === 'channelUp' || key === 'channelDown') e.preventDefault();
      ref.current(key, e.repeat ? 1 : 0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Escape / Backspace act as the remote's Back button. */
export function useBackKey(handler: () => boolean) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') ref.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
