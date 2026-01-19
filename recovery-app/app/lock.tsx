import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/constants';

export default function LockScreen() {
  const router = useRouter();
  const {
    passcodeEnabled,
    biometricsEnabled,
    biometricsAvailable,
    authenticate,
    authenticateWithPasscode,
  } = useAuth();

  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const MAX_ATTEMPTS = 5;

  useEffect(() => {
    // Try biometrics on mount
    if (biometricsEnabled) {
      handleBiometricAuth();
    }
  }, [biometricsEnabled]);

  const handleBiometricAuth = async () => {
    const result = await authenticate();
    if (result.success) {
      router.replace('/(tabs)');
    }
  };

  const handlePasscodeInput = (digit: string) => {
    if (attempts >= MAX_ATTEMPTS) {
      Alert.alert('Too Many Attempts', 'Please wait and try again later.');
      return;
    }

    const newPasscode = passcode + digit;
    setPasscode(newPasscode);
    setError('');

    if (newPasscode.length >= 4) {
      verifyPasscode(newPasscode);
    }
  };

  const handleBackspace = () => {
    setPasscode(passcode.slice(0, -1));
    setError('');
  };

  const verifyPasscode = async (code: string) => {
    const result = await authenticateWithPasscode(code);
    if (result.success) {
      router.replace('/(tabs)');
    } else {
      setPasscode('');
      setAttempts(attempts + 1);
      setError(`Invalid passcode. ${MAX_ATTEMPTS - attempts - 1} attempts remaining.`);
    }
  };

  const renderPasscodeDots = () => {
    const dots = [];
    for (let i = 0; i < 4; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.dot,
            i < passcode.length && styles.dotFilled,
          ]}
        />
      );
    }
    return dots;
  };

  const renderKeypad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      [biometricsAvailable ? 'bio' : '', '0', 'del'],
    ];

    return keys.map((row, rowIndex) => (
      <View key={rowIndex} style={styles.keypadRow}>
        {row.map((key, keyIndex) => {
          if (key === '') {
            return <View key={keyIndex} style={styles.keyEmpty} />;
          }

          if (key === 'bio') {
            return (
              <TouchableOpacity
                key={keyIndex}
                style={styles.keySpecial}
                onPress={handleBiometricAuth}
              >
                <Ionicons name="finger-print" size={28} color={COLORS.primary} />
              </TouchableOpacity>
            );
          }

          if (key === 'del') {
            return (
              <TouchableOpacity
                key={keyIndex}
                style={styles.keySpecial}
                onPress={handleBackspace}
              >
                <Ionicons name="backspace-outline" size={28} color={COLORS.text} />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={keyIndex}
              style={styles.key}
              onPress={() => handlePasscodeInput(key)}
            >
              <Text style={styles.keyText}>{key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="lock-closed" size={48} color={COLORS.primary} />
        <Text style={styles.title}>Enter Passcode</Text>
        <Text style={styles.subtitle}>
          {biometricsEnabled
            ? 'Use passcode or biometrics to unlock'
            : 'Enter your 4-digit passcode'}
        </Text>
      </View>

      <View style={styles.dotsContainer}>{renderPasscodeDots()}</View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.keypad}>{renderKeypad()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.border,
  },
  dotFilled: {
    backgroundColor: COLORS.primary,
  },
  error: {
    color: COLORS.danger,
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  keypad: {
    width: '100%',
    maxWidth: 300,
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '500',
    color: COLORS.text,
  },
  keySpecial: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyEmpty: {
    width: 72,
    height: 72,
  },
});
