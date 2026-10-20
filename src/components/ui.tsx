import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View, type ViewStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, TOUCH, type, useTheme } from '../theme';

export function Button({
  label, onPress, variant = 'primary', icon, disabled, style,
}: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? 'transparent' : colors.surfaceAlt;
  const fg = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'danger' && { borderWidth: 1, borderColor: colors.danger },
        hovered && { opacity: 0.9 }, style,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={fg} />}
      <Text style={[type.strong, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function SearchBar({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder: string }) {
  const { colors } = useTheme();
  return (
    <View style={[s.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={placeholder}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={[type.body, s.searchInput, { color: colors.text }, { outlineStyle: 'none' } as any]}
      />
      {!!value && (
        <Pressable accessibilityLabel="Clear search" onPress={() => onChangeText('')} hitSlop={12}>
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.chip, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }]}
    >
      <Text style={[type.caption, { color: selected ? colors.onPrimary : colors.text }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function Skeleton({ height = 64, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [o]);
  return <Animated.View style={[{ height, borderRadius: radius.md, backgroundColor: colors.skeleton, opacity: o }, style]} />;
}

export function EmptyState({ icon, title, message, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; message: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={48} color={colors.textMuted} />
      <Text style={[type.h2, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.body, { color: colors.textMuted, textAlign: 'center', maxWidth: 360 }]}>{message}</Text>
      {action}
    </View>
  );
}

export function Screen({ children, maxWidth = 1100 }: { children: React.ReactNode; maxWidth?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, width: '100%', maxWidth, alignSelf: 'center' }}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: TOUCH, paddingHorizontal: spacing.lg, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  search: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  searchInput: { flex: 1, minHeight: TOUCH },
  chip: { minHeight: 36, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, marginRight: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
});
