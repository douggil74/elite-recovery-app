import { Stack } from 'expo-router';

// Dark theme colors
const DARK = {
  bg: '#0f1419',
  surface: '#1c2128',
  text: '#e6edf3',
  border: '#30363d',
};

export default function CaseLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: DARK.surface,
        },
        headerTintColor: DARK.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
        contentStyle: {
          backgroundColor: DARK.bg,
        },
      }}
    >
      <Stack.Screen
        name="new"
        options={{
          title: 'New Case',
          presentation: 'modal',
          headerBackTitle: 'Cancel',
        }}
      />
      <Stack.Screen
        name="[id]/index"
        options={{
          title: '',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[id]/upload"
        options={{
          title: 'Add Report',
          headerBackTitle: 'Case',
        }}
      />
      <Stack.Screen
        name="[id]/brief"
        options={{
          title: 'Recovery Brief',
          headerBackTitle: 'Case',
        }}
      />
      <Stack.Screen
        name="[id]/journey"
        options={{
          title: 'Journey Plan',
          headerBackTitle: 'Case',
        }}
      />
      <Stack.Screen
        name="[id]/export"
        options={{
          title: 'Export Brief',
          presentation: 'modal',
          headerBackTitle: 'Cancel',
        }}
      />
    </Stack>
  );
}
