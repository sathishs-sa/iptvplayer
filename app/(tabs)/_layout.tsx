import React from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';

type Icon = keyof typeof Ionicons.glyphMap;
const tab = (title: string, active: Icon, inactive: Icon) => ({
  title,
  tabBarIcon: ({ color, focused, size }: { color: any; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color as string} />
  ),
});

export default function TabsLayout() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900; // desktop / large tablet: sidebar navigation
  // Android TV boots straight into the remote-control TV experience
  if (Platform.isTV) return <Redirect href="/tv" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uniform',
        tabBarLabelPosition: wide ? 'below-icon' : undefined,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderColor: colors.border, ...(Platform.OS === 'web' && wide ? { width: 96 } : null) },
        sceneStyle: { backgroundColor: colors.bg },
      } as any}
    >
      <Tabs.Screen name="index" options={tab('Browse', 'tv', 'tv-outline')} />
      <Tabs.Screen name="favorites" options={tab('Favorites', 'heart', 'heart-outline')} />
      <Tabs.Screen name="links" options={tab('My Links', 'link', 'link-outline')} />
      <Tabs.Screen name="settings" options={tab('Settings', 'settings', 'settings-outline')} />
    </Tabs>
  );
}
