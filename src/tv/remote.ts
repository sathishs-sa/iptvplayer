import { useEffect, useRef } from 'react';
import { BackHandler, DeviceEventEmitter } from 'react-native';

/** Keys forwarded by MainActivity (see plugins/withAndroidTV.js). */
export type RemoteKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'channelUp' | 'channelDown' | 'last' | 'info' | 'guide'
  | 'up' | 'down' | 'left' | 'right';

export type RemoteHandler = (key: RemoteKey, repeat: number) => void;

/** Subscribe to TV remote keys. The handler may change every render; it is always called with the latest one. */
export function useRemoteKeys(handler: RemoteHandler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('tvRemoteKey', (e: { key: RemoteKey; repeat?: number }) => ref.current(e.key, e.repeat ?? 0));
    return () => sub.remove();
  }, []);
}

/** Remote "Back" button. Return true from the handler to consume it. */
export function useBackKey(handler: () => boolean) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => ref.current());
    return () => sub.remove();
  }, []);
}
