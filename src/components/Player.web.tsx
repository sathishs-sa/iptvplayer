import React, { useEffect, useRef } from 'react';
import type { Channel } from '../lib/m3u';
import { hasProxy, proxyUrl } from '../lib/proxy';

export type PlayerState = { state: 'loading' | 'playing' | 'error'; message?: string };

type Mode = 'direct' | 'proxy';

/**
 * Web player. Tries the stream directly; if the browser blocks it (CORS, mixed content, required
 * User-Agent/Referer headers) it transparently retries through the bundled proxy (server/server.mjs).
 */
export function Player({ channel, onState, controls = true }: { channel: Channel; onState: (s: PlayerState) => void; controls?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const video: HTMLVideoElement = el;
    let cancelled = false;
    let hls: import('hls.js').default | undefined;
    const set = (s: PlayerState) => { if (!cancelled) onState(s); };
    const teardown = () => {
      try { hls?.destroy(); } catch {}
      hls = undefined;
      video.onplaying = null;
      video.onerror = null;
    };

    const url = channel.url;
    const insecure = location.protocol === 'https:' && url.startsWith('http:');
    const needsHeaders = !!(channel.userAgent || channel.referrer);

    async function start() {
      set({ state: 'loading' });
      if (/\.mpd(\?|$)/i.test(url)) {
        return set({ state: 'error', message: 'This is a DASH (.mpd) stream, which browsers cannot play here. Use the Android/iOS app, or "Open in other app" (VLC).' });
      }
      const proxyOk = await hasProxy();
      if (cancelled) return;
      const modes: Mode[] = needsHeaders || insecure ? (proxyOk ? ['proxy'] : []) : proxyOk ? ['direct', 'proxy'] : ['direct'];
      if (!modes.length) {
        return set({
          state: 'error',
          message: insecure
            ? 'This stream uses plain http, which browsers block on a secure page, and no proxy is running. Start the bundled server (npm run serve:web), or use the mobile app.'
            : 'This stream needs special request headers that browsers cannot send, and no proxy is running. Start the bundled server (npm run serve:web), or use the mobile app.',
        });
      }
      tryMode(0);

      function tryMode(i: number) {
        if (cancelled) return;
        teardown();
        const mode = modes[i];
        const src = mode === 'proxy' ? proxyUrl(channel) : url;
        const next = (reason: string) => {
          if (i + 1 < modes.length) return tryMode(i + 1);
          set({ state: 'error', message: mode === 'proxy' ? `Stream unavailable: it may be offline or geo-blocked. (${reason})` : `The browser could not play this stream. (${reason})` });
        };
        video.onplaying = () => set({ state: 'playing' });

        if (/\.(mp4|webm|ogv)(\?|$)/i.test(url)) {
          video.onerror = () => next('media error');
          video.src = src;
          video.play().catch(() => {});
          return;
        }
        import('hls.js').then(({ default: Hls }) => {
          if (cancelled) return;
          if (Hls.isSupported()) {
            hls = new Hls({ lowLatencyMode: true, manifestLoadingMaxRetry: 1, levelLoadingMaxRetry: 2, fragLoadingMaxRetry: 2 });
            let recoveries = 0;
            hls.on(Hls.Events.ERROR, (_e, data) => {
              if (!data.fatal) return;
              // try to recover from decoding hiccups a couple of times, then give up instead of looping
              if (data.type === Hls.ErrorTypes.MEDIA_ERROR && hls && recoveries++ < 2) return void hls.recoverMediaError();
              if (data.type === Hls.ErrorTypes.MEDIA_ERROR) return set({ state: 'error', message: 'Your browser cannot decode this stream\'s video format. Try the mobile app or "Open in other app".' });
              next(String(data.details));
            });
            hls.loadSource(src);
            hls.attachMedia(video);
            video.play().catch(() => {});
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari / iOS WebKit: native HLS
            video.onerror = () => next('native playback error');
            video.src = src;
            video.play().catch(() => {});
          } else {
            set({ state: 'error', message: 'Your browser does not support HLS playback.' });
          }
        }).catch(() => next('player failed to load'));
      }
    }
    start();

    return () => {
      cancelled = true; // set first so late events from teardown are ignored
      teardown();
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch {}
    };
  }, [channel.url, channel.userAgent, channel.referrer, onState]);

  return (
    <video
      ref={ref}
      controls={controls}
      autoPlay
      playsInline
      aria-label={`Video player: ${channel.name}`}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000', objectFit: 'contain' }}
    />
  );
}
