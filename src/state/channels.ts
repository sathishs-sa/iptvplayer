import { useMemo } from 'react';
import { createStore } from './store';
import { usePrefs } from './prefs';
import { parseM3U, dedupe, channelId, type Channel } from '../lib/m3u';
import rows from '../../assets/data/channels.json';
import extraRows from '../../assets/data/extra.json';

/** Bundled snapshot: Tamil + English channels from the iptv-org language playlists. */
type Row = [string, string, string, string, number, string | 0, string | 0, string | 0, string | 0, string];
const bundled: Channel[] = (rows as unknown as Row[]).map(
  ([id, name, url, country, quality, ua, ref, group, logo, lang]) => ({
    id, name, url, country, quality,
    userAgent: ua || undefined,
    referrer: ref || undefined,
    group: group || undefined,
    logo: logo || undefined,
    lang: lang.split(',').filter(Boolean) as Channel['lang'],
  }),
);

/** Hand-maintained channels (assets/data/extra.json) that must survive a live refresh. */
const extra: Channel[] = (extraRows as Omit<Channel, 'id'>[]).map((e) => ({ ...e, id: channelId(e.url) }));

const BASE = 'https://iptv-org.github.io/iptv/languages';
export const LIVE_URLS = { ta: `${BASE}/tam.m3u`, en: `${BASE}/eng.m3u` } as const;
export const LIVE_INDEX_URL = `${BASE}/tam.m3u + eng.m3u`;

type S = { live: Channel[]; fetched: Channel[]; status: 'idle' | 'loading' | 'error'; error?: string; updatedAt?: number };
const store = createStore<S>({ live: [], fetched: [], status: 'idle' });

export async function fetchPlaylist(url: string, defaultCountry = 'XX'): Promise<Channel[]> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const list = parseM3U(await res.text(), defaultCountry);
    if (!list.length) throw new Error('No channels found in that playlist');
    return list;
  } finally {
    clearTimeout(t);
  }
}

/** Refresh the official live index (adds categories + logos) and the user's playlist URLs. */
export async function refreshChannels(extraUrls: string[]) {
  store.set({ status: 'loading', error: undefined });
  try {
    const [ta, en, ...extra] = await Promise.all([
      fetchPlaylist(LIVE_URLS.ta),
      fetchPlaylist(LIVE_URLS.en),
      ...extraUrls.map((u) => fetchPlaylist(u).catch(() => [] as Channel[])),
    ]);
    const merged = new Map<string, Channel>();
    for (const [list, lang] of [[ta, 'ta'], [en, 'en']] as const) {
      for (const c of list) {
        const have = merged.get(c.id);
        if (have) have.lang = [...new Set([...(have.lang ?? []), lang])];
        else merged.set(c.id, { ...c, lang: [lang] });
      }
    }
    store.set({ live: [...merged.values()], fetched: extra.flat(), status: 'idle', updatedAt: Date.now() });
  } catch (e) {
    store.set({ status: 'error', error: e instanceof Error ? e.message : 'Network error' });
  }
}

/** Select primitives separately: a selector must return a stable value, or useSyncExternalStore re-renders forever. */
export function useChannelStatus() {
  const status = store.use((s) => s.status);
  const error = store.use((s) => s.error);
  const updatedAt = store.use((s) => s.updatedAt);
  const liveCount = store.use((s) => s.live.length);
  return { status, error, updatedAt, liveCount };
}

/** All channels: the fresh live list replaces the bundled snapshot once loaded; the user's own links come first. */
export function useChannels(): Channel[] {
  const live = store.use((s) => s.live);
  const fetched = store.use((s) => s.fetched);
  const custom = usePrefs((s) => s.custom);
  return useMemo(() => {
    return dedupe([...custom, ...extra, ...(live.length ? live : bundled), ...fetched]);
  }, [live, fetched, custom]);
}

export function useChannel(id: string | undefined): Channel | undefined {
  const all = useChannels();
  return useMemo(() => all.find((c) => c.id === id), [all, id]);
}

export function countryName(code: string): string {
  if (code === 'XX') return 'Unsorted';
  if (code === 'INT') return 'International';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
export function flag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX') return '🌐';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
