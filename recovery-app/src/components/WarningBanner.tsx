import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SEVERITY_COLORS } from '@/constants';

interface WarningBannerProps {
  title: string;
  message: string;
  severity?: 'low' | 'medium' | 'high' | 'info';
}

export function WarningBanner({
  title,
  message,
  severity = 'medium',
}: WarningBannerProps) {
  const iconName =
    severity === 'high'
      ? 'alert-circle'
      : severity === 'medium'
      ? 'warning'
      : severity === 'low'
      ? 'information-circle'
      : 'information-circle-outline';

  const color =
    severity === 'info'
      ? COLORS.primary
      : SEVERITY_COLORS[severity];

  return (
    <View style={[styles.container, { borderLeftColor: color }]}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={iconName} size={24} color={color} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color }]}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
