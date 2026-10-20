import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { ChannelList } from '../../src/components/ChannelList';
import { Button, EmptyState, Screen } from '../../src/components/ui';
import { channelId, parseM3U, type Channel } from '../../src/lib/m3u';
import { fetchPlaylist } from '../../src/state/channels';
import { prefs, usePrefs } from '../../src/state/prefs';
import { radius, spacing, TOUCH, type, useTheme } from '../../src/theme';

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);

export default function MyLinks() {
  const { colors } = useTheme();
  const custom = usePrefs((s) => s.custom);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const error = useMemo(() => (url && !isUrl(url.trim()) ? 'Enter a full link starting with http:// or https://' : null), [url]);

  const inputStyle = [type.body, { minHeight: TOUCH, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }];

  async function add() {
    const link = url.trim();
    if (!isUrl(link)) return setMsg({ ok: false, text: 'Please enter a valid http(s) link.' });
    setBusy(true);
    setMsg(null);
    try {
      // A playlist (.m3u/.m3u8 with #EXTINF entries) adds many channels; anything else is a single stream.
      const looksLikePlaylist = /\.m3u8?(\?|$)/i.test(link) || /get\.php|playlist/i.test(link);
      let channels: Channel[] = [];
      if (looksLikePlaylist) {
        try {
          const text = await (await fetch(link)).text();
          if (text.includes('#EXTINF') && !text.includes('#EXT-X-')) channels = parseM3U(text, 'XX');
        } catch {
          /* fall through: treat as a single stream (the browser may block reading it, but playback can still work) */
        }
      }
      if (channels.length) {
        prefs.addCustom(channels);
        prefs.addPlaylist(link);
        setMsg({ ok: true, text: `Added ${channels.length} channels from the playlist.` });
      } else {
        prefs.addCustom([{ id: channelId(link), name: name.trim() || link.replace(/^https?:\/\//, '').split(/[/?]/)[0], url: link, country: 'XX', quality: 0 }]);
        setMsg({ ok: true, text: 'Stream added.' });
      }
      setUrl('');
      setName('');
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
      <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">My Links</Text>
      <Text style={[type.body, { color: colors.textMuted }]}>Add your own stream link (.m3u8) or a whole M3U playlist URL.</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Channel name (optional)" placeholderTextColor={colors.textMuted} accessibilityLabel="Channel name" style={inputStyle} />
      <TextInput
        value={url}
        onChangeText={(t) => { setUrl(t); setMsg(null); }}
        placeholder="https://example.com/stream.m3u8"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Stream or playlist link"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="done"
        onSubmitEditing={add}
        style={[inputStyle, !!error && { borderColor: colors.danger }]}
      />
      {!!error && <Text style={[type.caption, { color: colors.danger }]} accessibilityRole="alert">{error}</Text>}
      {!!msg && <Text style={[type.caption, { color: msg.ok ? colors.success : colors.danger }]} accessibilityRole="alert">{msg.text}</Text>}
      <Button label={busy ? 'Adding…' : 'Add link'} icon="add-circle-outline" onPress={add} disabled={busy || !url.trim() || !!error} />
      {custom.length > 0 && <Text style={[type.h2, { color: colors.text, marginTop: spacing.md }]}>Your channels ({custom.length})</Text>}
    </View>
  );

  return (
    <Screen maxWidth={900}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ChannelList
          data={custom}
          header={header}
          onRemove={prefs.removeCustom}
          empty={<EmptyState icon="link-outline" title="No custom links yet" message="Paste a stream URL above. It will be saved on this device and can be favorited like any channel." />}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
