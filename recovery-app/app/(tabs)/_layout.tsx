import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppLockProvider } from '@/contexts/AppLockContext';

// Dark Red Theme
const THEME = {
  bg: '#000000',
  surface: '#0a0a0a',
  border: '#27272a',
  primary: '#dc2626',
  danger: '#dc2626',
  text: '#fafafa',
  textMuted: '#71717a',
};

const ACCESS_CODES: Record<string, string> = {
  '4461': 'agent_1',
  '4070': 'agent_2',
};

export default function TabLayout() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(false);

  const handleCodePress = (digit: string) => {
    if (codeInput.length >= 4) return;
    const next = codeInput + digit;
    setCodeInput(next);
    setCodeError(false);
    if (next.length === 4) {
      const userId = ACCESS_CODES[next];
      if (userId) {
        setActiveUser(userId);
        setTimeout(() => setIsUnlocked(true), 200);
      } else {
        setCodeError(true);
        setTimeout(() => {
          setCodeInput('');
          setCodeError(false);
        }, 800);
      }
    }
  };

  const handleCodeDelete = () => {
    setCodeInput(prev => prev.slice(0, -1));
    setCodeError(false);
  };

  if (!isUnlocked || !activeUser) {
    return (
      <View style={lockStyles.container}>
        <View style={lockStyles.content}>
          <Ionicons name="shield-checkmark" size={48} color={THEME.primary} style={{ marginBottom: 16 }} />
          <Text style={lockStyles.title}>ELITE RECOVERY</Text>
          <Text style={lockStyles.subtitle}>Enter 4-digit access code</Text>

          <View style={lockStyles.dotsRow}>
            {[0, 1, 2, 3].map(i => (
              <View
                key={i}
                style={[
                  lockStyles.dot,
                  codeInput.length > i && lockStyles.dotFilled,
                  codeError && lockStyles.dotError,
                ]}
              />
            ))}
          </View>

          {codeError && <Text style={lockStyles.errorText}>Incorrect code</Text>}

          <View style={lockStyles.keypad}>
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']].map((row, ri) => (
              <View key={ri} style={lockStyles.keyRow}>
                {row.map((key, ki) => {
                  if (key === '') return <View key={ki} style={lockStyles.keyBlank} />;
                  if (key === 'del') {
                    return (
                      <TouchableOpacity key={ki} style={lockStyles.key} onPress={handleCodeDelete}>
                        <Ionicons name="backspace-outline" size={24} color={THEME.text} />
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity key={ki} style={lockStyles.key} onPress={() => handleCodePress(key)}>
                      <Text style={lockStyles.keyText}>{key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <AppLockProvider activeUser={activeUser}>
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
              <Ionicons name="locate" size={size} color={color} />
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
            href: null,
          }}
        />
      </Tabs>
    </AppLockProvider>
  );
}

const lockStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: 2,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.textMuted,
    marginBottom: 32,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 12,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: THEME.textMuted,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  dotError: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
  },
  keypad: {
    marginTop: 20,
    gap: 12,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBlank: {
    width: 72,
    height: 72,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fafafa',
  },
});
