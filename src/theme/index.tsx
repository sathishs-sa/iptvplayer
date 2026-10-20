import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { usePrefs } from '../state/prefs';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  strong: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
};
/** Minimum touch target (Apple HIG 44 / Material 48). */
export const TOUCH = 48;

const light = {
  bg: '#F6F7FB', surface: '#FFFFFF', surfaceAlt: '#EEF0F6', border: '#E1E4EE',
  text: '#12141C', textMuted: '#5B6275', primary: '#4F46E5', onPrimary: '#FFFFFF',
  danger: '#C62828', success: '#1B7F4B', live: '#E11D48', skeleton: '#E6E9F2',
};
const dark: typeof light = {
  bg: '#0B0D14', surface: '#151824', surfaceAlt: '#1D2131', border: '#272C40',
  text: '#F2F4FA', textMuted: '#9AA1B8', primary: '#8B85FF', onPrimary: '#0B0D14',
  danger: '#FF8A80', success: '#5BD69A', live: '#FF5C7C', skeleton: '#222639',
};
export type Colors = typeof light;
type Theme = { colors: Colors; isDark: boolean };

const Ctx = createContext<Theme>({ colors: dark, isDark: true });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const mode = usePrefs((s) => s.theme);
  const isDark = mode === 'system' ? system !== 'light' : mode === 'dark';
  const value = useMemo(() => ({ colors: isDark ? dark : light, isDark }), [isDark]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
