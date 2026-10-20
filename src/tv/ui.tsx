import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

/** 10-foot UI palette (always dark: it sits on top of video). */
export const tv = {
  bg: 'rgba(8,10,18,0.94)', panel: '#151824', row: '#1D2131', focus: '#4F46E5', text: '#F2F4FA', muted: '#A4ABC2',
  accent: '#8B85FF', danger: '#FF8A80', ok: '#5BD69A',
  /** keep content inside the TV "safe area" (overscan) */
  safe: 48,
};

/** A focusable control with a clearly visible focus state, usable with a D-pad. */
export function Focusable({
  children, onPress, style, focusedStyle, autoFocus, label,
}: {
  children: React.ReactNode | ((focused: boolean) => React.ReactNode); onPress?: () => void;
  style?: StyleProp<ViewStyle>; focusedStyle?: StyleProp<ViewStyle>; autoFocus?: boolean; label: string;
}) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<any>(null);
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => ref.current?.focus?.(), 120);
    return () => clearTimeout(t);
  }, [autoFocus]);
  return (
    <Pressable
      ref={ref}
      focusable
      accessibilityRole="button"
      accessibilityLabel={label}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[s.base, style, focused && [s.focused, focusedStyle]]}
    >
      {typeof children === 'function' ? children(focused) : children}
    </Pressable>
  );
}

export const T = {
  title: { color: tv.text, fontSize: 34, fontWeight: '700' as const },
  body: { color: tv.text, fontSize: 24, fontWeight: '600' as const },
  small: { color: tv.muted, fontSize: 20, fontWeight: '500' as const },
};

const s = StyleSheet.create({
  base: { borderRadius: 12, borderWidth: 3, borderColor: 'transparent' },
  focused: { borderColor: '#FFFFFF', backgroundColor: tv.focus, transform: [{ scale: 1.03 }] },
});
export const styles = s;
export function TText({ style, ...p }: React.ComponentProps<typeof Text>) {
  return <Text {...p} style={style} />;
}
