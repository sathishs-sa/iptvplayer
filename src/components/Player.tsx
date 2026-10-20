import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer, type VideoSource } from 'expo-video';
import type { Channel } from '../lib/m3u';

export type PlayerState = { state: 'loading' | 'playing' | 'error'; message?: string };

/** Native (Android / iOS) player built on expo-video; honours per-channel user-agent / referrer headers. */
export function Player({ channel, onState, controls = true }: { channel: Channel; onState: (s: PlayerState) => void; controls?: boolean }) {
  const headers: Record<string, string> = {};
  if (channel.userAgent) headers['User-Agent'] = channel.userAgent;
  if (channel.referrer) headers.Referer = channel.referrer;
  const source: VideoSource = {
    uri: channel.url,
    contentType: /\.mpd(\?|$)/i.test(channel.url) ? 'dash' : /\.m3u8|\.m3u(\?|$)/i.test(channel.url) ? 'hls' : undefined,
    headers: Object.keys(headers).length ? headers : undefined,
  };
  const alive = useRef(true);
  const player = useVideoPlayer(source, (p) => {
    p.staysActiveInBackground = false;
    // live TV: start quickly, keep a modest forward buffer so zapping stays snappy but playback is smooth
    p.bufferOptions = { preferredForwardBufferDuration: 15, minBufferForPlayback: 1.5, waitsToMinimizeStalling: true };
    p.play();
  });

  useEffect(() => {
    alive.current = true;
    const emit = (s: PlayerState) => alive.current && onState(s);
    emit({ state: 'loading' });
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'readyToPlay') emit({ state: 'playing' });
      else if (status === 'error') emit({ state: 'error', message: error?.message ?? 'This stream could not be played. It may be offline or geo-blocked.' });
      else if (status === 'loading') emit({ state: 'loading' });
    });
    return () => {
      // Stop reacting first. The hook releases the native player when the screen closes (e.g. on Back),
      // so touching it afterwards can throw "shared object already released".
      alive.current = false;
      try { player.pause(); } catch {}
      try { sub.remove(); } catch {}
    };
  }, [player, onState]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls={controls}
      contentFit="contain"
      allowsPictureInPicture
      accessibilityLabel={`Video player: ${channel.name}`}
    />
  );
}
