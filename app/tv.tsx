import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Player, type PlayerState } from '../src/components/Player';
import { buildDefaultLineup, useLineup } from '../src/lib/lineup';
import { useSafeKeepAwake } from '../src/lib/useSafeKeepAwake';
import type { Channel } from '../src/lib/m3u';
import { countryName, useChannels } from '../src/state/channels';
import { prefs, usePrefs } from '../src/state/prefs';
import { Guide } from '../src/tv/Guide';
import { useBackKey, useRemoteKeys, type RemoteKey } from '../src/tv/remote';
import { Focusable, tv } from '../src/tv/ui';

const ENTRY_TIMEOUT_MS = 1800; // like a real TV: wait for more digits
const OSD_MS = 4500;
const LOADING_TIMEOUT_MS = 20000; // a stream that never starts counts as failed
const norm = (n: string) => n.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export default function TvScreen() {
  const all = useChannels();
  const lineup = useLineup();
  const hydrated = usePrefs((s) => s.hydrated);
  const seeded = usePrefs((s) => s.lineupSeeded);
  const lastTv = usePrefs((s) => s.lastTv);

  // first launch: build the default numbered lineup (1 = Sun TV, 2 = Vijay, ...)
  useEffect(() => {
    if (hydrated && !seeded && all.length) prefs.setLineup(buildDefaultLineup(all));
  }, [hydrated, seeded, all]);

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [override, setOverride] = useState<Channel | null>(null); // backup source in use
  const [tried, setTried] = useState<string[]>([]);
  const [state, setState] = useState<PlayerState>({ state: 'loading' });
  const [entry, setEntry] = useState('');
  const [guide, setGuide] = useState(false);
  const [osd, setOsd] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [exitArmed, setExitArmed] = useState(false);

  // pick the initial channel once data is ready: last watched, else channel 1
  useEffect(() => {
    if (currentId || !hydrated || !all.length) return;
    const last = lastTv && all.find((c) => c.id === lastTv);
    const first = last || lineup[0];
    if (first) setCurrentId(first.id);
  }, [currentId, hydrated, all, lineup, lastTv]);

  const current = useMemo(() => all.find((c) => c.id === currentId) ?? null, [all, currentId]);
  const playing = override ?? current;
  const number = current ? lineup.findIndex((c) => c.id === current.id) + 1 : 0; // 0 = not in lineup

  // other sources for the same channel (automatic failover)
  const alternates = useMemo(() => {
    if (!current) return [];
    return all.filter((c) => c.id !== current.id && ((current.tvgId && c.tvgId === current.tvgId) || (norm(c.name) === norm(current.name) && c.country === current.country)));
  }, [all, current]);

  useSafeKeepAwake('tv-playback', !!playing);

  // ---- timers -------------------------------------------------------------------------------
  const osdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const entryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => { [osdTimer, toastTimer, entryTimer, exitTimer].forEach((t) => clearTimeout(t.current)); }, []);

  const showOsd = useCallback(() => {
    setOsd(true);
    clearTimeout(osdTimer.current);
    osdTimer.current = setTimeout(() => setOsd(false), OSD_MS);
  }, []);
  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // ---- tuning ---------------------------------------------------------------------------------
  const prevId = useRef<string | null>(null);
  const tuneTo = useCallback((c: Channel) => {
    setCurrentId((cur) => {
      if (cur && cur !== c.id) prevId.current = cur;
      return c.id;
    });
    setOverride(null);
    setTried([]);
    setRetry(0);
    setState({ state: 'loading' });
    setGuide(false);
    prefs.setLastTv(c.id);
    showOsd();
  }, [showOsd]);

  const tuneNumber = useCallback((n: number) => {
    const c = lineup[n - 1];
    if (!c) return flash(`Channel ${n} is not available`);
    tuneTo(c);
  }, [lineup, tuneTo, flash]);

  const step = useCallback((dir: 1 | -1) => {
    if (!lineup.length) return flash('Your lineup is empty');
    const i = current ? lineup.findIndex((c) => c.id === current.id) : -1;
    const next = i < 0 ? (dir === 1 ? 0 : lineup.length - 1) : (i + dir + lineup.length) % lineup.length;
    tuneTo(lineup[next]);
  }, [lineup, current, tuneTo, flash]);

  const commitEntry = useCallback((value: string) => {
    clearTimeout(entryTimer.current);
    setEntry('');
    const n = parseInt(value, 10);
    if (n > 0) tuneNumber(n);
  }, [tuneNumber]);

  const onDigit = useCallback((d: string) => {
    const next = (entry + d).slice(0, 4);
    if (next === '0') { // a lone 0 recalls the previous channel
      const p = prevId.current && all.find((c) => c.id === prevId.current);
      return p ? tuneTo(p) : flash('No previous channel');
    }
    setEntry(next);
    clearTimeout(entryTimer.current);
    // no longer number can exist (e.g. 3 typed with 9 channels) -> tune right away
    const immediate = parseInt(next, 10) * 10 > lineup.length;
    entryTimer.current = setTimeout(() => commitEntry(next), immediate ? 250 : ENTRY_TIMEOUT_MS);
  }, [entry, all, lineup.length, tuneTo, flash, commitEntry]);

  // ---- remote ---------------------------------------------------------------------------------
  const lastStep = useRef(0);
  useRemoteKeys((key: RemoteKey, repeat) => {
    if (/^[0-9]$/.test(key)) { if (!repeat) onDigit(key); return; }
    if (key === 'channelUp' || key === 'channelDown') {
      const now = Date.now();
      if (now - lastStep.current < 300) return; // throttle held keys
      lastStep.current = now;
      return step(key === 'channelUp' ? 1 : -1);
    }
    if (key === 'last') { const p = prevId.current && all.find((c) => c.id === prevId.current); return p ? tuneTo(p) : undefined; }
    if (key === 'guide') return setGuide((g) => !g);
    if (key === 'info') return showOsd();
    if (guide) return; // D-pad belongs to the guide's focus navigation
    if (repeat) return;
    if (key === 'up') step(1);        // D-pad up/down zap like channel +/-
    else if (key === 'down') step(-1);
    else if (key === 'left') setGuide(true);
    else if (key === 'right') showOsd();
  });

  useBackKey(() => {
    if (entry) { clearTimeout(entryTimer.current); setEntry(''); return true; }
    if (guide) { setGuide(false); return true; }
    if (!exitArmed) { // press Back twice to leave
      setExitArmed(true);
      flash('Press Back again to exit');
      clearTimeout(exitTimer.current);
      exitTimer.current = setTimeout(() => setExitArmed(false), 2500);
      return true;
    }
    if (Platform.OS === 'android') BackHandler.exitApp();
    return true;
  });

  // keep one focusable "catcher" focused while watching so OK opens the guide
  const catcherKey = guide ? 'off' : 'on';

  // ---- failover -------------------------------------------------------------------------------
  const failover = useCallback(() => {
    const next = alternates.find((c) => !tried.includes(c.id));
    if (next) {
      setTried((t) => [...t, next.id]);
      setOverride(next);
      setState({ state: 'loading' });
      flash(`Source unavailable, trying backup ${tried.length + 1}/${alternates.length}`);
    } else {
      setState({ state: 'error', message: 'No signal' });
    }
  }, [alternates, tried, flash]);

  useEffect(() => {
    if (state.state === 'error' && state.message !== 'No signal') failover();
  }, [state, failover]);
  useEffect(() => {
    if (state.state !== 'loading' || !playing) return;
    const t = setTimeout(() => setState({ state: 'error', message: 'Stream timed out' }), LOADING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [state.state, playing?.id, retry]);

  const onState = useCallback((s: PlayerState) => setState(s), []);
  const noSignal = state.state === 'error' && state.message === 'No signal';
  const okPressed = () => {
    if (entry) return commitEntry(entry);
    if (noSignal && current) { setTried([]); setOverride(null); setRetry((r) => r + 1); setState({ state: 'loading' }); return; }
    setGuide(true);
  };

  const preview = entry ? lineup[parseInt(entry, 10) - 1] : null;

  return (
    <View style={s.root}>
      <StatusBar hidden />
      {playing && <Player key={`${playing.id}-${retry}`} channel={playing} onState={onState} controls={false} />}

      {/* invisible full-screen target: OK on the remote opens the guide (or tunes the typed number) */}
      {!guide && (
        <Focusable key={catcherKey} label="Video: press OK for channel list" autoFocus onPress={okPressed} style={s.catcher} focusedStyle={s.catcherFocused}>
          <View />
        </Focusable>
      )}

      {/* buffering */}
      {state.state === 'loading' && playing && !guide && (
        <View pointerEvents="none" style={s.center}><Text style={s.bigMsg}>Loading {playing.name}…</Text></View>
      )}
      {noSignal && !guide && (
        <View pointerEvents="none" style={s.center}>
          <Text style={s.bigMsg}>No signal</Text>
          <Text style={s.subMsg}>Press OK to retry · channel +/- to change</Text>
        </View>
      )}

      {/* channel info banner */}
      {osd && playing && !guide && (
        <View pointerEvents="none" style={s.osd}>
          <Text style={s.osdNum}>{number || '–'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.osdName} numberOfLines={1}>{playing.name}</Text>
            <Text style={s.osdMeta} numberOfLines={1}>
              {countryName(playing.country)}{playing.group ? ` · ${playing.group}` : ''}{playing.quality ? ` · ${playing.quality}p` : ''}
              {override ? ` · backup source ${tried.length}/${alternates.length}` : ''}
            </Text>
          </View>
          <Text style={s.hint}>OK: channels</Text>
        </View>
      )}

      {/* typed number */}
      {!!entry && (
        <View pointerEvents="none" style={s.entry}>
          <Text style={s.entryNum}>{entry}</Text>
          <Text style={s.entryName} numberOfLines={1}>{preview ? preview.name : 'No such channel'}</Text>
        </View>
      )}

      {!!toast && (
        <View pointerEvents="none" style={s.toast}><Text style={s.toastText}>{toast}</Text></View>
      )}

      {guide && <Guide all={all} lineup={lineup} currentId={current?.id} onPlay={tuneTo} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  catcher: { ...StyleSheet.absoluteFill, borderWidth: 0, backgroundColor: 'transparent' },
  catcherFocused: { borderWidth: 0, backgroundColor: 'transparent', transform: [] },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 10 },
  bigMsg: { color: '#fff', fontSize: 40, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 8 },
  subMsg: { color: tv.muted, fontSize: 24, fontWeight: '500' },
  osd: { position: 'absolute', left: tv.safe, right: tv.safe, bottom: tv.safe, flexDirection: 'row', alignItems: 'center', gap: 24, paddingVertical: 18, paddingHorizontal: 28, borderRadius: 16, backgroundColor: 'rgba(8,10,18,0.88)' },
  osdNum: { color: tv.accent, fontSize: 56, fontWeight: '800', minWidth: 90, textAlign: 'center' },
  osdName: { color: '#fff', fontSize: 34, fontWeight: '700' },
  osdMeta: { color: tv.muted, fontSize: 22, marginTop: 2 },
  hint: { color: tv.muted, fontSize: 20 },
  entry: { position: 'absolute', top: tv.safe, right: tv.safe, minWidth: 220, alignItems: 'flex-end', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16, backgroundColor: 'rgba(8,10,18,0.88)' },
  entryNum: { color: '#fff', fontSize: 84, fontWeight: '800', letterSpacing: 6 },
  entryName: { color: tv.muted, fontSize: 26, maxWidth: 520 },
  toast: { position: 'absolute', top: tv.safe, left: tv.safe, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12, backgroundColor: 'rgba(8,10,18,0.9)' },
  toastText: { color: '#fff', fontSize: 24, fontWeight: '600' },
});
