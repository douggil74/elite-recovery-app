/**
 * Cross-platform confirmation dialog
 * Uses window.confirm on web, Alert.alert on native
 */

import { Alert, Platform } from 'react-native';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

/**
 * Show a confirmation dialog
 * Returns true if user confirmed, false if cancelled
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message,
    confirmText = 'OK',
    cancelText = 'Cancel',
  } = options;

  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      // Web: use native browser confirm
      const result = window.confirm(`${title}\n\n${message}`);
      resolve(result);
    } else {
      // Native: use React Native Alert
      Alert.alert(
        title,
        message,
        [
          {
            text: cancelText,
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: confirmText,
            style: options.destructive ? 'destructive' : 'default',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    }
  });
}

/**
 * Show a simple alert message (no confirmation needed)
 */
export function showAlert(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}
