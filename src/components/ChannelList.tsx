import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChannelCard } from './ChannelCard';
import { spacing } from '../theme';
import { prefs, usePrefs } from '../state/prefs';
import type { Channel } from '../lib/m3u';

const PAGE = 60;

/** Responsive, incrementally-rendered channel grid (1 column on phones, up to 3 on desktop). */
export function ChannelList({
  data, header, empty, onRemove,
}: { data: Channel[]; header?: React.ReactElement; empty?: React.ReactElement; onRemove?: (id: string) => void }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const columns = width >= 1100 ? 3 : width >= 700 ? 2 : 1;
  const favorites = usePrefs((s) => s.favorites);
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [data]);

  const open = useCallback((c: Channel) => router.push({ pathname: '/watch/[id]', params: { id: c.id } }), [router]);
  const slice = data.slice(0, limit);

  return (
    <FlatList
      key={columns}
      data={slice}
      numColumns={columns}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content}
      columnWrapperStyle={columns > 1 ? { gap: spacing.md } : undefined}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      onEndReachedThreshold={0.6}
      onEndReached={() => setLimit((l) => (l < data.length ? l + PAGE : l))}
      initialNumToRender={20}
      windowSize={9}
      renderItem={({ item }) => (
        <View style={{ flex: 1 / columns }}>
          <ChannelCard channel={item} favorite={favorites.includes(item.id)} onPress={open} onToggleFavorite={prefs.toggleFavorite} onRemove={onRemove} />
        </View>
      )}
    />
  );
}
const styles = StyleSheet.create({ content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, flexGrow: 1 } });
