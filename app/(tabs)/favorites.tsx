import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { ChannelList } from '../../src/components/ChannelList';
import { Button, EmptyState, Screen } from '../../src/components/ui';
import { useChannels } from '../../src/state/channels';
import { prefs, usePrefs } from '../../src/state/prefs';
import { spacing, type, useTheme } from '../../src/theme';

export default function Favorites() {
  const { colors } = useTheme();
  const all = useChannels();
  const favorites = usePrefs((s) => s.favorites);
  const recents = usePrefs((s) => s.recents);
  const hydrated = usePrefs((s) => s.hydrated);

  const data = useMemo(() => {
    const byId = new Map(all.map((c) => [c.id, c]));
    const fav = favorites.map((id) => byId.get(id)).filter(Boolean) as typeof all;
    const rec = recents.filter((id) => !favorites.includes(id)).map((id) => byId.get(id)).filter(Boolean) as typeof all;
    return { fav, rec };
  }, [all, favorites, recents]);
  const list = [...data.fav, ...data.rec];

  const header = (
    <View style={{ gap: spacing.xs, marginBottom: spacing.lg }}>
      <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">Favorites</Text>
      <Text style={[type.body, { color: colors.textMuted }]}>
        {data.fav.length} favorite{data.fav.length === 1 ? '' : 's'}{data.rec.length ? ` · ${data.rec.length} recently watched` : ''}
      </Text>
      {data.rec.length > 0 && <Button label="Clear recently watched" variant="secondary" icon="time-outline" onPress={prefs.clearRecents} style={{ alignSelf: 'flex-start', marginTop: spacing.sm }} />}
    </View>
  );

  return (
    <Screen>
      <ChannelList
        data={hydrated ? list : []}
        header={header}
        empty={<EmptyState icon="heart-outline" title="Nothing here yet" message="Tap the heart on any channel to keep it here. Channels you watch also show up in this list." />}
      />
    </Screen>
  );
}
