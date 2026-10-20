import React, { useDeferredValue, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChannelList } from '../../src/components/ChannelList';
import { Chip, EmptyState, Screen, SearchBar, Skeleton } from '../../src/components/ui';
import { countryName, flag, useChannels } from '../../src/state/channels';
import { spacing, type, useTheme } from '../../src/theme';

type Sort = 'az' | 'quality';
const QUALITIES = [{ label: 'Any quality', min: 0 }, { label: 'HD 720p+', min: 720 }, { label: 'FHD 1080p+', min: 1080 }];

export default function Browse() {
  const { colors } = useTheme();
  const all = useChannels();
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [minQ, setMinQ] = useState(0);
  const [lang, setLang] = useState<'ta' | 'en' | null>(null);
  const [sort, setSort] = useState<Sort>('az');
  const deferred = useDeferredValue(query);

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    all.forEach((c) => counts.set(c.country, (counts.get(c.country) ?? 0) + 1));
    return [...counts.entries()].filter(([c]) => c !== 'XX').sort((a, b) => b[1] - a[1]).slice(0, 30);
  }, [all]);
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    all.forEach((c) => c.group && counts.set(c.group, (counts.get(c.group) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([g]) => g);
  }, [all]);

  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    const alnum = (n: string) => (/^[\p{L}\p{N}]/u.test(n) ? 0 : 1);
    let list = all.filter(
      (c) =>
        (!country || c.country === country) &&
        (!group || c.group === group) &&
        // channels the user added themselves (no language tag) are always shown
        (!lang || !c.lang || c.lang.includes(lang)) &&
        c.quality >= minQ &&
        (!q || c.name.toLowerCase().includes(q) || countryName(c.country).toLowerCase().includes(q)),
    );
    if (sort === 'az') list = [...list].sort((a, b) => alnum(a.name) - alnum(b.name) || a.name.localeCompare(b.name));
    if (sort === 'quality') list = [...list].sort((a, b) => b.quality - a.quality || a.name.localeCompare(b.name));
    return list;
  }, [all, deferred, country, group, minQ, sort, lang]);

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
      <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">Live TV</Text>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search channels or countries" />
      <Row>
        <Chip label="Tamil + English" selected={!lang} onPress={() => setLang(null)} />
        <Chip label="Tamil" selected={lang === 'ta'} onPress={() => setLang(lang === 'ta' ? null : 'ta')} />
        <Chip label="English" selected={lang === 'en'} onPress={() => setLang(lang === 'en' ? null : 'en')} />
      </Row>
      <Row>
        <Chip label="All countries" selected={!country} onPress={() => setCountry(null)} />
        {countries.map(([c, n]) => (
          <Chip key={c} label={`${flag(c)} ${countryName(c)} · ${n}`} selected={country === c} onPress={() => setCountry(country === c ? null : c)} />
        ))}
      </Row>
      {groups.length > 0 && (
        <Row>
          <Chip label="All categories" selected={!group} onPress={() => setGroup(null)} />
          {groups.map((g) => <Chip key={g} label={g} selected={group === g} onPress={() => setGroup(group === g ? null : g)} />)}
        </Row>
      )}
      <Row>
        {QUALITIES.map((q) => <Chip key={q.min} label={q.label} selected={minQ === q.min} onPress={() => setMinQ(q.min)} />)}
        <Chip label={sort === 'az' ? 'Sort: A–Z' : 'Sort: Quality'} onPress={() => setSort(sort === 'az' ? 'quality' : 'az')} />
      </Row>
      <Text style={[type.caption, { color: colors.textMuted }]} accessibilityLiveRegion="polite">
        {filtered.length.toLocaleString()} channel{filtered.length === 1 ? '' : 's'}
      </Text>
    </View>
  );

  return (
    <Screen>
      {all.length === 0 ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}</View>
      ) : (
        <ChannelList
          data={filtered}
          header={header}
          empty={<EmptyState icon="tv-outline" title="No channels match" message="Try a different search, or clear the country and quality filters." />}
        />
      )}
    </Screen>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.row}>
      {children}
    </ScrollView>
  );
}
const styles = StyleSheet.create({ row: { alignItems: 'center', paddingVertical: 2 } });
