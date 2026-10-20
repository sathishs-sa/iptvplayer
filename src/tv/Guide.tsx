import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { Channel } from '../lib/m3u';
import { countryName } from '../state/channels';
import { prefs } from '../state/prefs';
import { Focusable, T, tv } from './ui';

type Tab = 'lineup' | 'ta' | 'en';
const ROW_H = 84;

const TABS: { id: Tab; label: string }[] = [
  { id: 'lineup', label: 'My Lineup' },
  { id: 'ta', label: 'Tamil' },
  { id: 'en', label: 'English' },
];

/** Full-height channel guide opened with OK / Left / Guide. Fully D-pad navigable. */
export function Guide({
  all, lineup, currentId, onPlay,
}: { all: Channel[]; lineup: Channel[]; currentId?: string; onPlay: (c: Channel) => void }) {
  const [tab, setTab] = useState<Tab>('lineup');
  const [category, setCategory] = useState<string | null>(null);

  const source = useMemo(() => (tab === 'lineup' ? lineup : all.filter((c) => c.lang?.includes(tab))), [tab, lineup, all]);
  const categories = useMemo(() => {
    if (tab === 'lineup') return [];
    const n = new Map<string, number>();
    source.forEach((c) => c.group && n.set(c.group, (n.get(c.group) ?? 0) + 1));
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => g);
  }, [tab, source]);
  const data = useMemo(() => (category && tab !== 'lineup' ? source.filter((c) => c.group === category) : source), [source, category, tab]);

  const startIndex = Math.max(0, data.findIndex((c) => c.id === currentId));
  const inLineup = (id: string) => lineup.findIndex((c) => c.id === id);

  return (
    <View style={s.panel} accessibilityViewIsModal>
      <Text style={T.title}>Channels</Text>
      <Text style={[T.small, { marginBottom: 14 }]}>OK to watch · Right for options · Back to close</Text>

      <View style={s.chips}>
        {TABS.map((t) => (
          <Focusable key={t.id} label={t.label} onPress={() => { setTab(t.id); setCategory(null); }} style={[s.chip, tab === t.id && s.chipOn]}>
            <Text style={s.chipText}>{t.label}</Text>
          </Focusable>
        ))}
      </View>
      {categories.length > 0 && (
        <View style={s.chips}>
          <Focusable label="All categories" onPress={() => setCategory(null)} style={[s.chip, !category && s.chipOn]}><Text style={s.chipText}>All</Text></Focusable>
          {categories.map((g) => (
            <Focusable key={g} label={g} onPress={() => setCategory(category === g ? null : g)} style={[s.chip, category === g && s.chipOn]}>
              <Text style={s.chipText}>{g}</Text>
            </Focusable>
          ))}
        </View>
      )}

      <FlatList
        key={`${tab}-${category}`}
        data={data}
        keyExtractor={(c) => c.id}
        getItemLayout={(_d, i) => ({ length: ROW_H, offset: ROW_H * i, index: i })}
        initialScrollIndex={Math.min(startIndex, Math.max(0, data.length - 1))}
        initialNumToRender={12}
        windowSize={7}
        style={{ flex: 1 }}
        ListEmptyComponent={<Text style={[T.body, { marginTop: 24 }]}>{tab === 'lineup' ? 'Your lineup is empty. Add channels from the Tamil or English tabs.' : 'No channels here.'}</Text>}
        renderItem={({ item, index }) => {
          const num = inLineup(item.id);
          return (
            <View style={s.rowWrap}>
              <Focusable
                label={`${num >= 0 ? `Channel ${num + 1}, ` : ''}${item.name}`}
                autoFocus={index === startIndex}
                onPress={() => onPlay(item)}
                style={[s.row, item.id === currentId && s.rowActive]}
              >
                <Text style={s.num}>{num >= 0 ? num + 1 : ''}</Text>
                <View style={s.logo}>{item.logo ? <Image source={{ uri: item.logo }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}</View>
                <View style={{ flex: 1 }}>
                  <Text style={T.body} numberOfLines={1}>{item.name}</Text>
                  <Text style={T.small} numberOfLines={1}>{countryName(item.country)}{item.group ? ` · ${item.group}` : ''}{item.quality ? ` · ${item.quality}p` : ''}</Text>
                </View>
              </Focusable>
              {tab === 'lineup' ? (
                <>
                  <Focusable label={`Move ${item.name} up`} onPress={() => prefs.moveInLineup(item.id, -1)} style={s.act}><Text style={s.actText}>▲</Text></Focusable>
                  <Focusable label={`Move ${item.name} down`} onPress={() => prefs.moveInLineup(item.id, 1)} style={s.act}><Text style={s.actText}>▼</Text></Focusable>
                  <Focusable label={`Remove ${item.name} from lineup`} onPress={() => prefs.removeFromLineup(item.id)} style={s.act}><Text style={[s.actText, { color: tv.danger }]}>✕</Text></Focusable>
                </>
              ) : num >= 0 ? (
                <Focusable label={`Remove ${item.name} from lineup`} onPress={() => prefs.removeFromLineup(item.id)} style={s.actWide}><Text style={[s.actText, { color: tv.ok }]}>✓ #{num + 1}</Text></Focusable>
              ) : (
                <Focusable label={`Add ${item.name} to lineup`} onPress={() => prefs.addToLineup(item.id)} style={s.actWide}><Text style={s.actText}>＋ Lineup</Text></Focusable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '62%', maxWidth: 980, backgroundColor: tv.bg, paddingTop: tv.safe, paddingLeft: tv.safe, paddingRight: 24, paddingBottom: tv.safe },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  chip: { paddingHorizontal: 22, height: 52, justifyContent: 'center', backgroundColor: tv.row },
  chipOn: { backgroundColor: '#2C3150', borderColor: tv.accent },
  chipText: { color: tv.text, fontSize: 22, fontWeight: '600' },
  rowWrap: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flex: 1, height: ROW_H - 10, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, backgroundColor: tv.row },
  rowActive: { borderColor: tv.accent },
  num: { width: 52, color: tv.accent, fontSize: 30, fontWeight: '800', textAlign: 'right' },
  logo: { width: 64, height: 44, borderRadius: 6, backgroundColor: '#272C40', overflow: 'hidden' },
  act: { width: 60, height: ROW_H - 10, alignItems: 'center', justifyContent: 'center', backgroundColor: tv.row },
  actWide: { width: 150, height: ROW_H - 10, alignItems: 'center', justifyContent: 'center', backgroundColor: tv.row },
  actText: { color: tv.text, fontSize: 22, fontWeight: '700' },
});
