import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { radius, spacing, TOUCH, type, useTheme } from '../theme';
import { countryName, flag } from '../state/channels';
import type { Channel } from '../lib/m3u';

function qualityLabel(q: number) {
  return q >= 2160 ? '4K' : q >= 1080 ? 'FHD' : q >= 720 ? 'HD' : q > 0 ? 'SD' : '';
}

export const ChannelCard = memo(function ChannelCard({
  channel, favorite, onPress, onToggleFavorite, onRemove,
}: {
  channel: Channel; favorite: boolean; onPress: (c: Channel) => void;
  onToggleFavorite: (id: string) => void; onRemove?: (id: string) => void;
}) {
  const { colors } = useTheme();
  const q = qualityLabel(channel.quality);
  return (
    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Play ${channel.name}, ${countryName(channel.country)}`}
        onPress={() => onPress(channel)}
        style={({ pressed, hovered }: any) => [s.main, { backgroundColor: pressed || hovered ? colors.surfaceAlt : 'transparent' }]}
      >
        <View style={[s.logo, { backgroundColor: colors.surfaceAlt }]}>
          {channel.logo ? (
            <Image source={{ uri: channel.logo }} style={StyleSheet.absoluteFill} contentFit="contain" />
          ) : (
            <Text style={{ fontSize: 22 }}>{flag(channel.country)}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.strong, { color: colors.text }]} numberOfLines={1}>{channel.name}</Text>
          <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {flag(channel.country)} {countryName(channel.country)}{channel.group ? ` · ${channel.group}` : ''}
          </Text>
        </View>
        {!!q && (
          <View style={[s.badge, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[type.caption, { color: colors.textMuted }]}>{q}</Text>
          </View>
        )}
      </Pressable>
      {onRemove && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${channel.name}`} onPress={() => onRemove(channel.id)} style={s.icon}>
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={favorite ? `Remove ${channel.name} from favorites` : `Add ${channel.name} to favorites`}
        onPress={() => onToggleFavorite(channel.id)}
        style={s.icon}
      >
        <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={22} color={favorite ? colors.live : colors.textMuted} />
      </Pressable>
    </View>
  );
});

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', flex: 1 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: 64 },
  logo: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  icon: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
});
