import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Dark Red Theme
const THEME = {
  bg: '#000000',
  surface: '#0a0a0a',
  border: '#27272a',
  primary: '#dc2626',
  text: '#fafafa',
  textMuted: '#71717a',
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.textMuted,
        tabBarStyle: {
          backgroundColor: THEME.surface,
          borderTopColor: THEME.border,
          borderTopWidth: 1,
          paddingTop: 4,
          height: 85,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: THEME.bg,
        },
        headerTintColor: THEME.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'TRACE',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="risk"
        options={{
          title: 'FTA Risk',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="osint"
        options={{
          title: 'OSINT',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="audit"
        options={{
          href: null, // Hide from tab bar - accessible from Settings
        }}
      />
    </Tabs>
  );
}
