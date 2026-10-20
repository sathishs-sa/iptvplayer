import { useMemo } from 'react';
import type { Channel } from './m3u';
import { useChannels } from '../state/channels';
import { usePrefs } from '../state/prefs';

/** Default lineup, in remote-control order (1 = first entry). Missing channels are skipped. */
const SEED: RegExp[] = [
  /^sun tv( hd)?$/i,
  /^star vijay/i,
  /^zee tamil( hd)?$/i,
  /^colors tamil/i,
  /^raj tv/i,
  /^kalaignar tv/i,
  /^polimer tv/i,
  /^thanthi tv/i,
  /^puthiya thalaimurai/i,
  /^news ?7 tamil/i,
  /^jaya plus/i,
  /^cnn international$/i,
  /^bbc news/i,
  /^al jazeera english/i,
  /^dw english/i,
  /^france 24 english/i,
  /^cna international/i,
  /^red bull tv$/i,
];

/** Best working-looking candidate: https first, then resolution, then shortest name. */
function best(all: Channel[], re: RegExp): Channel | undefined {
  return all
    .filter((c) => re.test(c.name) && !/geo-blocked|not 24\/7/i.test(c.name) && !/\.mpd(\?|$)/i.test(c.url))
    .sort((a, b) => Number(b.url.startsWith('https')) - Number(a.url.startsWith('https')) || b.quality - a.quality || a.name.length - b.name.length)[0];
}

export function buildDefaultLineup(all: Channel[]): string[] {
  const out: string[] = [];
  for (const re of SEED) {
    const c = best(all, re);
    if (c && !out.includes(c.id)) out.push(c.id);
  }
  return out;
}

/** The user's numbered lineup resolved to channels (position + 1 = channel number). */
export function useLineup(): Channel[] {
  const all = useChannels();
  const ids = usePrefs((s) => s.lineup);
  return useMemo(() => {
    const byId = new Map(all.map((c) => [c.id, c]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as Channel[];
  }, [all, ids]);
}
