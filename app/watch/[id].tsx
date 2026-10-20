import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Share, Text, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeKeepAwake } from '../../src/lib/useSafeKeepAwake';
import { Player, type PlayerState } from '../../src/components/Player';
import { Button, EmptyState, Screen } from '../../src/components/ui';
import { countryName, flag, useChannel, useChannels } from '../../src/state/channels';
import { prefs, usePrefs } from '../../src/state/prefs';
import { radius, spacing, TOUCH, type, useTheme } from '../../src/theme';

export default function Watch() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const channel = useChannel(id);
  const hydrated = usePrefs((s) => s.hydrated);
  const favorite = usePrefs((s) => (id ? s.favorites.includes(id) : false));
  const [state, setState] = useState<PlayerState>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const all = useChannels();
  useSafeKeepAwake(`watch-${id}`, !!channel);

  // Other sources for the same channel (same guide id or name): used when this one fails.
  const alternates = React.useMemo(() => {
    if (!channel) return [];
    const norm = (n: string) => n.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    return all.filter((c) => c.id !== channel.id && ((channel.tvgId && c.tvgId === channel.tvgId) || (norm(c.name) === norm(channel.name) && c.country === channel.country)));
  }, [all, channel]);
  const tryAlternate = () => {
    if (alternates[0]) router.replace({ pathname: '/watch/[id]', params: { id: alternates[0].id } });
  };

  useEffect(() => { if (channel) prefs.pushRecent(channel.id); }, [channel?.id]);
  const onState = useCallback((s: PlayerState) => setState(s), []);
  const goBack = () => {
    try {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch {
      router.replace('/');
    }
  };

  const copy = async () => {
    if (!channel) return;
    await Clipboard.setStringAsync(channel.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (!channel) {
    return (
      <Screen>
        <EmptyState
          icon={hydrated ? 'alert-circle-outline' : 'hourglass-outline'}
          title={hydrated ? 'Channel not found' : 'Loading…'}
          message={hydrated ? 'This channel is not in your list any more.' : 'Just a moment.'}
          action={<Button label="Back to channels" onPress={goBack} />}
        />
      </Screen>
    );
  }

  const wide = width >= 900;
  const playerW = wide ? Math.min(width - spacing.xl * 2, 1100) : width;
  const playerH = Math.min(playerW * 9 / 16, height * 0.6);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, minHeight: TOUCH }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={[type.strong, { color: colors.text, flex: 1 }]} numberOfLines={1} accessibilityRole="header">{channel.name}</Text>
      </View>

      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={{ width: playerW, height: playerH, backgroundColor: '#000', borderRadius: wide ? radius.lg : 0, overflow: 'hidden' }}>
          <Player key={`${channel.id}-${attempt}`} channel={channel} onState={onState} />
          {state.state === 'loading' && (
            <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as any}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
          {state.state === 'error' && (
            <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md } as any}>
              <Ionicons name="warning-outline" size={36} color="#FFB74D" />
              <Text style={[type.body, { color: '#fff', textAlign: 'center', maxWidth: 420 }]} accessibilityRole="alert">{state.message}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button label="Retry" icon="refresh" onPress={() => { setState({ state: 'loading' }); setAttempt((a) => a + 1); }} />
                {alternates.length > 0 && <Button label={`Try another source (${alternates.length})`} variant="secondary" icon="swap-horizontal" onPress={tryAlternate} />}
              </View>
            </View>
          )}
        </View>

        <View style={{ width: playerW, padding: spacing.lg, gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={[type.title, { color: colors.text }]}>{channel.name}</Text>
            <Text style={[type.body, { color: colors.textMuted }]}>
              {flag(channel.country)} {countryName(channel.country)}{channel.quality ? ` · ${channel.quality}p` : ''}{channel.group ? ` · ${channel.group}` : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button label={favorite ? 'Favorited' : 'Favorite'} variant="secondary" icon={favorite ? 'heart' : 'heart-outline'} onPress={() => prefs.toggleFavorite(channel.id)} />
            <Button label={copied ? 'Copied!' : 'Copy link'} variant="secondary" icon="copy-outline" onPress={copy} />
            <Button label="Open in other app" variant="secondary" icon="open-outline" onPress={() => (Platform.OS === 'web' ? window.open(channel.url, '_blank', 'noopener') : Linking.openURL(channel.url).catch(() => Share.share({ message: channel.url })))} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
