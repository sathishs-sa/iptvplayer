import { createStore } from './store';
import type { Channel } from '../lib/m3u';

type Prefs = {
  hydrated: boolean;
  theme: 'system' | 'light' | 'dark';
  favorites: string[];
  recents: string[];
  /** channels the user added by pasting a stream link or playlist URL */
  custom: Channel[];
  /** playlist URLs the user added (re-fetched on refresh) */
  playlists: string[];
  /** Android TV lineup: channel ids, position + 1 = remote-control number */
  lineup: string[];
  lineupSeeded: boolean;
  /** last channel watched on TV (restored on launch) */
  lastTv: string | null;
};

const store = createStore<Prefs>(
  { hydrated: false, theme: 'system', favorites: [], recents: [], custom: [], playlists: [], lineup: [], lineupSeeded: false, lastTv: null },
  { key: 'iptv.prefs.v1', pick: ['theme', 'favorites', 'recents', 'custom', 'playlists', 'lineup', 'lineupSeeded', 'lastTv'] },
);

export const usePrefs = store.use;
export const prefs = {
  get: store.get,
  setTheme: (theme: Prefs['theme']) => store.set({ theme }),
  toggleFavorite: (id: string) =>
    store.set((s) => ({ favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [id, ...s.favorites] })),
  pushRecent: (id: string) => store.set((s) => ({ recents: [id, ...s.recents.filter((x) => x !== id)].slice(0, 30) })),
  clearRecents: () => store.set({ recents: [] }),
  addCustom: (list: Channel[]) =>
    store.set((s) => {
      const have = new Set(s.custom.map((c) => c.id));
      return { custom: [...list.filter((c) => !have.has(c.id)), ...s.custom] };
    }),
  removeCustom: (id: string) =>
    store.set((s) => ({ custom: s.custom.filter((c) => c.id !== id), favorites: s.favorites.filter((f) => f !== id) })),
  addPlaylist: (url: string) => store.set((s) => (s.playlists.includes(url) ? {} : { playlists: [...s.playlists, url] })),
  setLineup: (ids: string[]) => store.set({ lineup: ids, lineupSeeded: true }),
  addToLineup: (id: string) => store.set((s) => (s.lineup.includes(id) ? {} : { lineup: [...s.lineup, id], lineupSeeded: true })),
  removeFromLineup: (id: string) => store.set((s) => ({ lineup: s.lineup.filter((x) => x !== id), lineupSeeded: true })),
  moveInLineup: (id: string, delta: number) =>
    store.set((s) => {
      const i = s.lineup.indexOf(id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= s.lineup.length) return {};
      const next = [...s.lineup];
      [next[i], next[j]] = [next[j], next[i]];
      return { lineup: next };
    }),
  setLastTv: (id: string) => store.set({ lastTv: id }),
  removePlaylist: (url: string) => store.set((s) => ({ playlists: s.playlists.filter((p) => p !== url) })),
};
