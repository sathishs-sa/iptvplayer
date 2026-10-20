import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Chip, Screen } from '../../src/components/ui';
import { LIVE_INDEX_URL, refreshChannels, useChannelStatus, useChannels } from '../../src/state/channels';
import { prefs, usePrefs } from '../../src/state/prefs';
import { radius, spacing, type, useTheme } from '../../src/theme';

export default function Settings() {
  const { colors } = useTheme();
  const theme = usePrefs((s) => s.theme);
  const playlists = usePrefs((s) => s.playlists);
  const { status, error, updatedAt, liveCount } = useChannelStatus();
  const total = useChannels().length;
  const Card = ({ children }: { children: React.ReactNode }) => (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>{children}</View>
  );
  return (
    <Screen maxWidth={720}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}>
        <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">Settings</Text>
        <Card>
          <Text style={[type.h2, { color: colors.text }]}>Appearance</Text>
          <View style={{ flexDirection: 'row' }}>
            {(['system', 'light', 'dark'] as const).map((t) => (
              <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} selected={theme === t} onPress={() => prefs.setTheme(t)} />
            ))}
          </View>
        </Card>
        <Card>
          <Text style={[type.h2, { color: colors.text }]}>Channel data</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>
            {total.toLocaleString()} channels available. The app ships with a built-in snapshot of the iptv-org Tamil and English playlists and can refresh from the live list to add categories and logos.
          </Text>
          {!!updatedAt && <Text style={[type.caption, { color: colors.success }]}>Live list loaded ({liveCount.toLocaleString()} channels) at {new Date(updatedAt).toLocaleTimeString()}</Text>}
          {status === 'error' && <Text style={[type.caption, { color: colors.danger }]} accessibilityRole="alert">Refresh failed: {error}. The built-in list is still available.</Text>}
          <Button label={status === 'loading' ? 'Refreshing…' : 'Refresh from live list'} icon="refresh" disabled={status === 'loading'} onPress={() => refreshChannels(playlists)} />
          <Text style={[type.caption, { color: colors.textMuted }]} selectable>{LIVE_INDEX_URL}</Text>
        </Card>
        {playlists.length > 0 && (
          <Card>
            <Text style={[type.h2, { color: colors.text }]}>Your playlists</Text>
            {playlists.map((p) => (
              <View key={p} style={{ gap: spacing.sm }}>
                <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={2} selectable>{p}</Text>
                <Button label="Remove" variant="danger" onPress={() => prefs.removePlaylist(p)} />
              </View>
            ))}
          </Card>
        )}
        <Text style={[type.caption, { color: colors.textMuted }]}>
          Streams are provided by third parties and availability varies. This app does not host any content.
        </Text>
      </ScrollView>
    </Screen>
  );
}
