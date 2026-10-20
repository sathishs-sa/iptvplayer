import type { Channel } from './m3u';

/** Base URL of the CORS proxy. Same origin by default (served by server/server.mjs); override for `expo start --web`. */
export const PROXY_BASE: string = (process.env.EXPO_PUBLIC_PROXY_URL ?? '').replace(/\/$/, '');

export function proxyUrl(channel: Pick<Channel, 'url' | 'userAgent' | 'referrer'>): string {
  const q = new URLSearchParams({ url: channel.url });
  if (channel.userAgent) q.set('ua', channel.userAgent);
  if (channel.referrer) q.set('ref', channel.referrer);
  return `${PROXY_BASE}/proxy?${q}`;
}

let probe: Promise<boolean> | undefined;
/** True when a proxy answers at PROXY_BASE (cached for the session). */
export function hasProxy(): Promise<boolean> {
  probe ??= fetch(`${PROXY_BASE}/proxy/health`, { cache: 'no-store' })
    .then(async (r) => r.ok && (await r.text()).trim() === 'ok')
    .catch(() => false);
  return probe;
}
